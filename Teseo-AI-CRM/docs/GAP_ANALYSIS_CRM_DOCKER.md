# Gap Analysis Técnico: Ecosistema "fleetco-crm" (CRM-Agéntico)

**Fecha:** 16 de Abril de 2026
**Rol:** Learner (Auditoría Docker CRM)
**Objetivo:** Contrastar el estado real del código vs. la nueva arquitectura conceptual (DIAGRAMA_CRM_AGENTICO.md).

---

## 1. Cimientos Listos (Lo que existe físicamente)

### A. Motor Agéntico (LangGraph)
* **Ubicación:** `fleetco-claw`
* **Estado:** Integrado. Usa `@langchain/langgraph` y cuenta con un orquestador base (`gatekeeper.ts`). Tiene soporte de estado para las interacciones.

### B. Tooling y SSOT (Odoo MCP Server)
* **Ubicación:** `odoo-mcp-server`
* **Estado:** **Funcional y Dockerizado**. Utiliza el paquete `@marcfargas/odoo-mcp@0.1.3` expuesto por HTTP en el puerto 3100. Conecta exitosamente a la instancia de Odoo 17 y está controlado por políticas (`policy.json`).

### C. Base de Datos Vectorial (pgvector / Modelo Karpathy)
* **Ubicación:** `fleetco-claw/prisma/schema.prisma`
* **Estado:** **Esquema Listo**. La base de datos PostgreSQL ya tiene declarados los modelos `KnowledgeDocument` y `KnowledgeChunk` con soporte para embeddings `Unsupported("vector(1536)")`.

### D. Enrutador de Modelos (AI Gateway)
* **Ubicación:** `fleetco-ai-gateway`
* **Estado:** **Listo**. Operando con Fastify + Redis para inyección de límites de cuota (FinOps) y downgrade de modelos automático.

---

## 2. Gaps (Lo que falta construir o refactorizar)

### A. Discrepancia en la Topología de Nodos (Agentes)
* **Estado Actual:** El directorio `fleetco-claw/src/agents` contiene: `chitchat`, `content-creator`, `sdr-outbound`, `staff-dm`, `staff-general`, `staff-it`, `support-l1`.
* **Conceptual:** La arquitectura demanda **7 nodos exactos**: *Gatekeeper, SDR, Hunter, Investigador, Content Creator, Trafficker, Admin*.
* **Acción:** Refactorizar el código de LangGraph para eliminar/renombrar agentes legacy y crear los nodos específicos del flujo CRM-Agéntico, cada uno con sus promps y acceso a MCP.

### B. Conexión RAG (Ingesta del CMS Obsidian)
* **Estado Actual:** Existe la bóveda física en `/Users/teseohome/Documents/Ai-crm-vault`, pero en el código, la carpeta del pipeline (`fleetco-claw/src/kdb-compiler/`) está vacía.
* **Acción:** Desarrollar el pipeline de ingesta (Node.js o Python) que parsee los archivos de Markdown de Obsidian, los fragmente (chunking), obtenga los embeddings (OpenAI/BGE) y los inserte en las tablas `KnowledgeDocument` y `KnowledgeChunk` de PostgreSQL.

### C. Orquestación Docker (Mandato de Integración)
* **Estado Actual:** Fragmentado. `odoo-mcp-server` y `fleetco-ai-gateway` usan Docker Compose propio. `fleetco-claw` tiene un Dockerfile aislado pero los scripts en `package.json` apuntan a PM2 (`pm2 start ecosystem.config.cjs`).
* **Acción:** Para cumplir con el mandato del 21 de Marzo ("Un Docker (con su propio Enjambre/Equipo de Agentes) por cada Proyecto"), se debe consolidar el "Ai-crm-vault" / "fleetco-crm" en un único **docker-compose** unificado que levante: 
  1. Base de datos PostgreSQL + pgvector.
  2. Motor Agéntico (LangGraph / fleetco-claw).
  3. Servidor de herramientas (odoo-mcp-server).
  4. Enrutador de Modelos (fleetco-ai-gateway).

---
**Conclusión:** La infraestructura base (Odoo, pgvector, LangGraph, Gateway) es sólida y ya existe en repositorios separados. El paso inmediato para el **Ejecutor** debe ser la refactorización de los 7 nodos en LangGraph y el desarrollo del pipeline de Obsidian a pgvector.