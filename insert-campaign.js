import { createClient } from '@supabase/supabase-js'

const supabase = createClient('http://127.0.0.1:54321', 'process.env.SUPABASE_SERVICE_ROLE_KEY')

async function main() {
  const tenantId = '9246f444-1e22-491a-b195-479977abf7ec';
  const userId = 'c3ff3f49-25dd-4043-bea5-08f75733d37f';
  
  const { data, error } = await supabase.from('campaigns').insert({
    tenant_id: tenantId,
    name: 'Test Campaign',
    agent_roles: [{role: 'sales', count: 1}],
    channel: 'whatsapp',
    status: 'draft',
    target_audience: {},
    created_by: userId
  }).select().single();

  if (error) console.error(error)
  else console.log('Campaign inserted:', data.id)
}

main()