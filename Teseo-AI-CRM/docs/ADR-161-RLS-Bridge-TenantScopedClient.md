# [DEPRECATED] - Superseded by MASTER_ARCHITECTURE.md v1.0.0nn
# ADR-161: RLS Bridge via TenantScopedClient y Rol `app_tenant`

| Campo          | Valor                                          |
| -------------- | ---------------------------------------------- |
| **ID**         | ADR-161                                        |
| **Estado**     | Propuesto                                      |
| **Fecha**      | 2026-04-23                                     |
| **Autor**      | Builder (Arquitecto Staff)                     |
| **Dominio**    | Data Access Layer · PostgreSQL Security         |
| **RFC**        | RFC-055 (Bloque 20)                            |

## 1. Contexto

El Bloque 18 eliminó los fallbacks de `process.env.TENANT_ID` en la capa de aplicación (ADR-140). Sin embargo, el aislamiento de datos sigue dependiendo de filtros `WHERE tenant_id = $1` manuales en cada query SQL. Esto constituye una superficie de ataque por omisión: un solo query olvidado sin filtro de tenant produce un data bleed entre inquilinos.

Adicionalmente, el sistema opera con dos mecanismos de acceso a datos que ignoran RLS:
1. **`supabaseClient`** con `SUPABASE_SERVICE_ROLE_KEY` → bypass total de RLS
2. **`pg.Pool`** conectado como superusuario/`postgres` → RLS no aplica

## 2. Decisiones

### D1: Introducción de `TenantScopedClient` como abstracción obligatoria de acceso a datos

Todo nodo del grafo LangGraph y toda ruta interna que acceda a datos transaccionales (leads, messages, finops, memories) **debe** adquirir una instancia de `TenantScopedClient(tenantId)` que:
- Valida el formato UUID del `tenantId`
- Adquiere una conexión del pool con rol `app_tenant` (sujeto a RLS)
- Ejecuta `SET app.current_tenant = '<tenantId>'` en la conexión
- Expone repositorios tipados (`leads`, `messages`, `memories`, `finops`)
- Limpia el contexto con `RESET app.current_tenant` al liberarse

### D2: Creación de rol PostgreSQL `app_tenant` con permisos limitados

Se crea un rol `app_tenant` con LOGIN y permisos DML (SELECT, INSERT, UPDATE, DELETE) sobre tablas del schema `public`, **sin** capacidad de bypass de RLS. Este rol es el que usará el pool de conexiones del orquestador para queries transaccionales.

### D3: Activación de RLS en tablas transaccionales con política dual

Las tablas `leads`, `inbox_messages`, `finops_token_ledger`, y `tenant_memories` tendrán RLS habilitado con políticas que soportan dos modos de acceso:
1. **Orquestador:** `tenant_id = current_setting('app.current_tenant', true)::uuid`
2. **Mission Control:** `tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())`

### D4: Desnormalización de `tenant_id` en `inbox_messages`

Se añade columna `tenant_id` directa a `inbox_messages` (backfill desde `leads.tenant_id`) para evitar subqueries costosas en políticas RLS.

### D5: Restricción del `supabaseClient` (Service Role) a operaciones administrativas

El cliente con Service Role Key se renombra a `supabase-admin.ts` y se restringe a:
- RPCs `SECURITY DEFINER` (ej. `match_tenant_memories`)
- Operaciones de onboarding (ADR-139)
- Uploads a Supabase Storage (ADR-148)
- Scripts de migración

## 3. Consecuencias

### Positivas
- **Defense in Depth:** Incluso si un desarrollador olvida filtrar por `tenant_id` en una query, PostgreSQL RLS la bloquea automáticamente.
- **Fail-Closed:** Conexiones sin `app.current_tenant` seteado retornan 0 filas (no all filas).
- **Auditable:** Se puede verificar el aislamiento con `EXPLAIN ANALYZE` que muestra el filtro RLS en el plan de ejecución.
- **Consistente con la industria:** Patrón idéntico a AWS SaaS Factory, Nile.dev, y Citus.

### Negativas
- **Overhead de conexión:** Cada nodo del grafo debe adquirir y liberar un `TenantScopedClient`. Mitigado: el pool reutiliza conexiones, solo añade un `SET` + `RESET` por operación (~0.1ms).
- **Complejidad de migraciones:** La desnormalización de `tenant_id` en `inbox_messages` y la creación del rol requieren migraciones cuidadosas.
- **Dos modos de RLS:** La política dual (orquestador + Mission Control) añade complejidad a las políticas SQL, pero es inevitable dado que ambas capas coexisten.

## 4. Alternativas Descartadas

| Alternativa | Razón de Descarte |
|-------------|-------------------|
| **Application-only filtering** (sin RLS) | Un query olvidado = data bleed. Imposible auditar estáticamente. |
| **RLS con JWT claims (auth.jwt()->>'tenant_id')** | El orquestador no usa Supabase Auth para sus conexiones. No hay JWT en el flujo de LangGraph. |
| **Base de datos separada por tenant** | Ya descartado en ADR-097 a favor de Hub & Spoke. Resurrección no viable. |
| **Citus / sharding por tenant** | Over-engineering para el volumen actual (<100 tenants). RLS es suficiente. |
