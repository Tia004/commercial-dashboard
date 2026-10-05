import { NextRequest, NextResponse } from 'next/server';
import { getServerDb } from '@/lib/serverDb';

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
  const email = (req.nextUrl.searchParams.get('email') || 'tiachinaglia@gmail.com').trim().toLowerCase();
  
  try {
    const db = await getServerDb();
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
