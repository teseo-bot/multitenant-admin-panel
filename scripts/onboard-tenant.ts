import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'util';
import 'dotenv/config';

// 1. Setup Supabase Admin Client (Bypass RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Fatal: Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  console.log("🚀 Iniciando Secuencia de Onboarding Multi-Tenant...\n");

  // 2. Parsear argumentos de CLI
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      tenant: { type: 'string', short: 't' },
      email: { type: 'string', short: 'e' },
      password: { type: 'string', short: 'p', default: 'Temporal123!' },
    },
  });

  if (!values.tenant || !values.email) {
    console.error("❌ Uso incorrecto. Ejemplo:");
    console.error(`npx tsx scripts/onboard-tenant.ts --tenant "Acme Corp" --email "admin@acme.com"`);
    process.exit(1);
  }

  const tenantName = values.tenant;
  const adminEmail = values.email;
  const adminPassword = values.password;

  try {
    // 3. Crear el Tenant
    console.log(`[1/4] Registrando Tenant: ${tenantName}`);
    const { data: tenantData, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert({ name: tenantName })
      .select('id')
      .single();

    if (tenantError) throw new Error(`Fallo al crear Tenant: ${tenantError.message}`);
    const tenantId = tenantData.id;
    console.log(`✅ Tenant Creado (ID: ${tenantId})`);

    // 4. Crear el Usuario en Supabase Auth
    console.log(`\n[2/4] Aprovisionando cuenta Auth para: ${adminEmail}`);
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true, // Auto-verificado
    });

    if (authError) throw new Error(`Fallo al crear Usuario Auth: ${authError.message}`);
    const userId = authData.user.id;
    console.log(`✅ Usuario Creado (ID: ${userId})`);

    // 5. Vincular Usuario al Tenant con Rol Admin
    console.log(`\n[3/4] Vinculando usuario al Tenant con permisos de administrador...`);
    const { error: linkError } = await supabaseAdmin
      .from('tenant_users')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        role: 'admin'
      });

    if (linkError) throw new Error(`Fallo al vincular rol: ${linkError.message}`);
    console.log(`✅ Vínculo exitoso.`);

    // 6. Semilla (Dummy Data) para evitar Empty States
    console.log(`\n[4/4] Inyectando Semillas Transaccionales (Knowledge Base Inicial)...`);
    
    // Semilla de Lead Dummy
    await supabaseAdmin.from('leads').insert({
      tenant_id: tenantId,
      name: "John Doe (Lead de Prueba)",
      email: "demo@teseo.lat",
      status: "New",
      source: "Manual Onboarding"
    });

    console.log(`✅ Datos semilla inyectados con éxito.`);

    console.log("\n=============================================");
    console.log("🎉 ONBOARDING COMPLETADO CON ÉXITO");
    console.log("=============================================");
    console.log(`Tenant:   ${tenantName}`);
    console.log(`URL:      https://mission-control.teseo.lat`);
    console.log(`Usuario:  ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log("=============================================\n");

  } catch (error: any) {
    console.error(`\n❌ ERROR CRÍTICO DURANTE EL ONBOARDING:`);
    console.error(error.message);
    process.exit(1);
  }
}

main();
