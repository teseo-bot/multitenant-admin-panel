# [DEPRECATED] - Superseded by MASTER_ARCHITECTURE.md v1.0.0nn
# ADR-200: Arquitectura Completa de Gestión de Tenants — Mission Control

| Campo | Valor |
|---|---|
| **ID** | ADR-200 |
| **Estado** | Aprobado (CEO Sign-off) |
| **Fecha** | 2026-04-26 |
| **Autor** | Builder Agent (Auditoría + Diseño) |
| **Aprobador** | Jorge García (CEO) |
| **Dominio** | teseo-mission-control — Panel Administrativo SaaS B2B |
| **Supersedes** | ADR-105 (parcial), ADR-100 §2.2.4 |
| **Repo** | `/Users/teseohome/projects/teseo-mission-control` |

---

## 0. Resumen Ejecutivo

Este documento define la arquitectura de mutación, estado y componentes para las **4 pestañas** de gestión de Tenants en Mission Control:

1. **Operación** — Estado, routing, LLM tier, feature flags
2. **Branding & UI** — Logo, colores OKLCH, tema, accent color
3. **Prompts & IA** — Prompt templates versionados (SDR, Gatekeeper, RAG L1, Hunter), variables, A/B testing link
4. **Accesos & Roles** — RBAC (OWNER/ADMIN/MEMBER/VIEWER), invitaciones, audit log

---

## 1. Auditoría del Estado Actual

### 1.1 Esquema de Base de Datos (Supabase Local)

#### Tablas Core existentes:
```
tenants              → id (uuid PK), name, status (enum), created_at, orchestrator_url, api_key_vault_id
tenant_configs       → id, tenant_id (FK→tenants, UNIQUE), llm_tier, features (jsonb), semantic_prompts (jsonb), updated_at
tenant_users         → id, tenant_id (FK→tenants), user_id (FK→auth.users), role (text), created_at, updated_at
tenant_channels      → id, tenant_id (FK→tenants), channel_type, channel_identifier, credentials (jsonb), is_active
prompt_templates     → id, tenant_id (FK→tenants), role (check: sdr|gatekeeper|hunter|l1_support), name, description, active_version_id, timestamps
prompt_versions      → id, template_id (FK→prompt_templates), version_number, content, variables (jsonb), changelog, status (enum), created_by
variable_defs        → id, tenant_id (FK→tenants), key, label, type (enum), default_value, enum_options (jsonb), required, description
documents            → id, tenant_id, name, file_path, file_type, size_bytes, status (enum), source, external_id, raw_file_url
tenant_memories      → id, tenant_id, content, metadata (jsonb), embedding (vector(768)), document_id
```

#### Migración pendiente aplicada (20260424100000):
```sql
-- Columnas de branding en tenant_configs (YA en migration, NO en dump local):
primary_color TEXT, accent_color TEXT, logo_url TEXT, theme_mode (enum: LIGHT|DARK|SYSTEM)

-- Columnas adicionales en tenants:
domain TEXT UNIQUE, updated_at TIMESTAMPTZ

-- Actualización de tenant_users.role a enum: OWNER|ADMIN|MEMBER|VIEWER
```

### 1.2 Brechas Críticas Detectadas

| # | Brecha | Severidad | Tab Afectada |
|---|--------|-----------|--------------|
| G1 | `tenant_configs` en DB local **no tiene** `primary_color`, `accent_color`, `logo_url`, `theme_mode` | 🔴 CRÍTICA | Branding |
| G2 | `tenant_users.role` sigue siendo `text` (no enum `user_role`) en local | 🔴 CRÍTICA | Accesos |
| G3 | `tenants` no tiene `domain` ni `updated_at` en local | 🟡 MEDIA | Operación |
| G4 | Storage bucket `tenant-assets` **no existe** | 🔴 CRÍTICA | Branding |
| G5 | No hay RLS policies para `tenant-assets` bucket | 🔴 CRÍTICA | Branding |
| G6 | Pestaña "Accesos & Roles" es un placeholder vacío | 🟡 MEDIA | Accesos |
| G7 | PromptsTab usa `semantic_prompts` JSONB inline en lugar de `prompt_templates`+`prompt_versions` | 🟡 MEDIA | Prompts |
| G8 | No hay Zod schemas para validación server-side de mutations | 🟡 MEDIA | Todas |
| G9 | El API route `/api/tenant/config` usa `anon_key` sin tenant isolation | 🔴 CRÍTICA | Seguridad |
| G10 | No hay `react-hook-form` integration (ya instalado pero no usado en tabs) | 🟢 BAJA | UX |

