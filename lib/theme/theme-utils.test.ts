import { test } from "node:test";
import assert from "node:assert/strict";

import { buildThemeCss } from "./theme-utils";
import { brightenForDark, contrastingForeground, oklchLightness } from "./theme-pure";

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
