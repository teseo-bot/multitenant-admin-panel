// G0-W3: aplica las migraciones GCP-Native contra el plano de control (CONTROL_DB_URL).
//
// USO:
//   CONTROL_DB_URL=postgres://... node_modules/.bin/tsx scripts/apply-gcp-migrations.ts
//
// ⚠️ `MIGRATION_FILES` (abajo) es la ÚNICA fuente de verdad: el runner NO descubre archivos
// del directorio. Una migración que no esté en esa lista no se aplica nunca, y nada avisa —
// el repo se ve consistente y la columna simplemente no existe en producción. Ya pasó dos
// veces: la 012 quedó sin aplicar desde el 2026-08-03 (entró de rezagada con la 013) y la 014
// se escribió el 2026-08-05 sin registrar. Al añadir un archivo a `migrations-gcp/`, añadirlo
// aquí en el mismo commit. El test `apply-gcp-migrations.test.ts` cruza lista contra disco.
//
// Aplica en orden estricto de la lista. Cada archivo se ejecuta en su propia
// transacción. Las migraciones son idempotentes por diseño (CREATE TABLE IF NOT EXISTS /
// ON CONFLICT DO NOTHING) o manejan duplicados en capas de error.
//
// Estado (ADR-206 H0, 2026-07-06/07): ya aplicado contra el control-plane vivo
// (micontexto-control:us-central1:control-plane, vía Cloud SQL Auth Proxy). Re-ejecutable
// por idempotencia. La 008 restauró las columnas de expansión de tenant_users. La 009 añade
// partner_sources y onboarded_at para Knowledge Lab. La 010 (PA4-W2) añade
// partner_contract_otp para la firma simple por OTP de contratos de aliado. La 011 (PA7-W3) añade
// partner_citation_stats para el metering de citas de conocimiento certificado [INV-5.4].
// La 012 añade hocflit_blocks; la 013 (ADR-215 WU-1.1) tenant_brands; ambas aplicadas el
// 2026-08-05. La 014 (ADR-212 D1) añade el mapa tenant → Identity Platform, SIN APLICAR aún.
// La 015 crea `tenant_agents` en el plano de control, con el módulo como eje: la pestaña
// «Agentes» del panel escribía en una tabla que sólo existe en el Hot-Tier y su `catch` pintaba
// el `42P01` como «no hay agentes». SIN APLICAR aún.
// La 016 (ADR-220 D-220.4) añade `tenant_projects`; aplicada el 2026-08-21. La 017 (ADR-221
// D-221.1) añade `tenant_project_bindings`: el vínculo remitente → proyecto, que es lo que
// permite que UN número atienda N conferencias. SIN APLICAR aún.

import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations-gcp');

export const MIGRATION_FILES = [
  '001_control_base.sql',
  '002_rbac.sql',
  '003_modules_seed.sql',
  '004_kdb_agent_acls.sql',
  '005_kdb_modules_seed.sql',
  '006_partners.sql',
  '007_partner_contracts.sql',
  '008_tenant_users_expansion.sql',
  '009_partner_sources.sql',
  '010_partner_contract_otp.sql',
  '011_partner_citation_stats.sql',
  '012_hocflit_blocks.sql',
  '013_tenant_brands.sql',
  '014_tenant_idp_map.sql',
  '015_tenant_agents.sql',
  '016_tenant_projects.sql',
  '017_tenant_project_bindings.sql',
] as const;

// Códigos de error Postgres que indican "esto ya existía" (re-run seguro).
const DUPLICATE_ERROR_CODES = new Set([
  '42710', // duplicate_object (constraint, etc.)
  '42P07', // duplicate_table
  '42701', // duplicate_column
  '23505', // unique_violation (ON CONFLICT resuelve, pero el error es info útil)
]);

interface MigrationResult {
  file: string;
  status: 'applied' | 'already_applied' | 'failed';
  detail?: string;
}

