# ADR-147: Integración RAG LangGraph y Hardening de Compilador Python

**Fecha:** 23 Abril 2026
**Estado:** Aceptado
**Autor:** Teseo (Gerente AIDevops) / Builder (Arquitecto Staff)

## 1. Contexto
Durante el Bloque 11, se abordaron dos necesidades críticas para el flujo de inyección de contexto:
1. Conectar LangGraph Orchestrator con la tabla `tenant_memories` (pgvector) de manera segura.
2. Preparar el microservicio Python (`crm-agentico-compiler`) para su despliegue en Google Cloud Run, mitigando vulnerabilidades críticas de ejecución como `root` y la deriva de dependencias.

## 2. Decisiones Arquitectónicas

### 2.1. Nodos de Recuperación RAG (LangGraph)
- **Eliminación de Mocks y TCP Pools:** Se depreció el Tool Call de RAG asíncrono y los pools de conexión cruda TCP, alineándose con el ADR-136.
- **Implementación de `RetrievalNode`:** Se diseñó un nodo de recuperación nativo inyectado en el estado del grafo (`GraphState`). 
- **Tenant Isolation (Fail-Fast):** El nodo incorpora un gatekeeper a nivel de aplicación que detiene el flujo (arroja una excepción) si el `tenant_id` es nulo, protegiendo la llamada RPC `@supabase/supabase-js` -> `.rpc('match_tenant_memories')`.

### 2.2. Deuda Técnica y Hardening del Compilador (Python)
- **Locking Inmutable:** Se extrajo el `uv.lock` hacia un `requirements.txt` determinista (con hashes completos) para bloquear versiones de `fastapi`, `uvicorn`, `scikit-learn` y `tenacity`.
- **Rootless Docker:** Se refactorizó el `Dockerfile` (`python:3.12-slim`) para operar íntegramente bajo el usuario `appuser` (UID 10001). 
- **Aislamiento de Instalación:** La instalación de librerías (`pip install --user`) y la transferencia de código (`COPY --chown=appuser:appgroup`) ocurren ahora después de una caída de privilegios explícita (`USER appuser`), eliminando el riesgo de escalamiento en Cloud Run.

## 3. Consecuencias
- **Positivas:** El orquestador ahora consume contexto de manera determinista y segura. La infraestructura del compilador es inmutable, mitigando los riesgos OWASP y cumpliendo los estrictos requisitos de seguridad de GCP para contenedores serverless.
- **Negativas / Trade-offs:** El `Dockerfile` es ligeramente más verboso (requiere gestión explícita de `PATH` local y comandos `chown`), pero el beneficio en seguridad operacional supera ampliamente este costo.