# REPORT: Contexto para Asset Studio - Fase 5 (Generación Visual Canvas/Snapshots)

## 1. Estado actual del Asset Studio (Logros Fases 1-4)
A partir del análisis de la memoria histórica (`MEMORY.md`, `ADR-113`, `RFC-015`) y la finalización del Campaign Review, el estado actual de Asset Studio incluye:
*   **Fase 1 (Fundaciones):** Implementación de la base de datos (PostgreSQL/Supabase) con tablas inmutables (`prompt_templates`, `prompt_versions`, `variable_defs`), integrando Row Level Security (RLS) para aislamiento estricto por Tenant.
*   **Fase 2 (Prompt Editor):** Construcción del editor UI. Establecimiento del patrón de estado: Server State gobernado por TanStack Query y UI State transitorio controlado por Zustand (manejando tabs, modales y borradores en memoria).
*   **Fase 3 (A/B Testing):** Despliegue de experimentos A/B (`ab_experiments`, `ab_variants`) con validación de split de tráfico y mutaciones optimistas.
*   **Fase 4 (Analítica):** Dashboard de performance mediante métricas y gráficas (Recharts).
*   **Seguridad y Routing:** Aislamiento exitoso mediante Route Groups `(asset-studio)` y protección Edge Middleware. Los webhooks de eventos hacia LangGraph ya cuentan con validación de roles y M2M.

## 2. Reglas y directivas destiladas de TeseoKDB (Manejo de Canvas/Snapshots)
El análisis del repositorio de conocimiento (`TeseoKDB` en módulos de `hyperframes` y `video_rendering`) arrojó el siguiente marco normativo estricto:

*   **HyperFrames como Estándar Declarativo:** La generación visual de Canvas y Snapshots se sustenta en HTML/CSS como fuente de la verdad.
*   **Ciclo de Vida vs. Animación:** 
    *   *El Framework* lee los atributos (`data-start`, `data-duration`, `data-track-index`) y controla automáticamente la presencia en el DOM (montaje/desmontaje) y la sincronización general.
    *   *GSAP* es el único motor autorizado para efectos y transiciones. Se prohíbe animar `display` o mutar el DOM manualmente. Todo timeline debe registrarse en `window.__timelines["<id>"]`.
*   **Principio "Layout Before Animation":** Se debe maquetar el *Hero Frame* (estado final/de mayor visibilidad) usando Flexbox. GSAP debe animar *desde* (from) o *hacia* (to) dicho estado. Prohibido usar `position: absolute` en contenedores de flujo principal para evitar colisiones de UI.
*   **Sincronización Transitoria de Estado (Zustand):** El estado interno de los elementos del Canvas (e.g., nodo seleccionado, opacidad de un overlay) se sincroniza hacia el store de Zustand para alimentar Páneles de Propiedades en tiempo real. **Regla de Hierro:** No se debe duplicar Server Data (como la definición base del asset o template) en Zustand; eso pertenece exclusivamente a la caché de TanStack Query.
*   **Snapshots de Verificación:** Los snapshots capturan el "visible element state" en timestamps clave. Su ciclo de vida es fundamental para la validación visual y de contraste (WCAG) sin intervención manual.

## 3. Puntos de Impacto en el proyecto Next.js (`crm-agentico-panel`)
Para la implementación de la Fase 5, el Builder deberá considerar:

1.  **Rutas (App Router):** Extender el Route Group `(asset-studio)`. Posiblemente inyectando visores de Canvas/Snapshots bajo una ruta anidada como `/prompts/[templateId]/canvas`.
2.  **Arquitectura del Store (Zustand):** Expandir `asset-studio-store.ts` (o crear un sub-store) para alojar el "Canvas Player State" (current time, play/pause) y el "Editor State" (capas seleccionadas, propiedades del track activo) para el panel lateral, garantizando que este estado no mute los datos cacheados de TanStack Query directamente, sino a través de mutaciones de la API.
3.  **Persistencia y BFF:** La capa de Route Handlers (BFF) deberá estar preparada para ingerir o actualizar las composiciones en formato HTML/JSON, almacenándolas en `prompt_versions.content` (o campo afín), manteniendo la compatibilidad con las migraciones SQL existentes (ADR-113).
4.  **Generación Realtime (Snapshots):** Si se requiere validación visual programática, habilitar un canal para procesar y almacenar capturas del canvas (ej. subida de imágenes resultantes al Supabase Storage y persistiendo referencias para A/B testing u optimización visual).