### 1.3 Stack Tecnológico Confirmado

```
Framework:    Next.js 16.2.4 (App Router, React 19)
State:        Zustand 5.x (useTenantStore)
Forms:        react-hook-form 7.x + @hookform/resolvers 5.x
Validation:   Zod 4.x
UI:           Shadcn/UI + Tailwind CSS v4 (OKLCH nativo)
Backend:      Supabase (SSR + Browser clients)
Auth:         Supabase Auth (cookie-based SSR)
Storage:      Supabase Storage (bucket: tenant-assets — pendiente)
Deployment:   Cloud Run via CloudBuild/GitHub Actions
```

### 1.4 RLS Policies Existentes

```
tenant_isolation_tenants       → current_setting('app.current_tenant') OR tenant_users lookup
tenant_isolation_tenant_configs → current_setting('app.current_tenant') OR tenant_users lookup  
tenant_isolation_templates     → auth.jwt()->>'tenant_id'
tenant_isolation_versions      → template_id IN (subquery prompt_templates)
tenant_isolation_variables     → auth.jwt()->>'tenant_id'
Service Role Full Access       → job, tenant_memories, tenant_users
```

> ⚠️ **Nota de seguridad**: Mission Control opera con `service_role` o un admin autenticado vía Supabase Auth con RLS bypass. Las policies de `current_setting('app.current_tenant')` son para el Command Center (cliente). Mission Control necesita policies de super-admin separadas.

---

## 2. Arquitectura de Estado y Mutación

### 2.1 Patrón Global: Form → Zod → Supabase → Toast

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────┐
│  react-hook  │───▶│  Zod Schema  │───▶│  Supabase    │───▶│  Toast    │
│  -form       │    │  (validate)  │    │  .upsert()   │    │  (sonner) │
│  useForm()   │    │  safeParse() │    │  .update()   │    │           │
└──────────────┘    └──────────────┘    └──────────────┘    └───────────┘
       ▲                                       │
       │                                       ▼
       │                              ┌──────────────┐
       └──────────────────────────────│  Zustand      │
                                      │  (cache)      │
                                      └──────────────┘
```

### 2.2 Zustand Store Refactorizado

```typescript
// src/hooks/useTenantDetailStore.ts
import { create } from "zustand";

