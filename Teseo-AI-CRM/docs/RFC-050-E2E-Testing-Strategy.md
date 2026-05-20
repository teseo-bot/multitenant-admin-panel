# RFC-050: Estrategia de Pruebas E2E en Producción (Tenant OS)

## 1. Contexto Actual
El proyecto ha generado una copia de seguridad estática (`teseo_crm_backup_2026-04-21_19-27-02.tar.gz` - 41MB) cubriendo todo el desarrollo Zero-Trust del Track Primario (Sprints 1 al 6). El sistema está acoplado, hidratando base de datos real (Supabase PostgreSQL) y gestionando eventos dinámicos (LangGraph).

## 2. Planificación de Pruebas E2E (Cuándo y Cómo)

### 2.1. ¿Cuándo es el momento adecuado?
Las pruebas End-to-End globales deben ejecutarse **inmediatamente después del despliegue en un entorno de Staging/Pre-Producción (Cloud Run)**, nunca contra el localhost de desarrollo para las certificaciones formales.
Dado que la arquitectura ya está en código, el pipeline correcto es:
1. Push a rama principal (`git push`).
2. Disparo de CI/CD (GitHub Actions / Cloud Build) hacia Cloud Run.
3. Ejecución automática de la Suite E2E contra la URL pública inyectando tokens de test.

### 2.2. ¿Qué se va a probar? (Playwright Suite)

Se diseñarán tres flujos críticos (Happy Paths) que no pueden fallar en Producción:

#### A. Flujo Transaccional (Inbox & Kanban)
- **Actor:** Agente / Humano.
- **Acción:** Un webhook dispara la creación de un Lead.
- **Expectativa:** La interfaz de Kanban (SSE) debe re-renderizar el tablero en tiempo real. El usuario mueve la tarjeta a "Qualified" (Mutación Optimista -> DB 200 OK).

#### B. Flujo HITL & Handoff (Escalamiento)
- **Actor:** LangGraph (AI) -> SDR (Humano).
- **Acción:** Un Lead es marcado para escalamiento. El Agent Stream expulsa al LLM y bloquea la inyección de prompts.
- **Expectativa:** El Inbox Dual muestra el botón de "Take Over". El humano envía un mensaje y se registra como `message_sender: 'human_admin'`.

#### C. Flujo de Configuración (Asset Studio)
- **Actor:** Tenant Admin.
- **Acción:** Creación de una nueva Variable `{{test_var}}` y su inyección en el editor de Prompts.
- **Expectativa:** El guardado del Prompt genera una versión nueva en BD (Inmutabilidad verificada) y el LangGraph adopta el cambio en el siguiente ciclo.

## 3. Próximo Paso
Para avanzar a esta fase, el equipo debe:
1. Confirmar el despliegue del contendor Docker (`crm-agentico-panel`) a Cloud Run.
2. Autorizar al Tester (SDET) para que escriba la suite de Playwright (`tests/e2e`) apuntando al entorno vivo.
