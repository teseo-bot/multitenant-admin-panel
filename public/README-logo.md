# Marca: dónde va cada archivo

Deja los archivos con estos nombres exactos y la aplicación los toma sola —
no hay que tocar código. Si alguno falta, `components/brand/logotipo.tsx`
compone un respaldo con la tipografía de la aplicación.

| Archivo | Dónde va | Para qué |
|---|---|---|
| `public/micontexto.svg` | aquí | Logotipo completo: cabecera del sidebar y pantalla de acceso |
| `public/micontexto-oscuro.svg` | aquí | Sólo si el SVG de arriba lleva el texto en negro fijo (ver abajo) |
| `public/micontexto-marca.svg` | aquí | Sólo el cuadro naranja con «mi». Sidebar colapsado |
| `app/icon.svg` | un nivel arriba, en `app/` | Favicon. Next lo cablea solo por el nombre |
| `app/apple-icon.png` | un nivel arriba, en `app/` | Icono al guardar en pantalla de inicio (180×180) |

## Modo oscuro: mejor un solo archivo

Dentro de `micontexto.svg`, el relleno de la palabra «contexto» debe ser
`currentColor` en vez de `#000000`. Así el mismo archivo sirve para claro y
oscuro y no hace falta `micontexto-oscuro.svg`.

```svg
<!-- en vez de esto -->
<path d="..." fill="#000000"/>
<!-- esto -->
<path d="..." fill="currentColor"/>
```

El cuadro naranja y el punto se quedan con su `#FF9A00` fijo: son la marca y no
deben cambiar con el tema.

Si prefieres no editar el SVG, deja también `micontexto-oscuro.svg` con el texto
en blanco y el componente elige según el tema.

## Favicon

`app/icon.svg` conviene que sea **sólo el cuadro con «mi»**: a 16×16 el
logotipo completo es una mancha ilegible.

Next.js App Router reconoce estos nombres por convención — basta el archivo, sin
`<link>` ni metadata. Si dejas `app/icon.svg`, borra el `app/favicon.ico` que
está hoy para que no compitan.
