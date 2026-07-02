// lib/knowledge-ops/format.ts
// K7-W2: utilidades de formato para Knowledge Ops. Reglas transversales UXUI §"Reglas
// transversales": timestamps en zona America/Mexico_City, formato `dd MMM yyyy HH:mm`.
// Sin librerías nuevas — usa Intl.DateTimeFormat nativo (no hay date-fns/dayjs en el panel).

const MESES_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
] as const;

const TIMEZONE = "America/Mexico_City";

/**
 * Formatea un timestamp (ISO string, Date, o null/undefined) como
 * `dd MMM yyyy HH:mm` en zona America/Mexico_City. Devuelve `fallback` si no hay valor
 * o si el valor no es una fecha válida.
 */
export function formatTimestamp(
  value: string | Date | null | undefined,
  fallback = "—"
): string {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  const parts = new Intl.DateTimeFormat("es-MX", {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = get("day");
  const month = MESES_ES[Number(get("month")) - 1] ?? get("month");
  const year = get("year");
  const hour = get("hour");
  const minute = get("minute");

  return `${day} ${month} ${year} ${hour}:${minute}`;
}

/** Antigüedad relativa breve en español (ej. "hace 3h", "hace 2d"). */
export function formatRelativeAge(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "hace instantes";
  if (diffMin < 60) return `hace ${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD}d`;
}
