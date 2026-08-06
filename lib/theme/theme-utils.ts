import {
  oklchLightness,
  contrastingForeground,
  normalizeColor,
  brightenForDark
} from "./theme-pure";

/**
 * Construye el CSS de branding por tenant que <TenantThemeStyle /> inyecta en
 * runtime.
 *
 * REGLA: emite SÓLO lo que el tenant configuró de verdad. Si no configuró nada,
 * devuelve cadena vacía y manda el sistema de diseño de globals.css.
 *
 * Antes esta función tenía valores por defecto propios (un `--primary` azul
 * hardcodeado y catorce tokens de modo oscuro derivados). Como el <style> se
 * inyecta siempre y gana por especificidad/orden, el resultado era que la
 * paleta de globals.css no llegaba nunca a pintarse: el panel salía azul
 * aunque el archivo dijera otra cosa. El valor por defecto del producto vive
 * en el CSS, no aquí.
 */
export const buildThemeCss = (themeConfig: any, primaryColorLegacy?: string | null): string => {
  const primary = themeConfig?.primaryColor || primaryColorLegacy;
  const secondary = themeConfig?.colors?.secondary;
  const accent = themeConfig?.colors?.accent;
  const background = themeConfig?.colors?.background;
  const cardBackground = themeConfig?.colors?.cardBackground;
  const radius = themeConfig?.appearance?.radius;
  const fontFamily = themeConfig?.appearance?.fontFamily;

  const claro: string[] = [];
  const oscuro: string[] = [];

  if (primary) {
    const val = normalizeColor(primary);
    claro.push(`--primary: ${val}`);
    claro.push(`--primary-foreground: ${contrastingForeground(val)}`);
    // El anillo de foco es la marca: si no lo movemos con el primario, el
    // teclado navega con un color que ya no existe en la paleta.
    claro.push(`--ring: ${val}`);
    claro.push(`--sidebar-primary: ${val}`);
    claro.push(`--sidebar-ring: ${val}`);
    claro.push(`--chart-1: ${val}`);

    // En oscuro el mismo tono se ve apagado: se sube la luminosidad para que
    // conserve presencia sobre un fondo oscuro, sin cambiar el tono ni el croma.
    const valOscuro = brightenForDark(val);
    oscuro.push(`--primary: ${valOscuro}`);
    oscuro.push(`--primary-foreground: ${contrastingForeground(valOscuro)}`);
    oscuro.push(`--ring: ${valOscuro}`);
    oscuro.push(`--sidebar-primary: ${valOscuro}`);
    oscuro.push(`--sidebar-ring: ${valOscuro}`);
    oscuro.push(`--chart-1: ${valOscuro}`);
  }

  if (secondary) {
    const val = normalizeColor(secondary);
    claro.push(`--secondary: ${val}`);
    claro.push(`--secondary-foreground: ${contrastingForeground(val)}`);
    oscuro.push(`--secondary: ${val}`);
    oscuro.push(`--secondary-foreground: ${contrastingForeground(val)}`);
  }

  if (accent) {
    const val = normalizeColor(accent);
    claro.push(`--accent: ${val}`);
    claro.push(`--accent-foreground: ${contrastingForeground(val)}`);
    oscuro.push(`--accent: ${val}`);
    oscuro.push(`--accent-foreground: ${contrastingForeground(val)}`);
  }

  if (background) {
    const val = normalizeColor(background);
    claro.push(`--background: ${val}`);
    claro.push(`--foreground: ${contrastingForeground(val)}`);
    // Un fondo claro en modo oscuro deja el texto ilegible: sólo se respeta si
    // de verdad es oscuro; si no, se cae a la superficie oscura del sistema.
    if (oklchLightness(val) < 0.35) {
      oscuro.push(`--background: ${val}`);
      oscuro.push(`--foreground: ${contrastingForeground(val)}`);
    }
  }

  if (cardBackground) {
    const val = normalizeColor(cardBackground);
    const fg = contrastingForeground(val);
    claro.push(`--card: ${val}`, `--card-foreground: ${fg}`);
    claro.push(`--popover: ${val}`, `--popover-foreground: ${fg}`);
    if (oklchLightness(val) < 0.35) {
      oscuro.push(`--card: ${val}`, `--card-foreground: ${fg}`);
      oscuro.push(`--popover: ${val}`, `--popover-foreground: ${fg}`);
    }
  }

  if (radius !== undefined && radius !== null) {
    claro.push(`--radius: ${typeof radius === "number" ? `${radius}rem` : radius}`);
  }

  if (fontFamily) {
    const resuelta = resolveFont(fontFamily);
    if (resuelta) claro.push(`--font-sans: ${resuelta}`);
  }

  let css = "";
  if (claro.length) css += `:root{${claro.join(";")};}`;
  if (oscuro.length) css += `.dark{${oscuro.join(";")};}`;
  return css;
};

const resolveFont = (font: string): string | null => {
  if (!font || font === "system") return null;
  if (font === "inter") return '"Inter", var(--font-sans), sans-serif';
  if (font === "roboto") return '"Roboto", var(--font-sans), sans-serif';
  return `"${font}", var(--font-sans), sans-serif`;
};
