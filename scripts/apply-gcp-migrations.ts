// G0-W3: aplica las migraciones GCP-Native (001..008) contra el plano de control (CONTROL_DB_URL).
//
// USO:
//   CONTROL_DB_URL=postgres://... node_modules/.bin/tsx scripts/apply-gcp-migrations.ts
//
// Aplica en orden estricto 001 -> 002 -> ... -> 008. Cada archivo se ejecuta en su propia
// transacción. Las migraciones son idempotentes por diseño (CREATE TABLE IF NOT EXISTS /
// ON CONFLICT DO NOTHING) o manejan duplicados en capas de error.
//
// Estado (ADR-206 H0, 2026-07-06/07): ya aplicado contra el control-plane vivo
// (micontexto-control:us-central1:control-plane, vía Cloud SQL Auth Proxy). Re-ejecutable
// por idempotencia. La 008 restauró las columnas de expansión de tenant_users.

import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations-gcp');

const MIGRATION_FILES = [
  '001_control_base.sql',
  '002_rbac.sql',
  '003_modules_seed.sql',
  '004_kdb_agent_acls.sql',
  '005_kdb_modules_seed.sql',
  '006_partners.sql',
  '007_partner_contracts.sql',
  '008_tenant_users_expansion.sql',
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
