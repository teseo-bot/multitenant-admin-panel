# Post-Mortem Bloque 37: MCP & Workspace Auth (28 Abril 2026)

## Problema 1: Odoo MCP Fallido
- **Síntoma:** `odoo-mcp-server` fallaba al exponer `/sse` y `/message`. El LangGraph quedaba ciego respecto al CRM.
- **Root Cause:** El wrapper MCP de Odoo no es nativamente compatible con el ruteo interno de Cloud Run.
- **Resolución Técnica:** Deprecado. Migración a conexión directa JSON-RPC (`src/services/odoo.ts`).

## Problema 2: Autenticación Workspace API
- **Síntoma:** `invalid_grant: Invalid issuer: null` al inicializar Google Auth Library.
- **Root Cause:** El paso de Domain-Wide Delegation vía Service Account JSON es frágil si no se parsea correctamente o faltan scopes exactos en Google Admin.
- **Resolución Técnica:** Se reescribió `WorkspaceAuthenticator` para priorizar autenticación OAuth2 de M2M/Auth0, con fallback de parseo en memoria manual del JSON.
