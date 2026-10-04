import nodemailer from 'nodemailer';

export function appOrigin(req?: Request) {
  if (process.env.APP_ORIGIN) {
    const raw = process.env.APP_ORIGIN.trim();
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    return url.origin;
  }

  // Automatically detect host from incoming HTTP request headers
  if (req) {
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    if (host) return `${proto}://${host}`;
  }

  // Automatically detect Vercel production URL or deployment URL
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) {
    return `https://${vercel.replace(/^https?:\/\//, '')}`;
  }

  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }

  return 'https://commercial-dashboard-silk.vercel.app';
}

export function isRealSmtpConfigured() {
  if (process.env.RESEND_API_KEY?.trim()) return true;
  if (process.env.BREVO_API_KEY?.trim()) return true;
  const pass = (process.env.SMTP_PASSWORD || process.env.SMTP_PASS || '').trim();
  const user = (process.env.SMTP_USER || '').trim();
  const host = (process.env.SMTP_HOST || '').trim();
  return !!(host && process.env.SMTP_PORT && user && pass);
}

export function emailConfigured() {
  if (process.env.NODE_ENV === 'development') return true;
  return isRealSmtpConfigured();
}

export interface LinearEmailOptions {
  kicker?: string;
  title?: string;
  intro?: string;
  bodyText?: string;
  actionUrl?: string;
  actionLabel?: string;
  expiryText?: string;
  footnote?: string;
}

