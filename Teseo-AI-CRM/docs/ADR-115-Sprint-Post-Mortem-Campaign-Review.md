# ADR-115: Sprint Post-Mortem — Módulo Campaign Review

| Campo | Valor |
|---|---|
| **Autor** | Teseo (Gerente AIDevops) / Escuadrón Táctico |
| **Fecha** | 2026-04-20 |
| **Estado** | 🟢 CERRADO |
| **Componente** | `crm-agentico-panel` (Campaign Review) |

## 1. Contexto del Sprint
Se ejecutó la construcción end-to-end del módulo "Campaign Review", diseñado para auditar y aprobar campañas de agentes autónomos (SDR, Hunter, Gatekeeper) en un entorno multi-tenant. El escuadrón operó bajo el ciclo "Zero-Trust Pipeline" (Planificación -> Implementación -> Pruebas -> Auditoría de Seguridad).

## 2. Hitos y Tiempos de Resolución
1. **Scaffolding (Builder):** Diseño de arquitectura y schema (`RFC-018`) con tablas, vista materializada para métricas y APIs.
2. **Ejecución (Ejecutor):** Construcción del backend y frontend (10 componentes Shadcn/Zustand/TanStack).
3. **Auditoría Inicial (Tester):** Se identificaron problemas críticos en el enrutamiento (`White Screen of Death` por colisión de Route Groups) y en la resolución del middleware.
4. **AppSec Audit (Reviewer):** Se identificaron vulnerabilidades críticas (OWASP) que detuvieron el despliegue a producción:
   - Tenant ID Injection en creación de campañas (corregido delegando al JWT y cliente administrativo).
   - Ausencia de Zod para validación (corregido).
   - Privilege Escalation horizontal en la aprobación (se insertó validación RBAC estricta).
5. **Cierre de Ciclo:** Tras múltiples inyecciones de fallo y remediación autónoma, se selló el código.

## 3. Decisiones Estratégicas y Topológicas Adoptadas
- **`ADR-114` y RBAC Estricto:** Se prohíbe delegar el control de roles al cliente o a *claims* del JWT sin verificación administrativa. Toda validación privilegiada (`/approve`) se hace consultando directamente `user_profiles` vía `supabaseAdmin` en el servidor (BFF).
- **Rutas de Next.js App Router:** Se prohibió el abuso de *Route Groups* (`(folder)`) en la raíz para evitar colisiones estructurales del índice. `campaign-review` ahora es una ruta hard-segment.
- **Zod por defecto:** Zod es obligatorio en todos los route handlers de `crm-agentico-panel` antes de invocar los clientes de base de datos.

## 4. Consecuencias a Futuro
- **Mayor resiliencia:** El ciclo *Zero-Trust* demostró su eficacia frenando vulnerabilidades reales en un entorno aislado sin intervención manual del CEO.
- **Deuda Técnica Saldada:** Se limpió la topología y se preparó el pipeline de CI/CD para el despliegue. 

## 5. Próximos Pasos (Bottom-Up)
Para la próxima sesión, el enfoque cambiará de la interfaz hacia la orquestación: Los agentes de LangGraph deberán ser conectados a la API de eventos de `campaign_events` para popular los timelines reales.