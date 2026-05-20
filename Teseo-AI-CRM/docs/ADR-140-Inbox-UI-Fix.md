# [DEPRECATED] - Superseded by MASTER_ARCHITECTURE.md v1.0.0nn
# ADR-140: Refactorización Maqueta Inbox (Split-Pane)
**Dominio:** `teseo-ai-crm`
**Autor:** Builder
**Fecha:** 22 Abril 2026

## 1. Contexto y Problema
El CEO reporta un fallo crítico de UX y Estado en la maqueta actual del Inbox:
1. **Layout Estrujado:** El panel de conversación minimiza el espacio y vuelve ilegible la lectura. Probable conflicto con el layout Tri-Columnar o medidas absolutas restrictivas.
2. **Data Fetching Roto:** Los componentes no están cargando la data (Live Data no hidrata la UI).

## 2. Auditoría y Solución Técnica

### 2.1. Resolución de Espacio de Conversación (Layouting)
**Diagnóstico:** El contenedor `InboxWorkspace` estaba heredando el padding nativo (`p-4 md:p-6`) y el scroll de la etiqueta `<main>` del `GlobalLayout`. Al no tener una altura restrictiva impuesta que cancelara el scroll de la página global, los paneles de `react-resizable-panels` colapsaban su altura volviendo la lectura ilegible.
**Solución (Ejecutor):** Se aplicó un "Escape Hatch" en `app/(dashboard)/command-center/inbox/layout.tsx`. Mediante márgenes negativos (`-m-4 md:-m-6`) se anuló el padding global, y se forzó una altura matemática estricta `calc(100dvh - 60px)` (Viewport restando los 60px del `AppTopBar`). Esto obliga a los paneles a usar todo el hardware disponible y delegar el scroll internamente.

### 2.2. Resolución de Hidratación (Data Fetching Roto)
**Diagnóstico:** El evento `onClick` de las tarjetas de conversación en `InboxList` inyectaba la propiedad `thread.threadId` (un string textual heredado del orquestador, ej. `th_123`) al hook global `selectedThreadId`.
Sin embargo, el endpoint de Supabase (`/api/leads/[id]/messages`) valida que el parámetro sea estrictamente un `UUID` para buscar la relación en `inbox_messages.lead_id`. Al recibir un string genérico, Zod escupía un HTTP 400 Bad Request, corrompiendo la caché de `react-query` y lanzando el estado `isError`.
**Solución (Ejecutor):** Se modificó la inyección en `inbox-list.tsx` a `onSelect(thread.id)` (UUID garantizado). El endpoint ahora responde con un 200 OK y la data hidrata en tiempo real a través del Short-Polling (3000ms).

## 3. Estado
**Dictamen (Reviewer):** PASS. Problemas corregidos de raíz. Compilación limpia y sin regresiones a la arquitectura Tri-Columnar.