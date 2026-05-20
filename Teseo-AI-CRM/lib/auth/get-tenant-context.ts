import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { User, SupabaseClient } from '@supabase/supabase-js';

export type TenantContextResult =
  | { ok: true; ctx: { user: User; tenantId: string; supabase: SupabaseClient } }
  | { ok: false; err: { error: string; status: number } };

export async function getTenantContext(request: Request): Promise<TenantContextResult> {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.MISSION_CONTROL_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.MISSION_CONTROL_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; }
      }
    }
  );

  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  const { data: { user }, error } = token 
    ? await supabase.auth.getUser(token) 
    : await supabase.auth.getUser();

  if (!user || error) {
    console.error('SSE/API Auth error:', error);
    return { ok: false, err: { error: 'Unauthorized', status: 401 } };
  }

  let tenantId = user.app_metadata?.tenant_id || user.user_metadata?.tenant_id;
  
  if (!tenantId) {
    // Fallback: Check tenant_users if not present in metadata
    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();
    if (tenantUser) {
      tenantId = tenantUser.tenant_id;
    }
  }

  if (!tenantId) {
    return { ok: false, err: { error: 'Tenant ID missing', status: 400 } };
  }

  return { ok: true, ctx: { user, tenantId, supabase } };
}
