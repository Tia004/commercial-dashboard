import nodemailer from 'nodemailer';
import { randomUUID } from 'node:crypto';

export function appOrigin(req?: Request) {
  if (process.env.APP_ORIGIN || process.env.NEXT_PUBLIC_APP_URL) {
    const raw = cleanEnv(process.env.APP_ORIGIN || process.env.NEXT_PUBLIC_APP_URL);
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

function cleanEnv(val?: string): string {
  if (!val) return '';
  return val.trim().replace(/^["']|["']$/g, '').trim();
}

export function isRealSmtpConfigured() {
  if (cleanEnv(process.env.RESEND_API_KEY)) return true;
  if (cleanEnv(process.env.BREVO_API_KEY)) return true;
  const pass = cleanEnv(process.env.SMTP_PASSWORD || process.env.SMTP_PASS);
  if (pass.startsWith('xkeysib-')) return true;
  const user = cleanEnv(process.env.SMTP_USER);
  const host = cleanEnv(process.env.SMTP_HOST);
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

  const pass = cleanEnv(process.env.SMTP_PASSWORD || process.env.SMTP_PASS);
  const user = cleanEnv(process.env.SMTP_USER);
  const host = cleanEnv(process.env.SMTP_HOST);
  const smtpConfigured = !!(host && process.env.SMTP_PORT && user && pass);
  let from = cleanEnv(process.env.SMTP_FROM) ||
    (user.includes('@') && !user.endsWith('@smtp-brevo.com') ? `Hub Commerciale <${user}>` : '');
  if (!from) {
    from = 'Hub Commerciale <tiachinaglia@gmail.com>';
  }

  const resendApiKey = cleanEnv(process.env.RESEND_API_KEY);
  const brevoApiKey = cleanEnv(process.env.BREVO_API_KEY) || (pass.startsWith('xkeysib-') ? pass : '');

  // Select optimal Resend sender: custom RESEND_FROM, or verified domain, or official onboarding sender
  let resendFrom = cleanEnv(process.env.RESEND_FROM);
  if (!resendFrom) {
    if (from && !/@(gmail|yahoo|hotmail|outlook|icloud|libero|live|aol|smtp-brevo)\./i.test(from)) {
      resendFrom = from;
    } else {
      resendFrom = 'Hub Commerciale <onboarding@resend.dev>';
    }
  }

  const failures: string[] = [];
  const requestId = randomUUID();

  async function submit(provider: string, url: string, headers: Record<string, string>, payload: object) {
    const response = await fetch(url, {
      method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(6000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = typeof data === 'object' ? (data.message || data.code || JSON.stringify(data)) : String(data);
      throw new Error(`${provider} HTTP ${response.status}: ${detail || 'richiesta rifiutata'}`);
    }
    const id = data.id || data.messageId;
    if (!id) throw new Error(`${provider}: conferma di invio mancante`);
    console.info('[ACCOUNT EMAIL ACCEPTED]', { provider, id, to });
    return { provider, id: String(id) };
  }

  // 1. Resend REST API (Instant delivery < 1s)
  if (resendApiKey) {
    try {
      return await submit('resend', 'https://api.resend.com/emails', {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': requestId,
      }, { from: resendFrom, to: [to], subject, html, text: message });
    } catch (error) {
      failures.push(error instanceof Error ? error.message : 'Resend non disponibile');
      console.warn('[ACCOUNT EMAIL RESEND FALLBACK]', failures[failures.length - 1]);
    }
  }

  // 2. Brevo REST API v3 (Instant transactional delivery)
  if (brevoApiKey) {
    try {
      const match = from.match(/^(.*?)\s*<([^>]+)>$/);
      let senderEmail = match ? match[2].trim() : from;
      let senderName = match ? match[1].replace(/"/g, '').trim() : 'Hub Commerciale';
      if (!senderEmail || senderEmail.endsWith('@smtp-brevo.com')) {
        senderEmail = 'tiachinaglia@gmail.com';
      }

      return await submit('brevo', 'https://api.brevo.com/v3/smtp/email', {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': brevoApiKey,
      }, {
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: message,
      });
    } catch (error) {
      failures.push(error instanceof Error ? error.message : 'Brevo non disponibile');
      console.warn('[ACCOUNT EMAIL BREVO FALLBACK]', failures[failures.length - 1]);
    }
  }

  // 3. Fallback to standard SMTP (Nodemailer)
  if (smtpConfigured && from) {
    const port = Number(cleanEnv(process.env.SMTP_PORT) || 587);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SMTP_PORT non valido');
    const transport = nodemailer.createTransport({
      host, port, secure: port === 465, auth: { user, pass },
      connectionTimeout: 6000, greetingTimeout: 6000, socketTimeout: 6000,
    });
    try {
      const result = await transport.sendMail({ from, to, subject, text: message, html });
      if (!result.accepted?.length || result.rejected?.length) throw new Error('SMTP: destinatario non accettato');
      console.info('[ACCOUNT EMAIL ACCEPTED]', { provider: 'smtp', id: result.messageId, to });
      return { provider: 'smtp', id: String(result.messageId) };
    } catch (error) {
      failures.push(error instanceof Error ? error.message : 'SMTP non disponibile');
    } finally {
      transport.close();
    }
  }

  throw new Error(failures.join('; ') || 'Configura un mittente verificato e un provider email valido.');
}
