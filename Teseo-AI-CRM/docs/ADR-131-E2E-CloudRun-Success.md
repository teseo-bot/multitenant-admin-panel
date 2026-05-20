# ADR-131: Cierre de Sesión E2E en Sandbox Cloud Run

## 1. Contexto
Durante la sesión del 21 de Abril de 2026, logramos desplegar de forma íntegra la plataforma *crm-agentico-panel* hacia un entorno Sandbox de Producción (Cloud Run) en GCP (`teseobot-487515`). 

## 2. Decisiones Arquitectónicas y Post-Mortem E2E
1. **Despliegue Multi-Stage:** Se construyó un Dockerfile standalone optimizado para entornos serverless, eliminando componentes superfluos.
2. **Exposición IAM:** Al habilitar el rol `run.invoker` de forma pública, conseguimos acceso libre a la URL para poder interactuar y probar el Next.js.
3. **Pruebas Playwright:** Se estableció una suite de QA (Smoke Test y Pruebas Transaccionales E2E) apuntando a la URL pública, logrando un 100% de `PASS`. 
4. **Mitigación Middleware:** Durante los tests detectamos que los SSR sin JWT eran bloqueados por Next.js levantando un error 404 hacia la antigua ruta de `/login` en vez de `/auth/login`. Este error se corrigió rápidamente ajustando el test y logrando que todos los Assertions E2E pasaran a estado verde.

## 3. Estado de Entrega (Testing Humano)
El panel se encuentra vivo y listo para pruebas humanas manuales en `https://crm-agentico-panel-1067632954359.us-central1.run.app`.

## 4. Próxima Dependencia Arquitectónica
Dado que el UI y el Orquestador ya fueron conectados, el bloque `Asset Studio` está casi listo. Sin embargo, el **Renderizado Headless** (Phase 6 del Sprint de animaciones/GSAP) es la última deuda técnica importante para que el Asset Studio (y la herramienta de Canvas) quede consolidada con *Snapshots Reales* (Playwright como worker en Node.js inyectando imágenes a Supabase).
