// Envío de correo del plano de CONTROL, vía Resend.
//
// ─── Por qué Resend y no Gmail con delegación de dominio ────────────────────────────────
//
// La versión anterior usaba Gmail API con DWD y se desplegaba con `MAILER_DRY_RUN=true`: hacía
// `return` sin enviar y dejaba un `[mailer:dry-run]` que nadie miraba. Así se perdió la
// primera invitación real (monica.galan@fleetco.mx, 2026-08-05 17:28) — el panel reportó éxito.
//
// Pero quitar la bandera no habría bastado, y ese es el punto: **DWD autoriza por DOMINIO**
// (ADR-207). El SA con delegación vive en el Workspace de fleetco.mx y sólo puede firmar como
// buzones de fleetco.mx. Control es la plataforma y da de alta usuarios de CUALQUIER tenant:
// con DWD necesitaría una credencial por dominio de cliente, que no escala y multiplica la
// superficie de permisos.
//
// Una invitación a micontexto es un acto de la PLATAFORMA, no de la empresa cliente, así que
// el remitente correcto es una dirección de micontexto. Resend hace exactamente eso con un
// dominio verificado, y la credencial `RESEND_MAIL` ya estaba provisionada en
// micontexto-control desde el 2026-07-10 — habilitada y sin un solo lector.
//
// ⚠️ Reputación del remitente: el incidente del 2026-07-29 NO fue de entrega sino de
// reputación. Antes de confiar en este camino, SPF/DKIM/DMARC del dominio verificados en
// Resend.
//
// ─── Sin modo dry-run, a propósito ──────────────────────────────────────────────────────
//
// El mailer viejo tenía DOS caminos que devolvían éxito sin enviar (la bandera y un «dry-run
// implícito» cuando faltaba el buzón). Aquí, falta de configuración o rechazo de la API ⇒ se
// LANZA. Quien llama decide; en la invitación, devuelve el enlace de contraseña al admin para
// que el usuario nunca quede bloqueado por un problema de correo.

export class MailerNotConfiguredError extends Error {
  constructor(detalle: string) {
    super(`mailer_not_configured: ${detalle}`);
    this.name = 'MailerNotConfiguredError';
  }
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

function getApiKey(): string {
  const key = process.env.RESEND_MAIL;
  if (!key) throw new MailerNotConfiguredError('RESEND_MAIL no seteado');
  return key;
}

function getSender(): string {
  const from = process.env.MAIL_FROM;
  if (!from) {
    throw new MailerNotConfiguredError(
      'MAIL_FROM no seteado (remitente, p.ej. "micontexto <no-reply@micontexto.com>")'
    );
  }
  return from;
}

/**
 * Envía un correo. LANZA si no está configurado o si Resend rechaza — nunca devuelve éxito sin
 * haber enviado.
 */
export async function sendMail(opts: SendMailOptions): Promise<void> {
  const apiKey = getApiKey();
  const from = getSender();

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, html: opts.html }),
  });

  if (!res.ok) {
    // El cuerpo de Resend nombra la causa real (dominio no verificado, remitente inválido,
    // clave revocada). Se conserva: sin él, un 403 es indistinguible de otro.
    const detalle = await res.text().catch(() => '');
    throw new Error(`mailer_send_failed (${res.status}): ${detalle.slice(0, 300)}`);
  }
}