interface TenantDetailState {
  // ─── Operación ───
  tenant: {
    id: string;
    name: string;
    status: "active" | "suspended" | "onboarding";
    orchestrator_url: string | null;
    api_key_vault_id: string | null;
    domain: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  config: {
    id: string | null;
    tenant_id: string;
    llm_tier: string;
    features: Record<string, unknown>;
    semantic_prompts: { sdr: string; gatekeeper: string; rag_l1: string };
    // Branding
    primary_color: string | null;
    accent_color: string | null;
    logo_url: string | null;
    theme_mode: "LIGHT" | "DARK" | "SYSTEM";
  } | null;

  // ─── Accesos ───
  users: TenantUser[];
  
  // ─── Prompts ───
  promptTemplates: PromptTemplate[];

  // ─── Loading/Error ───
  loading: boolean;
  saving: Record<string, boolean>; // per-tab saving state
  
  // ─── Actions ───
  setTenant: (t: TenantDetailState["tenant"]) => void;
  setConfig: (c: TenantDetailState["config"]) => void;
  setUsers: (u: TenantUser[]) => void;
  setPromptTemplates: (p: PromptTemplate[]) => void;
  setSaving: (tab: string, val: boolean) => void;
  setLoading: (l: boolean) => void;
  reset: () => void;
}

interface TenantUser {
  id: string;
  user_id: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  email?: string;
  created_at: string;
  updated_at: string;
}

interface PromptTemplate {
  id: string;
  tenant_id: string;
  role: "sdr" | "gatekeeper" | "hunter" | "l1_support";
  name: string;
  description: string | null;
  active_version_id: string | null;
  versions?: PromptVersion[];
}

interface PromptVersion {
  id: string;
  template_id: string;
  version_number: number;
  content: string;
  variables: Array<{ key: string; label: string; type: string; required: boolean }>;
  changelog: string | null;
  status: "draft" | "active" | "testing" | "archived";
  created_by: string;
  created_at: string;
}
```

### 2.3 Zod Schemas de Validación

```typescript
// src/lib/schemas/tenant.ts
import { z } from "zod";

// ─── Operación ───
export const operationSchema = z.object({
  status: z.enum(["active", "suspended", "onboarding"]),
  orchestrator_url: z.string().url().nullable().optional(),
  api_key_vault_id: z.string().nullable().optional(),
  llm_tier: z.enum(["gemini-flash", "claude-sonnet", "claude-opus"]),
  features: z.record(z.unknown()).default({}),
});

// ─── Branding ───
const oklchRegex = /^oklch\(\s*[\d.]+%?\s+[\d.]+%?\s+[\d.]+(?:deg|rad|turn|grad|%?)?\s*\)$/i;

export const brandingSchema = z.object({
  primary_color: z.string().regex(oklchRegex, "Formato: oklch(L C H)").nullable(),
  accent_color: z.string().regex(oklchRegex, "Formato: oklch(L C H)").nullable().optional(),
  theme_mode: z.enum(["LIGHT", "DARK", "SYSTEM"]).default("SYSTEM"),
  logo_url: z.string().url().nullable().optional(),
});

// ─── Prompts (inline legacy) ───
export const semanticPromptsSchema = z.object({
  sdr: z.string().max(10000),
  gatekeeper: z.string().max(10000),
  rag_l1: z.string().max(10000),
});

// ─── Prompts (versionado) ───
export const promptVersionSchema = z.object({
  content: z.string().min(1).max(50000),
  changelog: z.string().max(500).nullable().optional(),
  status: z.enum(["draft", "active", "testing", "archived"]).default("draft"),
  variables: z.array(z.object({
    key: z.string(),
    label: z.string(),
    type: z.string(),
    required: z.boolean(),
  })).default([]),
});

// ─── Accesos ───
export const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
});

export const updateRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]),
});
```

---

## 3. Diseño por Pestaña

### 3.1 Tab: Operación (value="core")

**Estado actual**: ✅ Funcional (parcial)

**Mutaciones**:
| Acción | Tabla | Operación | Campos |
|--------|-------|-----------|--------|
| Cambiar status | `tenants` | UPDATE | `status` |
| Actualizar orchestrator | `tenants` | UPDATE | `orchestrator_url` |
| Actualizar vault key | `tenants` | UPDATE | `api_key_vault_id` |
| Cambiar LLM tier | `tenant_configs` | UPSERT (on conflict tenant_id) | `llm_tier` |
| Toggle feature flags | `tenant_configs` | UPSERT | `features` |

**Mejoras requeridas**:
- [ ] Migrar a `react-hook-form` + Zod resolver para `operationSchema`
- [ ] Agregar campo `domain` (text input, unique validation)
- [ ] Agregar sección "Feature Flags" con toggles dinámicos desde `features` JSONB
- [ ] Botón de "Kill Switch" (cambiar status a `suspended` con confirmación dialog)

**Componente**: `src/app/tenants/[id]/components/OperationTab.tsx` (extraer del page.tsx actual)

### 3.2 Tab: Branding & UI (value="branding")

**Estado actual**: ⚠️ Código existe pero DB columns faltan

**Pre-requisitos (Migración SQL)**:
```sql
-- Ya existe en 20260424100000_branding_and_users.sql
-- DEBE aplicarse al entorno local:
ALTER TABLE public.tenant_configs ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT 'oklch(0.205 0 0)';
ALTER TABLE public.tenant_configs ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT 'oklch(0.97 0.01 106.42)';
ALTER TABLE public.tenant_configs ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.tenant_configs ADD COLUMN IF NOT EXISTS theme_mode TEXT DEFAULT 'SYSTEM';
```

**Storage Bucket** (NUEVA migración requerida):
```sql
-- Crear bucket con restricciones
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-assets',
  'tenant-assets',
  true,  -- Public read para servir logos
  2097152,  -- 2MB max
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: Solo service_role puede write; público puede read
CREATE POLICY "Public read tenant-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tenant-assets');

