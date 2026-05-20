# ADR-111: Bases de Datos Efímeras en Integración Continua (CI Quality Gate)

**Fecha:** 2 Mayo 2026  
**Estado:** Aceptado  
**Autor:** Builder (coordinado por Teseo, aprobado por CEO)

## 1. Contexto y Problema
Recientemente, los tests de integración (`dlq_worker.test.ts` y `checkpointer.test.ts`) fallaron en el entorno de GitHub Actions (CI) con errores `ECONNREFUSED`. Esto se debió a que el runner de Ubuntu no cuenta con una instancia de PostgreSQL configurada. La medida paleativa fue inyectar *mocks* de base de datos en los archivos de test, lo cual liquidó la alerta pero transformó pruebas de integración puras en pruebas unitarias ciegas ante fallos de sintaxis SQL, concurrencia (como `FOR UPDATE SKIP LOCKED`) o violaciones de esquema.
Se debatió la responsabilidad de GitHub Actions versus pruebas locales, confirmándose la postura de mantener a GitHub Actions como la "Aduana Automatizada" que protege a Producción (GCP).

## 2. Decisión Arquitectónica
Se instaura la política de **Bases de Datos Efímeras en CI**. El pipeline de Integración Continua debe levantar sus propios contenedores reales durante la fase de validación automatizada.

1. **Servicio Efímero:** El archivo `.github/workflows/ci.yml` debe configurar un *service* de `pgvector/pgvector:pg16` para brindar una base de datos real y limpia a la suite de `vitest`.
2. **Migraciones Automáticas:** Antes de ejecutar los tests, el pipeline debe correr los scripts de esquema (`migrations/*.sql`) contra esta base de datos desechable.
3. **Prohibición de Mocks de I/O de Datos:** Queda estrictamente prohibido simular (`vi.mock`) el pool de conexiones de `pg` para apagar fuegos de red en CI, exceptuando flujos puramente unitarios sin afectación transaccional. Los tests de integración deben validar contra los fierros.

## 3. Consecuencias
* **Positivas:** Restauración del rigor técnico y fiabilidad del 100% de que lo que se aprueba en verde en la nube no romperá Cloud Run. Adiós a los "falsos positivos".
* **Negativas / Riesgos:** Un leve incremento (algunos segundos) en el tiempo total de ejecución del workflow de GitHub Actions debido al arranque del contenedor de Postgres.