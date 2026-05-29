-- ═══════════════════════════════════════════════════════
-- Migración: Agregar canvas_data JSONB a prompt_versions
-- Sprint 5.5 — Persistencia de Canvas Layout
-- ═══════════════════════════════════════════════════════

-- 1. Agregar columna JSONB nullable (no rompe datos existentes)
ALTER TABLE prompt_versions
  ADD COLUMN IF NOT EXISTS canvas_data JSONB;

-- 2. Comentario descriptivo
COMMENT ON COLUMN prompt_versions.canvas_data IS
  'Layout completo del Canvas serializado como JSON. Estructura: { width, height, background, nodes[], nodeOrder[], metadata }. NULL = versión sin layout visual (solo texto de prompt).';

-- 3. Índice GIN para queries futuras sobre nodos específicos
CREATE INDEX IF NOT EXISTS idx_prompt_versions_canvas_data
  ON prompt_versions USING GIN (canvas_data jsonb_path_ops);

-- 4. Constraint CHECK para validar estructura mínima cuando no es NULL
ALTER TABLE prompt_versions
  ADD CONSTRAINT chk_canvas_data_structure
  CHECK (
    canvas_data IS NULL
    OR (
      canvas_data ? 'width'
      AND canvas_data ? 'height'
      AND canvas_data ? 'nodes'
      AND jsonb_typeof(canvas_data -> 'nodes') = 'array'
    )
  );
