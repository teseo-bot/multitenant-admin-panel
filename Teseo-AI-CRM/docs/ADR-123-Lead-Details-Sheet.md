# ADR-123 — Panel de Detalles del Lead (Lead Details Sheet)

**Fecha:** 21 Abril 2026
**Autor:** Teseo (Gerente AIDevops)
**Contexto:** Sprint 1.9 - UI de Edición Individual de Leads
**Estado:** Aplicado y Verificado

## Problema
El sistema contaba con el `KanbanBoard` y el `InboxDual` operativos, pero carecía de una interfaz para visualizar o editar la información dura (metadatos) de un Lead de manera individual. No existía el endpoint API para extraer datos de un solo registro ni un formulario con inyección Reactiva que permitiera editar el Lead en la sesión activa.

## Decisión Técnica
1. **Interfaz Lateral:** Se implementó el componente `Sheet` de shadcn como barra lateral deslizable (Right Sidebar) anclada al lado derecho de la pantalla, activada mediante el ícono de `UserCog` en el Header del Inbox Dual. Esto previene la pérdida de contexto visual del Dashboard.
2. **Ciclo SSR y API:** Se introdujo el endpoint faltante `GET /api/leads/[id]` para alimentar individualmente al componente mediante el hook personalizado `use-lead-detail.ts` en TanStack Query.
3. **Mutación y Formulario:** Se construyó el componente `<LeadDetailsSheet />` que levanta la metadata al estado de hidratación de `react-hook-form` con los validadores de `updateLeadSchema`. Se implementó la lógica optimista mediante `use-update-lead.ts` inyectando un doble snapshot frente a la base del kanban y la base individual.

## Consecuencias y Verificación
- **Tester (Zero-Trust):** PASS. E2E (Playwright) confirma el correcto renderizado del Sheet, la hidratación limpia de los datos y el funcionamiento del update sin "White Screens" ni errores 500, persistiendo los datos de manera real en la Base de Datos.