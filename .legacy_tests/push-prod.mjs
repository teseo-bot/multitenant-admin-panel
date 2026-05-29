import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ Error: DATABASE_URL no encontrada en .env. Se requiere para conectar al Supabase de Producción.');
  process.exit(1);
}

try {
  console.log(`📡 Conectando al Supabase de Producción y empujando migraciones...`);
  // Usamos el flag --db-url para no depender del "link" de Supabase CLI
  execSync(`npx supabase db push --db-url "${dbUrl}"`, { stdio: 'inherit' });
  console.log('✅ Migraciones aplicadas exitosamente en Producción.');
} catch (error) {
  console.error('❌ Fallo al aplicar migraciones en Producción.');
  process.exit(1);
}
