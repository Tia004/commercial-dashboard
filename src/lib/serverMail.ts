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

  throw new Error('APP_ORIGIN non configurato (aggiungi APP_ORIGIN con l’URL della dashboard nelle variabili di Vercel)');
}

export function isRealSmtpConfigured() {
  const pass = (process.env.SMTP_PASSWORD || process.env.SMTP_PASS || '').trim();
  const user = (process.env.SMTP_USER || '').trim();
  const host = (process.env.SMTP_HOST || '').trim();
  return !!(host && process.env.SMTP_PORT && user && pass);
}

export function emailConfigured() {
  if (process.env.NODE_ENV === 'development') return true;
  return isRealSmtpConfigured();
}

export async function sendAccountEmail(to: string, subject: string, message: string) {
  if (!isRealSmtpConfigured()) {
    if (process.env.NODE_ENV === 'development') {
      console.log('\n┌─────────────────────────────────────────────────────────────────────────────┐');
      console.log('│ 📨 [SIMULATORE EMAIL LOCALE - SVILUPPO]                                     │');
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

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });

  await transport.sendMail({ from, to, subject, text: message });
}
