const { Client } = require('pg');
async function setup() {
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });
  await client.connect();
  await client.query(`
    INSERT INTO public.campaigns (id, tenant_id, name, status, channel, created_by) 
    VALUES ('11111111-1111-1111-1111-111111111111', '9246f444-1e22-491a-b195-479977abf7ec', 'Test Campaign', 'draft', 'whatsapp', '00000000-0000-0000-0000-000000000000') 
    ON CONFLICT DO NOTHING;
  `);
  console.log('Test campaign created.');
  await client.end();
}
setup();