CREATE POLICY "Service role write tenant-assets"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'tenant-assets');

CREATE POLICY "Service role delete tenant-assets"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'tenant-assets');

-- RLS: Authenticated admin users can upload to their tenant's folder
CREATE POLICY "Authenticated upload own tenant assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT tu.tenant_id::text FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid() AND tu.role IN ('OWNER', 'ADMIN')
    )
  );
```

**Mutaciones**:
| Acción | Target | Operación |
|--------|--------|-----------|
| Upload logo | `storage.tenant-assets/{tenantId}/branding/logo-{ts}.{ext}` | Storage.upload |
| Save branding | `tenant_configs` | UPDATE `primary_color, accent_color, theme_mode, logo_url` |
| Remove logo | Storage + `tenant_configs` | Storage.remove + UPDATE `logo_url=null` |

**Mejoras requeridas**:
- [ ] Migrar form a `react-hook-form` + `brandingSchema`
- [ ] Agregar `accent_color` field
- [ ] Color picker visual (opcional, v2)
- [ ] Preview en vivo del tema (CSS variables injection)
- [ ] Botón "Reset to defaults"

**Componente**: `src/app/tenants/[id]/components/BrandingTab.tsx` (ya existe, ampliar)

### 3.3 Tab: Prompts & IA (value="prompts")

**Estado actual**: ⚠️ Funciona con `semantic_prompts` JSONB (legacy), pero existen tablas `prompt_templates` + `prompt_versions` sin uso en UI

**Estrategia de migración (dual-write)**:
1. **Fase 1 (inmediata)**: Mantener el editor inline de `semantic_prompts` como "Quick Edit"
2. **Fase 2 (este sprint)**: Agregar UI para `prompt_templates` + `prompt_versions` como "Advanced Prompt Studio"
3. **Fase 3 (futuro)**: Deprecar `semantic_prompts` JSONB, migrar datos a `prompt_versions`

**Mutaciones Fase 1 (Quick Edit — ya implementadas)**:
| Acción | Tabla | Operación |
|--------|-------|-----------|
| Editar prompt SDR | `tenant_configs` | UPDATE `semantic_prompts->sdr` |
| Editar Gatekeeper | `tenant_configs` | UPDATE `semantic_prompts->gatekeeper` |
| Editar RAG L1 | `tenant_configs` | UPDATE `semantic_prompts->rag_l1` |

**Mutaciones Fase 2 (Prompt Studio)**:
| Acción | Tabla | Operación |
|--------|-------|-----------|
| Crear template | `prompt_templates` | INSERT |
| Crear versión | `prompt_versions` | INSERT (auto-increment version_number) |
| Activar versión | `prompt_templates` | UPDATE `active_version_id` |
| Archivar versión | `prompt_versions` | UPDATE `status='archived'` |
| Gestionar variables | `variable_defs` | CRUD |
| A/B Test link | `ab_experiments` | INSERT (referencia template_id) |

**Componentes**:
```
src/app/tenants/[id]/components/
├── PromptsTab.tsx              ← Wrapper con sub-tabs
├── prompts/
│   ├── QuickEditPanel.tsx      ← Editor inline de semantic_prompts (legacy)
│   ├── PromptStudio.tsx        ← Master list de prompt_templates
│   ├── VersionEditor.tsx       ← Editor de versión con diff preview
│   ├── VariableManager.tsx     ← CRUD de variable_defs
│   └── PromptPreview.tsx       ← Renderiza prompt con variables interpoladas
```

### 3.4 Tab: Accesos & Roles (value="access")

**Estado actual**: ❌ Placeholder vacío ("Modulo RBAC en construcción")

**Esquema DB (ya existe)**:
```
tenant_users: id, tenant_id, user_id, role (OWNER|ADMIN|MEMBER|VIEWER), created_at, updated_at
auth.users: id, email, raw_user_meta_data, ...
```

**Mutaciones**:
| Acción | Tabla/Service | Operación |
|--------|---------------|-----------|
| Listar usuarios | `tenant_users` JOIN `auth.users` | SELECT |
| Invitar usuario | `auth.admin.inviteUserByEmail()` + INSERT `tenant_users` | Server Action |
| Cambiar rol | `tenant_users` | UPDATE `role` |
| Revocar acceso | `tenant_users` | DELETE |
| Ver actividad | (futuro: `audit_log`) | SELECT |

**API Route requerida** (invitaciones requieren `service_role`):
```typescript
// src/app/api/tenant/[id]/invite/route.ts
// POST { email, role }
// 1. supabase.auth.admin.inviteUserByEmail(email)
// 2. INSERT INTO tenant_users (tenant_id, user_id, role)
// 3. Return { success: true, user_id }
```

**Componentes**:
```
src/app/tenants/[id]/components/
├── AccessTab.tsx               ← Wrapper principal
├── access/
│   ├── UserTable.tsx           ← Lista de usuarios con roles
│   ├── InviteDialog.tsx        ← Modal de invitación (email + role select)
│   ├── RoleSelect.tsx          ← Dropdown de roles con badge colors
│   └── RevokeDialog.tsx        ← Confirmación de revocación
```

**RLS para Mission Control admin access**:
```sql
-- Mission Control opera como super-admin. Necesitamos una policy que permita
-- a los usuarios autenticados de MC (que están en tenant_users con role='OWNER' 
-- del tenant de Teseo) acceder a TODOS los tenants.

