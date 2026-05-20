# Plan de Resolución: Deuda Técnica de Contraste UI (Modo Oscuro)

## 1. Problema Identificado
Existe una falta de contraste accesible en el modo oscuro para los elementos de UI que utilizan el token `text-muted-foreground`. Este token se percibe muy oscuro frente a los fondos oscuros del sistema (`--background` o `--card`), dificultando la lectura y potencialmente incumpliendo los estándares de accesibilidad (WCAG).

## 2. Análisis del Estado Actual
Tras inspeccionar el archivo de estilos globales, se identificó la siguiente configuración en la sección de variables de entorno:

- **Archivo**: `src/mission-control/src/app/globals.css`
- **Contexto (`.dark`)**:
  - `--background`: `oklch(0.145 0 0)` (Fondo muy oscuro).
  - `--muted-foreground`: `oklch(0.708 0 0)` (Gris medio).

En lugar de HSL, el proyecto está utilizando el espacio de color `oklch`. El valor actual de luminosidad (L) para el texto secundario (0.708) no brinda un ratio de contraste ideal contra el fondo (0.145).

## 3. Solución Técnica Propuesta
Para corregir el contraste sin alterar la paleta cromática general:
1. **Ajuste de Variable**: Modificar la variable `--muted-foreground` dentro de la directiva `.dark` en `globals.css`.
2. **Nuevo Valor**: Incrementar el parámetro de Luminosidad (L) en la función `oklch`. Se sugiere cambiar `0.708` por un valor más claro, como `0.850` u `0.870` (ejemplo: `oklch(0.850 0 0)`). Esto aclarará el texto atenuado haciéndolo más legible en modo oscuro.

## 4. Pasos para el Ejecutor
1. Abrir el archivo `src/mission-control/src/app/globals.css`.
2. Localizar la clase `.dark`.
3. Reemplazar `--muted-foreground: oklch(0.708 0 0);` por `--muted-foreground: oklch(0.850 0 0);`.
4. El Tester debe validar los componentes que dependan de `text-muted-foreground` asegurando un contraste mínimo de 4.5:1.