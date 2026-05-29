const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });
client.connect()
  .then(() => client.query('SELECT email FROM auth.users'))
  .then(res => { console.log('Users:', res.rows); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
