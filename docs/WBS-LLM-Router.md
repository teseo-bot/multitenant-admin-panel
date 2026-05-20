# WBS: LLM Router (Enrutador de Modelos)

## 1. Propósito y Arquitectura
El objetivo principal de este componente es unificar la instanciación de los modelos de IA (OpenAI, Anthropic, Gemini) en una fábrica centralizada (**Factory Pattern**).

Anteriormente, los modelos se instanciaban de manera dispersa directamente en cada nodo (`src/nodes/`), lo que provocaba alta redundancia y el error detectado en QA: `Missing credentials`. Con el **LLM Router**, se extrae la configuración de credenciales del flujo de los nodos, garantizando una única fuente de verdad y una inyección correcta para todos los agentes del sistema.

## 2. Gestión de Variables de Entorno (.env) y Fail-Fast
Para resolver definitivamente la falta de credenciales en producción y en local, el sistema implementará un esquema **Fail-Fast** en el arranque.
- El entorno de despliegue validará obligatoriamente la existencia de las llaves necesarias (ej. `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) antes de levantar el servidor.
- Si las variables requeridas no se encuentran en el `.env` o en el entorno, el proceso lanzará un error crítico y detendrá el arranque. No habrá intentos de ejecución de nodos si el router no puede asegurar su instanciación.

## 3. Firma Técnica (Pseudocódigo)
El enrutador expone una función central que toma un proveedor y las opciones deseadas, retornando el LLM instanciado de LangChain (o SDK respectivo).

```typescript
// src/llm/router.ts
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";

interface LLMConfig {
  temperature?: number;
  modelName?: string;
  // otras configuraciones opcionales
}

type Provider = 'openai' | 'anthropic' | 'gemini';

export function getLLM(provider: Provider, config?: LLMConfig): any {
  // En caso de estar en test, retornar el mock inmediatamente
  if (process.env.NODE_ENV === 'test') {
    return new MockLLM(config);
  }

  // Validación de llaves Fail-Fast ya asumida en el boot, pero se inyectan explícitamente.
  switch (provider) {
    case 'openai':
      return new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        temperature: config?.temperature ?? 0,
        modelName: config?.modelName ?? 'gpt-4o',
      });
    case 'anthropic':
      return new ChatAnthropic({
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        temperature: config?.temperature ?? 0,
        modelName: config?.modelName ?? 'claude-3-5-sonnet-latest',
      });
    // ... Implementación para Gemini
    default:
      throw new Error(`Proveedor de LLM no soportado: ${provider}`);
  }
}
```

## 4. Soporte para Mocks (Testing)
Durante los ambientes de prueba (`NODE_ENV=test`), el LLM Router bloqueará cualquier petición a APIs externas proveyendo la clase especializada `MockLLM`.

- **MockLLM** sobreescribe el método `invoke()` para devolver respuestas en texto controladas predefinidas para la prueba.
- También sobreescribe el método `withStructuredOutput()` para simular la devolución de esquemas JSON estructurados perfectos.
- **Ventaja:** Permite que la suite de QA ejecute todos los grafos y nodos de manera rápida y determinista, garantizando cero consumo de tokens y resolviendo la necesidad de llaves de API reales en los pipelines de CI/CD.