# Marca: dónde va cada archivo

Estos son los nombres que la aplicación busca. Si alguno falta,
`components/brand/logotipo.tsx` compone un respaldo con la tipografía de la
aplicación en vez de romperse.

| Archivo | Dónde | Para qué |
|---|---|---|
| `public/micontexto.svg` | aquí | Logotipo completo: sidebar y pantalla de acceso |
| `public/micontexto_obscuro.svg` | aquí | El mismo, con el texto en blanco. Se usa en modo oscuro |
| `public/micontexto_marca.svg` | aquí | Sólo el cuadro naranja con «mi». Sidebar colapsado |
| `app/icon.svg` | en `app/`, no en `public/` | Favicon. Es una copia de `micontexto_marca.svg` |
| `app/apple-icon.png` | en `app/`, no en `public/` | Icono de iOS al guardar en pantalla de inicio |

Los dos últimos van en `app/`: Next.js los reconoce ahí por el nombre y genera
las etiquetas `<link>` solo. En `public/` no hacen nada.

## Por qué el favicon es sólo el cuadro

A 16×16 el logotipo completo es una mancha ilegible. El cuadro naranja con «mi»
se distingue en la pestaña.

Se quitó el `app/favicon.ico` que traía el proyecto — era el genérico de Next y
competía con `icon.svg`. Si hace falta un `.ico` para navegadores viejos, se
puede volver a añadir, pero exportado de la marca, no el de plantilla.

## Modo oscuro

Hoy funciona con dos archivos: el claro lleva el texto en `#000000` y el oscuro
en `#ffffff`. El componente elige según el tema.

Alternativa a futuro, si se quiere un solo archivo: cambiar el relleno del texto
a `currentColor` dentro de `micontexto.svg` y borrar el `_obscuro`. El cuadro
naranja y el punto se quedan con su `#ff9900` fijo — son la marca y no deben
cambiar con el tema.
