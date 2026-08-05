import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

import { sendMail, MailerNotConfiguredError } from './mailer';

// Lo que estos tests protegen es UNA sola cosa: que este mailer nunca devuelva éxito sin haber
// enviado.
//
// El mailer anterior de este mismo panel tenía dos caminos que hacían justo eso —la bandera
// `MAILER_DRY_RUN=true` con la que se desplegaba, y la falta de configuración— y por eso la
// primera invitación real (monica.galan@fleetco.mx, 2026-08-05 17:28) se reportó como enviada
// y nunca salió. Un test que sólo comprobara «no lanza» habría pasado con el mailer roto: por
// eso cada caso afirma que LANZA y qué nombra el mensaje.
//
// Portado de tenant-admin-panel/lib/mailer.test.ts, adaptado de Gmail/DWD a Resend.

const ORIG = { key: process.env.RESEND_MAIL, from: process.env.MAIL_FROM };

const correo = { to: 'x@fleetco.mx', subject: 'Hola', html: '<p>x</p>' };

function configurar() {
  process.env.RESEND_MAIL = 're_test_key';
  process.env.MAIL_FROM = 'micontexto <noreply@micontexto.com>';
}

/** Sustituye fetch y devuelve las llamadas capturadas. Ningún test toca la red. */
function stubFetch(respuesta: { ok: boolean; status?: number; body?: string }) {
  const llamadas: Array<{ url: string; init: RequestInit }> = [];
  mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    llamadas.push({ url, init });
    return {
      ok: respuesta.ok,
      status: respuesta.status ?? (respuesta.ok ? 200 : 500),
      text: async () => respuesta.body ?? '',
    } as unknown as Response;
  });
  return llamadas;
}

describe('sendMail — falla ruidoso, nunca en silencio', () => {
  beforeEach(() => {
    delete process.env.RESEND_MAIL;
    delete process.env.MAIL_FROM;
  });

  afterEach(() => {
    mock.restoreAll();
    if (ORIG.key === undefined) delete process.env.RESEND_MAIL;
    else process.env.RESEND_MAIL = ORIG.key;
    if (ORIG.from === undefined) delete process.env.MAIL_FROM;
    else process.env.MAIL_FROM = ORIG.from;
  });

  it('sin RESEND_MAIL: LANZA (no hace return silencioso)', async () => {
    await assert.rejects(
      () => sendMail(correo),
      (e: Error) => {
        assert.ok(e instanceof MailerNotConfiguredError);
        assert.match(e.message, /RESEND_MAIL no seteado/);
        return true;
      }
    );
  });

  it('SIN remitente: LANZA — este era el «dry-run implícito» del mailer viejo', async () => {
    process.env.RESEND_MAIL = 're_test_key';
    // En este punto exacto, el mailer anterior logueaba y hacía `return`.
    await assert.rejects(
      () => sendMail(correo),
      (e: Error) => {
        assert.ok(e instanceof MailerNotConfiguredError);
        assert.match(e.message, /MAIL_FROM no seteado/);
        return true;
      }
    );
  });

  it('si Resend rechaza: LANZA con el status Y el cuerpo, que es lo que nombra la causa', async () => {
    configurar();
    // 403 con dominio sin verificar: el incidente del 2026-07-29 fue de reputación del
    // remitente, no de entrega. Sin el cuerpo, un 403 es indistinguible de otro.
    stubFetch({ ok: false, status: 403, body: '{"message":"The micontexto.com domain is not verified"}' });
    await assert.rejects(() => sendMail(correo), (e: Error) => {
      assert.match(e.message, /mailer_send_failed \(403\)/);
      assert.match(e.message, /domain is not verified/);
      return true;
    });
  });

  it('un 200 no basta si la API cambia de forma: sólo `ok` decide, y un 500 LANZA', async () => {
    configurar();
    stubFetch({ ok: false, status: 500, body: 'upstream boom' });
    await assert.rejects(() => sendMail(correo), /mailer_send_failed \(500\)/);
  });

  it('camino feliz: pega a la API de Resend con el Bearer y el remitente configurados', async () => {
    configurar();
    const llamadas = stubFetch({ ok: true });

    await sendMail(correo);

    assert.equal(llamadas.length, 1, 'debe enviarse exactamente un correo');
    assert.equal(llamadas[0].url, 'https://api.resend.com/emails');
    assert.equal(llamadas[0].init.method, 'POST');
    const headers = llamadas[0].init.headers as Record<string, string>;
    assert.equal(headers.Authorization, 'Bearer re_test_key');
    const body = JSON.parse(llamadas[0].init.body as string);
    assert.equal(body.from, 'micontexto <noreply@micontexto.com>');
    assert.deepEqual(body.to, ['x@fleetco.mx'], 'Resend espera `to` como array');
    assert.equal(body.subject, 'Hola');
    assert.equal(body.html, '<p>x</p>');
  });

  it('no existe ninguna bandera que desactive el envío', async () => {
    // Guarda de regresión doble, porque el fallo original tenía dos caras:
    // (a) con el mailer sin configurar, la bandera no debe convertirlo en éxito silencioso;
    // (b) con el mailer configurado, la bandera no debe impedir el envío.
    process.env.MAILER_DRY_RUN = 'true';
    try {
      await assert.rejects(
        () => sendMail(correo),
        MailerNotConfiguredError,
        'MAILER_DRY_RUN no debe convertir un mailer sin configurar en un éxito silencioso'
      );

      configurar();
      const llamadas = stubFetch({ ok: true });
      await sendMail(correo);
      assert.equal(llamadas.length, 1, 'MAILER_DRY_RUN no debe suprimir un envío real');
    } finally {
      delete process.env.MAILER_DRY_RUN;
    }
  });
});
