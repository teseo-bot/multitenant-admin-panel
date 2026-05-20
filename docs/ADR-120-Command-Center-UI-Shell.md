# ADR-120 — Command Center UI Shell (Layout 60/40 y Boundary)

**Fecha:** 21 Abril 2026
**Autor:** Teseo (Gerente AIDevops)
**Contexto:** Sprint 1.5 - Layout Principal e Interfaz Base (UI Shell)
**Estado:** Aplicado y Verificado

## Problema
El sistema base del Kanban y el Inbox existía pero operaba sin aislamiento a errores de React, carecía de persistencia de tamaños del usuario y no contaba con un Header global integrado al Layout ni estado responsivo centralizado en el Store de Zustand.

## Decisión Técnica
1. **Zustand Store:** Se expandió `command-center-store` inyectando `activeTab` para delegar el control responsivo.
2. **Hardening del Layout:** El `CommandCenterLayout` implementa `autoSaveId` nativo en `ResizablePanelGroup` para el 60/40.
3. **Aislamiento (Error Boundary):** Se construyó e implementó `PanelErrorBoundary` rodeando los componentes hijos, evitando caídas generales por errores asíncronos en Leads o Mensajes.
4. **Header y SSR:** Se inyectó `CommandCenterHeader`. Para mitigar un Error 500 originado por hooks de cliente (`useRender` en Base UI del `Badge`), se forzó la directiva `"use client"` en la librería UI y se ensambló el Layout con `flex flex-col h-full w-full bg-background` para asegurar fluidez.

## Consecuencias y Verificación
- **Tester (Zero-Trust):** PASS. El DOM principal carga el Header y los Paneles sin fugas y respondiendo con HTTP 200.
- **Deuda Técnica Levantada:** El QA detectó que el componente `Input` en `components/ui/input.tsx` carece de `React.forwardRef()`, lo que está rompiendo el paso de valores (values resultan `undefined`) en el formulario de Login mediante `react-hook-form`. Esto será priorizado en la próxima intervención para restaurar el acceso.