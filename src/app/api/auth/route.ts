import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerDb } from '@/lib/serverDb';
import { COOKIE_NAME, cookieOptions, createToken, getSessionUser, hashPassword, hashToken, verifyPassword } from '@/lib/serverAuth';

export async function GET() {
  try { return NextResponse.json({ user: await getSessionUser() }); }
  catch { return NextResponse.json({ user: null, error: 'Database non configurato' }, { status: 503 }); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) return NextResponse.json({ error: 'Inserisci email e password valide.' }, { status: 400 });
    const db = await getServerDb();
    let userId: string;
    if (body.action === 'register') {
      const name = String(body.name || '').trim();
      if (!name || password.length < 12 || password.length > 256) return NextResponse.json({ error: 'Indica il nome e una password di almeno 12 caratteri.' }, { status: 400 });
      userId = crypto.randomUUID();
      try {
        await db.execute({ sql: 'INSERT INTO users (id,email,name,company,role,password_hash,created_at) VALUES (?,?,?,?,?,?,?)', args: [userId, email, name, String(body.company || '').trim(), 'Commerciale', hashPassword(password), new Date().toISOString()] });
      } catch { return NextResponse.json({ error: 'Account già presente per questa email.' }, { status: 409 }); }
    } else if (body.action === 'login') {
      const attempt = await db.execute({ sql: 'SELECT failures, window_started_at FROM login_attempts WHERE email = ?', args: [email] });
      const existing = attempt.rows[0];
      const windowActive = existing && Date.now() - Date.parse(String(existing.window_started_at)) < 15 * 60 * 1000;
      if (windowActive && Number(existing.failures) >= 10) return NextResponse.json({ error: 'Troppi tentativi. Riprova tra 15 minuti.' }, { status: 429 });
      const result = await db.execute({ sql: 'SELECT id, password_hash FROM users WHERE email = ?', args: [email] });
      if (!result.rows.length || !verifyPassword(password, String(result.rows[0].password_hash))) {
        await db.execute({ sql: 'INSERT INTO login_attempts(email,failures,window_started_at) VALUES (?,?,?) ON CONFLICT(email) DO UPDATE SET failures = ?, window_started_at = ?', args: [email, 1, new Date().toISOString(), windowActive ? Number(existing.failures) + 1 : 1, windowActive ? String(existing.window_started_at) : new Date().toISOString()] });
        return NextResponse.json({ error: 'Email o password non corretti.' }, { status: 401 });
      }
      await db.execute({ sql: 'DELETE FROM login_attempts WHERE email = ?', args: [email] });
      userId = String(result.rows[0].id);
    } else return NextResponse.json({ error: 'Azione non valida.' }, { status: 400 });
    const token = createToken();
    await db.execute({ sql: 'INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)', args: [hashToken(token), userId, new Date(Date.now() + cookieOptions.maxAge * 1000).toISOString()] });
    const user = await db.execute({ sql: 'SELECT id,email,name,company,role FROM users WHERE id = ?', args: [userId] });
    const row = user.rows[0];
    const response = NextResponse.json({ user: { id: String(row.id), email: String(row.email), name: String(row.name), company: String(row.company || ''), role: String(row.role), hasPasskey: false, passkeys: [] } });
    response.cookies.set(COOKIE_NAME, token, cookieOptions);
    return response;
  } catch { return NextResponse.json({ error: 'Accesso temporaneamente non disponibile. Verifica la configurazione del database.' }, { status: 503 }); }
}

export async function DELETE() {
  const token = cookiesToken();
  if (token) { try { const db = await getServerDb(); await db.execute({ sql: 'DELETE FROM sessions WHERE token_hash = ?', args: [hashToken(token)] }); } catch {} }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, '', { ...cookieOptions, maxAge: 0 });
  return response;
}

function cookiesToken() { return cookies().get(COOKIE_NAME)?.value; }
