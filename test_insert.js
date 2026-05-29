const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
// wait, we need to sign in first to simulate the user
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

(async () => {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'test@teseo.lat',
    password: 'password123'
  });
  
  if (authError) {
      console.error("Auth error:", authError);
      return;
  }
  
  console.log("Logged in. Getting a tenant_id...");
  
  // just get any tenant
  const { data: tenantData } = await supabase.from('tenants').select('id').limit(1).single();
  const finalTenantId = tenantData ? tenantData.id : '00000000-0000-0000-0000-000000000000';
  
  console.log("Inserting document for tenant:", finalTenantId);
  const { data: docData, error: dbError } = await supabase
    .from('documents')
    .insert({
      tenant_id: finalTenantId,
      name: 'test_document.txt',
      file_path: 'test/path',
      file_type: 'txt',
      size_bytes: 123,
      status: 'processing',
      created_by: authData.user.id
    })
    .select()
    .single();
    
   if (dbError) {
       console.error("DB Insert Error:", dbError);
   } else {
       console.log("Insert Success:", docData);
   }
})();