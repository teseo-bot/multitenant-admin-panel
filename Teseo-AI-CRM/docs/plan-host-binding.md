# Plan Técnico: Corrección de Binding en Cloud Run para Mission Control (Next.js)

## 1. Contexto y Problema
En entornos serverless como Google Cloud Run, la plataforma inyecta dinámicamente un puerto a través de la variable de entorno `$PORT` (usualmente 8080) y requiere que el contenedor escuche explícitamente en todas las interfaces de red (`0.0.0.0`). 
El enfoque actual en `mission-control` utiliza el script `npm run start` (que ejecuta `next start`). Aunque el `Dockerfile` actual define `ENV HOSTNAME="0.0.0.0"` y `ENV PORT=3000`, la inicialización a través del orquestador de NPM frecuentemente ignora las variables inyectadas en tiempo de ejecución o impide que Next.js enlace el socket de manera correcta en el tiempo esperado. Esto provoca que el health check de GCP falle por "Port Timeout", terminando el contenedor.

## 2. Propuesta de Arquitectura (Trade-offs)
**Enfoque Recomendado (Best Practice para Next.js en Cloud Run):** Compilación tipo `standalone`.
- **Pros:** Genera un archivo minimalista de entrada (`server.js`) que inicia un servidor de Node puro. Este binario atiende directamente a `process.env.PORT` y `process.env.HOSTNAME` de forma nativa sin pasar por el CLI de Next ni NPM. Además, reduce drásticamente la superficie de ataque y el tamaño final de la imagen al eliminar la necesidad de acarrear los `node_modules` completos en la etapa de ejecución.
- **Contras:** Requiere una adaptación en el copiado de los archivos dentro de la etapa `runner` del `Dockerfile`.

## 3. Work Breakdown Structure (WBS) - Pasos Técnicos para el Ejecutor

### Paso 1: Habilitar el Output Standalone
- **Archivo a Modificar:** `src/mission-control/next.config.ts`
- **Acción:** Modificar el objeto `nextConfig` para incluir la propiedad `output: "standalone"`.
- **Justificación:** Esto instruirá al framework para aislar solo los archivos y dependencias estrictamente necesarios en un build compacto.

### Paso 2: Refactorización de la Etapa Runner en el Dockerfile
- **Archivo a Modificar:** `src/mission-control/Dockerfile`
- **Acciones:**
  1. En la fase `runner`, **eliminar** la copia genérica de `package.json` y `node_modules` (`COPY --from=builder /app/node_modules ./node_modules`, etc.). En standalone ya no se requieren.
  2. Sustituir las instrucciones de copiado de la aplicación por las siguientes rutas específicas del build `standalone`:
     - Copiar los artefactos core: `COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./`
     - Copiar la carpeta estática para que el custom server la pueda enrutar: `COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static`
     - (Mantener la copia de `/app/public` tal como está, hacia `./public`).
  3. Modificar el comando de arranque: Cambiar `CMD ["npm", "run", "start"]` por `CMD ["node", "server.js"]`.
- **Justificación:** `server.js` inicializa el binding utilizando la red a nivel Node.js puro e incorpora nativamente cualquier valor que reciba en `PORT`. (Se mantienen los `ENV PORT=3000` y `ENV HOSTNAME="0.0.0.0"` del Dockerfile actual como fallbacks saludables para desarrollo local).

### Paso 3 (Fallback Opcional): Forzar argumentos en package.json
*Nota: Este paso solo debe implementarse si el enfoque `standalone` fracasa debido a incompatibilidades extrañas con librerías nativas.*
- **Archivos a Modificar:** `src/mission-control/package.json` y `src/mission-control/Dockerfile`.
- **Acción:**
  - En el `package.json`, cambiar `"start": "next start"` a `"start": "next start -H 0.0.0.0 -p ${PORT:-3000}"`.
  - En el `Dockerfile`, modificar el CMD a `CMD ["sh", "-c", "npm run start"]`.

## 4. Criterios de Aceptación (Para la fase Tester/Reviewer)
1. Al probar la imagen en local (`docker run -p 8080:8080 -e PORT=8080 -e HOSTNAME=0.0.0.0 teseo/mission-control`), la aplicación debe responder en el puerto 8080 (emulando GCP).
2. Los logs de inicialización del contenedor deben indicar claramente `Listening on port 8080 url: http://0.0.0.0:8080`.
3. Tras el despliegue a Cloud Run, el contenedor no debe ser terminado por un "Timeout de Puerto" y el tráfico debe enrutar correctamente a la interfaz.