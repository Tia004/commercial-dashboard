import { NextRequest, NextResponse } from 'next/server';
import { getServerDb, getClientIp, checkRateLimit } from '@/lib/serverDb';
import { createToken, hashPassword, hashToken } from '@/lib/serverAuth';
import { appOrigin, emailConfigured, sendAccountEmail } from '@/lib/serverMail';

export const maxDuration = 60;
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = await getServerDb();
    if (body.action === 'request') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Email non valida.' }, { status: 400 });
      if (!emailConfigured()) return NextResponse.json({ error: 'Il servizio email non è configurato.' }, { status: 503 });

      const clientIp = getClientIp(req);
      const isAllowed = await checkRateLimit(db, clientIp, 'reset-request', 10, 15);
      if (!isAllowed) {
        return NextResponse.json({ error: 'Troppe richieste di recupero. Attendi qualche minuto prima di riprovare.' }, { status: 429 });
      }

      const generic = { ok: true, message: 'Se l’indirizzo è registrato, riceverai il link per recuperare l’accesso. Controlla anche la cartella Spam.' };
      const user = await db.execute({ sql: 'SELECT id, name, email, email_verified FROM users WHERE LOWER(email) = LOWER(?)', args: [email] });
      if (!user.rows.length) return NextResponse.json(generic);

      const isVerified = Number(user.rows[0].email_verified) === 1;
      const userId = String(user.rows[0].id);
      const targetEmail = String(user.rows[0].email || email).toLowerCase();
      const userName = String(user.rows[0].name || 'Utente');

      if (!isVerified) {
        const verificationToken = createToken();
        await db.execute({ sql: 'INSERT INTO auth_tokens(token_hash,purpose,email,user_id,expires_at) VALUES (?,?,?,?,?)', args: [hashToken(verificationToken), 'verify', targetEmail, userId, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()] });
        try {
          const verifyUrl = `${appOrigin(req)}/api/auth/verify?token=${encodeURIComponent(verificationToken)}`;
          await sendAccountEmail(
            targetEmail,
            'Verifica il tuo indirizzo email · Hub Commerciale',
            `Ciao ${userName},\n\nil tuo account su Hub Commerciale non è ancora stato verificato.\n\nPer attivarlo ed entrare direttamente nel tuo workspace, apri questo link:\n\n${verifyUrl}\n\nIl link scade tra 24 ore.`,
            {
              title: 'Attiva il tuo account',
              intro: `Ciao ${userName},`,
              bodyText: 'Il tuo account non è ancora stato verificato. Clicca sul pulsante qui sotto per attivarlo ed entrare direttamente nel tuo workspace.',
              actionUrl: verifyUrl,
              actionLabel: 'Attiva account',
              expiryText: 'Questo link scade tra 24 ore.'
            }
          );
        } catch (err: any) {
          await db.execute({ sql: 'DELETE FROM auth_tokens WHERE token_hash = ?', args: [hashToken(verificationToken)] });
          console.error('[AUTH EMAIL FAILED]', err);
          return NextResponse.json({ error: 'Invio email non riuscito. Riprova tra poco o contatta l’assistenza.' }, { status: 503 });
        }
        return NextResponse.json({ ok: true, message: 'L’account non era ancora verificato: ti abbiamo inviato un’email con il link per attivarlo ed entrare.' });
      }

      // Invalidate any previous unconsumed reset tokens for this user so a new email can be requested anytime
      await db.execute({ sql: 'DELETE FROM auth_tokens WHERE purpose = ? AND (LOWER(email) = LOWER(?) OR user_id = ?)', args: ['reset', targetEmail, userId] });

      const token = createToken();
      const tokenHash = hashToken(token);
      await db.execute({ sql: 'INSERT INTO auth_tokens(token_hash,purpose,email,user_id,expires_at) VALUES (?,?,?,?,?)', args: [tokenHash, 'reset', targetEmail, userId, new Date(Date.now() + 60 * 60 * 1000).toISOString()] });
      try {
        const resetUrl = `${appOrigin(req)}/?reset=${encodeURIComponent(token)}`;
        await sendAccountEmail(
          targetEmail,
          'Reimposta la password · Hub Commerciale',
          `Apri questo link per impostare una nuova password:\n\n${resetUrl}\n\nIl link scade tra 60 minuti. Se non hai richiesto il recupero, ignora questa email.`,
          {
            title: 'Reimposta la tua password',
            intro: `Ciao ${userName},`,
            bodyText: 'Abbiamo ricevuto una richiesta per reimpostare la password del tuo account. Clicca sul pulsante qui sotto per sceglierne una nuova.',
            actionUrl: resetUrl,
            actionLabel: 'Reimposta password',
            expiryText: 'Questo link scade tra 60 minuti.',
            footnote: 'Se non hai richiesto tu il ripristino della password, puoi ignorare questo messaggio: il tuo account rimane protetto.'
          }
        );
      } catch (err: any) {
        await db.execute({ sql: 'DELETE FROM auth_tokens WHERE token_hash = ?', args: [tokenHash] });
        return NextResponse.json({ error: 'Invio email non riuscito. Riprova o contatta l’amministratore.' }, { status: 503 });
      }
      return NextResponse.json(generic);
    }
    if (body.action === 'confirm') {
      const tokenHash = hashToken(String(body.token || ''));
      const password = String(body.password || '');
      if (password.length < 8 || password.length > 256) return NextResponse.json({ error: 'Usa una password di almeno 8 caratteri.' }, { status: 400 });
      const passwordHash = hashPassword(password);
      const tx = await db.transaction('write');
      try {
        const result = await tx.execute({ sql: 'SELECT user_id FROM auth_tokens WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?', args: [tokenHash, 'reset', new Date().toISOString()] });
        if (!result.rows.length) { await tx.rollback(); return NextResponse.json({ error: 'Link non valido o scaduto.' }, { status: 400 }); }
        const userId = String(result.rows[0].user_id);
        await tx.execute({ sql: 'UPDATE users SET password_hash = ?, email_verified = 1 WHERE id = ?', args: [passwordHash,userId] });
        await tx.execute({ sql: 'UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND purpose IN (?,?) AND used_at IS NULL', args: [new Date().toISOString(),userId,'reset','verify'] });
        await tx.execute({ sql: 'DELETE FROM sessions WHERE user_id = ?', args: [userId] });
        await tx.commit();
      } catch (error) { await tx.rollback(); throw error; } finally { tx.close(); }
      return NextResponse.json({ ok: true, message: 'Password aggiornata con successo! Ora puoi accedere.' });
    }
    return NextResponse.json({ error: 'Azione non valida.' }, { status: 400 });
  } catch { return NextResponse.json({ error: 'Operazione non disponibile.' }, { status: 503 }); }
}
