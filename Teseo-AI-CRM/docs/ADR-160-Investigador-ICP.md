# ADR-160: Nodo Investigador, Vectorización ICP y Routing SDR/Hunter

**Fecha:** 2026-04-23
**Estado:** Aprobado y Desplegado (Bloque 16)
**Contexto:**
El CRM requería una capacidad asíncrona para calificar leads entrantes con base en su huella digital y el histórico de la empresa (ERP), antes de asignar los recursos de venta (SDR vs Hunter).

**Decisión Arquitectónica:**
1. **Pipeline de Enriquecimiento (Investigador):** Se implementó un motor de scraping vía Playwright (8s timeout duro) acoplado a la API de Hunter.io para descubrimiento de contactos.
2. **Compactación de Contexto:** El texto extraído se comprime usando un modelo LLM Tier-3 a un límite estricto de `< 800 tokens` para prevenir OOM y proteger el context window de los nodos subsecuentes.
3. **Cálculo ICP (Similitud Coseno):** Se vectorizan las métricas del lead enriquecido (ℝ⁸) y se comparan contra un centroide histórico extraído de Odoo CE (ponderado por decaimiento exponencial temporal). 
4. **Enrutamiento Condicional:** 
   - `ICP ≥ 0.65`: Asignación al **SDR** (Nurturing consultivo).
   - `ICP < 0.65` + Señales (hiring, funding): Asignación al **Hunter** (Outbound agresivo).
5. **AppSec (Zero-Trust):** Validación estricta anti-SSRF bloqueando IPs internas/reservadas en el motor de requests del scraping, y serialización segura `safeStringify` mediante `WeakSet` para evitar caídas por referencias circulares.

**Consecuencias:**
- Optimización del costo computacional derivando al agente Hunter solo cuando la oportunidad de cierre agresivo lo amerita.
- Reducción del payload en el estado global del LangGraph garantizando longevidad de sesión y velocidad en el Dispatcher.