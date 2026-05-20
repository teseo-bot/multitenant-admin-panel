# POST_MORTEM_BLOQUE29_STABILIZATION.md
**Fecha:** 25 de Abril de 2026
**Autor:** Teseo (Gerente AIDevops) & Tester
**Estado:** Resuelto y en Producción

## 1. Incidente Principal: Naming Drift & Falso Despliegue
**Síntoma:** El CEO reportó URLs de GCP arrojando error `403 Forbidden` y falta de actualización visual en el Command Center, a pesar de que los scripts locales reportaban "éxito".
**Causa Raíz:** 
1. Ejecución de scripts locales obsoletos sobre repositorios incorrectos (Naming Drift entre `teseo-mission-control` y `teseo-ai-crm-panel`).
2. Falta de política IAM (`roles/run.invoker` a `allUsers`) en el servicio de Cloud Run (`crm-frontend` y `crm-mission-control`), bloqueando el tráfico entrante.

**Resolución:**
1. Se forzó el push del código a `teseo-ai-crm-panel` (rama `main`), detonando el pipeline oficial de GitHub Actions que despliega hacia la imagen de Artifact Registry correcta y mapea al servicio `crm-frontend`.
2. Se redactó y aprobó el **ADR-110** estableciendo la Topología Oficial de Repositorios para evitar cruces futuros.
3. Se embelleció el `README.md` del panel para reflejar el estado productivo (Docs-as-Code).

## 2. Incidente Secundario: Bug de CSS Layout en Command Center
**Síntoma:** El texto "Command Center" y la Ribbon se partían a la mitad por un solapamiento blanco en dispositivos o ventanas pequeñas.
**Causa Raíz:** El componente `AppSidebar` (`w-[260px] fixed`) carecía de la clase `hidden md:flex`. En breakpoints móviles, el menú no desaparecía, solapándose sobre el `InboxWorkspace` que sí adaptaba sus márgenes.
**Resolución:**
Se inyectó la directiva responsiva correcta en `GlobalLayout.tsx` y `AppSidebar.tsx` aislando el sidebar de escritorio en móviles, dejando el control absoluto al componente de `Sheet` (Menú Hamburguesa).

## 3. Conclusión y Veredicto
El Tester validó con éxito la interfaz (Kanban, Thread View, Responsive) en Producción. **El Bloque 29 (Command Center y Tenant Mapping) queda oficialmente estabilizado, cerrado y blindado.**