-- Alternativa: MC usa service_role key para bypass total de RLS.
-- Recomendación: Usar service_role en Server Actions/API routes,
-- y anon_key solo para read-only queries autenticadas con RLS via tenant_users.
```

---

## 4. Migración SQL Consolidada

```sql
-- 20260426000000_tenant_management_full.sql
-- ============================================================
-- Paso 1: Aplicar columnas de branding (idempotente)
-- ============================================================

DO $$ BEGIN
    CREATE TYPE theme_mode AS ENUM ('LIGHT', 'DARK', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS domain TEXT UNIQUE;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.tenant_configs ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT 'oklch(0.205 0 0)';
ALTER TABLE public.tenant_configs ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT 'oklch(0.97 0.01 106.42)';
ALTER TABLE public.tenant_configs ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.tenant_configs ADD COLUMN IF NOT EXISTS theme_mode TEXT DEFAULT 'SYSTEM';

-- ============================================================
-- Paso 2: Storage bucket tenant-assets
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-assets', 'tenant-assets', true, 2097152,
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "public_read_tenant_assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'tenant-assets');

CREATE POLICY "authenticated_upload_tenant_assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tenant-assets');

CREATE POLICY "authenticated_delete_tenant_assets" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'tenant-assets');

-- ============================================================
-- Paso 3: Triggers
-- ============================================================

DROP TRIGGER IF EXISTS set_tenants_updated_at ON public.tenants;
CREATE TRIGGER set_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

---

## 5. Estructura de Archivos Final

```
src/app/tenants/[id]/
├── page.tsx                        ← Shell: fetch data, tabs container, save coordination
├── components/
│   ├── OperationTab.tsx            ← NUEVO: extraer lógica de Operación del page.tsx
│   ├── BrandingTab.tsx             ← EXISTENTE: ampliar con accent_color, RHF
│   ├── PromptsTab.tsx              ← EXISTENTE: refactorizar como wrapper
│   ├── AccessTab.tsx               ← NUEVO: reemplazar placeholder
│   ├── prompts/
│   │   ├── QuickEditPanel.tsx      ← NUEVO: extraer lógica inline actual
│   │   ├── PromptStudio.tsx        ← NUEVO: prompt_templates CRUD
│   │   ├── VersionEditor.tsx       ← NUEVO: editor con preview
│   │   └── VariableManager.tsx     ← NUEVO: variable_defs CRUD
│   └── access/
│       ├── UserTable.tsx           ← NUEVO
│       ├── InviteDialog.tsx        ← NUEVO
│       ├── RoleSelect.tsx          ← NUEVO
│       └── RevokeDialog.tsx        ← NUEVO

src/lib/
├── schemas/
│   └── tenant.ts                   ← NUEVO: Zod schemas consolidados

src/hooks/
├── useTenantDetailStore.ts         ← NUEVO: Zustand store per-tenant detail
├── useTenantStore.ts               ← EXISTENTE: mantener para theme global

src/app/api/tenant/
├── config/route.ts                 ← EXISTENTE: refactorizar con tenant isolation
├── [id]/
│   ├── invite/route.ts             ← NUEVO: invitación de usuarios
│   ├── users/route.ts              ← NUEVO: CRUD de tenant_users
│   └── prompts/route.ts            ← NUEVO: CRUD de prompt_templates
```

