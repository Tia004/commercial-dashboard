import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerDb, getClientIp, checkRateLimit } from '@/lib/serverDb';
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
      // 1. Anti-Bot Honeypot (if hidden field is filled, silently discard bot injection)
      if (body.hp_code) {
        return NextResponse.json({ pendingVerification: true, message: 'Account creato. Controlla la tua email per verificare l’account.' }, { status: 201 });
      }

      // 2. IP Rate Limiting (max 5 registrations per hour per IP address)
      const clientIp = getClientIp(req);
      const isAllowed = await checkRateLimit(db, clientIp, 'register', 5, 60);
      if (!isAllowed) {
        return NextResponse.json({ error: 'Troppi tentativi di registrazione da questo indirizzo IP. Riprova tra 1 ora.' }, { status: 429 });
      }


      const name = String(body.name || '').trim();
      if (!name || password.length < 8 || password.length > 256) return NextResponse.json({ error: 'Indica il nome e una password di almeno 8 caratteri.' }, { status: 400 });
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
      const existing = await db.execute({ sql: 'SELECT id, email_verified FROM users WHERE email = ?', args: [email] });
      if (existing.rows.length) {
        if (Number(existing.rows[0].email_verified) === 1) {
          return NextResponse.json({ error: 'Account già registrato con questa email. Clicca su "Accedi" per entrare.' }, { status: 409 });
        }
        // Account exists but is unverified: update details and resend verification email
        const existingUserId = String(existing.rows[0].id);
        await db.execute({
          sql: 'UPDATE users SET name = ?, password_hash = ?, company = ? WHERE id = ?',
          args: [name, hashPassword(password), String(body.company || '').trim(), existingUserId]
        });
        const verificationToken = createToken();
        await db.execute({ sql: 'INSERT INTO auth_tokens(token_hash,purpose,email,user_id,expires_at) VALUES (?,?,?,?,?)', args: [hashToken(verificationToken), 'verify', email, existingUserId, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()] });
        try {
          const verifyUrl = `${appOrigin(req)}/api/auth/verify?token=${encodeURIComponent(verificationToken)}`;
          await sendAccountEmail(
            email,
            'Verifica il tuo indirizzo email · Hub Commerciale',
            `Ciao ${name},\n\ngrazie per esserti registrato su Hub Commerciale!\n\nPer attivare il tuo account e accedere al workspace, apri questo link:\n\n${verifyUrl}\n\nIl link scade tra 24 ore.`,
            {
              title: 'Verifica il tuo indirizzo email',
              intro: `Ciao ${name},`,
              bodyText: 'Grazie per esserti registrato. Clicca sul pulsante qui sotto per confermare la tua email ed accedere al workspace.',
              actionUrl: verifyUrl,
              actionLabel: 'Verifica email',
              expiryText: 'Questo link scade tra 24 ore.'
            }
          );
        } catch (err: any) {
          await db.execute({ sql: 'DELETE FROM auth_tokens WHERE token_hash = ?', args: [hashToken(verificationToken)] });
          console.error('[AUTH EMAIL FAILED]', err);
          return NextResponse.json({ error: 'Invio email non riuscito. Riprova tra poco o contatta l’assistenza.' }, { status: 503 });
        }
        return NextResponse.json({ pendingVerification: true, message: 'Account aggiornato! Ti abbiamo inviato un’email di verifica: clicca sul link per attivarlo.' }, { status: 201 });
      }

      if (!emailConfigured()) {
        return NextResponse.json({ error: 'La verifica email non è ancora configurata. Contatta l’amministratore per inserire le credenziali SMTP.' }, { status: 503 });
      }

      if (!inviteToken) await db.execute({ sql: 'INSERT INTO workspaces(id,name,created_at) VALUES (?,?,?)', args: [workspaceId, String(body.company || name).trim(), new Date().toISOString()] });

      // Save user with email_verified = 0 (must confirm email before gaining access)
      await db.execute({ 
        sql: 'INSERT INTO users (id,email,name,company,role,password_hash,created_at,workspace_id,email_verified) VALUES (?,?,?,?,?,?,?,?,0)', 
        args: [userId, email, name, String(body.company || '').trim(), role, hashPassword(password), new Date().toISOString(), workspaceId] 
      });

      const verificationToken = createToken();
      await db.execute({ sql: 'INSERT INTO auth_tokens(token_hash,purpose,email,user_id,expires_at) VALUES (?,?,?,?,?)', args: [hashToken(verificationToken), 'verify', email, userId, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()] });
      if (inviteToken) await db.execute({ sql: 'UPDATE auth_tokens SET used_at = ? WHERE token_hash = ?', args: [new Date().toISOString(), hashToken(inviteToken)] });

      // Wait for provider acceptance before reporting success.
      try {
        const verifyUrl = `${appOrigin(req)}/api/auth/verify?token=${encodeURIComponent(verificationToken)}`;
        await sendAccountEmail(
          email,
          'Verifica il tuo indirizzo email · Hub Commerciale',
          `Ciao ${name},\n\ngrazie per esserti registrato su Hub Commerciale!\n\nPer attivare il tuo account e accedere al workspace, apri questo link:\n\n${verifyUrl}\n\nIl link scade tra 24 ore. Se non hai richiesto la creazione di questo account, ignora questo messaggio.`,
          {
            title: 'Verifica il tuo indirizzo email',
            intro: `Ciao ${name},`,
            bodyText: 'Grazie per esserti registrato su Hub Commerciale. Clicca sul pulsante qui sotto per confermare la tua email ed entrare direttamente nel tuo workspace.',
            actionUrl: verifyUrl,
            actionLabel: 'Verifica email',
            expiryText: 'Questo link scade tra 24 ore.'
          }
        );
      } catch (err: any) {
        // Rollback creation so unverified spam does not linger
        await db.execute({ sql: 'DELETE FROM auth_tokens WHERE user_id = ? AND purpose = ?', args: [userId, 'verify'] });
        await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [userId] });
        if (!inviteToken) await db.execute({ sql: 'DELETE FROM workspaces WHERE id = ?', args: [workspaceId] });
        if (inviteToken) await db.execute({ sql: 'UPDATE auth_tokens SET used_at = NULL WHERE token_hash = ?', args: [hashToken(inviteToken)] });
        console.error('[AUTH EMAIL FAILED]', err);
        return NextResponse.json({ error: 'Invio email non riuscito. Riprova tra poco o contatta l’assistenza.' }, { status: 503 });
      }

      return NextResponse.json({ pendingVerification: true, message: 'Account creato! Ti abbiamo inviato un’email di verifica: clicca sul link per attivarlo.' }, { status: 201 });
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
    if (Number(result.rows[0].email_verified) !== 1) {
      return NextResponse.json({ error: 'Verifica prima la tua email cliccando sul link ricevuto nella tua casella di posta.' }, { status: 403 });
    }
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
