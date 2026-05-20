# RFC-052: Rate Limiting y Prevención de Token Exhaustion

## 1. Contexto y Problema
Actualmente, el `webhook.ts` centralizado recibe tráfico de canales como WhatsApp (Meta), Telegram y Web. Este tráfico invoca de manera asíncrona un flujo de LangGraph a través del `ingestionGateway`. Dado que los modelos fundacionales (ej. Claude, Gemini, OpenAI) cobran por token, un usuario malintencionado (o un bot descontrolado) podría enviar cientos de mensajes en segundos a través de WhatsApp, consumiendo rápidamente el presupuesto mensual del `tenantId` (Ataque de Token Exhaustion).

## 2. Análisis de Trade-offs (Estrategias Evaluadas)

### A. Google Cloud Armor (Nivel de Infraestructura / L7)
- **Pros:** Detiene el tráfico antes de que despierte instancias de Cloud Run, ahorrando costos de cómputo.
- **Contras:** Cloud Armor opera principalmente a nivel de IP y headers HTTP crudos. Los webhooks de Meta o Telegram provienen de rangos de IPs del proveedor. Si aplicamos rate limiting estricto por IP en Cloud Armor, **bloquearemos a Meta completo**, desconectando a todos los usuarios de WhatsApp del Tenant. 
- **Veredicto:** Solo debe usarse como WAF perimetral contra ataques volumétricos generales, NO para Token Exhaustion basado en usuarios de negocio.

### B. In-Memory Rate Limiting (Node Map / LRU Cache)
- **Pros:** Extremadamente rápido (latencia sub-milisegundo), implementación trivial.
- **Contras:** Cloud Run escala horizontalmente (múltiples contenedores). La memoria no se comparte entre instancias. Un atacante balanceado entre 5 instancias tendrá un límite 5 veces mayor.
- **Veredicto:** Insuficiente para entornos Serverless dinámicos.

### C. PostgreSQL (Reutilizando Infraestructura Actual)
- **Pros:** No añade infraestructura nueva (ya tenemos un Pool de `pg` y tablas para el `checkpointer` / Supabase).
- **Contras:** Genera carga de I/O adicional en la base de datos transaccional y agrega latencia en cada mensaje entrante.
- **Veredicto:** Es el **MVP ideal** usando una tabla `UNLOGGED` en Postgres para reducir I/O, con limpieza automática (cron o pg-boss).

### D. Redis (Google Cloud Memorystore / Upstash)
- **Pros:** Estándar de la industria, operaciones atómicas (ej. `INCR`, `EXPIRE`), latencia de red mínima, alta escalabilidad horizontal.
- **Contras:** Introduce un nuevo servicio de infraestructura, aumentando el costo mensual y la complejidad de despliegue.
- **Veredicto:** **Solución definitiva** para producción a escala.

## 3. Diseño Propuesto (Nivel de Arquitectura)

Se implementará la estrategia a nivel de aplicación (Gateway/Hono) debido a la necesidad de inspeccionar el payload de negocio. 

### Ubicación del Middleware
El control de límites se inyectará en `src/orchestrator/src/routes/webhook.ts`, **después** del `ingestionGateway` (el cual normaliza la data) y **antes** de adquirir el lock de hilo. 

```typescript
// Diseño conceptual
webhook.post('/:channel', devTenantInjector, ingestionGateway, rateLimiter, async (c) => {
    // ... invocación al grafo
});
```

### Llaves de Rate Limiting (Dimensiones)
El middleware leerá la variable inyectada `(c as any).get('genericMessage')` y establecerá dos capas de protección:
1. **Límite por Sender (`senderId`):** Ej. Max 5 mensajes por minuto por usuario final. Evita que un solo humano o bot vacíe la cuenta.
2. **Límite por Tenant (`tenantId`):** Ej. Max 100 mensajes por minuto globales por inquilino. Controla el límite de presupuesto total para mitigar ataques distribuidos o picos masivos.

### Manejo de la Restricción (Denial)
Si el límite se supera, el Gateway no procesará el mensaje en LangGraph y hará un Drop silencioso o responderá con HTTP 429 para que el canal (ej. Web) informe al usuario. Para canales asíncronos (Meta), se hace un bypass retornando HTTP 200 al proveedor (para que no reintente el webhook eternamente) pero registrando una métrica de Drop.

## 4. Pasos de Implementación (Track de Desarrollo)
1. **MVP (Semana 1):** Crear la función de rate limiting utilizando el pool existente de PostgreSQL con una tabla `UNLOGGED`.
2. Registrar eventos de límite excedido en el sistema de L1 Alerts.
3. **Escalabilidad (Post-Lanzamiento):** Migrar el conteo a Redis usando `ioredis` si las métricas de Cloud Monitoring indican un cuello de botella de I/O en Postgres durante picos de carga.

---
*Este diseño respeta el Zero-Trust pipeline aislando los tenants y salvaguarda el pool financiero (Tokens).*