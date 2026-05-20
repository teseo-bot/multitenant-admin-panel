# ADR-097: Despliegue Single-Tenant (Dedicated Infra) para el SaaS B2B

| Campo | Valor |
|---|---|
| **ID** | ADR-097 |
| **Estado** | Aprobado |
| **Fecha** | 2026-04-18 |
| **Autor** | Teseo AIDevops |
| **Aprobador** | Jorge García (CEO) |
| **Dominio** | Arquitectura Cloud (GCP) del SaaS B2B |

## 1. Contexto y Problema

Ante la comercialización del ecosistema `CRM-Agentico` como un SaaS B2B independiente (Orquestador, Compilador RAG, Odoo, Inbound Engine, UI Admin), surge la disyuntiva del modelo de despliegue: ¿Multi-Tenant (Compartido) o Single-Tenant (Infraestructura Dedicada)?

Inicialmente se consideró una arquitectura Multi-Tenant por eficiencia de recursos (un solo Cloud Run sirviendo a múltiples clientes diferenciados por `X-Tenant-Id`). Sin embargo, el CEO identificó tres limitantes críticas insalvables para el modelo de negocio:
1. **Complejidad de Canales de Comunicación:** Enrutar cientos de webhooks distintos de Meta (WhatsApp Business APIs), tokens de Telegram y delegaciones de Google Workspace (Domain-Wide JWTs) hacia un solo endpoint compartido genera un cuello de botella de enrutamiento, aumenta el riesgo de fuga de datos (cross-tenant data bleed) y hace casi imposible la certificación de seguridad para empresas serias (Salud, Finanzas, Inmobiliarias).
2. **Calidad del Modelo (El problema de los LLMs pequeños):** Un Multi-Tenant masivo suele forzar el uso de LLMs más baratos/pequeños (Flash/Haiku/8B) en el Inbound Engine o en el Summarizer para mantener márgenes de rentabilidad. El producto Premium requiere modelos de frontera (Opus, Sonnet, Pro) sin racionamiento artificial.
3. **Opacidad de Costos (FinOps):** Calcular el costo exacto de base de datos vectorial (pgvector) y tokens consumidos por un cliente específico dentro de un pool compartido es ingenierilmente costoso.

## 2. Decisión

Se adopta oficialmente el modelo **Single-Tenant (Infraestructura Dedicada / Managed Hosting)**.
Cada nuevo cliente B2B recibirá su propio ecosistema provisionado y aislado.

- **Aislamiento Total:** Cada cliente (ej. Inmobiliaria X) tendrá su propio Proyecto en GCP, su propia instancia de Cloud Run para el Orquestador, su propia DB de Postgres (Vectorial) y su propia instancia de Odoo Community.
- **Translación de Costos:** El costo de infraestructura (GCP) y el costo de inferencia (API Keys de OpenAI/Google/Anthropic) se trasladan directa y transparentemente al cliente. Teseo no subsidia el cómputo.
- **Monetización:** Teseo cobra exclusivamente por el licenciamiento del software (SaaS Fee), el Setup Inicial (Onboarding/Compilación de RAG) y los Servicios de Soporte/Ads.

## 3. Consecuencias y Siguientes Pasos

**Pros:**
- **Seguridad Grado Enterprise:** Aislamiento físico de datos, indispensable para vender a clientes corporativos.
- **Canales Simples:** Cada cliente tiene su propio Webhook de Meta y su propio Token de Telegram/Workspace. Cero colisiones.
- **Rendimiento Máximo (Cero Rate Limits compartidos):** Un cliente abusando de su bot no afectará los tokens por minuto (TPM) del resto de los clientes. Se pueden usar modelos pesados (Opus 4.6 / Gemini 3.1 Pro) porque el cliente absorbe el costo de su propia API Key.
- **Operación FinOps Trivial:** La factura de GCP y de los LLMs le llega directo al cliente.

**Contras:**
- **Despliegue Manual Lento (Actual):** Levantar una nueva instancia para cada cliente toma tiempo si se hace a mano.
- **Mantenimiento Distribuido:** Un parche de seguridad (ej. actualizar LangChain) requiere desplegar la actualización en N proyectos de GCP simultáneamente.

**Acción de Ingeniería Aprobada:**
El Agente Builder y el Ejecutor deben desarrollar un pipeline de **Infraestructura como Código (IaC) usando Terraform o scripts de automatización (Bash/Google Cloud CLI)**.
El objetivo será que, cuando se cierre una venta, Teseo pueda ejecutar un comando (ej. `deploy-new-tenant.sh "Cliente_Hospital"`) que automáticamente clone el CRM-Agentico, aprovisione un nuevo proyecto en GCP, levante el Cloud Run y configure la VectorDB en menos de 10 minutos.
