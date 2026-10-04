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
  const title = opts.title || 'Notifica account';
  const actionLabel = opts.actionLabel || 'Continua';
  const footnote = opts.footnote || 'Se non hai effettuato tu questa richiesta, puoi ignorare questo messaggio in sicurezza. Il tuo account rimane protetto.';

  const directLinkBlock = opts.actionUrl ? `
    <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #1f1f23;">
      <p style="font-size: 12px; color: #71717a; margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        Se il pulsante sopra non funziona, copia e incolla questo link nel browser:
      </p>
      <div style="background-color: #121215; border: 1px solid #27272a; border-radius: 6px; padding: 10px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; color: #a1a1aa; word-break: break-all; line-height: 1.5;">
        <a href="${opts.actionUrl}" target="_blank" style="color: #d4d4d8; text-decoration: underline;">${opts.actionUrl}</a>
      </div>
    </div>` : '';

  const buttonBlock = opts.actionUrl ? `
    <table cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0 24px 0;">
      <tr>
        <td align="center" style="border-radius: 6px; background-color: #ffffff;">
          <a href="${opts.actionUrl}" target="_blank" style="display: inline-block; padding: 11px 24px; font-size: 13px; font-weight: 600; color: #000000; text-decoration: none; letter-spacing: -0.01em; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; border-radius: 6px;">${actionLabel}</a>
        </td>
      </tr>
    </table>` : '';

  const expiryBlock = opts.expiryText ? `
    <p style="font-size: 12px; line-height: 1.5; color: #71717a; margin: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      ${opts.expiryText}
    </p>` : '';

  const introBlock = opts.intro ? `
    <p style="font-size: 14px; font-weight: 500; line-height: 1.6; color: #f4f4f5; margin: 0 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      ${opts.intro}
    </p>` : '';

  const bodyBlock = opts.bodyText ? `
    <p style="font-size: 14px; line-height: 1.65; color: #a1a1aa; margin: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
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
<body style="margin: 0; padding: 0; background-color: #000000; color: #ededed; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #000000; margin: 0; padding: 48px 16px;">
    <tr>
      <td align="center">
        <!-- Resend / Linear Card Container -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; width: 100%; background-color: #09090b; border: 1px solid #27272a; border-radius: 12px; text-align: left;">
          <tr>
            <td style="padding: 36px 36px 32px 36px;">
              <!-- Minimalist Header Brand Mark -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
                <tr>
                  <td style="width: 26px; height: 26px; background-color: #18181b; border: 1px solid #27272a; border-radius: 6px; text-align: center; vertical-align: middle;">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 700; color: #ffffff; line-height: 1;">H</span>
                  </td>
                  <td style="padding-left: 10px; font-size: 13px; font-weight: 600; color: #f4f4f5; letter-spacing: -0.01em; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    Hub Commerciale
                  </td>
                </tr>
              </table>

              <!-- Title -->
              <h1 style="font-size: 20px; font-weight: 600; color: #ffffff; letter-spacing: -0.02em; line-height: 1.35; margin: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                ${title}
              </h1>

              <!-- Intro & Body -->
              ${introBlock}
              ${bodyBlock}

              <!-- Resend Primary Button (Pure White & Solid Black) -->
              ${buttonBlock}

              <!-- Expiry Notice -->
              ${expiryBlock}

              <!-- Fallback Direct Link -->
              ${directLinkBlock}

              <!-- Security Notice -->
              <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid #1f1f23; font-size: 12px; line-height: 1.5; color: #52525b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                ${footnote}
              </div>
            </td>
          </tr>
        </table>

        <!-- Out-of-card Footer -->
        <table cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; width: 100%; margin: 20px auto 0 auto;">
          <tr>
            <td align="center" style="font-size: 11px; color: #52525b; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              Hub Commerciale · Workspace vendite
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

  let defaultActionLabel = 'Continua';
  if (/verifica/i.test(subject)) {
    defaultActionLabel = 'Verifica email';
  } else if (/password/i.test(subject)) {
    defaultActionLabel = 'Reimposta password';
  } else if (/invito/i.test(subject)) {
    defaultActionLabel = 'Accetta invito';
  }

  const resolvedOpts: LinearEmailOptions = {
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
    try {
      const resendFrom = (process.env.RESEND_FROM || from).trim();
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [to],
          subject,
          html,
          text: message,
        }),
      });
      if (res.ok) return;
      const errText = await res.text().catch(() => '');
      console.warn(`Resend API non riuscito (${res.status}): ${errText}. Tento fallback automatico su Brevo/SMTP...`);
      if (!pass && !process.env.BREVO_API_KEY) {
        throw new Error(`Errore invio Resend (${res.status}): ${errText}`);
      }
    } catch (e: any) {
      if (!pass && !process.env.BREVO_API_KEY) throw e;
      console.warn('Eccezione invio Resend API, tento fallback su Brevo/SMTP:', e?.message || e);
    }
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
