# RFC-012: Master Architecture, UX Pipelines & Tool Mapping

## 1. Visión General y Aclaración del CEO
**Pregunta del CEO:** "¿Estamos hablando del sistema centralizado operado por Teseo o los prompts van directo en el crm de cada cliente, hablamos de actualizar a distancia con JSON para gestionar performance de agentes y finops qué opinas?"

**Respuesta Arquitectónica (Builder):**
Los despliegues son **Descentralizados (Single-Tenant)** (un clon de infraestructura por cliente), pero la **Gobernanza es Centralizada (Control Plane en Teseo Mission Control)**. 
Los prompts y configuraciones **NO van hardcodeados en el código del CRM del cliente**. Operamos bajo una arquitectura de "Dynamic Config":
- El sistema de cada cliente se comunica con el servidor central de Teseo (`teseo-mission-control`) al inicializarse o mediante un webhook de Push.
- Se descarga un archivo JSON que contiene sus `system_prompts`, `active_tools`, hiperparámetros del modelo (temperatura) y Tiers de LLM autorizados (FinOps).
- Esto nos permite actualizar, ajustar performance y bloquear el servicio (Kill-Switch) remotamente sin tener que redesplegar el Cloud Run del cliente.

## 2. Alineación Estructural (Production AI App)
Para garantizar observabilidad, seguridad y modularidad, el monorepo de `Teseo-AI-CRM` se reestructura siguiendo el estándar de aplicaciones IA en producción:

```text
Teseo-AI-CRM/
├── agents/             # Lógica de agentes (SDR, Orquestador, Copywriter)
│   ├── skills/         # Herramientas específicas de agente
│   └── states.ts       # Definición de grafos (LangGraph)
├── components/         # Componentes UI (si aplica) / Componentes de flujo
├── services/           # Integraciones externas (WhatsApp API, Odoo, Stripe)
├── prompts/
│   └── registry.ts     # Gestor de fallback de prompts (carga desde Mission Control)
├── security/
│   ├── input_guard/    # Filtros de PII, inyección de prompts, moderación
│   └── output_guard/   # Validación estructural (JSON, toxicidad)
├── evaluation/         # Scripts de evaluación y RAG metrics (Alpha-Eval)
├── observability/      # Logging, trazabilidad de LangSmith, métricas FinOps
└── data/
    ├── raw/            # Transcripciones y logs sin procesar
    └── processed/      # Vectores destilados, embeddings para PgVector
```

## 3. Recopilación de las 9 Propuestas Core

1. **Módulo de Registro (Onboarding B2B):** Scripts IaC (Terraform/Pulumi) para despliegue Single-Tenant 1-Click (Cloud Run + PgVector + Odoo aislado).
2. **Módulo FinOps (Kill-Switch y Billing):** Cobro directo usando las API Keys del cliente (BYOK - Bring Your Own Key) o facturación por tokens medida en `observability/`. Botón rojo central para suspender accesos a distancia.
3. **Módulo de Alertas L1 (Dashboard de Fuego):** Endpoint `/webhooks/alerts` central que recibe crash-loops, timeouts de Odoo o fallas de LLM desde el middleware del cliente.
4. **Configuración Dinámica Remota (Dynamic Prompts):** Inyección de JSON desde el Mission Control (Push Webhook o GET con caché Redis) para controlar el comportamiento sin re-deploy.
5. **Memory Destillation:** Grafo secundario asíncrono que resume conversaciones largas (cada 15 mensajes) en la base de datos para evitar amnesia de contexto, manteniendo un prompt ligero.
6. **Pipeline de Re-Engagement (Outbound):** Cron jobs periódicos que leen leads en estado "Tibio" de Odoo y disparan un agente SDR proactivo por WhatsApp.
7. **Vectorización de Objeciones (RAG Dinámico):** Almacenar motivos de pérdida ("Muy caro", "No tiene función X") en PgVector. El SDR recupera estos vectores para rebatir objeciones futuras.
8. **TaskFlow para Agendamiento Asíncrono:** Workers monitoreando esperas. El bot no se bloquea esperando confirmación; un TaskFlow gestiona el estado "Esperando Confirmación de Cita" y reactiva al bot cuando el cliente responde.
9. **Cerebro Inbound Autogenerativo:** Equipo de sub-agentes asíncronos:
   - *Miner:* Extrae señales de compra.
   - *Scout:* Analiza tendencias.
   - *Copywriter:* Sintetiza guiones.
   - *Creator:* Genera media (HeyGen).

## 4. Mapeo Maestro de Agentes y Tools

| Agente / Nodo | Función Principal | Tools / Skills (Herramientas) |
|---------------|-------------------|--------------------------------|
| **Orchestrator** | Enrutamiento de intenciones, seguridad (Input Guard), delegación. | `fetch_dynamic_config`, `evaluate_intent`, `check_rate_limits` |
| **SDR (Ventas)** | Conversación con leads, calificación, manejo de objeciones. | `query_rag_objections`, `fetch_odoo_lead`, `update_odoo_lead` |
| **Scheduler** | Agendamiento de citas, revisión de disponibilidad. | `check_calendar_free_busy`, `create_calendar_event`, `taskflow_wait` |
| **Distiller** | Resume contexto histórico, actualiza perfil del lead. | `summarize_thread`, `update_long_term_memory`, `extract_entities` |
| **Copywriter/Creator** | Generación de campañas Inbound y contenido asíncrono. | `generate_video_heygen`, `post_to_socials`, `analyze_trends` |

## 5. HITL Invisible (Human-In-The-Loop UX)
El objetivo es que el cliente final no perciba la fricción técnica del bot consultando a un humano.

**Escenario de Aprobación de Descuento:**
1. **Cliente:** "¿Me das un 20% de descuento si pago anual?"
2. **SDR Bot:** Intercepta la intención. Las reglas (`dynamic_config`) indican que descuentos > 10% requieren aprobación.
3. **UX Bot -> Cliente:** "Esa es una excelente propuesta. Déjame consultarlo rápido con Jorge (el director) para que me autorice ese 20%. Dame un par de minutos." (El bot usa un delay natural simulando tipeo).
4. **Backend (TaskFlow):** Pausa el estado del agente y envía un Actionable Message a Telegram (o Slack) al panel de Teseo:
   > 🚨 **Aprobación Requerida:** Cliente X pide 20%. [Aprobar] [Rechazar y ofrecer 15%]
5. **CEO (Jorge):** Presiona [Aprobar] en Telegram.
6. **TaskFlow:** Reanuda el agente SDR con la inyección de la respuesta humana.
7. **UX Bot -> Cliente:** "¡Listo! Ya lo revisé con Jorge y me dio luz verde. Te aplico el 20% anual. ¿Te envío la liga de pago?"

## 6. Diagrama de Arquitectura Push (Configuración Dinámica)

```text
[ Teseo Mission Control (Central) ]
       │
       ├─ UI Dashboard (Jorge ajusta Prompts, Tiers, FinOps)
       │
       ▼ (Webhook POST /v1/config/update)
[ API Gateway del Cliente (Single-Tenant) ]
       │
       ▼
[ prompts/registry.ts ] ─── Actualiza caché en memoria (Redis/Local)
       │
       ▼
[ Orchestrator & Agents ] ─── La siguiente inferencia usa el nuevo prompt/temperatura.
```

**Ventajas FinOps:** Si un cliente deja de pagar, Teseo Mission Control envía un payload `{ "active": false }`. El `registry.ts` corta inmediatamente las peticiones al LLM, devolviendo un mensaje predefinido ("Servicio temporalmente suspendido").
