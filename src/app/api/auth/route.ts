import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerDb } from '@/lib/serverDb';
import { COOKIE_NAME, cookieOptions, createSession, createToken, getSessionUser, hashPassword, hashToken, publicUser, verifyPassword } from '@/lib/serverAuth';
import { appOrigin, emailConfigured, sendAccountEmail } from '@/lib/serverMail';

export async function GET() {
  try { return NextResponse.json({ user: await getSessionUser() }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return NextResponse.json({ user: null, error: 'Database non configurato' }, { status: 503 }); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) return NextResponse.json({ error: 'Inserisci email e password valide.' }, { status: 400 });
    const db = await getServerDb();
    if (body.action === 'register') {
      if (!emailConfigured()) return NextResponse.json({ error: 'La verifica email non è ancora configurata. Contatta l’amministratore.' }, { status: 503 });
      const name = String(body.name || '').trim();
      if (!name || password.length < 12 || password.length > 256) return NextResponse.json({ error: 'Indica il nome e una password di almeno 12 caratteri.' }, { status: 400 });
      const userId = crypto.randomUUID();
      let workspaceId = userId;
      let role = 'owner';
      const inviteToken = String(body.inviteToken || '');
      if (inviteToken) {
        const invite = await db.execute({ sql: 'SELECT email,workspace_id,role FROM auth_tokens WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?', args: [hashToken(inviteToken), 'invite', new Date().toISOString()] });
        if (!invite.rows.length || String(invite.rows[0].email) !== email) return NextResponse.json({ error: 'Invito non valido o scaduto.' }, { status: 400 });
        workspaceId = String(invite.rows[0].workspace_id);
        role = String(invite.rows[0].role);
      }
      const existing = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] });
      if (existing.rows.length) return NextResponse.json({ error: 'Account già presente per questa email.' }, { status: 409 });
      if (!inviteToken) await db.execute({ sql: 'INSERT INTO workspaces(id,name,created_at) VALUES (?,?,?)', args: [workspaceId, String(body.company || name).trim(), new Date().toISOString()] });
      await db.execute({ sql: 'INSERT INTO users (id,email,name,company,role,password_hash,created_at,workspace_id,email_verified) VALUES (?,?,?,?,?,?,?,?,0)', args: [userId, email, name, String(body.company || '').trim(), role, hashPassword(password), new Date().toISOString(), workspaceId] });
      const verificationToken = createToken();
      await db.execute({ sql: 'INSERT INTO auth_tokens(token_hash,purpose,email,user_id,expires_at) VALUES (?,?,?,?,?)', args: [hashToken(verificationToken), 'verify', email, userId, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()] });
      if (inviteToken) await db.execute({ sql: 'UPDATE auth_tokens SET used_at = ? WHERE token_hash = ?', args: [new Date().toISOString(), hashToken(inviteToken)] });
      try {
        await sendAccountEmail(email, 'Verifica il tuo indirizzo email · Hub Commerciale', 'Apri questo link per verificare il tuo account:\n\n' + appOrigin(req) + '/api/auth/verify?token=' + encodeURIComponent(verificationToken) + '\n\nIl link scade tra 24 ore. Se non hai richiesto l’account, ignora questa email.');
      } catch (err: any) {
        await db.execute({ sql: 'DELETE FROM auth_tokens WHERE user_id = ? AND purpose = ?', args: [userId, 'verify'] });
        await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [userId] });
        if (!inviteToken) await db.execute({ sql: 'DELETE FROM workspaces WHERE id = ?', args: [workspaceId] });
        if (inviteToken) await db.execute({ sql: 'UPDATE auth_tokens SET used_at = NULL WHERE token_hash = ?', args: [hashToken(inviteToken)] });
        const reason = err?.message ? ` (${err.message})` : '';
        return NextResponse.json({ error: `Invio email non riuscito: controlla la configurazione SMTP.${reason}` }, { status: 503 });
      }
      return NextResponse.json({ pendingVerification: true, message: 'Account creato. Apri l’email di verifica per attivarlo.' }, { status: 201 });
    }
    if (body.action !== 'login') return NextResponse.json({ error: 'Azione non valida.' }, { status: 400 });
    const attempt = await db.execute({ sql: 'SELECT failures, window_started_at FROM login_attempts WHERE email = ?', args: [email] });
    const existing = attempt.rows[0];
    const windowActive = existing && Date.now() - Date.parse(String(existing.window_started_at)) < 15 * 60 * 1000;
    if (windowActive && Number(existing.failures) >= 10) return NextResponse.json({ error: 'Troppi tentativi. Riprova tra 15 minuti.' }, { status: 429 });
    const result = await db.execute({ sql: 'SELECT id,password_hash,email_verified FROM users WHERE email = ?', args: [email] });
    if (!result.rows.length || !verifyPassword(password, String(result.rows[0].password_hash))) {
      await db.execute({ sql: 'INSERT INTO login_attempts(email,failures,window_started_at) VALUES (?,?,?) ON CONFLICT(email) DO UPDATE SET failures = ?, window_started_at = ?', args: [email, 1, new Date().toISOString(), windowActive ? Number(existing.failures) + 1 : 1, windowActive ? String(existing.window_started_at) : new Date().toISOString()] });
      return NextResponse.json({ error: 'Email o password non corretti.' }, { status: 401 });
    }
    if (Number(result.rows[0].email_verified) !== 1) return NextResponse.json({ error: 'Verifica l’indirizzo email prima di accedere.' }, { status: 403 });
    await db.execute({ sql: 'DELETE FROM login_attempts WHERE email = ?', args: [email] });
    const userId = String(result.rows[0].id);
    const token = await createSession(userId);
    const response = NextResponse.json({ user: await publicUser(userId) });
    response.cookies.set(COOKIE_NAME, token, cookieOptions);
    return response;
  } catch { return NextResponse.json({ error: 'Accesso temporaneamente non disponibile. Verifica la configurazione del database.' }, { status: 503 }); }
}

export async function DELETE() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (token) { try { const db = await getServerDb(); await db.execute({ sql: 'DELETE FROM sessions WHERE token_hash = ?', args: [hashToken(token)] }); } catch {} }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, '', { ...cookieOptions, maxAge: 0 });
  return response;
}
