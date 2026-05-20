# Post-Mortem & ADR: Bloque 32 (Despliegue GitOps)
**Fecha:** 25 de Abril de 2026

## Resumen del Sprint
Se completó exitosamente el despliegue del ecosistema B2B (Track Producción) hacia Google Cloud Run, habilitando una arquitectura CI/CD completa a través de Cloud Build (GitOps).

## Hitos Alcanzados (SUCCESS)
1. **Consolidación Topológica:** Se purgó el conflicto de nomenclaturas entre `Teseo-AI-CRM` (Command Center) y `teseo-mission-control` (Tenant OS Admin).
2. **Despliegues a Cloud Run:** Se publicaron las URLs de producción para el Orquestador (Motor LangGraph), Mission Control y Command Center. Se resolvieron bloqueos 403 modificando la política IAM a `allUsers` con `roles/run.invoker`.
3. **CI/CD (GitOps):** Se inyectó un `cloudbuild.yaml` en la raíz de los 4 repositorios core (`crm-agentico-orchestrator`, `teseo-mission-control`, `Teseo-AI-CRM` y `crm-agentico-compiler`). Se conectaron los repos a GCP Cloud Build (1ª Gen) estableciendo triggers automáticos en push a `^main$`.
4. **Fix UI Kanban:** Se corrigió un error de tipeo estricto y se enlazó el evento `onClick` de las tarjetas `KanbanCard` hacia `setActiveView("PROSPECT")` para habilitar la vista operativa (ProspectCanvas).
5. **RAG Update:** Se asimiló la documentación de la herramienta `h4ckf0r0day/obscura` (Headless Browser en Rust) en `/compiled/tools/obscura.md` como el estándar interno para scraping y uso de Playwright, descartando Chrome pesado.

## Deuda Técnica Eliminada
El ecosistema cuenta ahora con 0 deuda de despliegues manuales. Cualquier push a GitHub detona recompilaciones nativas aisladas (Single-Responsibility).
