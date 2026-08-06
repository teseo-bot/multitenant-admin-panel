"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/**
 * Logotipo de micontexto.
 *
 * Usa el archivo oficial de `public/micontexto.svg` si existe. Si no está,
 * compone la marca con sus tres piezas — cuadro naranja con «mi» en blanco,
 * la palabra «contexto», y el punto naranja — usando la tipografía de la
 * aplicación.
 *
 * ⚠️ MIENTRAS NO ESTÉ EL ARCHIVO, la tipografía es una aproximación: el
 * logotipo original usa una grotesca geométrica pesada que no tenemos. La
 * estructura, los tamaños, el color y el comportamiento en claro/oscuro sí son
 * los definitivos. **Basta con dejar el SVG en `public/micontexto.svg` para que
 * lo tome; no hay que tocar ningún sitio de uso.**
 *
 * **Modo oscuro.** Lo ideal es un solo archivo con el relleno de «contexto» en
 * `currentColor`: sirve para los dos modos. Si el SVG trae el negro fijo, se
 * deja además `micontexto-oscuro.svg` (el mismo logotipo con el texto claro) y
 * el componente lo usa cuando el tema es oscuro.
 *
 * Dos decisiones deliberadas:
 *
 * 1. **El naranja del logotipo es fijo, no `--primary`.** Control y el portal de
 *    aliados son aplicaciones de micontexto, no paneles con marca blanca: su
 *    logotipo no debe moverse cuando un tenant cambia su color. (En el panel del
 *    tenant sí manda el logo del cliente.)
 *
 * 2. **«contexto» hereda el color del texto**, por lo mismo.
 *
 * El blanco sobre el naranja de marca no llega a contraste AA, y está bien:
 * WCAG 1.4.3 excluye explícitamente los logotipos. Una marca no se «arregla».
 */

// #FF9A00 — el naranja de la marca (docs/plan-teseo-branding.md).
export const NARANJA_MARCA = "#FF9A00";

const ARCHIVO_LOGOTIPO = "/micontexto.svg";
const ARCHIVO_LOGOTIPO_OSCURO = "/micontexto-oscuro.svg";
const ARCHIVO_MARCA = "/micontexto-marca.svg";

/**
 * ¿Está el archivo oficial en `public/`?
 *
 * Se comprueba cargándolo, no con `onError` sobre un <img> renderizado: el
 * error ocurre antes de la hidratación, React nunca lo recibe y lo que queda en
 * pantalla es el icono de imagen rota. Así el respaldo se pinta siempre primero
 * y el archivo lo sustituye sólo cuando de verdad carga.
 */
function useArchivoDeMarca(ruta: string) {
  const [existe, setExiste] = useState(false);
  useEffect(() => {
    let vivo = true;
    const img = new Image();
    img.onload = () => vivo && setExiste(true);
    img.src = ruta;
    return () => {
      vivo = false;
    };
  }, [ruta]);
  return existe;
}

/**
 * El cuadro con «mi»: la parte de la marca que funciona sola, sin la palabra.
 * Es lo que va en el sidebar colapsado y en cualquier sitio estrecho.
 *
 * Esquinas rectas, sin radio: el original es un cuadro, y redondearlo lo
 * convierte en un icono de app cualquiera.
 */
export function Marca({ size = 24, className }: { size?: number; className?: string }) {
  const hayArchivo = useArchivoDeMarca(ARCHIVO_MARCA);

  if (hayArchivo) {
    return (
      <img
        src={ARCHIVO_MARCA}
        alt=""
        className={cn("shrink-0 object-contain", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold leading-none tracking-tight text-white",
        className
      )}
      style={{
        backgroundColor: NARANJA_MARCA,
        width: size,
        height: size,
        fontSize: size * 0.46,
      }}
    >
      mi
    </span>
  );
}

/** El logotipo completo. `size` es la altura del cuadro; el resto escala con él. */
export function Logotipo({ size = 24, className }: { size?: number; className?: string }) {
  const { resolvedTheme } = useTheme();
  const hayOscuro = useArchivoDeMarca(ARCHIVO_LOGOTIPO_OSCURO);
  const hayArchivo = useArchivoDeMarca(ARCHIVO_LOGOTIPO);

  // La variante oscura sólo se usa si existe: con un SVG en `currentColor` no
  // hace falta y este archivo no está.
  const ruta =
    resolvedTheme === "dark" && hayOscuro ? ARCHIVO_LOGOTIPO_OSCURO : ARCHIVO_LOGOTIPO;

  if (hayArchivo || hayOscuro) {
    return (
      <img
        src={ruta}
        alt="micontexto"
        className={cn("w-auto object-contain object-left", className)}
        style={{ height: size }}
      />
    );
  }

  return (
    <span className={cn("inline-flex items-center", className)}>
      <Marca size={size} />
      <span
        className="ml-1.5 font-semibold leading-none tracking-tight"
        style={{ fontSize: size * 0.66 }}
      >
        contexto
      </span>
      <span
        aria-hidden
        className="ml-[2px] shrink-0 self-end rounded-full"
        style={{
          backgroundColor: NARANJA_MARCA,
          width: size * 0.17,
          height: size * 0.17,
          marginBottom: size * 0.1,
        }}
      />
      <span className="sr-only">micontexto</span>
    </span>
  );
}
