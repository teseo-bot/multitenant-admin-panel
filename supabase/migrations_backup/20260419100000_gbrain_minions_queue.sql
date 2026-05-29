-- ADR-106: Continuous Learning & Durable Jobs (GBrain Minions)
-- Migración para inicializar pg-boss y la cola asíncrona en Supabase.
-- Requiere la extensión pgcrypto, que normalmente está activada por defecto.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- El esquema pg-boss se creará automáticamente en un esquema dedicado 'pgboss' o similar 
-- si usamos la librería cliente de NodeJS, pero para asegurar la visibilidad en Supabase, 
-- preparamos los roles y la tabla genérica si no usamos la instalación automática.

-- NOTA: Lo más estándar para pg-boss es dejar que la propia librería inicialice el esquema
-- cuando el Worker arranca con el flag { schema: 'boss' }. Sin embargo, para cumplir con
-- la infraestructura declarativa de Supabase, creamos un esquema explícito o usamos public.

-- Si preferimos gestionar los trabajos nativamente en 'public' como 'job' (como cita el ADR-106):
CREATE TABLE IF NOT EXISTS public.job (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  state TEXT NOT NULL DEFAULT 'created',
  retry_limit INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  retry_delay INTEGER NOT NULL DEFAULT 0,
  retry_backoff BOOLEAN NOT NULL DEFAULT false,
  start_after TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_on TIMESTAMP WITH TIME ZONE,
  singleton_key TEXT,
  singleton_on TIMESTAMP WITHOUT TIME ZONE,
  expire_in INTERVAL NOT NULL DEFAULT interval '15 minutes',
  created_on TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_on TIMESTAMP WITH TIME ZONE,
  keep_until TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now() + interval '14 days'
);

-- Índices de rendimiento para los Minions
CREATE INDEX IF NOT EXISTS job_name_idx ON public.job (name);
CREATE INDEX IF NOT EXISTS job_state_idx ON public.job (state);
CREATE INDEX IF NOT EXISTS job_start_after_idx ON public.job (start_after);

-- Habilitar RLS aunque sea gestionada por backend
ALTER TABLE public.job ENABLE ROW LEVEL SECURITY;

-- Solo Service Role (nuestros Workers y Orchestrador) puede manipular esta tabla
CREATE POLICY "Service Role Full Access to Jobs" 
ON public.job 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

COMMENT ON TABLE public.job IS 'Cola de trabajos duraderos para los Minion Workers (ADR-106).';
