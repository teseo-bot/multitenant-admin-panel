import { createClient } from '@supabase/supabase-js'

const supabase = createClient('http://127.0.0.1:54321', 'process.env.SUPABASE_SERVICE_ROLE_KEY')

async function main() {
  const { data, error } = await supabase.rpc('get_policies_dummy');
  // Or just query pg_policies
}

main()