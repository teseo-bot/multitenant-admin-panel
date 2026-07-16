// lib/mailer.ts
// WU G1-W4: Mailer con google.auth.JWT + Domain-Wide Delegation
// Envía correos de invitación usando Gmail API (gmail.send scope).

import { google } from 'googleapis';
import fs from 'fs';
import { logger } from '@/lib/logger';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Envía un correo usando Gmail API con Domain-Wide Delegation.
 *
 * Modo DRY-RUN: si MAILER_DRY_RUN=true o faltan credenciales,
 * loguea sin enviar.
 */
export async function sendMail(opts: SendMailOptions): Promise<void> {
  // Chequeo early de dry-run
  if (process.env.MAILER_DRY_RUN === 'true') {
    logger.info('[mailer:dry-run]', { to: opts.to, subject: opts.subject });
    return;
  }

  // Chequeo de credenciales requeridas
  const subject = process.env.GOOGLE_WORKSPACE_SUBJECT;
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!subject) {
    logger.warn('[mailer:no-subject] GOOGLE_WORKSPACE_SUBJECT no configurado, modo dry-run implícito');
    logger.info('[mailer:dry-run]', { to: opts.to, subject: opts.subject });
    return;
  }

  let jwtClient: any;
  try {
    const jwtConfig: any = {
      scopes: ['https://www.googleapis.com/auth/gmail.send'],
      subject,
    };

    // Priority 1: keyFile
    if (credentialsPath && fs.existsSync(credentialsPath)) {
      jwtConfig.keyFile = credentialsPath;
    } else if (serviceAccountEmail && privateKey) {
      // Priority 2: email + key directo
      jwtConfig.email = serviceAccountEmail;
      jwtConfig.key = privateKey;
    } else {
      logger.warn('[mailer:no-credentials] No hay keyFile ni email/key configurados, modo dry-run implícito');
      logger.info('[mailer:dry-run]', { to: opts.to, subject: opts.subject });
      return;
    }

    jwtClient = new google.auth.JWT(jwtConfig);

    // Construye MIME message (RFC 5322 base64url)
    const message = [
      `To: ${opts.to}`,
      `Subject: ${opts.subject}`,
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      opts.html,
    ].join('\r\n');

    const encodedMessage = Buffer.from(message).toString('base64url');

    // Envía con gmail.users.messages.send
    const gmail = google.gmail({ version: 'v1', auth: jwtClient });
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    logger.info('[mailer:sent]', { to: opts.to, subject: opts.subject });
  } catch (err) {
    logger.error('[mailer:error]', {
      to: opts.to,
      subject: opts.subject,
      error: String(err),
    });
    throw err;
  }
}
