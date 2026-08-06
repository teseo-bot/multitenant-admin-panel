export const oklchLightness = (color: string): number => {
  const parts = color.match(/([\d.]+)/g);
  if (!parts || parts.length < 1) return 0.5;
  let l = parseFloat(parts[0]);
  if (l > 1) l /= 100;
  return l;
};

export const extractChromaHue = (color: string): { c: number, h: number } => {
  const parts = color.match(/([\d.]+)/g);
  if (!parts || parts.length < 3) return { c: 0, h: 0 };
  return {
    c: parseFloat(parts[1]),
    h: parseFloat(parts[2])
  };
};

/** oklch → sRGB (0–1, ya con gamma). Es el inverso de `hexToOklch`. */
export const oklchToSrgb = (color: string): [number, number, number] => {
  const L = oklchLightness(color);
  const { c, h } = extractChromaHue(color);
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;

  const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  const gamma = (v: number) => {
    const x = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
    return Math.min(1, Math.max(0, x));
  };
  return [gamma(lr), gamma(lg), gamma(lb)];
};

/** Luminancia relativa WCAG de un color oklch. */
export const relativeLuminance = (color: string): number => {
  const [r, g, b] = oklchToSrgb(color).map((v) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Razón de contraste WCAG entre dos colores oklch. */
export const contrastRatio = (a: string, b: string): number => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

export const FOREGROUND_CLARO = 'oklch(0.985 0 0)';
export const FOREGROUND_OSCURO = 'oklch(0.145 0 0)';

/**
 * Elige el texto que se lee mejor sobre un fondo.
 *
 * Antes decidía por un umbral de luminosidad (`L < 0.6 → texto claro`). Eso deja
 * una zona muerta alrededor de L≈0.55–0.60 donde el umbral escoge el peor de los
 * dos: medido sobre una malla de tonos, cuatro combinaciones bajaban de 4.5:1 y
 * la peor caía a 3.93:1. Y el croma mueve la frontera, así que ningún umbral fijo
 * acierta para todos los tonos.
 *
 * Ahora se calcula el contraste real contra los dos candidatos y gana el mayor.
 * No garantiza AA — hay colores de marca sobre los que ningún texto llega a
 * 4.5:1 — pero nunca elige el peor de los dos.
 */
export const contrastingForeground = (color: string): string => {
  return contrastRatio(FOREGROUND_CLARO, color) >= contrastRatio(FOREGROUND_OSCURO, color)
    ? FOREGROUND_CLARO
    : FOREGROUND_OSCURO;
};

export const hexToOklch = (hex: string): string => {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex[1] + hex[2], 16);
    g = parseInt(hex[3] + hex[4], 16);
    b = parseInt(hex[5] + hex[6], 16);
  } else {
    return hex;
  }
  
  r /= 255;
  g /= 255;
  b /= 255;
  
  const lin = (c: number) => c >= 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
  const lr = lin(r), lg = lin(g), lb = lin(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  const C = Math.sqrt(a * a + b_ * b_);
  let H = Math.atan2(b_, a) * 180 / Math.PI;
  if (H < 0) H += 360;
  
  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`;
};

export const normalizeColor = (color: string): string => {
  if (color.startsWith('#')) {
    return hexToOklch(color);
  }
  if (!color.startsWith('oklch(')) {
    return `oklch(${color})`;
  }
  return color;
};

/**
 * Sube la luminosidad de un color de marca para que respire sobre fondo oscuro,
 * conservando tono y croma. Un primario pensado para fondo claro se apaga en
 * modo oscuro; esto lo compensa sin cambiar la marca.
 */
export const brightenForDark = (oklchColor: string): string => {
  const l = oklchLightness(oklchColor);
  if (l >= 0.68) return oklchColor;
  const { c, h } = extractChromaHue(oklchColor);
  const nueva = Math.min(0.78, l + 0.1);
  return `oklch(${nueva.toFixed(3)} ${c} ${h})`;
};
