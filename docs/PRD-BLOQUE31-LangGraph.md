# PRD Bloque 31: LangGraph (Inyección de Tools y Desacoplamiento de Prompts en Nodo SDR)

## 1. Objetivo del Documento
Este PRD detalla la arquitectura, las interfaces exactas y las tareas necesarias para:
1. Inyectar nuevas herramientas de **Web Scraping** y **CRM** en el orquestador (`crm-agentico-orchestrator`), específicamente para ser consumidas por el **Nodo SDR**.
2. Desacoplar los *system prompts* hardcodeados del nodo SDR (`sdr.ts`), migrándolos a un archivo de configuración centralizado (`prompts.ts`).

## 2. Contexto de la Topología Actual
Actualmente, el archivo `src/nodes/sdr.ts` inicializa su agente de la siguiente manera:
- Tiene un arreglo de herramientas locales y de Workspace (`updateLeadProfileTool`, `escalateToHumanTool`, `readInboxTool`, `checkCalendarTool`, `bookMeetingTool`, `searchDriveTool`).
- El prompt de sistema está fuertemente acoplado (hardcodeado) dentro de la función `sdrNode` como una interpolación de cadenas `SystemMessage(\`Eres un asesor comercial...\`)`.

Esta estructura requiere ser refactorizada para permitir una evaluación (Triage/Eval) dinámica y permitir que el SDR haga *research* web de los prospectos y sincronice directamente los datos a un CRM.

## 3. Especificaciones de Diseño e Interfaces Exactas

### 3.1. Archivo de Prompts Centralizado (`src/nodes/prompts.ts`)
Se debe crear este archivo exportando constructores de prompts que acepten el estado como parámetro.

```typescript
// src/nodes/prompts.ts
import { SystemMessage } from "@langchain/core/messages";
import type { GraphStateType } from "../state.js";

export const getSdrPrompt = (state: GraphStateType): SystemMessage => {
  return new SystemMessage(
    `Eres un asesor comercial experto (SDR) de Fleetco. Tu objetivo es pre-cualificar leads que nos contactan por WhatsApp.
Reglas estrictas:
1. Sé extremadamente breve. Respuestas de 1 a 2 oraciones máximo.
2. Nunca pidas todos los datos a la vez. Haz solo una pregunta por turno.
3. Si el usuario proporciona datos de contacto o un dominio web, investiga la URL con scrape_website y registra/actualiza el prospecto en el CRM con sync_crm_lead.
4. Si el lead pide hablar con un humano o parece frustrado, usa escalate_to_human.
5. Usa check_calendar_tool para validar disponibilidad y book_meeting_tool para agendar la llamada en Google Meet.
Perfil actual del Lead extraído en la conversación: ${JSON.stringify(state.leadProfile)}`
  );
};
```

### 3.2. Interfaz: Herramienta de Web Scraping (`src/tools/scraping.ts`)
La herramienta debe permitir al SDR investigar dominios provistos por el usuario para obtener contexto sobre la empresa antes de cualificarlos a fondo.

**Esquema Zod (Interfaz):**
```typescript
import { z } from "zod";
import { tool } from "@langchain/core/tools";

export const scrapeWebsiteSchema = z.object({
  url: z.string().url().describe("La URL válida de la página web de la empresa del prospecto (ej. https://empresa.com)."),
  focus_area: z.enum(["about", "pricing", "contact", "general"]).optional().describe("Qué tipo de información priorizar al analizar la página.")
});

// Firma de la herramienta
// export const scrapeWebsiteTool = tool(async ({ url, focus_area }) => { ... }, { name: "scrape_website", description: "...", schema: scrapeWebsiteSchema })
```

### 3.3. Interfaz: Herramienta de CRM (`src/tools/crm.ts`)
Esta herramienta sustituirá o complementará la actual de "Update Lead Profile", pero comunicándose directamente con la API del CRM.

**Esquema Zod (Interfaz):**
```typescript
import { z } from "zod";
import { tool } from "@langchain/core/tools";

export const syncCrmLeadSchema = z.object({
  phone: z.string().describe("Número de teléfono del contacto (llave primaria)."),
  name: z.string().optional().describe("Nombre de la persona."),
  company: z.string().optional().describe("Nombre de la empresa."),
  pain_point: z.string().optional().describe("Dolor principal o necesidad expresada por el prospecto."),
  lead_score: z.number().min(1).max(10).optional().describe("Calificación estimada del prospecto del 1 al 10 en base al ICP.")
});

// Firma de la herramienta
// export const syncCrmLeadTool = tool(async (input) => { ... }, { name: "sync_crm_lead", description: "...", schema: syncCrmLeadSchema })
```

## 4. Work Breakdown Structure (WBS) para el Agente Ejecutor

El Ejecutor debe realizar exactamente las siguientes tareas en el repositorio `/Users/teseohome/projects/crm-agentico-orchestrator`:

1. **Creación de herramientas (Scraping):** 
   - Crear el archivo `src/tools/scraping.ts`.
   - Implementar `scrapeWebsiteTool` exportando la herramienta basada en `scrapeWebsiteSchema` (retornar un mock string si no hay integración de scraping real aún, ej: `"Información simulada de la web: Empresa de logística líder..."`).
2. **Creación de herramientas (CRM):**
   - Crear el archivo `src/tools/crm.ts`.
   - Implementar `syncCrmLeadTool` utilizando `syncCrmLeadSchema` (retornar un mock string como `"Lead actualizado en CRM con éxito."`).
3. **Desacoplamiento de Prompts:**
   - Crear el archivo `src/nodes/prompts.ts` y mover el `SystemMessage` de SDR, empaquetado en la función `getSdrPrompt(state)`.
   - Se debe hacer lo mismo para el prompt de RAG y Gatekeeper de ser posible (opcional, pero fuertemente sugerido mantener el patrón).
4. **Inyección y Refactor en `src/nodes/sdr.ts`:**
   - Importar `getSdrPrompt` desde `prompts.ts`.
   - Importar `scrapeWebsiteTool` y `syncCrmLeadTool`.
   - Añadirlas al arreglo `sdrTools`.
   - Reemplazar la asignación de `systemPrompt` actual por `const systemPrompt = getSdrPrompt(state);`.

## 5. Criterios de Aceptación (Para el Nodo de QA/Tester)
- `sdr.ts` ya no contiene strings literales de prompts extensos.
- `sdr.ts` compila y se puede hacer bind de las nuevas herramientas al modelo sin errores de tipado de Zod.
- La ejecución del nodo SDR debe seguir retornando un array con la invocación del modelo (`messages: [response]`).