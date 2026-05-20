const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });
client.connect()
  .then(() => client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`))
  .then(res => { console.log('Tables:', res.rows.map(r => r.table_name)); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
