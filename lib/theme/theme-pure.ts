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

export const contrastingForeground = (color: string): string => {
  return oklchLightness(color) < 0.6 ? 'oklch(0.985 0 0)' : 'oklch(0.145 0 0)';
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

export const buildDarkDefaults = (primaryOklch: string) => {
  const { c, h } = extractChromaHue(primaryOklch);
  const tintC = c > 0.05 ? 0.01 : 0;
  
  return {
    background:          `oklch(0.145 ${tintC} ${h})`,
    foreground:          `oklch(0.985 0 0)`,
    card:                `oklch(0.205 ${tintC} ${h})`,
    cardForeground:      `oklch(0.985 0 0)`,
    popover:             `oklch(0.205 ${tintC} ${h})`,
    popoverForeground:   `oklch(0.985 0 0)`,
    accent:              `oklch(0.269 ${tintC * 2} ${h})`,
    accentForeground:    `oklch(0.985 0 0)`,
    secondary:           `oklch(0.269 ${tintC * 1.5} ${h})`,
    secondaryForeground: `oklch(0.985 0 0)`,
    muted:               `oklch(0.269 ${tintC} ${h})`,
    mutedForeground:     `oklch(0.708 0 0)`,
    border:              `oklch(0.269 ${tintC} ${h})`,
    input:               `oklch(0.269 ${tintC} ${h})`,
  };
};
