# Walkthrough - Estabilización de Orchestrator Staging

Hemos logrado desplegar con éxito el Teseo AI Orchestrator en el ambiente de Staging, superando los fallos críticos de arranque y permisos.

## Cambios Principales

### 1. Robustez del Entorno (Dockerfile)
Se migró la imagen base de `node:20-slim` a `node:20` (full).
- **Razón**: El error persistente "Application exec likely failed" indicaba fallos en el cargador dinámico o falta de librerías base para cargar módulos nativos de LangChain/Puppeteer.
- **Resultado**: El binario de Node ahora carga correctamente el punto de entrada.

### 2. Inicio No Bloqueante (src/index.ts)
Se refactorizó la secuencia de arranque para satisfacer los health checks de Cloud Run.
- **Fail-Fast**: Se añadieron validaciones de variables de entorno al inicio del proceso.
- **Asincronía**: El servidor Hono inicia inmediatamente (escucha en el puerto 8080), mientras que la conexión a la base de datos y la inicialización de tablas ocurren en segundo plano.

### 3. Resolución de IAM y Secretos
Se detectó que el Service Account de Cloud Run no tenía permisos de lectura sobre los nuevos secretos de Staging.
- **Acción**: Se otorgó el rol `Secret Manager Secret Accessor` a la cuenta `1067632954359-compute@developer.gserviceaccount.com` para los secretos:
    - `ORCHESTRATOR_DATABASE_URL`
    - `ORCHESTRATOR_M2M_API_KEY`
    - `ORCHESTRATOR_TENANT_OS_URL`
    - `ORCHESTRATOR_TELEGRAM_BOT_TOKEN`
    - `WHATSAPP_API_TOKEN`
    - `WHATSAPP_PHONE_NUMBER_ID`
    - `WHATSAPP_VERIFY_TOKEN`

### 4. Restauración de Arquitectura (service-staging.yaml)
Se reintegró el sidecar `trirreme` (anteriormente `obscura`) para el procesamiento de browser headless.
- Se sincronizaron los nombres de contenedores y los probes con el estándar de producción.

## Verificación de Salud

El servicio ya responde públicamente en:
`https://crm-agentico-orchestrator-staging-cyxizsjbka-uc.a.run.app/health`

```json
{"status":"ok","timestamp":"2026-05-13T02:21:35.811Z"}
```

## Próximos Pasos Recomendados
1. **Habilitar Migraciones**: Una vez confirmada la estabilidad, cambiar `SKIP_MIGRATIONS=false` en `service-staging.yaml`.
2. **Pruebas E2E**: Enviar un mensaje de prueba via WhatsApp/Telegram al bot de staging para verificar el flujo completo de LangGraph.
