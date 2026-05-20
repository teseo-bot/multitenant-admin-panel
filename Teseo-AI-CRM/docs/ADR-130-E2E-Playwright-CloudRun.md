# ADR-130: Pruebas E2E en Sandbox (Cloud Run)

## 1. Contexto
El despliegue de `crm-agentico-panel` a Cloud Run se ejecutó con éxito utilizando el proyecto Sandbox `teseobot-487515`. 
URL de acceso público: `https://crm-agentico-panel-1067632954359.us-central1.run.app`

El CEO de Teseo Latam, Jorge García, ha confirmado que este entorno es el Sandbox designado para las pruebas E2E con el fin de validar el comportamiento de Producción sin afectar datos de clientes reales.

## 2. Decisión Arquitectónica (Playwright Suite)
Como indica el **RFC-050**, Playwright no atacará instancias de `localhost`. El Tester debe crear el proyecto de pruebas apuntando a esta URL Base.
El despliegue fue ejecutado con el bypass temporal para RLS/DB Dummy (`NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321` en el contenedor), lo cual es ideal para que el servidor Node.js arranque en el Sandbox sin necesidad de bases de datos productivas. Sin embargo, significa que los flujos a evaluar en esta suite inicial deben estar mokeados de lado del servidor (Mock Service Worker / interceptors) o debemos actualizar las variables en GCP hacia una BD de Staging.

## 3. Próximos Pasos (Tester SDET)
Se escribirá un script de prueba E2E básico de "Smoke Test" que garantice:
- La resolución DNS y carga del Frontend en Cloud Run.
- El despliegue visual del `Command Center` (Layout, Sidebar, Skeletons de Kanban y Analytics) demostrando que los componentes de Next.js renderizaron en el contenedor.
