const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'http://127.0.0.1:54321',
  'process.env.SUPABASE_SERVICE_ROLE_KEY'
);

(async () => {
  const { data: docs, error: err1 } = await supabase.from('documents').select('*');
  console.log('Documents:', docs || err1);
  const { data: chunks, error: err2 } = await supabase.from('document_chunks').select('id, document_id');
  console.log('Chunks:', chunks || err2);
})();
