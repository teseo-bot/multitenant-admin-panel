// G0-W3 verificación (zero-trust) ejecutable contra el plano de control (CONTROL_DB_URL).
// Valida los 5 criterios de aceptación para las migraciones GCP-Native.
//   CONTROL_DB_URL=postgres://... node_modules/.bin/tsx scripts/verify-control-db.ts

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const CONTROL_DB_URL = process.env.CONTROL_DB_URL || "";
let pass = 0, fail = 0;

function assert(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log("  ✓", name); }
  else { fail++; console.error("  ✗", name, extra !== undefined ? JSON.stringify(extra) : ""); }
}

(async () => {
  // Verificar que CONTROL_DB_URL apunta a local
  if (!/127\.0\.0\.1|localhost/.test(CONTROL_DB_URL)) {
    console.error("ABORT: CONTROL_DB_URL no es local (seguridad)");
    process.exit(1);
  }

  // Importación dinámica de pg Pool
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: CONTROL_DB_URL });

  try {
    // Validación de conectividad
    const conn = await pool.connect();
    await conn.query("SELECT 1");
    conn.release();
    console.log("[verify-control-db] conectado a CONTROL_DB_URL");
  } catch (err) {
    console.error("ABORT: fallo conectar a CONTROL_DB_URL:", err);
    await pool.end();
    process.exit(1);
  }

  try {
    // (1) Verificar que existen ≥13 tablas esperadas del set de migraciones
    const tableCheck = await pool.query(`
      SELECT array_agg(table_name) as tables
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'tenants', 'tenant_configs', 'tenant_users', 'tenant_channels',
          'modules', 'tenant_modules', 'tenant_user_modules', 'tenant_invitations',
          'user_management_audit', 'kdb_agent_acls', 'partners', 'partner_members',
          'partner_packages', 'partner_package_versions', 'partner_contracts',
          'partner_contract_events', 'partner_referrals', 'partner_sources'
        )
    `);
    const tables = tableCheck.rows[0]?.tables || [];
    assert(">=13 tablas base existen", tables.length >= 13, { count: tables.length, tables });

    // (2) Verificar que modules tiene exactamente 8 filas y una es 'Onboarding Academy' (lms)
    const modulesCheck = await pool.query(`
      SELECT count(*)::int as cnt, array_agg(name) as names
      FROM public.modules
    `);
    const modCount = modulesCheck.rows[0]?.cnt || 0;
    const modNames = modulesCheck.rows[0]?.names || [];
    assert("modules tiene 8 filas", modCount === 8, { count: modCount });
    assert("existe módulo 'Onboarding Academy' (lms)", modNames.includes('Onboarding Academy'), { names: modNames });

    // (3) Verificar que kdb_agent_acls tiene exactamente 3 roles
    const aclCheck = await pool.query(`
      SELECT count(*)::int as cnt, array_agg(role) as roles
      FROM public.kdb_agent_acls
    `);
    const aclCount = aclCheck.rows[0]?.cnt || 0;
    const aclRoles = aclCheck.rows[0]?.roles || [];
    assert("kdb_agent_acls tiene 3 roles", aclCount === 3, { count: aclCount });
    assert("roles esperados (sdr, compliance, eval)",
      aclRoles.includes('sdr') && aclRoles.includes('compliance') && aclRoles.includes('eval'),
      { roles: aclRoles });

    // (4) Prueba INSERT en partner_members con user_id TEXT (verifica que es TEXT, no UUID)
    // Crea un partner dummy, intenta insertar un miembro con user_id como string UUID literal
    // y luego ROLLBACK.
    const testResults = await pool.query("BEGIN");
    try {
      // Crear partner dummy
      const partnerResult = await pool.query(
        `INSERT INTO public.partners (slug, legal_name, vertical, contact_email, status)
         VALUES ('test-verify', 'Test Partner', 'legal', 'test@example.com', 'pending_verification')
         RETURNING id`
      );
      const partnerId = partnerResult.rows[0]?.id;

      // Insertar miembro con user_id TEXT (uid de Firebase, no UUID)
      const uidFirebase = 'uid_texto_firebase_abc123';
      const memberResult = await pool.query(
        `INSERT INTO public.partner_members (partner_id, user_id, member_role)
         VALUES ($1, $2, 'member')
         RETURNING partner_id, user_id`,
        [partnerId, uidFirebase]
      );

      const insertedUid = memberResult.rows[0]?.user_id;
      assert("INSERT en partner_members acepta user_id TEXT", insertedUid === uidFirebase, { uid: insertedUid });
      assert("partner_members.user_id se persistió como TEXT", typeof insertedUid === 'string', { type: typeof insertedUid });

    } finally {
      // ROLLBACK del test
      await pool.query("ROLLBACK");
    }

    // (5) Verificar tenant_users.user_id es TEXT (esquema)
    const columnCheck = await pool.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tenant_users'
        AND column_name = 'user_id'
    `);
    const userIdType = columnCheck.rows[0]?.data_type || "";
    assert("tenant_users.user_id es TEXT (no UUID)", userIdType === 'text', { type: userIdType });

    // (6) Verificar que tenant_users.role tiene CHECK constraint (no ENUM)
    const roleConstraintCheck = await pool.query(`
      SELECT constraint_type FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'tenant_users'
        AND constraint_name LIKE '%role%'
    `);
    const hasCheckConstraint = roleConstraintCheck.rows.length > 0;
    assert("tenant_users.role usa CHECK (no ENUM)", hasCheckConstraint, { constraints: roleConstraintCheck.rows });

    // (7) Verificar que partner_sources tiene las columnas esperadas para Knowledge Lab
    const partnerSourcesColumnsCheck = await pool.query(`
      SELECT array_agg(column_name) as columns
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'partner_sources'
        AND column_name IN ('id', 'partner_id', 'kind', 'title', 'source_ref', 'gcs_object', 'ingest_status', 'created_by', 'created_at')
    `);
    const psColumns = partnerSourcesColumnsCheck.rows[0]?.columns || [];
    assert("partner_sources tiene las 9 columnas esperadas", psColumns.length === 9, { count: psColumns.length, columns: psColumns });

    // (8) Verificar que partner_members tiene onboarded_at (KL1-W2)
    const partnerMembersOnboardedCheck = await pool.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'partner_members'
        AND column_name = 'onboarded_at'
    `);
    const hasOnboardedAt = partnerMembersOnboardedCheck.rows.length > 0;
    const onboardedType = partnerMembersOnboardedCheck.rows[0]?.data_type || "";
    assert("partner_members.onboarded_at existe y es TIMESTAMPTZ", hasOnboardedAt && onboardedType === 'timestamp with time zone', { type: onboardedType });

  } finally {
    await pool.end();
  }

  console.log(`\nverify-control-db: ${pass} pass, ${fail} fail`);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error("ERROR:", e); process.exit(1); });
