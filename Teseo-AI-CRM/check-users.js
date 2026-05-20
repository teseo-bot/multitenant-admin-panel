const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });
  await client.connect();
  const res = await client.query(`SELECT email FROM auth.users;`);
  console.log(res.rows);
  await client.end();
}
run();