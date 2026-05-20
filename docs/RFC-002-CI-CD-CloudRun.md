# RFC-002: Orquestación Cloud y CI/CD (Bloque 24)

## 1. Objetivo y Alcance
Automatizar el despliegue a producción del ecosistema Teseo-AI-CRM hacia Google Cloud Platform (GCP) garantizando un pipeline "Zero-Trust". Todo código que se integre a la rama principal (`main`) deberá pasar por auditorías automatizadas antes de empaquetarse y publicarse en infraestructura Serverless.

## 2. Arquitectura de Despliegue (GCP)
- **Container Registry:** Google Artifact Registry alojará las imágenes Docker inmutables generadas en el Bloque 23.
- **Compute:** Google Cloud Run. Permite escalabilidad a cero (ahorro de costos) y tolerancia a picos de tráfico para los modelos de LLM y el frontend Multi-Tenant.
- **Secretos:** Las llaves críticas (Supabase, OpenAI) abandonan los archivos locales `.env` y pasan a **Google Secret Manager**, inyectándose directamente en Cloud Run en tiempo de arranque.

## 3. Pipeline Zero-Trust (GitHub Actions)
La orquestación dictamina un flujo estricto sin intervención manual para el paso a producción:
1. **Fase de Prueba (Tester):** Ejecución de tests unitarios y validación visual DOM (Vitest) en el entorno de integración. Si falla, se rompe el pipeline.
2. **Fase de Construcción (Builder):** Creación de los builds multi-stage.
3. **Fase de Registro:** Autenticación vía Workload Identity Federation (WIF) y subida a Artifact Registry.
4. **Fase de Despliegue:** Actualización en vivo del servicio en Cloud Run.

## 4. Plan de Ejecución (WBS para Ejecutor)
1. **Tarea A:** Crear directorio `.github/workflows/` en la zona de código y escribir el archivo `deploy-frontend.yml` con el pipeline estipulado.
2. **Tarea B:** Redactar el script shell (`scripts/setup-gcp-secrets.sh`) para la creación programática de secretos en GCP (preparación de entorno).
3. **Tarea C:** Auditar que el `Dockerfile` del frontend esté correctamente referenciado en el pipeline y listo para exponer el puerto 8080 en Cloud Run.

---
**Status:** Aprobado para Ejecución.