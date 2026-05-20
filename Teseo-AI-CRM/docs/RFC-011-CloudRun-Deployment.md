# RFC-011: Hono + Cloud Run Deployment Crash (404 GFE)

## 1. Contexto y Problema
Durante el despliegue del motor `crm-agentico-orchestrator` hacia Google Cloud Run, las sondas de inicio TCP en el puerto 8080 fallan, lo que provoca que el Google Front End (GFE) retorne un error 404 al no encontrar instancias saludables ("Ready condition status changed to False"). 

## 2. Trazabilidad del Error
Revisando los logs de Cloud Run, el error raíz es el colapso del contenedor durante el arranque:
```
Error: Cannot find module '/app/dist/index.js'
    at Module._resolveFilename (node:internal/modules/cjs/loader:1207:15)
    ...
```

**Análisis de las posibles causas:**
1. **Compilación Local vs Cloud Build:** En pruebas locales con `docker build`, el archivo `/app/dist/index.js` sí se genera y el contenedor inicia exitosamente. 
2. **Impacto del `.dockerignore`:** El archivo `.dockerignore` incluye el directorio `dist`. En algunos entornos gestionados como Google Cloud Build, la presencia de un directorio en `.dockerignore` provoca que la instrucción `COPY --from=builder /app/dist ./dist` sea ignorada, resultando en un contenedor runner sin los artefactos compilados.
3. **Manejo de dependencias (NODE_ENV):** Si GCP inyecta `NODE_ENV=production` en el entorno de build, `npm ci` omitirá instalar `typescript` (al estar en `devDependencies`), lo que podría hacer que `npx tsc` falle, aunque debería haber fallado la etapa de build, no la de ejecución.

## 3. Dictamen y Siguientes Pasos
El adaptador de Hono Nodeserver y Cloud Run están chocando estructuralmente debido a la ausencia del punto de entrada (`dist/index.js`) tras el build en GCP.

**Solicitud a Auditoría (Opus):**
Requerimos que Claude Opus (Auditor) analice este comportamiento específico entre Cloud Build, Dockerfile (Multi-stage) y `.dockerignore`, validando nuestra hipótesis y entregando el fix arquitectónico (ya sea renombrar la salida a `build`, ajustar dependencias o modificar las instrucciones de COPY).