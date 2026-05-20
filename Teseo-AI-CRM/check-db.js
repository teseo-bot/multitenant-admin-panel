const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('http://127.0.0.1:54321', 'process.env.SUPABASE_SERVICE_ROLE_KEY');
(async () => {
  const { data, error } = await supabase.from('documents').select('*');
  console.log('Documents:', data ? data.length : error);
  const { data: chunks, error: err } = await supabase.from('document_chunks').select('*');
  console.log('Chunks:', chunks ? chunks.length : err);
})();
