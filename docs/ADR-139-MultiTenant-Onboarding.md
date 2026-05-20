# [DEPRECATED] - Superseded by MASTER_ARCHITECTURE.md v1.0.0nn
# ADR-139: Multi-Tenant Onboarding Automático (IaC)
**Dominio:** `teseo-ai-crm`
**Autor:** Builder (Arquitecto Staff)
**Fecha:** 22 Abril 2026

## 1. Contexto y Problema
El CRM-Agéntico opera en una arquitectura multi-tenant (Hub & Spoke). Aprovisionar un cliente de forma manual conlleva riesgo de error humano, fugas de RLS y altos tiempos de configuración. Necesitamos un mecanismo idempotente y programático (Script/CLI) para dar de alta un nuevo `tenant_id`, configurar su bóveda documental, inicializar políticas FinOps y conectarlo al orquestador LangGraph en menos de 60 segundos.

## 2. Decisiones Arquitectónicas

### 2.1. CLI Tool en Node.js (TypeScript)
Se construirá un script `scripts/onboard-tenant.ts` dentro de `crm-agentico-panel` utilizando `tsx` (TypeScript Execute) para aprovechar el ecosistema existente (`@supabase/supabase-js`, Tipos, y el entorno `.env`).

### 2.2. Flujo de Aprovisionamiento (Secuencia)
1. **Creación del Registro:** Insertar fila en la tabla maestra `public.tenants`.
2. **Setup de RLS y Autenticación:** 
   - Crear un usuario administrador en Supabase Auth (`auth.users`).
   - Asociar el UUID del Auth al `tenant_id` en la tabla `public.tenant_users` con el rol `admin`.
3. **Inyección de Semillas (Knowledge Base):** 
   - Inicializar la memoria transaccional básica en `tenant_memories` o el bucket correspondiente.
   - Registrar la entrada base en `finops_model_pricing` si existen modelos customizados.
4. **Respuesta Transaccional:** El script debe operar bajo una función RPC transaccional o manejar un mecanismo de "rollback" manual si alguna inserción falla, para evitar tenants "huérfanos".

## 3. Trade-offs (Análisis de Riesgo)
- **Supabase Service Role (Pro):** El script correrá a nivel de servidor utilizando la `SERVICE_ROLE_KEY` (bypass absoluto de RLS), permitiendo la creación de usuarios en la tabla cifrada `auth.users` mediante la API Admin.
- **Supabase Service Role (Con):** Requiere manejo estricto de secretos en el entorno de despliegue. No debe jamás invocarse desde el navegador.

## 4. Work Breakdown Structure (WBS) para Ejecutor

### Fase 1: Endpoint o RPC de Inserción
- **Paso A:** Crear el archivo `scripts/onboard-tenant.ts`.
- **Paso B:** Implementar la lógica utilizando `@supabase/supabase-js` invocando `supabase.auth.admin.createUser()` seguido de `supabase.from('tenants').insert()`.
- **Restricción:** El script debe aceptar argumentos por CLI (ej. `npm run onboard -- --name "Acme Corp" --email "admin@acme.com"`).

### Fase 2: Automatización de Semillas (Seeds)
- **Paso A:** Una vez obtenido el `tenant_id`, inyectar un par de registros de prueba (ej. 1 lead ficticio en `leads` y 1 campaña en `asset_studio_campaigns`) para evitar el "Síndrome de la Página en Blanco" (Empty States).

## 5. Criterios de Aceptación
- El script debe ejecutarse mediante `npx tsx scripts/onboard-tenant.ts ...` sin arrojar errores TypeScript.
- Al acceder al Mission Control con las credenciales recién creadas, el usuario no debe visualizar registros de inquilinos ajenos.