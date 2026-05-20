# ADR-137: Edge FinOps Engine (LangGraph Token Ledger)

## 1. Contexto y Problema
De acuerdo con el **ADR-096**, se ejecutó un bypass al AI Gateway interno para conectar directamente los nodos del grafo LangGraph con los proveedores (OpenAI/Anthropic/Google). Esta decisión preservó la integridad del Tool Calling, pero nos dejó ciegos a nivel operativo: perdimos el registro centralizado de tokens, impidiendo facturar con precisión a los Tenants (SaaS B2B).
Requerimos recuperar el control de costos (FinOps) calculando el uso exacto de Input/Output tokens por Tenant, directamente desde la ejecución del grafo.

## 2. Decisión Arquitectónica
Implementaremos un "Edge FinOps Engine". En lugar de un proxy proxy (Gateway), utilizaremos el sistema de **Callbacks nativo de Langchain**. 
Crearemos un manejador (`FinOpsCallbackHandler`) que se inyectará en el `StateGraph`. Este escuchará el evento `handleLLMEnd`, extraerá el uso de tokens de la respuesta cruda del proveedor y escribirá asíncronamente en una tabla agregada en Supabase (Tenant Token Ledger).

### 2.1 Restricciones Inquebrantables
1. **Asincronía Total:** El `FinOpsCallbackHandler` NO debe bloquear la respuesta del LLM hacia el usuario. La inserción a Supabase debe dispararse en *background* (fire-and-forget).
2. **Aislamiento Multitenant (ADR-135):** Toda transacción en el ledger debe ir obligatoriamente atada al `tenant_id` y al `thread_id` extraídos del contexto (configuración del Runnable).

## 3. Topología de Componentes

### 3.1 Base de Datos (PostgreSQL / Supabase)
Se requieren dos tablas nuevas:
- **`finops_model_pricing`**: Diccionario maestro de costos (ej. costo por 1M tokens in/out).
- **`finops_token_ledger`**: Libro mayor de transacciones.

**Esquema SQL Propuesto:**
```sql
CREATE TABLE public.finops_model_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name TEXT NOT NULL UNIQUE, -- ej. "google/gemini-3.1-pro-preview"
    input_cost_per_million NUMERIC NOT NULL,
    output_cost_per_million NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.finops_token_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL, -- Clave foránea al Tenant
    thread_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    total_cost NUMERIC NOT NULL DEFAULT 0.0, -- Calculado vía trigger o app
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para el Dashboard FinOps
CREATE INDEX idx_finops_ledger_tenant ON public.finops_token_ledger(tenant_id);
CREATE INDEX idx_finops_ledger_created_at ON public.finops_token_ledger(created_at);
```

### 3.2 Capa de Captura (LangGraph Callback)
**Implementación (TypeScript):**
```typescript
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { LLResult } from "@langchain/core/outputs";
import { createClient } from "@/utils/supabase/server"; // O supabase-admin para server-side logic

export class FinOpsCallbackHandler extends BaseCallbackHandler {
  name = "FinOpsCallbackHandler";
  private tenantId: string;
  private threadId: string;

  constructor(tenantId: string, threadId: string) {
    super();
    this.tenantId = tenantId;
    this.threadId = threadId;
  }

  async handleLLMEnd(output: LLResult, runId: string) {
    const tokenUsage = output.llmOutput?.tokenUsage;
    const modelName = output.llmOutput?.modelName || "unknown";

    if (tokenUsage) {
      const { promptTokens, completionTokens } = tokenUsage;
      
      // Fire-and-forget: No usamos await para no bloquear el hilo de ejecución principal.
      // En un entorno de Next.js / Cloud Run, debemos asegurar que el entorno Edge/Node 
      // permita promesas 'flotantes' (waitUntilContext en Vercel, o promise.catch).
      this.logUsage(modelName, promptTokens || 0, completionTokens || 0).catch(console.error);
    }
  }

  private async logUsage(modelName: string, inputTokens: number, outputTokens: number) {
     const supabase = await createClient(); // Requiere contexto asíncrono adecuado
     
     await supabase.from('finops_token_ledger').insert({
         tenant_id: this.tenantId,
         thread_id: this.threadId,
         model_name: modelName,
         input_tokens: inputTokens,
         output_tokens: outputTokens
         // El costo total se puede calcular aquí o mediante un DB Trigger.
     });
  }
}
```

### 3.3 Capa de Orquestación (StateGraph)
Al invocar el grafo, se debe instanciar e inyectar el Callback:
```typescript
const finOpsCallback = new FinOpsCallbackHandler(tenantId, threadId);
const config = {
  configurable: { thread_id: threadId },
  callbacks: [finOpsCallback]
};
await graph.invoke(inputs, config);
```

## 4. Work Breakdown Structure (WBS) para Ejecutor

| ID | Tarea | Componente Afectado | Criterio de Aceptación |
|----|-------|---------------------|-------------------------|
| 1.1 | Migración SQL DB | Supabase SQL Editor / Migrations | Tablas `finops_model_pricing` y `finops_token_ledger` creadas con índices. |
| 2.1 | Implementar Callback | `src/lib/langgraph/callbacks/finops-callback.ts` | Clase `FinOpsCallbackHandler` hereda de `BaseCallbackHandler` y procesa `handleLLMEnd`. |
| 2.2 | Inyección en Grafo | Archivo de inicialización del `StateGraph` | El handler se instancia con `tenant_id` y se pasa en la configuración de ejecución (`config.callbacks`). |
| 3.1 | Test (Unit/Integration) | Ejecución de prueba del Agente | Se verifica que tras una respuesta del LLM, se inserte un registro correcto en `finops_token_ledger` sin bloquear la respuesta. |

## 5. Consecuencias
- **Positivas:** Recuperamos visibilidad financiera exacta por Tenant y por Hilo, permitiendo facturación cruzada (Chargeback) y control de márgenes, respetando el Tool Calling nativo.
- **Negativas:** Incrementa ligeramente la carga de I/O en Supabase (una inserción extra por cada turno del agente). Es necesario asegurar que promesas flotantes (fire-and-forget) no sean canceladas prematuramente por el runtime *Serverless* antes de concluir.
