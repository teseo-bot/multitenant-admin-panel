# ADR-114: Patrón de Validación de Roles (admin-client role fetch)

- **Estado:** ✅ Aprobado
- **Fecha:** 20 Abril 2026
- **Autor:** Builder (Teseo Squad) / Jorge García
- **Módulo:** Campaign Review (Fase 1)

---

## Contexto

Durante el diseño de Campaign Review (Fase 1), se identificó la necesidad de un patrón estandarizado para la obtención y validación de roles de usuario (`admin` vs `client`) en el frontend (`crm-agentico-panel`). Sin un patrón claro, cada módulo implementaba su propia lógica de fetch de roles, generando inconsistencias y riesgos de seguridad.

## Decisión

Se adopta un patrón unificado de **Role Validation** que:

1. **Fetch centralizado:** El rol del usuario se obtiene una sola vez en el middleware SSR de Supabase Edge y se inyecta en el contexto de autenticación (`AuthContext`).
2. **Propagación via Zustand:** El rol validado se propaga al store de cliente (`useAuthStore`) sin re-fetch redundante.
3. **Guard Components:** Se implementan componentes `<RoleGate role="admin">` que encapsulan la lógica de visibilidad por rol, eliminando condicionales dispersos.
4. **Backend Enforcement:** RLS en Supabase aplica la validación de rol como última línea de defensa. El frontend es UX, no seguridad.

## Consecuencias

- **Positivas:** Consistencia entre módulos (Command Center, Asset Studio, Campaign Review). Reducción de superficie de ataque por roles mal validados.
- **Negativas:** Dependencia fuerte en el middleware SSR como punto único de inyección de roles. Si el middleware falla, toda la app pierde contexto de roles.

## Alternativas Rechazadas

- Fetch de roles por componente individual (descartado por redundancia y riesgo de race conditions).
- JWT claims como fuente de verdad de roles (descartado porque los claims no se actualizan en tiempo real tras cambio de rol en Supabase).
