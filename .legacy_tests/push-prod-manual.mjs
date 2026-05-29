import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

// Pide al usuario que ingrese su cadena de conexión de producción por CLI
const dbUrl = process.argv[2];

if (!dbUrl) {
  console.error('❌ Error: Debes pasar el DATABASE_URL de producción como argumento.');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: dbUrl });
  
  try {
    console.log(`📡 Conectando a Supabase Producción...`);
    await client.connect();

    console.log(`📡 Creando tabla contacts...`);
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
    
    console.log(`📡 Creando tabla tasks...`);
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

    console.log(`🧹 Limpiando registros mockup en producción (Zero Inbox)...`);
    await client.query('TRUNCATE TABLE inbox_messages CASCADE;');
    await client.query('TRUNCATE TABLE lead_assignment_outbox CASCADE;');
    await client.query('TRUNCATE TABLE leads CASCADE;');
    await client.query('TRUNCATE TABLE contacts CASCADE;');
    await client.query('TRUNCATE TABLE tasks CASCADE;');

    console.log('✅ Migraciones aplicadas en Producción.');
    
    await client.query('NOTIFY pgrst, \'reload schema\'');
    console.log('✅ PostgREST schema cache recargado.');

  } catch (error) {
    console.error('❌ Fallo al aplicar migraciones:', error.message);
  } finally {
    await client.end();
  }
}

main();
