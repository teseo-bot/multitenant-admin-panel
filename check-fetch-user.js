const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function test() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email: 'test@teseo.lat',
    password: 'password123'
  });
  if (authError) {
    console.error("Auth error:", authError);
    return;
  }
  
  const { data, error } = await supabase.from('leads').select('*, inbox_messages(content, created_at, channel)');
  console.log("Leads as user:", data?.length);
  if (data && data.length > 0) {
    console.log("Lead 0 messages:", data[0].inbox_messages?.length);
  }
}
test();