export function renderLinearEmail(opts: LinearEmailOptions): string {
  const kicker = opts.kicker || 'HUB COMMERCIALE';
  const title = opts.title || 'Notifica account';
  const actionLabel = opts.actionLabel || 'Continua →';
  const footnote = opts.footnote || 'Se non hai effettuato tu questa richiesta, puoi ignorare questo messaggio. Il tuo account rimane protetto.';

  const directLinkBlock = opts.actionUrl ? `
    <div style="margin-top: 26px; padding-top: 22px; border-top: 1px solid #1e293b;">
      <p style="font-size: 11px; color: #64748b; margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        Se il pulsante non funziona, copia e incolla questo indirizzo nel tuo browser:
      </p>
      <div style="background-color: #070a10; border: 1px solid #1e293b; border-radius: 8px; padding: 10px 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; color: #38bdf8; word-break: break-all; line-height: 1.45;">
        <a href="${opts.actionUrl}" target="_blank" style="color: #38bdf8; text-decoration: none;">${opts.actionUrl}</a>
      </div>
    </div>` : '';

  const buttonBlock = opts.actionUrl ? `
    <table cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 20px 0;">
      <tr>
        <td align="center" style="border-radius: 9px; background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%); box-shadow: 0 6px 20px rgba(56, 189, 248, 0.32);">
          <a href="${opts.actionUrl}" target="_blank" style="display: inline-block; padding: 13px 30px; font-size: 13px; font-weight: 700; color: #041322; text-decoration: none; letter-spacing: -0.01em; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border-radius: 9px;">${actionLabel}</a>
        </td>
      </tr>
    </table>` : '';

  const expiryBlock = opts.expiryText ? `
    <p style="font-size: 12px; line-height: 1.5; color: #64748b; margin: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      ⏱️ ${opts.expiryText}
    </p>` : '';

  const introBlock = opts.intro ? `
    <p style="font-size: 14px; font-weight: 600; line-height: 1.6; color: #e2e8f0; margin: 0 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      ${opts.intro}
    </p>` : '';

  const bodyBlock = opts.bodyText ? `
    <p style="font-size: 14px; line-height: 1.65; color: #94a3b8; margin: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      ${opts.bodyText}
    </p>` : '';

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #070a10; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #070a10; margin: 0; padding: 48px 16px;">
    <tr>
      <td align="center">
        <!-- Linear Card Container -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 540px; width: 100%; background-color: #0f1523; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.85);">
          <!-- Linear Vibrant Top Glow Bar -->
          <tr>
            <td style="height: 3px; background: linear-gradient(90deg, #38bdf8 0%, #6366f1 50%, #a855f7 100%); font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding: 36px 38px 32px 38px;">
              <!-- Header Brand Logo -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
                <tr>
                  <td style="width: 32px; height: 32px; background: linear-gradient(135deg, #1e293b 0%, #0b1120 100%); border: 1px solid #334155; border-radius: 9px; text-align: center; vertical-align: middle;">
                    <div style="font-size: 16px; line-height: 1; font-weight: 800; color: #38bdf8;">⚡</div>
                  </td>
                  <td style="padding-left: 12px; font-size: 15px; font-weight: 700; color: #f8fafc; letter-spacing: -0.02em; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    Hub Commerciale
                  </td>
                  <td style="padding-left: 8px;">
                    <span style="font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; background-color: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 2px 7px; border-radius: 12px;">Workspace</span>
                  </td>
                </tr>
              </table>

              <!-- Kicker -->
              <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #38bdf8; margin-bottom: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                ${kicker}
              </div>

              <!-- Title -->
              <h1 style="font-size: 23px; font-weight: 700; color: #ffffff; letter-spacing: -0.025em; line-height: 1.25; margin: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                ${title}
              </h1>

              <!-- Intro & Body -->
              ${introBlock}
              ${bodyBlock}

              <!-- Call to Action Button -->
              ${buttonBlock}

              <!-- Expiry -->
              ${expiryBlock}

              <!-- Fallback Direct Link -->
              ${directLinkBlock}

              <!-- Security Notice -->
              <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid #1e293b; font-size: 11px; line-height: 1.5; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                🔒 ${footnote}
              </div>
            </td>
          </tr>
        </table>

        <!-- Out-of-card Footer -->
        <table cellpadding="0" cellspacing="0" border="0" style="max-width: 540px; width: 100%; margin: 20px auto 0 auto;">
          <tr>
            <td align="center" style="font-size: 11px; color: #475569; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              Hub Commerciale <span>·</span> Workspace vendite multi-brand<br>
              <span style="color: #334155;">Email transazionale protetta inviata automaticamente</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendAccountEmail(
  to: string,
  subject: string,
  message: string,
  options?: LinearEmailOptions
) {
  // Automatically extract URL, expiry, and structure if custom options were not supplied
  const urlMatch = message.match(/(https?:\/\/[^\s]+)/);
  const actionUrl = options?.actionUrl || (urlMatch ? urlMatch[1] : undefined);
  const expiryMatch = message.match(/((?:Il link|L’invito|Questo link)[^.\n]+\.)/i);
  const expiryText = options?.expiryText || (expiryMatch ? expiryMatch[1] : undefined);

  // Clean body text by stripping the raw URL line if actionUrl is present
  const cleanedBody = message
    .replace(/(https?:\/\/[^\s]+)/g, '')
    .replace(/((?:Il link|L’invito|Questo link)[^.\n]+\.)/gi, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n\n');

  let defaultKicker = 'HUB COMMERCIALE';
  let defaultActionLabel = 'Continua →';
  if (/verifica/i.test(subject)) {
    defaultKicker = 'AUTENTICAZIONE WORKSPACE';
    defaultActionLabel = 'Verifica email ed entra →';
  } else if (/password/i.test(subject)) {
    defaultKicker = 'SICUREZZA ACCOUNT';
    defaultActionLabel = 'Reimposta password →';
  } else if (/invito/i.test(subject)) {
    defaultKicker = 'COLLABORAZIONE WORKSPACE';
    defaultActionLabel = 'Accetta invito ed entra →';
  }

  const resolvedOpts: LinearEmailOptions = {
    kicker: options?.kicker || defaultKicker,
    title: options?.title || subject.replace(/\s*·\s*Hub Commerciale/i, '').trim(),
    intro: options?.intro,
    bodyText: options?.bodyText || cleanedBody,
    actionUrl,
    actionLabel: options?.actionLabel || defaultActionLabel,
    expiryText,
    footnote: options?.footnote,
  };

  const html = renderLinearEmail(resolvedOpts);

  if (!isRealSmtpConfigured()) {
    if (process.env.NODE_ENV === 'development') {
      console.log('\n┌─────────────────────────────────────────────────────────────────────────────┐');
      console.log('│ 📨 [SIMULATORE EMAIL LOCALE - SVILUPPO (LINEAR AESTHETIC)]                 │');
      console.log(`│ A: ${to.padEnd(73).slice(0, 73)}│`);
      console.log(`│ Oggetto: ${subject.padEnd(67).slice(0, 67)}│`);
      console.log('├─────────────────────────────────────────────────────────────────────────────┤');
      const lines = message.split('\n');
      for (const line of lines) {
        console.log(`│ ${line.padEnd(75).slice(0, 75)} │`);
      }
      console.log('└─────────────────────────────────────────────────────────────────────────────┘\n');
      return;
    }
    throw new Error('Parametri SMTP mancanti (verifica SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)');
  }

  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SMTP_PORT non valido (usa 587)');
  const pass = (process.env.SMTP_PASSWORD || process.env.SMTP_PASS || '').trim();
  const user = (process.env.SMTP_USER || '').trim();
  const host = (process.env.SMTP_HOST || 'smtp-relay.brevo.com').trim();

  let from = (process.env.SMTP_FROM || '').trim();
  if (!from) {
    if (user.endsWith('@smtp-brevo.com')) {
      throw new Error('Configura SMTP_FROM su Vercel con l’email con cui sei registrato su Brevo (es. "Hub Commerciale <tua_email>"). Il codice di accesso @smtp-brevo.com non è un mittente valido.');
    }
    from = user.includes('@') ? `"Hub Commerciale" <${user}>` : user;
  }

  // 1. Resend REST API (Instant delivery < 1s)
  const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
  if (resendApiKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text: message,
      }),
    });
    if (res.ok) return;
    const errText = await res.text().catch(() => '');
    throw new Error(`Errore invio Resend (${res.status}): ${errText}`);
  }

  // 2. Brevo REST API v3 (Instant high-priority transactional delivery, bypasses slow SMTP queue)
  const brevoApiKey = (process.env.BREVO_API_KEY || (pass.startsWith('xkeysib-') ? pass : '')).trim();
  if (brevoApiKey) {
    try {
      let senderName = 'Hub Commerciale';
      let senderEmail = from;
      const match = from.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
      if (match) {
        if (match[1]) senderName = match[1].trim();
        if (match[2]) senderEmail = match[2].trim();
      }

      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'api-key': brevoApiKey,
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: message,
        }),
      });

      if (res.ok) return;
      console.warn('Brevo REST API non riuscita, provo fallback su SMTP relay:', await res.text().catch(() => ''));
    } catch (e) {
      console.warn('Errore chiamata Brevo REST API, provo fallback SMTP:', e);
    }
  }

  // 3. Fallback to standard SMTP (Nodemailer)
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });

  await transport.sendMail({ from, to, subject, text: message, html });
}
