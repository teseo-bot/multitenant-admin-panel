import { createClient } from '@supabase/supabase-js';

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

    // 2. Cache miss or expired, prepare Supabase Admin Client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[TenantResolver] Missing Supabase environment variables for service role.');
      return null;
    }

    // Instantiate with Service Role Key to bypass RLS for this internal system resolution
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    // 3. Invoke the RPC function
    const { data: tenantId, error } = await supabaseAdmin.rpc('resolve_tenant_by_channel', {
      p_channel_type: channelType,
      p_channel_identifier: channelIdentifier,
    });

    if (error) {
      console.error(`[TenantResolver] RPC error resolving tenant for ${cacheKey}:`, error);
      return null;
    }

    if (!tenantId) {
      // Channel not registered to any tenant (Fail-Safe)
      return null;
    }

    // 4. Update Cache
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
