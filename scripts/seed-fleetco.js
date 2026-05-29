const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

const envPath = path.resolve(__dirname, '../src/mission-control/.env.local');
dotenv.config({ path: envPath });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seed() {
  const tenantData = {
    name: 'Fleetco',
    orchestrator_url: 'http://localhost:8000',
    status: 'active'
  };

  // Upsert on name to prevent duplicates
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .upsert([tenantData], { onConflict: 'name' })
    .select()
    .single();
    
  if (tenantError) throw tenantError;

  const configData = {
    tenant_id: tenant.id,
    system_prompt: "Eres el asistente de Fleetco...",
    features: { gps: true }
  };

  const { error: configError } = await supabase
    .from('tenant_configs')
    .upsert([configData], { onConflict: 'tenant_id' });
    
  if (configError) throw configError;

  console.log("Seed completado");
}
seed();
