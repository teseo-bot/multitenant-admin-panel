# ADR-110: Estandarización de Topología de Repositorios para Teseo AI CRM

**Fecha:** 25 de Abril de 2026  
**Estado:** Aceptado  
**Autores:** Teseo (Gerente AIDevops), Jorge García (CEO)

## 1. Contexto y Problema (Naming Drift)
Durante la evolución del ecosistema Teseo AI CRM (anteriormente referenciado en algunos artefactos como Fleetco+ o Mission Control), se generó una discrepancia severa de nombres ("Naming Drift") entre los repositorios de GitHub, los directorios locales de desarrollo y los servicios de Google Cloud Run. 

Esta discrepancia provocó confusión en los pipelines de CI/CD (GitHub Actions) y errores de despliegue, donde repositorios deprecados o mal nombrados (ej. `teseo-mission-control` público) se confundían con el código productivo real (`teseo-ai-crm-panel`).

## 2. Decisión Arquitectónica
Se establece la siguiente topología estricta como la ÚNICA fuente de verdad para el ecosistema CRM:

### 2.1. El Frontend (La Interfaz Web / Command Center)
*   **Nombre de Dominio Interno:** Mission Control / Panel
*   **Repositorio GitHub:** `teseo-bot/teseo-ai-crm-panel` (Privado)
*   **Directorio Local:** `/Users/teseohome/projects/Teseo-AI-CRM`
*   **Servicio GCP (Cloud Run):** `crm-frontend`
*   **Responsabilidad:** UI en Next.js, Command Center, Inbox Omnicanal, Gestión de Tenants, y Webhooks.

### 2.2. El Orchestrator (El Cerebro Backend)
*   **Nombre de Dominio Interno:** Orquestador de Agentes / LangGraph
*   **Repositorio GitHub:** `teseo-bot/crm-agentico-orchestrator` (Privado)
*   **Servicio GCP (Cloud Run):** `crm-agentico-orchestrator`
*   **Responsabilidad:** Nodos de LangGraph, Agentes SDR, Gatekeeper, toma de decisiones y ruteo de mensajes a los canales.

### 2.3. El Compiler (Ingesta y RAG)
*   **Nombre de Dominio Interno:** Compilador RAG / TeseoKDB
*   **Repositorio GitHub:** `teseo-bot/crm-agentico-compiler` (Público/Privado)
*   **Servicio GCP (Cloud Run):** `crm-agentico-compiler`
*   **Responsabilidad:** Vectorización de PDFs, scrapeo de webs, generación de embeddings e indexación vectorial aislada por tenant.

## 3. Consecuencias
1. **Pipelines:** Todos los flujos de GitHub Actions en `teseo-ai-crm-panel` apuntarán exclusivamente a `crm-frontend`.
2. **Deprecación:** El repositorio público `teseo-mission-control` queda oficialmente deprecado y se recomienda su archivado (Read-Only) para evitar fugas de esfuerzo o cruce de ramas.
3. **Documentación:** El `README.md` de `teseo-ai-crm-panel` debe reflejar esta topología para el onboarding de futuros ingenieros.