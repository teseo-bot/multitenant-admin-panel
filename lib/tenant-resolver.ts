import { pool } from '@/lib/db';

// In-memory cache to store resolved tenants and prevent DB saturation
// Key format: `${channelType}:${channelIdentifier}`
interface CacheEntry {
  tenantId: string;
  expiresAt: number;
}

const tenantCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Resolves a tenant ID based on the incoming channel type and identifier.
 * Utilizes an in-memory cache for O(1) resolution on subsequent requests.
 *
 * @param channelType - The type of the channel (e.g., 'whatsapp', 'telegram')
 * @param channelIdentifier - The unique identifier for the channel (e.g., phone number, bot token ID)
 * @returns The resolved tenant_id or null if not found/unregistered
 */
export async function resolveTenant(
  channelType: string,
  channelIdentifier: string
): Promise<string | null> {
  try {
    const cacheKey = `${channelType}:${channelIdentifier}`;
    const now = Date.now();

    // 1. Check Cache (O(1) Resolution)
    const cached = tenantCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.tenantId;
    }

    // 2. Cache miss or expired, query Cloud SQL via pool
    const client = await pool.connect();
    const res = await client.query(
      'SELECT resolve_tenant_by_channel($1, $2) AS tenant_id',
      [channelType, channelIdentifier]
    );
    client.release();

    const tenantId = res.rows[0]?.tenant_id;

    if (!tenantId) {
      // Channel not registered to any tenant (Fail-Safe)
      return null;
    }

    // 3. Update Cache
    tenantCache.set(cacheKey, {
      tenantId: tenantId as string,
      expiresAt: now + CACHE_TTL_MS,
    });

    return tenantId as string;
  } catch (error) {
    console.error(`[TenantResolver] Unexpected error during tenant resolution:`, error);
    return null;
  }
}
