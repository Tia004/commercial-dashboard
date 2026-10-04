import { NextRequest, NextResponse } from 'next/server';
import { getServerDb } from '@/lib/serverDb';
import { createToken, hashPassword, hashToken } from '@/lib/serverAuth';
import { appOrigin, emailConfigured, sendAccountEmail } from '@/lib/serverMail';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = await getServerDb();
    if (body.action === 'request') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Email non valida.' }, { status: 400 });
      if (!emailConfigured()) return NextResponse.json({ error: 'Il servizio email non è configurato.' }, { status: 503 });
      const generic = { ok: true, message: 'Se l’indirizzo è registrato, riceverai un link per impostare una nuova password.' };
      const user = await db.execute({ sql: 'SELECT id, name, email_verified FROM users WHERE email = ?', args: [email] });
      if (!user.rows.length) return NextResponse.json(generic);

      const isVerified = Number(user.rows[0].email_verified) === 1;
      const userId = String(user.rows[0].id);
      const userName = String(user.rows[0].name || 'Utente');

      if (!isVerified) {
        const verificationToken = createToken();
        await db.execute({ sql: 'DELETE FROM auth_tokens WHERE user_id = ? AND purpose = ?', args: [userId, 'verify'] });
        await db.execute({ sql: 'INSERT INTO auth_tokens(token_hash,purpose,email,user_id,expires_at) VALUES (?,?,?,?,?)', args: [hashToken(verificationToken), 'verify', email, userId, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()] });
        try {
          const verifyUrl = `${appOrigin(req)}/api/auth/verify?token=${encodeURIComponent(verificationToken)}`;
          await sendAccountEmail(
            email,
            'Verifica il tuo indirizzo email · Hub Commerciale',
            `Ciao ${userName},\n\nil tuo account su Hub Commerciale non è ancora stato verificato.\n\nPer attivarlo ed entrare direttamente nel tuo workspace, apri questo link:\n\n${verifyUrl}\n\nIl link scade tra 24 ore.`,
            {
              kicker: 'ATTIVAZIONE WORKSPACE',
              title: 'Attiva il tuo account',
              intro: `Ciao ${userName},`,
              bodyText: 'Il tuo account su Hub Commerciale non era ancora stato verificato. Clicca sul pulsante qui sotto per attivarlo ed entrare direttamente nel tuo workspace.',
              actionUrl: verifyUrl,
              actionLabel: 'Attiva account ed entra →',
              expiryText: 'Il link scade tra 24 ore.'
            }
          );
        } catch (err: any) {
          const reason = err?.message ? ` (${err.message})` : '';
          return NextResponse.json({ error: `Invio email non riuscito: controlla la configurazione SMTP.${reason}` }, { status: 503 });
        }
        return NextResponse.json({ ok: true, message: 'L’account non era ancora verificato: ti abbiamo inviato un’email con il link per attivarlo ed entrare.' });
      }

      const recent = await db.execute({ sql: 'SELECT token_hash FROM auth_tokens WHERE purpose = ? AND email = ? AND used_at IS NULL AND expires_at > ?', args: ['reset', email, new Date().toISOString()] });
      if (recent.rows.length) return NextResponse.json(generic);
      const token = createToken();
      const tokenHash = hashToken(token);
      await db.execute({ sql: 'INSERT INTO auth_tokens(token_hash,purpose,email,user_id,expires_at) VALUES (?,?,?,?,?)', args: [tokenHash, 'reset', email, userId, new Date(Date.now() + 30 * 60 * 1000).toISOString()] });
      try {
        const resetUrl = `${appOrigin(req)}/?reset=${encodeURIComponent(token)}`;
        await sendAccountEmail(
          email,
          'Reimposta la password · Hub Commerciale',
          `Apri questo link per impostare una nuova password:\n\n${resetUrl}\n\nIl link scade tra 30 minuti. Se non hai richiesto il recupero, ignora questa email.`,
          {
            kicker: 'SICUREZZA ACCOUNT',
            title: 'Reimposta la tua password',
            intro: `Ciao ${userName},`,
            bodyText: 'Abbiamo ricevuto una richiesta di reimpostazione della password per il tuo account su Hub Commerciale. Clicca sul pulsante qui sotto per impostare subito una nuova password.',
            actionUrl: resetUrl,
            actionLabel: 'Reimposta password →',
            expiryText: 'Il link scade tra 30 minuti.',
            footnote: 'Se non hai richiesto il recupero della password, il tuo account è al sicuro e puoi ignorare questa email.'
          }
        );
      } catch (err: any) {
        await db.execute({ sql: 'DELETE FROM auth_tokens WHERE token_hash = ?', args: [tokenHash] });
        const reason = err?.message ? ` (${err.message})` : '';
        return NextResponse.json({ error: `Invio email non riuscito: controlla la configurazione SMTP.${reason}` }, { status: 503 });
      }
      return NextResponse.json(generic);
    }
    if (body.action === 'confirm') {
      const tokenHash = hashToken(String(body.token || ''));
      const password = String(body.password || '');
      if (password.length < 12 || password.length > 256) return NextResponse.json({ error: 'Usa una password di almeno 12 caratteri.' }, { status: 400 });
      const result = await db.execute({ sql: 'SELECT user_id FROM auth_tokens WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?', args: [tokenHash, 'reset', new Date().toISOString()] });
      if (!result.rows.length) return NextResponse.json({ error: 'Link non valido o scaduto.' }, { status: 400 });
      const userId = String(result.rows[0].user_id);
      const consumed = await db.execute({ sql: 'UPDATE auth_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL', args: [new Date().toISOString(), tokenHash] });
      if (!consumed.rowsAffected) return NextResponse.json({ error: 'Link già utilizzato.' }, { status: 400 });
      await db.execute({ sql: 'UPDATE users SET password_hash = ? WHERE id = ?', args: [hashPassword(password), userId] });
      await db.execute({ sql: 'DELETE FROM sessions WHERE user_id = ?', args: [userId] });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Azione non valida.' }, { status: 400 });
  } catch { return NextResponse.json({ error: 'Operazione non disponibile.' }, { status: 503 }); }
}
