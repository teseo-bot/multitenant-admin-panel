# ADR-112: Orquestación de Prompts (Frontend/Backend) y Topología de Cortesía (Chit-Chat)

## Contexto
El Orquestador LangGraph presentaba dos bloqueos críticos que desencadenaban alucinaciones ("Carlos/Diego") y finales prematuros ("__end__") en interacciones de usuarios orgánicos vía Telegram/WhatsApp.
1. **Discordancia de Variables:** El Frontend (Mission Control) inyectaba las reglas del negocio bajo las llaves `sdr`, `gatekeeper`, `rag_l1`, mientras que el Orquestador exigía los sufijos antiguos `_system_prompt`. Al no encontrar los datos en la base (Neon), usaba prompts hardcodeados vacíos.
2. **Deficiencia Estructural en Gatekeeper:** Mensajes cortos, saludos o intenciones ambiguas ("hola") eran clasificados como "sin valor comercial" por el Gatekeeper, enrutando a `__end__` y matando la sesión.

## Decisiones Técnicas

### 1. Sincronización Tolerante de Variables (Backend)
- Modificación del Orquestador (`prompts.ts`) para aceptar el operador lógico `||` entre las llaves cortas de la UI (`state.prompts?.sdr`) y las legacy (`state.prompts?.sdr_system_prompt`).
- Esto garantiza compatibilidad hacia atrás y previene alucinaciones al recuperar siempre el `tenant_config` oficial de la DB.

### 2. Inyección del Nodo "Chit-Chat"
- Creación de un `chitchatNode` explícito dedicado a la empatía y recepción humana.
- Se instruyó al `gatekeeperNode` para enrutar cualquier saludo o intención ambigua hacia `chitchat`.
- **Zero-Trust Loop:** El `chitchatNode` está diseñado para emitir su saludo y acto seguido vaciar la llave `currentRoute` (`null`). Esto obliga a que el siguiente mensaje del usuario vuelva a pasar por el `Gatekeeper` para su re-clasificación formal (RAG o SDR).

### 3. Server Actions para Evasión RLS (Frontend)
- Para la persistencia, se creó una API Route en Next.js (`/api/tenants/[id]/config`) que inyecta la llave `SUPABASE_SERVICE_ROLE_KEY` (privilegios de administrador).
- Esto evita el rechazo silencioso por políticas de "Row Level Security" de los clientes anónimos en los navegadores, asegurando la inyección exitosa a Neon Tech.

### 4. Mitigación de Concurrencia de Migraciones (Neon Tech)
- Se detectó que Cloud Run, al escalar horizontalmente contenedores simultáneos, disparaba el `run_migrations.ts` en paralelo. Neon arrojaba `tuple concurrently updated`, lo cual Cloud Run catalogaba como *Fatal Error*, abortando el arranque.
- **Solución:** Se incluyó un manejador `try/catch` nativo en el script de migraciones de Drizzle/PG para detectar el error de concurrencia de tupla y tratarlo como un simple `warning` de competencia (Skip), permitiendo que el contenedor arranque limpiamente.

## Consecuencias
- La UI de Mission Control es capaz de controlar el flujo total de la IA.
- El despliegue concurrente a Cloud Run ya es seguro.
- La conversación de los usuarios ahora posee una curva de humanización real de entrada.
