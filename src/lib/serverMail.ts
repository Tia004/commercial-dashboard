import nodemailer from 'nodemailer';

export function appOrigin() {
  const value = process.env.APP_ORIGIN || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '');
  if (!value) throw new Error('APP_ORIGIN non configurato');
  const url = new URL(value);
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error('APP_ORIGIN deve usare HTTPS');
  return url.origin;
}

export function emailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_FROM);
}

export async function sendAccountEmail(to: string, subject: string, message: string) {
  if (!emailConfigured()) throw new Error('SMTP non configurato');
  const port = Number(process.env.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SMTP_PORT non valido');
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  await transport.sendMail({ from: process.env.SMTP_FROM, to, subject, text: message });
}