---

## 6. Flujos de Mutación Detallados

### 6.1 Flujo de Guardado (Operación)

```
Usuario cambia status → react-hook-form onChange
 → Click "Guardar"
 → operationSchema.safeParse(formData)
 → IF error → toast.error(field errors)
 → IF success →
     1. supabase.from('tenants').update({status, orchestrator_url, api_key_vault_id, domain}).eq('id', tenantId)
     2. supabase.from('tenant_configs').upsert({tenant_id, llm_tier, features}, {onConflict: 'tenant_id'})
     → toast.success("Operación actualizada")
     → store.setTenant(updated), store.setConfig(updated)
```

### 6.2 Flujo de Upload de Logo (Branding)

```
Usuario selecciona archivo
 → Validar client-side: type ∈ [image/png, jpeg, svg, webp], size ≤ 2MB
 → supabase.storage.from('tenant-assets').upload(`${tenantId}/branding/logo-${Date.now()}.${ext}`, file, {upsert: true})
 → IF error → toast.error("Upload fallido")
 → IF success →
     → getPublicUrl() → setLogoUrl(publicUrl)
     → supabase.from('tenant_configs').update({logo_url: publicUrl}).eq('tenant_id', tenantId)
     → toast.success("Logo actualizado")
```

### 6.3 Flujo de Invitación de Usuario (Accesos)

```
Admin abre InviteDialog → ingresa email + selecciona role
 → inviteUserSchema.safeParse({email, role})
 → POST /api/tenant/{tenantId}/invite { email, role }
 → Server Action:
     1. const supabase = createServiceRoleClient()
     2. const { data: user } = await supabase.auth.admin.inviteUserByEmail(email)
     3. await supabase.from('tenant_users').insert({tenant_id, user_id: user.id, role})
     4. Return { success: true }
 → Client: refetch users list → toast.success("Invitación enviada")
```

### 6.4 Flujo de Versión de Prompt (Prompts Avanzado)

```
Admin selecciona template (ej: SDR) → ve lista de versiones
 → Click "Nueva Versión"
 → Editor de texto con syntax highlighting
 → Variables detectadas automáticamente via regex: {{variable_name}}
 → Click "Guardar Borrador"
     → INSERT prompt_versions (template_id, version_number=max+1, content, variables, status='draft')
 → Click "Activar"
     → UPDATE prompt_versions SET status='active' WHERE id=X
     → UPDATE prompt_templates SET active_version_id=X WHERE id=template_id
     → UPDATE prompt_versions SET status='archived' WHERE template_id=T AND id != X AND status='active'
     → toast.success("Versión activada — LangGraph consumirá los cambios en próximas conversaciones")
```

---

## 7. Seguridad — Zero-Trust Checklist

| Control | Estado | Implementación |
|---------|--------|----------------|
| RLS en `tenants` | ✅ | Policy `tenant_isolation_tenants` |
| RLS en `tenant_configs` | ✅ | Policy `tenant_isolation_tenant_configs` |
| RLS en `tenant_users` | ✅ | Service Role + user self-read |
| RLS en `prompt_templates` | ✅ | JWT tenant_id check |
| RLS en `prompt_versions` | ✅ | Subquery via template |
| RLS en `storage.tenant-assets` | ⬜ PENDIENTE | Crear con migración §4 |
| Server-side Zod validation | ⬜ PENDIENTE | Implementar schemas §2.3 |
| Service role isolation (invite API) | ⬜ PENDIENTE | API route con service_role |
| CSRF protection | ✅ | Next.js built-in (SameSite cookies) |
| Input sanitization (prompts) | ⬜ PENDIENTE | Zod max length + HTML strip |
| Rate limiting (invite) | ⬜ NICE-TO-HAVE | Edge middleware |

