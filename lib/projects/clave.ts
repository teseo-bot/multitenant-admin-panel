// ADR-221 D-221.3 — la CLAVE del proyecto es su `slug`, y aquí vive su canon.
//
// La clave es lo que el ponente dice en voz alta desde el escenario y lo que el asistente
// teclea en WhatsApp. También es lo que viaja al corpus como `project_slugs` y lo que filtran
// las seis lecturas del orquestador. Un solo valor con dos vidas.
//
// ⛔ POR QUÉ ESTO ES UN MÓDULO Y NO DOS LÍNEAS EN EL FORMULARIO. La 016 lo advierte por
// escrito sobre esta misma columna: «no se deriva del nombre: si se normalizara aquí y no
// allá, el selector ofrecería un valor que la ingesta rechaza». El alta y el emparejador
// (D-221.4, paso 3, en el orquestador) tienen que aplicar EXACTAMENTE la misma regla, o el
// asistente teclea la clave que vio en el slide y no vincula nada. Este fichero es esa regla.
//
// ⚠️ VIVE DUPLICADO A PROPÓSITO, Y HAY QUE SABERLO. El emparejador es del orquestador, que es
// otro repo. Cuando se escriba el paso 3, esta función se copia allí tal cual o se sube a
// `contracts`. Lo que NO puede pasar es que allá se escriba otra: la prueba de abajo fija el
// contrato para que el duplicado sea comprobable.

/**
 * Lleva una cadena escrita por una persona al canon de la clave.
 *
 * El canon es **minúsculas con guiones** —`cluster-plasticos`, `acoeq`— y no es una elección
 * estética: son los dos proyectos que ya existen en `tenant_projects`, dados de alta por SQL a
 * mano. Canonizar a mayúsculas habría partido el catálogo en dos convenciones el primer día.
 *
 * D-221.3 pide insensibilidad a mayúsculas y a espacios de sobra. Se añaden los acentos, que
 * el ADR no nombra pero el idioma sí: quien oye «plásticos» desde una butaca puede teclearlo
 * con tilde o sin ella, y las dos formas tienen que casar con la misma fila.
 *
 * Devuelve cadena vacía si no queda nada utilizable. Quien llame decide qué hacer con eso —
 * aquí no se lanza, porque esta función también corre sobre texto entrante de WhatsApp, donde
 * «no es una clave» es el caso normal y no una avería.
 */
export function normalizarClave(entrada: string): string {
  return entrada
    .normalize('NFD')
    // Marcas diacrídicas combinantes: «á» ya es «a» + tilde suelta tras el NFD de arriba.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    // Cualquier racha de lo que no sea alfanumérico —espacios de sobra, guiones bajos, puntos—
    // colapsa a UN guion. Así «Cluster  de Plásticos» y «cluster-de-plasticos» coinciden.
    .replace(/[^a-z0-9]+/g, '-')
    // Los guiones de los extremos son basura de la sustitución anterior, no parte de la clave.
    .replace(/^-+|-+$/g, '');
}

/** Longitud máxima de la clave. No es un límite de la tabla: es de la voz y del slide. */
export const CLAVE_MAX = 40;

export interface ClaveInvalida {
  ok: false;
  error: string;
}
export interface ClaveValida {
  ok: true;
  clave: string;
}

/**
 * Valida una clave propuesta en el alta, donde «no es una clave» SÍ es una avería y hay que
 * decir por qué. Es la mitad estricta de `normalizarClave`, que es la permisiva.
 */
export function validarClave(entrada: string): ClaveValida | ClaveInvalida {
  const clave = normalizarClave(entrada);

  if (!clave) {
    return { ok: false, error: 'La clave necesita al menos una letra o un número.' };
  }
  if (clave.length > CLAVE_MAX) {
    return { ok: false, error: `La clave no puede pasar de ${CLAVE_MAX} caracteres.` };
  }
  // Una clave que es sólo dígitos se confunde con un número de teléfono, con un año o con la
  // respuesta a otra pregunta del agente. El emparejador tendría que desempatar por contexto,
  // que es justo lo que D-221.4 saca del LLM.
  if (/^[0-9-]+$/.test(clave)) {
    return { ok: false, error: 'La clave no puede ser sólo números: se confundiría con otra respuesta.' };
  }

  return { ok: true, clave };
}
