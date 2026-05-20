# ADR 134: Estandarización de Ref Passthrough en Tenant OS
**Fecha:** 22 Abril 2026
**Estado:** Aceptado / Cerrado

## Contexto
Durante el ciclo de pruebas (UAT) de interacción en el panel de usuarios (`/admin/users`), el componente `DropdownMenu` (basado en Base UI y Radix) generó fallos en cascada y warnings severos en la consola. El origen del fallo fue rastreado hacia el `<Button>` que actuaba como trigger, el cual carecía de propagación del `ref` hacia el DOM nativo, impidiendo a las librerías subyacentes anclar listeners o calcular posiciones.

## Decisión Técnica
Se estableció una directiva estricta de UI que obliga a todo componente de interfaz atómico (ej. `Button`, `Badge`, `Card`, etc.) derivado de la arquitectura Shadcn/Radix en el Tenant OS (`crm-agentico-panel`) a exponer su retorno mediante `React.forwardRef`. El tipado se define rigurosamente usando `React.ComponentPropsWithoutRef` para mantener el aislamiento y la seguridad DOM.

## Consecuencias
- **Positivas:** Interoperabilidad garantizada con Radix y `@base-ui/react`. Erradicación de roturas en el DOM al usar menús contextuales, tooltips y popovers. Consola 100% libre de advertencias de React.
- **Negativas:** Ninguna con impacto en runtime. Únicamente incremento marginal de verbosidad en la definición de props de los componentes base.

## Ejecución
El bug fue procesado a través de un *Zero-Trust Loop* gestionado por Teseo, resuelto por el Ejecutor, validado por el Tester y auditado por el Reviewer con PASS definitivo. Esta directiva fue documentada de forma permanente en la Sección 9 del `PRD-000-CRM-AGENTICO.md`.
