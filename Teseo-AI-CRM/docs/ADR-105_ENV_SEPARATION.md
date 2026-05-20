# ADR-105: Separación de Entornos (Local Enjambre vs GCP Producción)

## Fecha
30 de Abril de 2026

## Contexto
El desarrollo bajo la directiva de Polyrepo estaba generando problemas de fricción al correr servicios desconectados localmente, creando colisiones de puertos, problemas de visibilidad de red, y requiriendo despliegues parciales a la nube (Cloud Run) para poder realizar integraciones profundas (ej: llamadas RPC entre Mission Control, Orchestrator y los Tenants). 

## Decisión
Se establece formalmente un límite duro entre el Entorno Local y el Entorno de Producción:
1. **Local (Enjambres Concurrentes):** Consolidado en un `docker-compose.yml` maestro en la raíz de `/Users/teseohome/Teseo_AI/`. Levanta la red completa local (Mission Control, CRM Orquestador, Obscura, Base de Datos, Odoo MCP y Tenants) en contenedores paralelos. Sirve como pista de pruebas unificada y *Clean Room* de los Agentes.
2. **Producción (Cloud Run Gen2 / GCP):** Los servicios desplegados permanecen intocables y sin interrupción. El pipeline hacia Producción ahora requiere que los agentes verifiquen las métricas de éxito en el Enjambre Local antes de autorizar un pase a la nube.

## Consecuencias
- **Positivas:** Permite la orquestación simultánea sin saturar la red local. Garantiza que todos los contenedores vean la misma versión de la base de datos de pruebas o de pgvector. Cero interrupciones para usuarios actuales en la capa de GCP.
- **Negativas:** Exige un control riguroso de variables de entorno `.env` para asegurar que el `docker-compose` maestro no apunte por accidente a la base de datos productiva de Supabase.
