# ADR-069: Resolución Polyrepo e Ignición de Staging (24 Abril 2026)

## 1. Contexto y Problema
Durante la ejecución del Bloque 25 (Ignición del Pipeline), el despliegue hacia Google Artifact Registry fallaba consistentemente. El pipeline descargaba un contenedor vacío y fallaba al localizar el `Dockerfile`.

**Causa Raíz:**
El directorio `crm-agentico-panel` mantenía una referencia huérfana de Git (`git submodule`). GitHub Actions clonaba el repositorio padre pero ignoraba el código fuente de Next.js.

## 2. Decisión Arquitectónica y Remediación
- Se ejecutó una cirugía en el árbol de Git (`git rm --cached crm-agentico-panel` y `rm -rf .git` interno).
- **Consolidación:** Se aplanó el código del frontend Next.js dentro del repositorio principal `teseo-bot/teseo-ai-crm-panel`, adhiriéndose estrictamente al mandato de **Polyrepo & Single-Responsibility** de nuestro `AGENTS.md`. El orquestador backend se mantiene aislado en su propio repositorio.
- **Docker Build:** Se restauró la capacidad del CI/CD de localizar el `Dockerfile` optimizado con dependencias de Chromium (Playwright) para el frontend.

## 3. Estado de la Orquestación (Bloque 25)
- **Objetivo 1 (Ignición):** COMPLETADO. El *Zero-Trust Pipeline* tiene visibilidad completa del código y ha disparado la fase de compilación y empaquetado en la nube.
- La URL de Cloud Run estará disponible al concluir la instanciación de GCP.

## 4. Consecuencias y Próximos Pasos
El sistema queda sellado en estado inmutable. Al reiniciar operaciones en la próxima sesión, el enfoque deberá ser estrictamente el `Smoke Testing` de la URL en vivo y el aprovisionamiento del primer Tenant real para probar el `Theme Injector` contra la base de datos de producción.

---
**Firmado:** Teseo (Gerente AIDevops)
**Aprobado:** Jorge García (CEO)