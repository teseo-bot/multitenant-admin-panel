// K11-W1: aplica el RBAC modular (012..017) contra el Supabase multitenant.
//
// USO:
//   SUPABASE_DB_URL=postgres://... node_modules/.bin/tsx scripts/apply-rbac-migrations.ts
//
// IMPORTANTE: este script NO se ejecuta contra nada remoto como parte de esta
// work unit (sin credenciales de prod). Sólo se valida que los archivos parsean
// y que el flujo de aplicación/transacción es correcto contra un Postgres local
// de prueba (schema temporal), nunca contra el Supabase multitenant real.
//
// Aplica en orden estricto 012 -> 013 -> 014 -> 015 -> 016 -> 017. Cada archivo
// se ejecuta en su propia transacción (BEGIN/COMMIT ya están en el .sql; este
// script no envuelve una transacción adicional alrededor del archivo completo
// para no interferir con los BEGIN/COMMIT/DO $$ ya presentes en cada migración).
//
// "Ya estaba aplicada": las migraciones 012/013/016/017 son idempotentes por
// diseño (CREATE TABLE IF NOT EXISTS / ON CONFLICT DO NOTHING), así que
// reaplicarlas NO lanza error de duplicado (confirmado en dry-run local: un
// segundo run devuelve exit 0 sin romper nada, pero pg no reporta "0 filas
// insertadas" como error). Por eso este script usa DOS mecanismos complementarios:
//   1) pre-chequeo: antes de aplicar 012/013/017 consulta si el objeto marcador
//      ya existe (tabla 'modules' para 012, filas de módulos para 013/017) y
//      lo reporta como 'already_applied' sin tocar la DB.
//   2) manejo de errores de duplicado (42710 duplicate_object, 42P07
//      duplicate_table, 42701 duplicate_column) para 014/015/016, que no
//      tienen un pre-chequeo barato y sí pueden fallar así en un re-run.
// Cualquier otro error aborta con exit 1.

import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

const MIGRATION_FILES = [
  '012_user_management_rbac.sql',
  '013_seed_modules.sql',
  '014_orphan_membership_fix.sql',
  '015_drop_auth_fk_federated.sql',
  '016_kdb_agent_acls.sql',
  '017_kdb_modules_seed.sql',
] as const;

// Códigos de error Postgres que indican "esto ya existía" (re-run seguro).
const DUPLICATE_ERROR_CODES = new Set([
  '42710', // duplicate_object (constraint, etc.)
  '42P07', // duplicate_table
  '42701', // duplicate_column
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
 * estar balanceados (no ejecuta nada, sólo valida la forma del archivo). Se
 * usa en dry-run cuando no hay conexión a base de datos disponible.
 *
 * NOTA: no todas las migraciones del repo envuelven su contenido en una
 * transacción explícita — 016_kdb_agent_acls.sql es un INSERT suelto sin
 * BEGIN/COMMIT (confirmado leyendo el archivo; no es un error de este script).
 * Por eso la ausencia total de BEGIN/COMMIT es válida; sólo se rechaza el
 * desbalance (uno sin el otro).
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
 * Devuelve null si no aplica pre-chequeo para este archivo (se decide por
 * el resultado real de la ejecución / manejo de errores de duplicado).
 */
async function checkAlreadyApplied(client: Client, file: string): Promise<string | null> {
  try {
    if (file === '012_user_management_rbac.sql') {
      const r = await client.query(
        `SELECT to_regclass('public.modules') IS NOT NULL AS exists`
      );
      return r.rows[0]?.exists ? 'tabla public.modules ya existe' : null;
    }
    if (file === '013_seed_modules.sql') {
      const r = await client.query(`SELECT count(*)::int AS n FROM public.modules WHERE id = 'crm'`);
      return r.rows[0]?.n > 0 ? "módulo 'crm' ya sembrado" : null;
    }
    if (file === '017_kdb_modules_seed.sql') {
      const r = await client.query(
        `SELECT count(*)::int AS n FROM public.modules WHERE id IN ('finanzas', 'direccion')`
      );
      return r.rows[0]?.n >= 2 ? "módulos 'finanzas'/'direccion' ya sembrados" : null;
    }
  } catch {
    // Si el pre-chequeo falla (ej. tabla aún no existe), no es "ya aplicada";
    // se deja que el flujo normal de aplicación continúe.
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
    // Los archivos ya incluyen su propio BEGIN/COMMIT; se ejecutan tal cual
    // via multi-statement query (pg soporta múltiples statements separados
    // por ';' en un solo client.query cuando no se usan parámetros).
    await client.query(sql);
    return { file, status: 'applied' };
  } catch (err: unknown) {
    const pgErr = err as { code?: string; message?: string };
    if (pgErr.code && DUPLICATE_ERROR_CODES.has(pgErr.code)) {
      // La migración ya se había aplicado antes (objeto duplicado). No es fatal.
      // La transacción de este client puede haber quedado abortada; el caller
      // reconecta antes de la siguiente migración para evitar arrastrar el error.
      return { file, status: 'already_applied', detail: `${pgErr.code}: ${pgErr.message}` };
    }
    return { file, status: 'failed', detail: pgErr.message ?? String(err) };
  }
}

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error('ABORT: falta SUPABASE_DB_URL en el entorno.');
    process.exit(1);
  }

  console.log(`[apply-rbac-migrations] aplicando ${MIGRATION_FILES.length} migraciones en orden...`);

  const results: MigrationResult[] = [];

  for (const file of MIGRATION_FILES) {
    // Cliente nuevo por archivo: si una migración deja la conexión en estado
    // abortado (transacción fallida), no queremos arrastrar ese estado a la
    // siguiente migración.
    const client = new Client({ connectionString });
    await client.connect();
    try {
      const result = await applyMigration(client, file);
      results.push(result);

      const icon = result.status === 'failed' ? '✗' : result.status === 'already_applied' ? '~' : '✓';
      console.log(`  ${icon} ${file}: ${result.status}${result.detail ? ` (${result.detail})` : ''}`);

      if (result.status === 'failed') {
        console.error(`\n[apply-rbac-migrations] ABORTADO en ${file}.`);
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
    `\n[apply-rbac-migrations] resumen: ${applied} aplicadas, ${already} ya existían, ${failed} fallidas (de ${results.length} totales).`
  );
}

// Sólo ejecutar main() si se invoca directamente (permite importar
// validateMigrationShape desde tests sin conectar a ninguna DB).
if (require.main === module) {
  main().catch((err) => {
    console.error('[apply-rbac-migrations] ERROR:', err);
    process.exit(1);
  });
}
