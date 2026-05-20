# RFC-050: Resolución de Deuda Técnica y Hardening del Compilador (Bloque 11 - Fase 2)

## 1. Metadatos
- **Estado:** Aprobado / Listo para Ejecución
- **Servicio Afectado:** `crm-agentico-compiler`
- **Objetivos Principales:** Inmutabilidad de dependencias (Locking) y Hardening Docker (Entorno Rootless) para Google Cloud Run.
- **Hallazgos QA a resolver:** H-1 a H-5.

## 2. Resumen Ejecutivo
Este RFC define la estrategia para saldar la deuda técnica en el servicio `crm-agentico-compiler`. Se establecen dos pilares fundamentales: 
1. **Inmutabilidad en la Cadena de Suministro:** Se implementará un mecanismo estricto de fijación (pinning) de dependencias (directas y transitivas) para eliminar las derivas de versiones detectadas en QA.
2. **Endurecimiento del Contenedor (Hardening):** Se reestructurará el `Dockerfile` para migrar la ejecución a un entorno *rootless*, garantizando cumplimiento con los lineamientos de seguridad para el despliegue en Google Cloud Run y mitigando vectores de ataque sobre escalamiento de privilegios.

## 3. Estrategia Arquitectónica

### 3.1 Lock de Dependencias (Inmutabilidad)
Se detectó inestabilidad derivada de dependencias libres (ej. `scikit-learn`, `tenacity`).
- **Patrón a Implementar:** Consolidación mediante herramientas deterministas (ej. `pip-tools` o `uv`). Se definirá un `requirements.in` (dependencias principales) y se generará un `requirements.txt` compilado, inmutable y bloqueado (pinned) que incluya explícitamente todas las dependencias transitivas con operadores de igualdad exacta (`==`).
- **Beneficio Operativo:** Construcciones 100% reproducibles, mitigación contra actualizaciones rompedoras (breaking changes) y eliminación de regresiones silenciosas en Producción.

### 3.2 Hardening Docker (Rootless y Cloud Run)
Para cumplir con el estándar de despliegue en Cloud Run, se prohíbe la ejecución de la aplicación bajo el usuario `root` interno del contenedor.
- **Directivas Arquitectónicas Estrictas:**
  1. **Base Minimalista:** Empleo de una imagen oficial optimizada (ej. `python:3.11-slim`) para reducir la superficie de ataque y el tamaño del asset.
  2. **Aislamiento de Privilegios:** Creación de un usuario de sistema dedicado (ej. `appuser`) y un grupo no privilegiado (ej. `appgroup`) con un GID/UID explícito (ej. `10001`).
  3. **Ownership Acotado:** El directorio de trabajo `/app` pertenecerá exclusivamente a `appuser:appgroup`. Los archivos copiados tomarán esta misma propiedad.
  4. **Puertos Seguros:** Exposición obligatoria de un puerto superior al `1024` para no requerir privilegios de kernel (`CAP_NET_BIND_SERVICE`). Se utilizará el estándar de Cloud Run: Puerto `8080`.
  5. **Predictibilidad de Ejecución:** Inyección de las variables de entorno `PYTHONDONTWRITEBYTECODE=1` y `PYTHONUNBUFFERED=1`.

## 4. Diseño del Dockerfile (Plantilla Normativa)
La siguiente estructura debe ser replicada exactamente por el Ejecutor:

```dockerfile
# 1. Imagen Base Segura y Minimalista
FROM python:3.11-slim

# 2. Configuración de Entorno de Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

# 3. Creación del grupo y usuario del sistema (Rootless)
RUN groupadd -r -g 10001 appgroup && \
    useradd -r -u 10001 -g appgroup -s /sbin/nologin -c "App User" appuser

# 4. Definición del directorio de trabajo
WORKDIR /app

# [Opcional] Instalación de dependencias del OS necesarias (ej. build-essential)
# RUN apt-get update && apt-get install -y --no-install-recommends <deps> \
#     && rm -rf /var/lib/apt/lists/*

# 5. Inyección Segura del Lockfile
COPY --chown=appuser:appgroup requirements.txt .

# 6. Instalación inmutable a nivel contenedor
RUN pip install --no-cache-dir -r requirements.txt

# 7. Copia del código fuente con asignación estricta de propiedad
COPY --chown=appuser:appgroup . .

# 8. Transición del contexto de ejecución (Drop de Privilegios a nivel OS)
USER appuser

# 9. Declaración del puerto (Cloud Run Default)
EXPOSE 8080

# 10. Entrypoint (El comando debe ser adaptado al framework en uso)
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

## 5. Work Breakdown Structure (WBS)

El despliegue de estas mejoras se realizará en los siguientes pasos estrictos:

### Tarea 1: Auditoría de Estado y Base Line (Agente: Learner)
- **1.1:** Localizar y leer el esquema de dependencias actual en el repo `crm-agentico-compiler`.
- **1.2:** Mapear el `Dockerfile` preexistente para identificar librerías de OS adicionales que puedan ser necesarias en la nueva base `slim`.

### Tarea 2: Consolidación e Inmutabilidad (Agente: Ejecutor)
- **2.1:** Extraer dependencias explícitas hacia un archivo `requirements.in`.
- **2.2:** Ejecutar la compilación para generar un `requirements.txt` cerrado (pinned) utilizando la versión más reciente y estable de `scikit-learn` y `tenacity`.

### Tarea 3: Implementación de Hardening Docker (Agente: Ejecutor)
- **3.1:** Reemplazar el `Dockerfile` de `crm-agentico-compiler` integrando el diseño *rootless* expuesto en la Sección 4 de este RFC.
- **3.2:** Asegurar que ninguna variable de entorno, comando `RUN` o directiva requiera acceso a `/root` o eleve privilegios.

### Tarea 4: Certificación de Integridad (Agente: Tester)
- **4.1:** Compilación local de la nueva imagen (`docker build -t compiler:rfc-050 .`).
- **4.2:** Invocación del contenedor aislando red y verificando que inicialice de forma sana en el puerto `8080` (Healthcheck base).
- **4.3:** Ejecución del suite de pruebas existente para confirmar que las dependencias lockeadas no rompieron la lógica de negocio subyacente.
