import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://jpmxqzrdeclkgpfuedjf.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxycHR1d2Vrd2dianV0a2xjdHdyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjU1MzQwOSwiZXhwIjoyMDkyMTI5NDA5fQ.iuWXzabPzQbR1XygZCCmDx-lBZREMHRl-eyDm6bsk0c');
async function check() {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) { console.error(error); return; }
  let target = data.users.find(u => u.email === 'fleetco@fleetco.mx');
  if (target) {
    await supabase.auth.admin.updateUserById(target.id, { password: 'password123', email_confirm: true });
    console.log("Updated fleetco");
  } else {
    await supabase.auth.admin.createUser({ email: 'fleetco@fleetco.mx', password: 'password123', email_confirm: true });
    console.log("Created fleetco");
  }
  let e2e = data.users.find(u => u.email === 'e2e@teseo.lat');
  if (e2e) {
    await supabase.auth.admin.updateUserById(e2e.id, { password: 'password123', email_confirm: true });
    console.log("Updated e2e");
  } else {
    await supabase.auth.admin.createUser({ email: 'e2e@teseo.lat', password: 'password123', email_confirm: true });
    console.log("Created e2e");
  }
}
check();
