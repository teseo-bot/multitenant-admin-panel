# ADR-109: FinOps - Tenant Token Usage & Financial Summary

## 1. Contexto y Objetivo
El Bloque 8 de Mission Control (fleetco-core) se enfoca en FinOps (Financial Operations). Es imperativo rastrear, atribuir y resumir el costo de la infraestructura de IA por cada "tenant" (cliente o entorno aislado). Se requiere un diseño no bloqueante que extraiga el consumo de tokens desde el grafo de LangGraph y lo persista en Supabase de forma segura.

## 2. Esquema SQL

### Tabla: `tenant_token_usage`
Almacenará el registro inmutable de cada transacción de inferencia de LLM.

```sql
CREATE TABLE public.tenant_token_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL, -- FK a tabla de tenants (asumida)
    session_id UUID NOT NULL,
    model_name VARCHAR(255) NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
    estimated_cost_usd NUMERIC(10, 6) DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Vista: `tenant_financial_summary_view`
Agregará los datos para métricas rápidas de los dashboards.

```sql
CREATE VIEW public.tenant_financial_summary_view AS
SELECT 
    tenant_id,
    DATE_TRUNC('month', created_at) AS billing_month,
    SUM(total_tokens) AS total_tokens_used,
    SUM(estimated_cost_usd) AS total_cost_usd,
    COUNT(id) AS total_requests
FROM 
    public.tenant_token_usage
GROUP BY 
    tenant_id, DATE_TRUNC('month', created_at);
```

## 3. Seguridad: Row Level Security (RLS)

Es imperativo asegurar que ningún tenant pueda ver o modificar los datos de facturación de otro.

1. **Habilitar RLS:** `ALTER TABLE public.tenant_token_usage ENABLE ROW LEVEL SECURITY;`
2. **Política de Lectura (Tenants):** Los usuarios autenticados solo pueden leer registros donde `tenant_id` coincida con su token JWT (ej. `auth.jwt() ->> 'tenant_id'`).
3. **Política de Escritura (Service Role):** La inserción de registros se hará **exclusivamente** desde el backend (LangGraph / Node.js) utilizando la Service Role Key de `@supabase/supabase-js`. 
   - *Restricción:* Ningún cliente (frontend) ni usuario autenticado tiene permisos de `INSERT`, `UPDATE` o `DELETE` sobre esta tabla.

## 4. Arquitectura de Software: Intercepción en LangGraph

Para no afectar la latencia percibida por el usuario, el registro de métricas será asíncrono y desacoplado del "Critical Path".

**Estrategia:**
- **Dónde interceptar:** En el nodo final de LangGraph (ej. un nodo `format_response` o mediante un `StateGraph` callback) o en el wrapper/middleware de la llamada al modelo (ej. usando el sistema de callbacks `onLLMEnd` de LangChain/LangGraph).
- **Cómo extraer:** De la propiedad `response_metadata.token_usage` retornada por los modelos (OpenAI, Anthropic, Gemini proveen esto unificadamente vía LangChain/LangGraph).
- **Ejecución Asíncrona:** Se utilizará un "fire and forget" o una cola ligera (como una promesa sin `await` dentro del handler de la request, pero capturando errores para no tumbar el proceso). 
- **Persistencia:** Se usará `@supabase/supabase-js` instanciado con el `SUPABASE_SERVICE_ROLE_KEY` para eludir restricciones de RLS de cliente y asegurar la escritura.

## 5. Trade-offs Evaluados

| Decisión | Pros | Contras / Riesgos |
|----------|------|-------------------|
| **Promesa asíncrona "Fire-and-forget" vs Cola de mensajes** | Menor complejidad de infraestructura. Respuesta inmediata al cliente. | Riesgo de pérdida de datos si el contenedor Node se destruye abruptamente antes de resolverse la promesa. |
| **Cálculo de `estimated_cost_usd` en BD vs en App** | Flexibilidad para inyectar precios dinámicos desde el backend al momento de la inserción. | El backend necesita conocer o consultar la tabla de precios por modelo en memoria. |
| **Inserción directa en Supabase vs Batching** | Trazabilidad en tiempo real. | Alta carga de escrituras si el volumen de requests es masivo (solucionable a futuro: migrar a batching). |

## 6. Work Breakdown Structure (WBS) - Listo para el Ejecutor

1. **[BD] Implementar migraciones SQL:**
   - Crear tabla `tenant_token_usage`.
   - Crear vista `tenant_financial_summary_view`.
   - Aplicar políticas RLS para lectura (tenant-bound) y bloquear escrituras públicas.
2. **[Backend] Módulo FinOps Service:**
   - Crear clase/servicio `FinOpsLogger`.
   - Inyectar cliente Supabase (con Service Role Key).
   - Implementar método `logUsageAsync(tenantId, sessionId, modelName, tokenUsage)`.
3. **[Backend] Integración LangGraph:**
   - Crear callback handler `FinOpsCallbackHandler` extendiendo `BaseCallbackHandler` (o el equivalente en el stack actual).
   - Sobrescribir `handleLLMEnd` para extraer `response_metadata.token_usage`.
   - Llamar a `FinOpsLogger.logUsageAsync` sin usar `await` bloqueante en el flujo principal (o delegarlo a un micro-task runner de Node).
4. **[Pruebas] Validar asincronía y RLS:**
   - (Tarea para el Tester) Asegurar que el tiempo de respuesta del LLM no aumente al activar el logger.
   - Confirmar que consultas con JWT de cliente o usuario estándar fallan al intentar insertar o alterar datos directamente en la base de datos.

## 7. Notas de Implementación y Fixes Post-Auditoría

Durante la fase de implementación y auditoría del Bloque 8 (FinOps), se encontraron y resolvieron los siguientes bloqueos:

- **Cambio de UUID a VARCHAR(255):** Se modificó el tipo de dato para tolerar los ID nominales del orquestador (`public_tenant`), sustituyendo el tipo `UUID` por `VARCHAR(255)` en los esquemas.
- **Encapsulamiento IIFE (Immediately Invoked Function Expression):** Se encapsuló la llamada a Supabase en una IIFE asíncrona para proteger el hilo de LangGraph, compensando la falta del método `.catch()` en el cliente de `Supabase-js` durante las ejecuciones "fire-and-forget".
- **Corrección de tipado a `ChatGeneration`:** Se ajustaron y corrigieron los tipos a `ChatGeneration` de Langchain para garantizar la correcta extracción e inferencia de los metadatos de uso de tokens.
