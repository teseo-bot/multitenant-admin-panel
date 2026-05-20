# Plan Técnico: Inyección de Branding Teseo en Mission Control

## 1. Actualización de Paleta de Colores (globals.css)
El proyecto utiliza Tailwind CSS v4 con variables nativas en CSS (espacio de color `oklch`). Se deben sustituir las variables de color primario y de acento en el archivo `src/app/globals.css`.

- **Color Primario (Rojo Teseo):** `#E10600`
- **Color Acento (Naranja Teseo):** `#FF9A00`

**Acciones a realizar:**
- Convertir los colores Hex a formato `oklch` para mantener el estándar y compatibilidad del tema (o en su defecto usar el Hex directamente si no hay manipulaciones de opacidad `oklch(from ...)`).
  - *Valores recomendados:* 
    - Primario (`#E10600`): `oklch(0.536 0.238 28.3)` (o simplemente `#e10600`)
    - Acento (`#FF9A00`): `oklch(0.745 0.185 64.3)` (o simplemente `#ff9a00`)
- En el bloque `:root` (Light Mode), reemplazar:
  - `--primary` y `--sidebar-primary` por el Rojo Teseo.
  - `--accent` y `--sidebar-accent` por el Naranja Teseo.
- En el bloque `.dark` (Dark Mode), actualizar:
  - `--primary` y `--sidebar-primary` por el Rojo Teseo.
  - `--accent` y `--sidebar-accent` por el Naranja Teseo.
- **Nota de Accesibilidad:** Se debe garantizar el contraste de los textos sobre estos fondos, ajustando `--primary-foreground` y `--accent-foreground` a un color claro (por ejemplo, blanco `oklch(1 0 0)`) en ambos esquemas.

## 2. Integración de la Fuente "Inter" (layout.tsx y globals.css)
Actualmente el proyecto utiliza la fuente `Geist` mapeada a la variable `--font-geist-sans`. Se requiere cambiar la tipografía del sistema a `Inter`.

**Acciones a realizar en `src/app/layout.tsx`:**
- Remover la importación e inicialización de `Geist`.
- Importar `Inter` desde `next/font/google`:
  ```tsx
  import { Inter, Geist_Mono } from "next/font/google";
  
  const inter = Inter({
    variable: "--font-sans",
    subsets: ["latin"],
  });
  ```
- Reemplazar las variables de clase en la etiqueta `<html>`:
  ```tsx
  <html lang="en" className={`${inter.variable} ${geistMono.variable} antialiased`}>
  ```

**Acciones a realizar en `src/app/globals.css`:**
- Confirmar que en `@theme inline` el mapeo de fuente apunte correctamente a la variable definida en el layout:
  ```css
  --font-sans: var(--font-sans);
  ```

## 3. Ajuste del Border Radius (globals.css)
Se solicitó implementar un estilo con curvas moderadas.

**Acciones a realizar en `src/app/globals.css`:**
- Buscar la definición base de `--radius` dentro del bloque `:root`.
- Cambiar el valor actual (`0.625rem`) a la medida especificada por el CEO:
  ```css
  --radius: 0.5rem;
  ```

## 4. Work Breakdown Structure (WBS)
1. **Tarea 1: Inyección de Tipografía**
   - Modificar `layout.tsx` para cambiar de `Geist` a `Inter`.
   - Ajustar el nombre de la variable CSS a `--font-sans`.
2. **Tarea 2: Ajuste de Esquinas (Border Radius)**
   - Modificar `globals.css` y ajustar el `--radius` general a `0.5rem`.
3. **Tarea 3: Implementación de Colores (Light/Dark Mode)**
   - Reasignar las variables `--primary`, `--accent` y sus respectivos equivalentes de `--sidebar` en `globals.css`.
   - Modificar los valores `*-foreground` relacionados para asegurar alto contraste (texto legible).
4. **Tarea 4: Revisión Funcional**
   - Levantar entorno de desarrollo.
   - Verificar la correcta propagación de la nueva fuente, curvatura de botones/tarjetas, y que los componentes de shadcn utilicen el Rojo y Naranja Teseo.