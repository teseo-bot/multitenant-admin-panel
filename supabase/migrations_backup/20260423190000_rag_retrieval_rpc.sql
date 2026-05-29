-- ============================================================
-- RFC-049: Integración RAG en LangGraph (Retrieval Node)
-- Stored Procedure para similitud de coseno con Zero-Trust
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- Función de similitud semántica con aislamiento de tenant estricto
CREATE OR REPLACE FUNCTION match_tenant_memories(
    query_embedding vector(768),
    match_threshold float,
    match_count int,
    p_tenant_id uuid
)
RETURNS TABLE (
    id uuid,
    content text,
    metadata jsonb,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER -- Ejecutar con privilegios del definidor (bypassing RLS en la llamada, pero filtrando manualmente)
AS $$
BEGIN
    -- Validación de seguridad temprana (Zero-Trust)
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'p_tenant_id no puede ser nulo. Aislamiento de inquilino comprometido.';
    END IF;

    -- Verificar que el tenant existe para evitar escaneos inútiles
    IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
        RAISE EXCEPTION 'El tenant_id proporcionado (%) no existe.', p_tenant_id;
    END IF;

    RETURN QUERY
    SELECT
        tm.id,
        tm.content,
        tm.metadata,
        1 - (tm.embedding <=> query_embedding) AS similarity
    FROM public.tenant_memories tm
    WHERE tm.tenant_id = p_tenant_id -- FILTRO ZERO-TRUST (obligatorio antes del cálculo)
      AND tm.embedding IS NOT NULL
      AND 1 - (tm.embedding <=> query_embedding) >= match_threshold
    ORDER BY tm.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
