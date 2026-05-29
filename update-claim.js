import { createClient } from '@supabase/supabase-js'

const supabase = createClient('http://127.0.0.1:54321', 'process.env.SUPABASE_SERVICE_ROLE_KEY')

async function main() {
  const userId = 'c3ff3f49-25dd-4043-bea5-08f75733d37f'; 
  const tenantId = '9246f444-1e22-491a-b195-479977abf7ec';

  const { data, error } = await supabase.auth.admin.updateUserById(
    userId,
    { app_metadata: { tenant_id: tenantId } }
  )

  if (error) console.error(error)
  else console.log('Updated app_metadata!', data.user.app_metadata)
}

main()