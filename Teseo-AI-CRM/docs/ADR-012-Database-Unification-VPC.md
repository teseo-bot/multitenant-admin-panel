# ADR-012: Unificación de Pool PostgreSQL, Enrutamiento VPC y Health-Check de Arranque

## Estado
Aceptado (17 Abril 2026)

## Contexto y Problema
Durante el despliegue del motor `crm-agentico-orchestrator` a Cloud Run, el servicio experimentó un crash-loop arrojando el error `ECONNREFUSED 127.0.0.1:5436`. 

El análisis forense de arquitectura reveló múltiples vulnerabilidades de infraestructura:
1. **Pools Fragmentados:** Existían dos conexiones separadas hacia la misma base de datos (`checkpointer.ts` y `db.ts`).
2. **Conflicto de Variables:** Al inyectar variables de entorno individuales en Cloud Run (`DB_HOST`, `DB_PORT`), el pool de `db.ts` hizo fallback a `localhost` porque estaba programado para buscar exclusivamente `DATABASE_URL`.
3. **Aislamiento de Red:** Cloud Run no podía alcanzar la IP privada de Cloud SQL (`172.18.208.3`) porque el tráfico saliente (`Egress`) no estaba enrutado hacia la Virtual Private Cloud (VPC) del proyecto.
4. **SSL Estricto:** Cloud SQL rechazaba las conexiones de la aplicación (`connection requires a valid client certificate`).
5. **Carga Insegura de Secretos:** La instrucción `import 'dotenv/config'` se estaba ejecutando en producción, arriesgando el estado de las variables inyectadas nativamente por GCP.

## Decisión Técnica
Para estabilizar el servicio y asegurar el estándar de grado producción, se implementaron las siguientes medidas:
1. **Unificación de Pools:** Se refactorizaron `checkpointer.ts` y `db.ts` para que ambos consuman un único string de conexión a través de la variable `DATABASE_URL`.
2. **Health-Check de Arranque:** Se inyectó un comando `SELECT 1` pre-serve en `index.ts` para forzar el fallo temprano (Fail-fast) antes de abrir el puerto web 8080 si la BD no está disponible.
3. **Enrutamiento Interno (VPC):** Se enlazó el servicio de Cloud Run al conector `crm-connector` (Serverless VPC Access) forzando `--vpc-egress=all-traffic`.
4. **SSL Relajado en Base de Datos:** Se modificó la instancia SQL (`gcloud sql instances patch fleetco-db-prod --no-require-ssl`) para permitir conexiones encriptadas sin exigir validación de certificado por parte del cliente Node.js.
5. **Protección Dotenv:** Se condicionó el módulo `dotenv/config` para ser invocado exclusivamente en desarrollo (`NODE_ENV !== 'production'`).

## Consecuencias y Siguientes Pasos
El orquestador Hono es ahora 100% cloud-native, tolerante a fallos de inicialización y se comunica de forma privada y segura con Cloud SQL (PgVector) sin salir a internet. 

La deuda técnica de los canales (Webhooks locales) queda en cuarentena hasta la actualización de Meta Developers y BotFather hacia la URL de producción de Cloud Run.