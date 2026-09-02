// ADR-221 D-221.4 — el QR es `wa.me/<número>?text=<clave>` convertido en imagen.
//
// Es el camino feliz de las DOS entradas al mismo emparejador: el asistente escanea y la clave
// llega precargada en su primer mensaje. La otra entrada —el agente preguntando «¿en qué
// evento estás?»— es respaldo, y las dos terminan en el mismo emparejador determinista.
//
// ⚠️ RIESGO QUE EL PROPIO ADR NOMBRA: el `?text=` precargado es EDITABLE y no todos los
// clientes de WhatsApp lo tratan igual. Conviene confirmar el comportamiento contra la
// documentación de Meta antes de mandar el QR a imprenta. Por eso el respaldo de D-221.4 no
// es opcional, y por eso la pantalla enseña la clave en grande junto al código.

import { normalizarClave } from './clave';

/**
 * Deja un teléfono en la forma que `wa.me` acepta: sólo dígitos, sin `+`, sin espacios y sin
 * paréntesis. `wa.me/+52 1 555…` no resuelve.
 *
 * Devuelve `null` si no queda un número plausible. Un tenant SIN canal de WhatsApp dado de
 * alta cae aquí, y es el caso normal hoy: Meta exige una línea real y verificada, y ese
 * trámite es de fuera de este repo. Quien llame tiene que distinguir ese `null` y decirlo —
 * no dibujar un QR roto.
 */
export function normalizarNumeroWa(numero: string | null | undefined): string | null {
  if (!numero) return null;
  const digitos = numero.replace(/\D+/g, '');
  // Un E.164 va de 8 a 15 dígitos. Por debajo es un identificador de otra cosa —un
  // `phone_number_id` de Meta, un alias— y montar un enlace con eso da un 404 silencioso.
  if (digitos.length < 8 || digitos.length > 15) return null;
  return digitos;
}

/**
 * Monta el enlace de la conferencia. La clave se canoniza aquí también, y no por paranoia:
 * el enlace tiene que llevar EXACTAMENTE lo que el emparejador espera recibir, porque el
 * texto que precarga es el que el asistente enviará sin tocarlo.
 */
export function construirEnlaceWa(numero: string | null | undefined, clave: string): string | null {
  const digitos = normalizarNumeroWa(numero);
  if (!digitos) return null;

  const canon = normalizarClave(clave);
  if (!canon) return null;

  return `https://wa.me/${digitos}?text=${encodeURIComponent(canon)}`;
}
