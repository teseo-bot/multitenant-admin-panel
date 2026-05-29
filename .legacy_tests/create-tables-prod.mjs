import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

const dbUrl = process.argv[2];

if (!dbUrl) {
  console.error('❌ Error: Debes pasar el DATABASE_URL de producción como argumento.');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    
    // Create contacts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS contacts (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          tenant_id UUID REFERENCES tenants(id),
          name VARCHAR(255) NOT NULL,
          position VARCHAR(255),
          phone VARCHAR(50),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
      );
    `);
    
    // Create tasks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          tenant_id UUID REFERENCES tenants(id),
          title VARCHAR(255) NOT NULL,
          due_date DATE,
          notes TEXT,
          status VARCHAR(50) DEFAULT 'pending',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
      );
    `);
    
    // Also truncate mock data since the user requested "borra los registros mock del pipeline"
    await client.query('TRUNCATE TABLE inbox_messages CASCADE;');
    await client.query('TRUNCATE TABLE lead_assignment_outbox CASCADE;');
    await client.query('TRUNCATE TABLE leads CASCADE;');
    await client.query('TRUNCATE TABLE contacts CASCADE;');
    await client.query('TRUNCATE TABLE tasks CASCADE;');
    
    console.log('✅ Tablas creadas y data mock borrada en Prod.');
    
    await client.query('NOTIFY pgrst, \'reload schema\'');
    console.log('✅ Schema reload.');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}
main();
