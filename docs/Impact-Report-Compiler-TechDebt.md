# Reporte de Impacto: Deuda Técnica y Vulnerabilidades en crm-agentico-compiler

## 1. Análisis de Dependencias (pyproject.toml)
Se ha detectado una violación a las políticas de fijación de dependencias. Actualmente, el archivo `pyproject.toml` especifica dependencias "sueltas" (loose dependencies) usando el operador `>=`, lo cual permite instalaciones no deterministas en cada construcción del contenedor.

### Dependencias Sueltas Detectadas:
* `fastapi>=0.115`
* `uvicorn[standard]>=0.30`
* `pydantic>=2.0`
* `pydantic-settings>=2.0`
* `supabase>=2.0`
* `asyncpg>=0.29`
* `httpx>=0.27`
* `google-genai>=1.0`
* `PyMuPDF>=1.24`
* `python-docx>=1.1`
* `chardet>=5.0`
* `pandas>=2.0`
* `numpy>=1.26`
* `scipy>=1.12`
* `scikit-learn>=1.3.0`
* `structlog>=24.0`
* `python-magic>=0.4`

**Riesgo:** Esto produce escenarios donde "funciona en mi máquina" pero falla en producción debido a que versiones más nuevas pueden introducir "breaking changes". Aunque existe un `uv.lock`, el Dockerfile no lo está respetando.

---

## 2. Vulnerabilidades Arquitectónicas (Dockerfile)

Se examinó el archivo `Dockerfile` actual de `crm-agentico-compiler` y se encontraron las siguientes vulnerabilidades y faltas de "hardening":

1. **Ejecución como Root:**
   El contenedor arranca a partir de `python:3.12-slim` sin declarar un usuario no privilegiado (`USER`). Al ejecutarse como root, cualquier brecha o vulnerabilidad de ejecución de código remoto (RCE) en FastAPI podría comprometer el entorno del contenedor.

2. **Manejo Incorrecto de Dependencias (No se usa uv.lock):**
   El comando `RUN pip install --no-cache-dir .` obvia por completo el archivo `uv.lock` existente en el directorio, y resuelve las versiones sobre la marcha (usando las restricciones débiles del `pyproject.toml`). Esto invalida el propósito del lockfile. 

## 3. Recomendaciones y Mitigación

* **Hardening del Dockerfile:**
  1. Crear un grupo y usuario no privilegiado (ej. `nonroot`).
  2. Modificar la propiedad de los archivos a este nuevo usuario.
  3. Añadir la directiva `USER nonroot` antes de `EXPOSE` o `CMD`.
* **Determinismo en Instalación:**
  1. Reemplazar `pip install` con la ejecución de `uv` (ya sea instalando `uv` en el contenedor o usando una imagen base compatible), e instalar estrictamente mediante `uv sync` o referenciando `uv.lock` para que las versiones de producción sean consistentes.
