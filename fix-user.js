import { createClient } from '@supabase/supabase-js'

const supabase = createClient('http://127.0.0.1:54321', 'process.env.SUPABASE_SERVICE_ROLE_KEY')

async function main() {
  const userId = 'c3ff3f49-25dd-4043-bea5-08f75733d37f'; // from the token payload

  // Create a tenant
  const { data: tenant, error: tenantErr } = await supabase.from('tenants').insert({ name: 'Test Tenant' }).select().single();
  if (tenantErr) {
    console.error('Tenant err:', tenantErr);
    // Maybe it already exists, fetch one
  }
  
  const { data: ten } = await supabase.from('tenants').select('id').limit(1).single();
  const tenantId = ten.id;

  // Insert user profile
  const { error: pErr } = await supabase.from('user_profiles').insert({
    id: userId,
    email: 'test1776727678522@example.com',
    full_name: 'Test User',
    tenant_id: tenantId,
    role: 'admin'
  });
  if (pErr) console.error('Profile err:', pErr);

  // Link user to tenant in tenant_users
  const { error: tuErr } = await supabase.from('tenant_users').insert({
    tenant_id: tenantId,
    user_id: userId,
    role: 'admin'
  });
  if (tuErr) console.error('TenantUser err:', tuErr);

  console.log('Done linking user to tenant:', tenantId);
}

main()