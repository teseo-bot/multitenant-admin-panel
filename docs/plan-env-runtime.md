# Plan de Resolución: Inyección de Variables Estáticas (NEXT_PUBLIC_*) en Cloud Run

## 1. Diagnóstico del Problema
Actualmente, las variables de entorno orientadas al cliente (`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`) están hardcodeadas en el `Dockerfile` con valores dummy (`https://dummy.supabase.co`). 

Next.js, durante el comando `npm run build`, realiza un proceso de "baking" (quemado) donde reemplaza cualquier referencia a `process.env.NEXT_PUBLIC_*` en el código fuente del frontend con el valor en string que tenga en ese momento. Debido a esto, aunque Cloud Run inyecte los secretos reales de forma correcta mediante Secret Manager en **runtime** (cuando arranca el contenedor), es demasiado tarde para el frontend: el JavaScript estático servido al cliente ya lleva empaquetado el dummy URL.

## 2. Enfoque Arquitectónico (Bottom-Up)
**Consideración:** La forma "purista" en Next.js Standalone es crear un endpoint `/api/config` que lea el `process.env` en el servidor y el frontend lo consuma al arrancar. Sin embargo, dada la **urgencia operativa** y para evitar una refactorización invasiva de React Contexts / Providers, optaremos por **inyectar las variables reales en tiempo de construcción (Build Time)**.

### Estrategia Elegida
Extraer los secretos localmente a través de la CLI de `gcloud` antes de disparar el despliegue e inyectarlos como Build Variables. 

1. **Modificar `deploy-mission-control.sh`:** Para que lea el Secret Manager y utilice el flag `--set-build-env-vars` en `gcloud run deploy`.
2. **Modificar `Dockerfile`:** Para que acepte `ARG` dinámicos y los setee como `ENV` justo antes de ejecutar `npm run build`.

---

## 3. Especificaciones Técnicas (Implementación)

### A) Modificación del `Dockerfile`
En la etapa de compilación (`builder`), debemos eliminar los dummies y declarar los `ARG` explícitamente para que Cloud Build pueda transferir las variables.

```dockerfile
# (Dentro de la etapa builder del Dockerfile, antes del build)

# 1. Declarar los argumentos de construcción (Build Args)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

# 2. Asignarlos a variables de entorno para el proceso de Next.js
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# 3. Compilar (ahora quemará los valores reales en el JS estático)
RUN npm run build
```

### B) Modificación del Script de Despliegue (`deploy-mission-control.sh`)
El script será el orquestador que "toma" los secretos del entorno Cloud y los empuja hacia el contenedor en construcción.

```bash
#!/bin/bash
# deploy-mission-control.sh

echo "🛠️  [1/3] Preparando entorno de despliegue para Mission Control..."
SERVICE_NAME="mission-control"
REGION="us-central1"

echo "🔐 [2/3] Extrayendo secretos de GCP Secret Manager para el Build..."
# Asegurarse de tener permisos: roles/secretmanager.secretAccessor
REAL_SUPABASE_URL=$(gcloud secrets versions access latest --secret="NEXT_PUBLIC_SUPABASE_URL")
REAL_ANON_KEY=$(gcloud secrets versions access latest --secret="NEXT_PUBLIC_SUPABASE_ANON_KEY")

if [ -z "$REAL_SUPABASE_URL" ] || [ -z "$REAL_ANON_KEY" ]; then
    echo "❌ Error: No se pudieron extraer los secretos de Supabase."
    exit 1
fi

echo "🚀 [3/3] Iniciando despliegue con inyección de secretos en Build-Time..."
gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --set-build-env-vars="NEXT_PUBLIC_SUPABASE_URL=${REAL_SUPABASE_URL},NEXT_PUBLIC_SUPABASE_ANON_KEY=${REAL_ANON_KEY}" \
  --allow-unauthenticated

echo "✅ Despliegue finalizado. Las variables de cliente se han incrustado correctamente."
```

## 4. Conclusión para el Ejecutor
- El uso de `--set-build-env-vars` permite a Cloud Build pasar la variable directamente a la directiva `ARG` del `Dockerfile`.
- Este diseño mitiga el error 404 del tenant de Supabase (`dummy.supabase.co`) sin modificar ni una sola línea de código React/Next.js.
- **Riesgo evaluado:** Los secretos quedan quemados en el frontend (lo cual es normal para las `NEXT_PUBLIC_*` ya que son llaves públicas/anónimas diseñadas para exponerse al navegador). Las llaves privadas (`SERVICE_ROLE_KEY`) **no** deben ser agregadas a este flujo, esas deben seguir manteniéndose estrictamente en runtime.
