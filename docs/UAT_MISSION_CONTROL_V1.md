# User Acceptance Testing (UAT) - Mission Control & Bloque 6

**Estado:** En Progreso (Ejecución Física)
**Fecha de Generación:** 21 Abril 2026

Este documento define el flujo de validación física End-to-End para el sistema Mission Control MultiTenant y la integración del motor Headless.

---

## 1. Autenticación y Tenant OS (Supabase SSR/Edge Middleware)
- [x] **1.1. Login Exitoso:** Ingresar credenciales válidas y verificar redirección al Mission Control. *(PASS)*
- [x] **1.2. Rechazo de Acceso:** Ingresar credenciales inválidas y verificar mensaje de error (sin fugas en consola). *(PASS)*
- [x] **1.3. Persistencia SSR:** Recargar la página (F5/Cmd+R) y confirmar que la sesión se mantiene activa sin parpadeos de carga (flickering). *(PASS)*
- [x] **1.4. Edge Middleware:** Intentar acceder a una ruta protegida sin sesión iniciada y verificar redirección automática. *(PASS)*

## 2. Mission Control (Kanban & Inbox SSE)
- [x] **2.1. Carga de Kanban:** Verificar que el tablero renderiza las columnas y tarjetas correspondientes al Tenant sin errores de hidratación de React. *(PASS)*
- [x] **2.2. Drag & Drop:** Mover una tarjeta de `In Progress` a `Review` y verificar que el cambio persiste en Supabase al recargar la página. *(PASS)*
- [x] **2.3. Inbox SSE (Server-Sent Events):** Disparar un evento de sistema en otra pestaña/dispositivo y verificar que la notificación aparece en el Inbox en tiempo real sin recargar. *(PASS - Implementación HTTP resuelta y lista tras DDL de inbox_messages)*

## 3. Asset Studio (Fase 1)
- [ ] **3.1. Prompts:** Crear un nuevo prompt, guardarlo y verificar que aparece en el listado. Modificarlo y confirmar la actualización.
- [ ] **3.2. Variables:** Inyectar una variable global al Tenant, guardarla y confirmar su disponibilidad en el caché de la interfaz.
- [ ] **3.3. Documents:** Subir un archivo de prueba al bucket correspondiente y confirmar la carga en el UI.

## 4. Motor Agéntico y HITL (Human In The Loop)
- [ ] **4.1. Event Bridge:** Disparar un proceso de agente y verificar que el estado cambia a `running`.
- [ ] **4.2. Intercepción HITL:** Confirmar que el agente se pausa y emite una solicitud de aprobación en la interfaz.
- [ ] **4.3. HITL Approve:** Aprobar la tarea y confirmar que el agente reanuda la ejecución.
- [ ] **4.4. HITL Reject:** Rechazar la tarea y confirmar que el flujo se aborta y el estado se reporta como `failed/rejected`.

## 5. Headless Rendering Engine & Snapshots Reales (Bloque 6)
- [ ] **5.1. Disparo Asíncrono:** Solicitar la generación de un Snapshot visual y verificar que el worker/servicio Headless lo procesa en background.
- [ ] **5.2. Supabase Storage:** Verificar en el panel de GCP/Supabase que el archivo `.png/.jpg` se subió correctamente al bucket con las políticas de acceso correctas.
- [ ] **5.3. Sincronización TanStack:** Confirmar que el UI (caché de TanStack Query) se actualiza y muestra la imagen renderizada automáticamente tras la subida, sin intervención manual.

---
*Nota Teseo: Una vez superado este checklist en entorno físico, delegar este artefacto al Tester para su transcripción a Playwright.*