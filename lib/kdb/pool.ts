// lib/kdb/pool.ts
// K7-W1: pool `pg` singleton hacia el Cold-Tier (context-kdb-compiler DB) + helper
// withTenant que aplica el patrón RLS de TRD §6 (SET app.tenant_id / RESET).
//
// Sigue la misma convención de pool singleton que lib/db.ts (Pool con connectionString
// desde env, cacheado en `global` para sobrevivir hot-reload en dev).

import { Pool, type PoolClient } from "pg";

const globalForKdbDb = global as unknown as { kdbPool: Pool | undefined };

export const kdbPool =
  globalForKdbDb.kdbPool ??
  new Pool({
    connectionString: process.env.COLD_TIER_URL,
  });

if (process.env.NODE_ENV !== "production") {
  globalForKdbDb.kdbPool = kdbPool;
}

/**
 * Obtiene una conexión del pool Cold-Tier, aplica `SET app.tenant_id` (patrón RLS,
 * TRD §6), ejecuta `fn`, y SIEMPRE hace `RESET app.tenant_id` + release en el finally
 * (incluso si `fn` lanza).
 *
 * Usa `set_config` con parámetro bindeado (no interpolación de string) para evitar
 * inyección SQL vía tenantId.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await kdbPool.connect();
  try {
    await client.query("SELECT set_config('app.tenant_id', $1, false)", [tenantId]);
    return await fn(client);
  } finally {
    await client.query("RESET app.tenant_id").catch(() => {
      // no-op: si la conexión ya está en mal estado, el release la descarta igual
    });
    client.release();
  }
}
