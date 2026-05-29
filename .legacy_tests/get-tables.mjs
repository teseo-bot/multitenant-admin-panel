import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });
  await client.connect();
  const { rows } = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);
  console.log(rows.map(r => r.table_name));
  await client.end();
}
main().catch(console.error);
