# RFC-043: Asset Studio Data Layer

## 1. Auditoría de Base de Datos (Learner)
La auditoría de las migraciones SQL ha revelado que la tabla `semantic_prompts` (creada en la migración `20260419000000`) fue un parche transitorio. 
La estructura real y madura fue inyectada en la migración `20260420000000_asset_studio_schema.sql` como parte de la Fase Inicial del Asset Studio.

## 2. Esquema Validado (Single-Tenant/Multi-Tenant Híbrido)
El esquema actual cuenta con las siguientes tablas relacionales protegidas por RLS:
- **`prompt_templates`**: Cabecera inmutable que define el rol (`sdr`, `gatekeeper`, etc.).
- **`prompt_versions`**: Historial inmutable de cambios (Control de Versiones) de cada prompt.
- **`ab_experiments` y `ab_variants`**: Motor para correr pruebas A/B de diferentes versiones de prompts.
- **`variable_defs`**: Catálogo de variables inyectables (`key`, `type`, `default_value`).

## 3. Estrategia Frontend para `PromptsPage` (Fase 1)
Dado que la base de datos ya soporta versionamiento y roles:

### 3.1. Fetching (TanStack Query)
El frontend deberá recuperar la lista de `prompt_templates`, haciendo un `JOIN` (vía PostgREST de Supabase) con `prompt_versions` para extraer la versión activa actual (basada en `active_version_id`).

### 3.2. Tabla de Datos (Shadcn UI)
La vista `/asset-studio/prompts` debe mostrar:
- Nombre del Prompt.
- Rol Asignado (`sdr`, `hunter`, etc.).
- Estado de la versión activa (`draft`, `active`).
- Última fecha de modificación.

## 4. Mitigación de Bloqueo Inmediato
Actualmente nuestro Tenant OS (Command Center) opera de forma Single-Tenant por bypass en RLS o inyecciones locales de dev. Debemos asegurar que el cliente de Supabase recupere las filas ignorando `tenant_id` temporalmente si no hay JWT inyectado en modo dev, o generar un "Seed" de datos para evitar que la tabla se vea vacía.
