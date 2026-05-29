import {
  oklchLightness,
  contrastingForeground,
  normalizeColor,
  buildDarkDefaults
} from "./theme-pure";

export const buildThemeCss = (themeConfig: any, primaryColorLegacy?: string): string => {
  const primary = themeConfig?.primaryColor || primaryColorLegacy;
  const secondary = themeConfig?.colors?.secondary;
  const accent = themeConfig?.colors?.accent;
  const background = themeConfig?.colors?.background;
  const cardBackground = themeConfig?.colors?.cardBackground;
  
  const defaults = {
    primary: 'oklch(0.556 0.2 250)',
    secondary: 'oklch(0.97 0 0)',
    accent: 'oklch(0.97 0 0)'
  };

  const primaryVal = primary ? normalizeColor(primary) : defaults.primary;
  const secondaryVal = secondary ? normalizeColor(secondary) : defaults.secondary;
  const accentVal = accent ? normalizeColor(accent) : defaults.accent;

  const primaryForeground = contrastingForeground(primaryVal);
  const accentForeground = contrastingForeground(accentVal);

  const darkDefaults = buildDarkDefaults(primaryVal);
  const darkSecondaryVal = secondary ? normalizeColor(secondary) : darkDefaults.secondary;
  const darkAccentVal = accent ? normalizeColor(accent) : darkDefaults.accent;
  const darkAccentForeground = accent
    ? contrastingForeground(darkAccentVal)
    : darkDefaults.accentForeground;
  const darkPrimaryForeground = 'oklch(0.985 0 0)';

  let css = `
    :root {
      --primary: ${primaryVal};
      --primary-foreground: ${primaryForeground};
      --secondary: ${secondaryVal};
      --accent: ${accentVal};
      --accent-foreground: ${accentForeground};
    }
    .dark {
      --primary: ${primaryVal};
      --primary-foreground: ${darkPrimaryForeground};
      --secondary: ${darkSecondaryVal};
      --secondary-foreground: ${darkDefaults.secondaryForeground};
      --accent: ${darkAccentVal};
      --accent-foreground: ${darkAccentForeground};
      --foreground: ${darkDefaults.foreground};
      --card-foreground: ${darkDefaults.cardForeground};
      --popover-foreground: ${darkDefaults.popoverForeground};
      --muted: ${darkDefaults.muted};
      --muted-foreground: ${darkDefaults.mutedForeground};
      --border: ${darkDefaults.border};
      --input: ${darkDefaults.input};
      --background: ${darkDefaults.background};
      --card: ${darkDefaults.card};
      --popover: ${darkDefaults.popover};
    }
  `;

  if (background || cardBackground || themeConfig?.appearance) {
    const bgVal = background ? normalizeColor(background) : null;
    const cardVal = cardBackground ? normalizeColor(cardBackground) : null;

    css += `:root {`;
    if (bgVal) {
      const bgForeground = contrastingForeground(bgVal);
      css += `
        --background: ${bgVal};
        --foreground: ${bgForeground};
      `;
    }
    if (cardVal) {
      const cardForeground = contrastingForeground(cardVal);
      css += `
        --card: ${cardVal};
        --card-foreground: ${cardForeground};
        --popover: ${cardVal};
        --popover-foreground: ${cardForeground};
      `;
    }

    if (themeConfig?.appearance?.radius !== undefined) {
      const rad = themeConfig.appearance.radius;
      css += `--radius: ${typeof rad === 'number' ? `${rad}rem` : rad};\n`;
    }
    
    let resolvedFontValue: string | null = null;
    if (themeConfig?.appearance?.fontFamily) {
      const font = themeConfig.appearance.fontFamily;
      resolvedFontValue = '"DM Sans", "Inter", system-ui, sans-serif';
      if (font === 'inter') resolvedFontValue = '"Inter", "DM Sans", sans-serif';
      else if (font === 'roboto') resolvedFontValue = '"Roboto", "DM Sans", sans-serif';
      else if (font === 'DM Sans') resolvedFontValue = '"DM Sans", sans-serif';
      else if (font !== 'system') resolvedFontValue = `"${font}", sans-serif`;
      css += `--font-sans: ${resolvedFontValue};\n`;
    }
    css += `}`;

    css += `.dark {`;
    if (bgVal) {
      const bgLum = oklchLightness(bgVal);
      if (bgLum < 0.35) {
        css += `--background: ${bgVal};`;
      } else {
        css += `--background: ${darkDefaults.background};`;
      }
    } else {
      css += `--background: ${darkDefaults.background};`;
    }
    if (cardVal) {
      const cardLum = oklchLightness(cardVal);
      if (cardLum < 0.35) {
        css += `--card: ${cardVal}; --popover: ${cardVal};`;
      } else {
        css += `--card: ${darkDefaults.card}; --popover: ${darkDefaults.popover};`;
      }
    } else {
      css += `--card: ${darkDefaults.card}; --popover: ${darkDefaults.popover};`;
    }
    if (resolvedFontValue) {
      css += `--font-sans: ${resolvedFontValue};`;
    }
    css += `}`;
  }

  return css;
};
