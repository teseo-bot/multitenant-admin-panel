const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase.from('leads').select('*, inbox_messages(content, created_at, channel)');
  console.log("Leads:", data?.length);
  if (data && data.length > 0) {
    console.log("Lead 0 inbox:", data[0].inbox_messages?.length);
  } else {
    console.log("Error:", error);
  }
}
test();
