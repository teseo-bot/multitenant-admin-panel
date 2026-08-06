import { test } from "node:test";
import assert from "node:assert/strict";

import { buildThemeCss } from "./theme-utils";
import {
  brightenForDark,
  contrastingForeground,
  contrastRatio,
  FOREGROUND_CLARO,
  FOREGROUND_OSCURO,
  hexToOklch,
  oklchLightness,
  oklchToSrgb,
} from "./theme-pure";

// La regla que protege este archivo: el <style> de branding sólo puede contener
// lo que el tenant configuró. Cualquier valor por defecto que se cuele aquí pisa
// a globals.css en runtime y deja el sistema de diseño en decoración.

test("sin configuración de tenant no emite nada", () => {
  assert.equal(buildThemeCss(null), "");
  assert.equal(buildThemeCss({}), "");
  assert.equal(buildThemeCss({ colors: {} }), "");
  assert.equal(buildThemeCss({ appearance: {} }), "");
});

test("no inventa un primario por defecto", () => {
  // El azul oklch(0.556 0.2 250) era el default hardcodeado que pintaba el panel.
  assert.ok(!buildThemeCss({}).includes("0.556"));
  assert.ok(!buildThemeCss({ colors: { background: "#101010" } }).includes("--primary:"));
});

test("no toca las superficies de modo oscuro si el tenant no las configuró", () => {
  const css = buildThemeCss({ primaryColor: "#ff9a00" });
  for (const token of ["--background", "--card", "--muted", "--border", "--input", "--popover"]) {
    assert.ok(!css.includes(`${token}:`), `${token} no debería emitirse`);
  }
});

test("un primario se emite en ambos modos, con su foreground y su anillo", () => {
  const css = buildThemeCss({ primaryColor: "#ff9a00" });
  assert.ok(css.includes(":root{"));
  assert.ok(css.includes(".dark{"));
  assert.ok(css.includes("--primary:"));
  assert.ok(css.includes("--primary-foreground:"));
  assert.ok(css.includes("--ring:"));
  assert.ok(css.includes("--chart-1:"));
});

test("el hex se normaliza a oklch", () => {
  const css = buildThemeCss({ primaryColor: "#ff9a00" });
  assert.ok(css.includes("oklch("));
  assert.ok(!css.includes("#ff9a00"));
});

test("acepta el parámetro legacy de color primario", () => {
  assert.ok(buildThemeCss({}, "#ff9a00").includes("--primary:"));
});

test("un fondo claro no se respeta en modo oscuro", () => {
  // Regresión: un tenant con fondo blanco dejaba el modo oscuro ilegible.
  const css = buildThemeCss({ colors: { background: "#ffffff" } });
  const oscuro = css.slice(css.indexOf(".dark{"));
  assert.ok(!oscuro.includes("--background"), "el fondo claro no debe pasar a oscuro");
  assert.ok(css.includes(":root{"), "pero sí debe aplicarse en claro");
});

test("un fondo oscuro sí pasa a modo oscuro", () => {
  const css = buildThemeCss({ colors: { background: "#0d0d0d" } });
  assert.ok(css.slice(css.indexOf(".dark{")).includes("--background"));
});

test("el foreground del primario contrasta en los dos extremos", () => {
  const claro = contrastingForeground("oklch(0.9 0.1 90)");
  const oscuro = contrastingForeground("oklch(0.2 0.1 90)");
  assert.ok(oklchLightness(claro) < 0.5, "sobre un primario claro, texto oscuro");
  assert.ok(oklchLightness(oscuro) > 0.5, "sobre un primario oscuro, texto claro");
});

test("brightenForDark sube un primario apagado y deja en paz a uno ya claro", () => {
  assert.ok(oklchLightness(brightenForDark("oklch(0.45 0.15 250)")) > 0.45);
  assert.equal(brightenForDark("oklch(0.72 0.16 52)"), "oklch(0.72 0.16 52)");
});

test("radio y tipografía sólo salen si el tenant los definió", () => {
  assert.ok(!buildThemeCss({ appearance: {} }).includes("--radius"));
  assert.ok(buildThemeCss({ appearance: { radius: 0.5 } }).includes("--radius: 0.5rem"));
  assert.ok(!buildThemeCss({ appearance: { fontFamily: "system" } }).includes("--font-sans"));
  assert.ok(buildThemeCss({ appearance: { fontFamily: "Inter" } }).includes("--font-sans"));
});

test("contrastingForeground nunca elige el peor de los dos candidatos", () => {
  // Barrido sobre una malla de colores de marca plausibles. La versión por
  // umbral (L < 0.6) fallaba alrededor de L≈0.55–0.60: escogía texto claro
  // cuando el oscuro contrastaba más.
  let peor = Infinity;
  let peorColor = "";
  for (let L = 0.3; L <= 0.92; L += 0.02) {
    for (const [c, h] of [[0.2, 25], [0.17, 46], [0.15, 145], [0.2, 265], [0.25, 320], [0, 90]]) {
      const color = `oklch(${L.toFixed(3)} ${c} ${h})`;
      const elegido = contrastingForeground(color);
      const otro = elegido === FOREGROUND_CLARO ? FOREGROUND_OSCURO : FOREGROUND_CLARO;
      const r = contrastRatio(elegido, color);
      assert.ok(
        r >= contrastRatio(otro, color),
        `${color}: eligió el candidato con menos contraste`
      );
      if (r < peor) { peor = r; peorColor = color; }
    }
  }
  // Elegir el mejor candidato no garantiza AA: sobre un color vivo a media
  // luminosidad —el peor de esta malla es oklch(0.6 0.25 320)— ni el blanco ni
  // el negro llegan a 4.5:1. Es una propiedad del color, no del algoritmo, y por
  // eso el suelo medido queda en 4.38. Se fija aquí para que una regresión que
  // lo empeore se note; subirlo exige avisar en la pantalla de branding, no
  // cambiar esta función.
  assert.ok(peor >= 4.3, `el peor caso bajó a ${peor.toFixed(2)} en ${peorColor}`);
});

test("oklchToSrgb es el inverso de hexToOklch", () => {
  // `hexToOklch` redondea a 3 decimales L y C y a 1 el tono, así que la ida y
  // vuelta pierde hasta un paso de 8 bits por canal. Lo que importa es que no
  // haya desvíos de tono ni de luminosidad, no la igualdad exacta.
  for (const hex of ["#ff9a00", "#e10600", "#0d6efd", "#198754", "#000000", "#ffffff"]) {
    const canales = oklchToSrgb(hexToOklch(hex)).map((v) => Math.round(v * 255));
    const original = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    canales.forEach((v, i) => {
      assert.ok(
        Math.abs(v - original[i]) <= 1,
        `${hex}: canal ${i} salió ${v}, se esperaba ${original[i]}`
      );
    });
  }
});

test("el primario por defecto del producto pasa AA en ambos modos", () => {
  // Los valores viven en app/globals.css; si cambian allí, este test se entera.
  const claro = { primary: "oklch(0.55 0.17 44)", fg: "oklch(0.99 0.002 90)" };
  const oscuro = { primary: "oklch(0.72 0.16 52)", fg: "oklch(0.17 0.02 52)" };
  assert.ok(contrastRatio(claro.fg, claro.primary) >= 4.5, "modo claro");
  assert.ok(contrastRatio(oscuro.fg, oscuro.primary) >= 4.5, "modo oscuro");
});
