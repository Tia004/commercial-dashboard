import { NextRequest, NextResponse } from 'next/server';
import { getServerDb } from '@/lib/serverDb';
import { sendAccountEmail } from '@/lib/serverMail';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || 'tiachinaglia@gmail.com').trim().toLowerCase();
    const secret = String(body.secret || req.nextUrl.searchParams.get('secret') || '');

    if (secret !== 'purge_tia_commercial_2026') {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const db = await getServerDb();
    const existing = await db.execute({
      sql: 'SELECT id, email, name FROM users WHERE email = ?',
      args: [email]
    });

    if (!existing.rows.length) {
      return NextResponse.json({ success: true, message: `Nessun utente trovato con email ${email}.` });
    }

    const userId = String(existing.rows[0].id);

    await db.execute({ sql: 'DELETE FROM auth_tokens WHERE email = ? OR user_id = ?', args: [email, userId] });
    await db.execute({ sql: 'DELETE FROM login_attempts WHERE email = ?', args: [email] });
    await db.execute({ sql: 'DELETE FROM passkeys WHERE user_id = ?', args: [userId] });
    await db.execute({ sql: 'DELETE FROM sessions WHERE user_id = ?', args: [userId] });
    await db.execute({ sql: 'DELETE FROM crm_data WHERE user_id = ?', args: [userId] });
    await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [userId] });
    await db.execute('DELETE FROM ip_rate_limits');

    return NextResponse.json({
      success: true,
      message: `Utente ${email} rimosso con successo dal database di produzione.`,
      deletedUser: { id: userId, email }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Errore durante la rimozione.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret') || '';
  if (secret !== 'purge_tia_commercial_2026') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }
  const action = req.nextUrl.searchParams.get('action') || 'inspect';
  const email = (req.nextUrl.searchParams.get('email') || 'tiachinaglia@gmail.com').trim().toLowerCase();
  
  try {
    const db = await getServerDb();
    if (action === 'inspect') {
      const users = await db.execute('SELECT id, email, name, email_verified, created_at FROM users');
      const tokens = await db.execute('SELECT token_hash, purpose, email, expires_at, used_at FROM auth_tokens');
      return NextResponse.json({
        users: users.rows,
        tokens: tokens.rows,
        mailConfig: {
          hasResend: !!process.env.RESEND_API_KEY?.trim(),
          hasBrevo: !!process.env.BREVO_API_KEY?.trim(),
          hasSmtpPass: !!(process.env.SMTP_PASSWORD || process.env.SMTP_PASS)?.trim(),
          smtpUser: (process.env.SMTP_USER || '').trim(),
          smtpFrom: (process.env.SMTP_FROM || '').trim(),
          smtpHost: (process.env.SMTP_HOST || '').trim(),
        }
      });
    }

    if (action === 'test-mail') {
      try {
        await sendAccountEmail(
          email,
          'Test verifica email · Hub Commerciale',
          'Questo è un messaggio di test per verificare la ricezione.',
          {
            title: 'Test verifica',
            bodyText: 'Se ricevi questo messaggio, il server di posta è configurato correttamente.',
            actionUrl: 'https://commercial-dashboard-silk.vercel.app',
            actionLabel: 'Vai alla dashboard'
          }
        );
        return NextResponse.json({ success: true, message: `Email di test inviata con successo a ${email}!` });
      } catch (err: any) {
        return NextResponse.json({ success: false, error: err?.message || String(err), stack: err?.stack });
      }
    }

    const existing = await db.execute({
      sql: 'SELECT id, email, name, email_verified FROM users WHERE email = ?',
      args: [email]
    });

    if (!existing.rows.length) {
      return NextResponse.json({ success: true, message: `Nessun utente trovato con email ${email}.` });
    }

    const userId = String(existing.rows[0].id);
    await db.execute({ sql: 'DELETE FROM auth_tokens WHERE email = ? OR user_id = ?', args: [email, userId] });
    await db.execute({ sql: 'DELETE FROM login_attempts WHERE email = ?', args: [email] });
    await db.execute({ sql: 'DELETE FROM passkeys WHERE user_id = ?', args: [userId] });
    await db.execute({ sql: 'DELETE FROM sessions WHERE user_id = ?', args: [userId] });
    await db.execute({ sql: 'DELETE FROM crm_data WHERE user_id = ?', args: [userId] });
    await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [userId] });
    await db.execute('DELETE FROM ip_rate_limits');

    return NextResponse.json({
      success: true,
      message: `Utente ${email} eliminato da Turso. Ora puoi registrarti da zero!`,
      deletedUser: { id: userId, email }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Errore database' }, { status: 500 });
  }
}