function readMigrationSql(file: string): string {
  const fullPath = path.join(MIGRATIONS_DIR, file);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Migración no encontrada: ${fullPath}`);
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

/**
 * Validación de sintaxis mínima: si la migración usa BEGIN;/COMMIT; deben
 * estar balanceados. Se usa en dry-run cuando no hay conexión disponible.
 */
export function validateMigrationShape(sql: string, file: string): { ok: boolean; reason?: string } {
  const beginCount = (sql.match(/\bBEGIN;/g) || []).length;
  const commitCount = (sql.match(/\bCOMMIT;/g) || []).length;
  if (beginCount !== commitCount) {
    return { ok: false, reason: `${file}: BEGIN;/COMMIT; desbalanceados (BEGIN=${beginCount}, COMMIT=${commitCount})` };
  }
  if (sql.trim().length === 0) {
    return { ok: false, reason: `${file}: archivo vacío` };
  }
  return { ok: true };
}

/**
 * Pre-chequeo barato: ¿ya existe el objeto marcador de esta migración?
 * Devuelve null si no aplica pre-chequeo para este archivo.
 */
async function checkAlreadyApplied(client: Client, file: string): Promise<string | null> {
  try {
    if (file === '001_control_base.sql') {
      const r = await client.query(
        `SELECT to_regclass('public.tenants') IS NOT NULL AS exists`
      );
      return r.rows[0]?.exists ? 'tabla public.tenants ya existe' : null;
    }
    if (file === '002_rbac.sql') {
      const r = await client.query(
        `SELECT to_regclass('public.modules') IS NOT NULL AS exists`
      );
      return r.rows[0]?.exists ? 'tabla public.modules ya existe' : null;
    }
    if (file === '003_modules_seed.sql') {
      const r = await client.query(`SELECT count(*)::int AS n FROM public.modules WHERE id = 'crm'`);
      return r.rows[0]?.n > 0 ? "módulo 'crm' ya sembrado" : null;
    }
    if (file === '005_kdb_modules_seed.sql') {
      const r = await client.query(
        `SELECT count(*)::int AS n FROM public.modules WHERE id IN ('finanzas', 'direccion')`
      );
      return r.rows[0]?.n >= 2 ? "módulos 'finanzas'/'direccion' ya sembrados" : null;
    }
    if (file === '006_partners.sql') {
      const r = await client.query(
        `SELECT to_regclass('public.partners') IS NOT NULL AS exists`
      );
      return r.rows[0]?.exists ? 'tabla public.partners ya existe' : null;
    }
    if (file === '009_partner_sources.sql') {
      const r = await client.query(
        `SELECT to_regclass('public.partner_sources') IS NOT NULL AS exists`
      );
      return r.rows[0]?.exists ? 'tabla public.partner_sources ya existe' : null;
    }
    if (file === '010_partner_contract_otp.sql') {
      const r = await client.query(
        `SELECT to_regclass('public.partner_contract_otp') IS NOT NULL AS exists`
      );
      return r.rows[0]?.exists ? 'tabla public.partner_contract_otp ya existe' : null;
    }
    if (file === '011_partner_citation_stats.sql') {
      const r = await client.query(
        `SELECT to_regclass('public.partner_citation_stats') IS NOT NULL AS exists`
      );
      return r.rows[0]?.exists ? 'tabla public.partner_citation_stats ya existe' : null;
    }
    if (file === '015_tenant_agents.sql') {
      const r = await client.query(
        `SELECT to_regclass('public.tenant_agents') IS NOT NULL AS exists`
      );
      return r.rows[0]?.exists ? 'tabla public.tenant_agents ya existe' : null;
    }
  } catch {
    // Si el pre-chequeo falla (ej. tabla aún no existe), no es "ya aplicada".
    return null;
  }
  return null;
}

async function applyMigration(client: Client, file: string): Promise<MigrationResult> {
  const sql = readMigrationSql(file);

  const shape = validateMigrationShape(sql, file);
  if (!shape.ok) {
    return { file, status: 'failed', detail: shape.reason };
  }

  const preCheck = await checkAlreadyApplied(client, file);
  if (preCheck) {
    return { file, status: 'already_applied', detail: preCheck };
  }

  try {
    // Los archivos ya incluyen su propio BEGIN/COMMIT si es necesario; se ejecutan tal cual.
    await client.query(sql);
    return { file, status: 'applied' };
  } catch (err: unknown) {
    const pgErr = err as { code?: string; message?: string };
    if (pgErr.code && DUPLICATE_ERROR_CODES.has(pgErr.code)) {
      // La migración ya se había aplicado antes (objeto duplicado). No es fatal.
      return { file, status: 'already_applied', detail: `${pgErr.code}: ${pgErr.message}` };
    }
    return { file, status: 'failed', detail: pgErr.message ?? String(err) };
  }
}

async function main() {
  const connectionString = process.env.CONTROL_DB_URL;
  if (!connectionString) {
    console.error('ABORT: falta CONTROL_DB_URL en el entorno.');
    process.exit(1);
  }

  console.log(`[apply-gcp-migrations] aplicando ${MIGRATION_FILES.length} migraciones en orden...`);

  const results: MigrationResult[] = [];

  for (const file of MIGRATION_FILES) {
    // Cliente nuevo por archivo: si una migración deja la conexión en estado
    // abortado (transacción fallida), no queremos arrastrar ese estado a la siguiente.
    const client = new Client({ connectionString });
    await client.connect();
    try {
      const result = await applyMigration(client, file);
      results.push(result);

      const icon = result.status === 'failed' ? '✗' : result.status === 'already_applied' ? '~' : '✓';
      console.log(`  ${icon} ${file}: ${result.status}${result.detail ? ` (${result.detail})` : ''}`);

      if (result.status === 'failed') {
        console.error(`\n[apply-gcp-migrations] ABORTADO en ${file}.`);
        await client.end();
        printSummary(results);
        process.exit(1);
      }
    } finally {
      await client.end();
    }
  }

  printSummary(results);
  process.exit(0);
}

function printSummary(results: MigrationResult[]) {
  const applied = results.filter((r) => r.status === 'applied').length;
  const already = results.filter((r) => r.status === 'already_applied').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  console.log(
    `\n[apply-gcp-migrations] resumen: ${applied} aplicadas, ${already} ya existían, ${failed} fallidas (de ${results.length} totales).`
  );
}

// Sólo ejecutar main() si se invoca directamente.
if (require.main === module) {
  main().catch((err) => {
    console.error('[apply-gcp-migrations] ERROR:', err);
    process.exit(1);
  });
}
