import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://jpmxqzrdeclkgpfuedjf.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxycHR1d2Vrd2dianV0a2xjdHdyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjU1MzQwOSwiZXhwIjoyMDkyMTI5NDA5fQ.iuWXzabPzQbR1XygZCCmDx-lBZREMHRl-eyDm6bsk0c');
async function clean() {
  const { data, error } = await supabase.from('tenants').select('*');
  if (error) { console.error(error); return; }
  console.log("Current tenants:", data.map(t => `${t.id} - ${t.name} - ${t.status}`));
  
  const toDelete = [
    '9163f7ef-7d83-4571-9d31-00c8659735a0',
    '640cdfca-b395-4f98-a424-372969470423',
    '335d3faf-1f63-436e-9c7d-aeda274b9e75'
  ];
  
  const { data: delData, error: delError } = await supabase.from('tenants').delete().in('id', toDelete);
  if (delError) {
    console.error("Delete error:", delError);
  } else {
    console.log("Deleted onboarding test tenants.");
  }
}
clean();
