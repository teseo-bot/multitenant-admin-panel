# RFC: Sincronización de Storage y Webhook para Asset Studio (Fase 2)

## 1. Unificación de Buckets
El Learner ha identificado que el objetivo arquitectónico define como bucket oficial a `asset_snapshots_bucket`, pero actualmente el backend utiliza `tenant_documents`.
**Acción Requerida:** Actualizar la constante/referencia del bucket en el archivo `app/api/asset-studio/documents/upload/route.ts` de `tenant_documents` a `asset_snapshots_bucket`.

## 2. Script de Migración SQL
Se requiere una migración consolidada que establezca la infraestructura en Supabase. El script (ej. `supabase/migrations/20260423_asset_studio_storage.sql`) debe contener:

### 2.1. Creación del Bucket
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('asset_snapshots_bucket', 'asset_snapshots_bucket', false)
ON CONFLICT (id) DO NOTHING;
```

### 2.2. Creación de la Tabla `documents`
Se debe oficializar la tabla en la base de datos con sus respectivos campos.
```sql
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.3. Políticas RLS (Row Level Security)
Se deben aplicar políticas robustas tanto para el bucket de Storage como para la tabla de la base de datos.
**Para la tabla `documents`:**
```sql
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their tenant documents"
ON public.documents FOR ALL
USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```
**Para el Storage (`asset_snapshots_bucket`):**
Asegurar que los usuarios autenticados solo puedan hacer Insert y Select si el primer segmento de la ruta del archivo corresponde a su `tenant_id`. *(El Ejecutor deberá definir esto usando `storage.foldername(name)[1]` o equivalente)*.

## 3. Trigger Webhook (`net.http_post`)
Crear una función y un trigger que reaccione al `INSERT` en la tabla `documents` (o cuando su estado cambie a `'processing'`) y delegue el trabajo al CRM Agentico.

```sql
-- Habilitar extensión pg_net si no existe
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_crm_compiler()
RETURNS TRIGGER AS $$
BEGIN
    -- Realizar POST asíncrono
    PERFORM net.http_post(
        url := 'https://<ENDPOINT_DEL_CRM_COMPILER>/webhook/process-document',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := json_build_object(
            'document_id', NEW.id,
            'tenant_id', NEW.tenant_id,
            'file_path', NEW.file_path,
            'status', NEW.status
        )::jsonb
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_compiler
AFTER INSERT OR UPDATE OF status ON public.documents
FOR EACH ROW
WHEN (NEW.status = 'processing' OR (TG_OP = 'INSERT'))
EXECUTE FUNCTION public.notify_crm_compiler();
```

## 4. WBS (Work Breakdown Structure) para el Ejecutor

Esta es la lista secuencial para implementar la Fase 2 del Asset Studio:

1. **[  ] Crear Script de Migración SQL:**
   - Crear un nuevo archivo en `supabase/migrations/` (ej. `<timestamp>_asset_studio_storage.sql`).
   - Implementar la creación del bucket `asset_snapshots_bucket`.
   - Implementar la creación de la tabla `documents`.
   - Aplicar políticas de RLS para tabla y bucket de Storage validando el `tenant_id`.
2. **[  ] Configurar Webhook via `pg_net`:**
   - Dentro del mismo script de migración, asegurar que la extensión `pg_net` esté activa.
   - Declarar la función `notify_crm_compiler()` haciendo el `net.http_post` y atarla al trigger de la tabla `documents`. *(Nota: Ajustar la URL del webhook usando configuraciones en BD si aplica).*
3. **[  ] Refactorizar Backend (route.ts):**
   - Modificar `app/api/asset-studio/documents/upload/route.ts` para cambiar todas las referencias del bucket `tenant_documents` a `asset_snapshots_bucket`.
4. **[  ] Despliegue y Validación (Local):**
   - Ejecutar la migración localmente (`supabase db reset` / `push`).
   - Validar que al subir un documento, caiga en el bucket correcto, se inserte en la tabla y el Webhook se dispare asíncronamente sin bloquear la interfaz.
