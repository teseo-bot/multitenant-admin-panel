// El campo de la whitelist de Telegram se convertía DOS veces: el componente hacía
// `.split(',')` y mandaba un array, y la server action volvía a hacerle `.split(',')`
// encima ⇒ «telegramWhitelistedGroupIds.split is not a function».
//
// El bug es anterior, pero estaba tapado: hasta que el formulario dejó de exigir dominio,
// orquestador y bot, la validación nunca pasaba y la ejecución no llegaba a la acción.
//
// La conversión vive AQUÍ y sólo aquí. Y acepta las dos formas a propósito: el componente
// es cliente, su bundle se cachea en el navegador, y durante la ventana de despliegue habrá
// pestañas abiertas mandando todavía el array. Tolerarlo evita un error incomprensible a
// quien no haya recargado; no es laxitud, es la forma del despliegue.

/** Normaliza la whitelist a un array de IDs, venga como texto separado por comas o ya como array. */
export function normalizarWhitelist(valor: unknown): string[] {
  if (Array.isArray(valor)) {
    return valor.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof valor === "string") {
    return valor.split(",").map((v) => v.trim()).filter(Boolean);
  }
  return [];
}