---

## 8. Plan de Implementación (Orden de Ejecución)

### Sprint 1 — Fundación (Ejecutor debe hacer primero)

| Paso | Acción | Archivo(s) | Estimado |
|------|--------|------------|----------|
| 1 | Aplicar migración SQL consolidada | `20260426000000_tenant_management_full.sql` | 5 min |
| 2 | Crear Zod schemas | `src/lib/schemas/tenant.ts` | 20 min |
| 3 | Crear `useTenantDetailStore` | `src/hooks/useTenantDetailStore.ts` | 20 min |
| 4 | Extraer `OperationTab.tsx` del page.tsx | Tab Operación | 30 min |
| 5 | Ampliar `BrandingTab.tsx` (accent_color, RHF, bucket) | Tab Branding | 40 min |
| 6 | Refactorizar page.tsx como shell de tabs | Container | 20 min |

### Sprint 2 — Accesos & Roles

| Paso | Acción | Archivo(s) | Estimado |
|------|--------|------------|----------|
| 7 | Crear API route `/api/tenant/[id]/invite` | Server route | 30 min |
| 8 | Crear API route `/api/tenant/[id]/users` | Server route | 20 min |
| 9 | Implementar `AccessTab.tsx` + sub-componentes | 4 archivos | 60 min |

### Sprint 3 — Prompts Avanzados

| Paso | Acción | Archivo(s) | Estimado |
|------|--------|------------|----------|
| 10 | Crear `QuickEditPanel.tsx` (extraer de PromptsTab actual) | 1 archivo | 15 min |
| 11 | Implementar `PromptStudio.tsx` | CRUD templates | 45 min |
| 12 | Implementar `VersionEditor.tsx` | Editor + diff | 45 min |
| 13 | Implementar `VariableManager.tsx` | CRUD variables | 30 min |
| 14 | Refactorizar `PromptsTab.tsx` como wrapper | Integración | 15 min |

### Sprint 4 — Hardening

| Paso | Acción | Estimado |
|------|--------|----------|
| 15 | E2E tests con Playwright | 60 min |
| 16 | Security audit: verify RLS, bucket policies | 30 min |
| 17 | Deploy a staging + validación cruzada | 30 min |

---

## 9. Diagrama de Dependencias entre Tablas

```
                    ┌──────────┐
                    │ tenants  │
                    │ (master) │
                    └────┬─────┘
            ┌────────────┼────────────┬───────────────┐
            ▼            ▼            ▼               ▼
    ┌──────────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐
    │tenant_configs│ │tenant_   │ │prompt_       │ │ documents    │
    │(1:1 branding │ │users     │ │templates     │ │              │
    │ + AI config) │ │(RBAC)    │ │              │ │              │
    └──────────────┘ └──────────┘ └──────┬───────┘ └──────────────┘
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │prompt_       │
                                  │versions      │
                                  └──────┬───────┘
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │ab_experiments│
                                  │(A/B testing) │
                                  └──────────────┘
```

---

## 10. Notas para el Ejecutor

1. **Prioridad de ejecución**: Migración SQL → Schemas → Store → OperationTab → BrandingTab → AccessTab → PromptsTab
2. **El page.tsx actual es monolítico**: Debe refactorizarse para que solo sea un shell de tabs que delega a componentes hijos.
3. **La migración 20260424100000 ya existe en el CRM repo** pero NO se ha aplicado al entorno local de Mission Control. Verificar antes de duplicar.
4. **El bucket `tenant-assets` no existe**: Debe crearse via SQL o via Supabase Dashboard antes de que BrandingTab funcione.
5. **Las invitaciones requieren `service_role`**: Crear un segundo Supabase client (`createServiceClient()`) que use `SUPABASE_SERVICE_ROLE_KEY` exclusivamente en API routes.
6. **Zero-Trust Loop**: Cada mutation debe:
   - Validarse con Zod en client Y server
   - Usar RLS (no bypass en client-side)
   - Loggear cambios críticos (status, role changes)
   - Pasar por review en staging antes de production

---

*Documento generado por Builder Agent. Listo para entrega al Ejecutor.*
