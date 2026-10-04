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
      const user = await db.execute({ sql: 'SELECT id FROM users WHERE email = ? AND email_verified = 1', args: [email] });
      if (!user.rows.length) return NextResponse.json(generic);
      const recent = await db.execute({ sql: 'SELECT token_hash FROM auth_tokens WHERE purpose = ? AND email = ? AND used_at IS NULL AND expires_at > ?', args: ['reset', email, new Date().toISOString()] });
      if (recent.rows.length) return NextResponse.json(generic);
      const token = createToken();
      const tokenHash = hashToken(token);
      await db.execute({ sql: 'INSERT INTO auth_tokens(token_hash,purpose,email,user_id,expires_at) VALUES (?,?,?,?,?)', args: [tokenHash, 'reset', email, String(user.rows[0].id), new Date(Date.now() + 30 * 60 * 1000).toISOString()] });
      try {
        await sendAccountEmail(email, 'Reimposta la password · Hub Commerciale', 'Apri questo link per impostare una nuova password:\n\n' + appOrigin(req) + '/?reset=' + encodeURIComponent(token) + '\n\nIl link scade tra 30 minuti. Se non hai richiesto il recupero, ignora questa email.');
      } catch (err: any) {
        await db.execute({ sql: 'DELETE FROM auth_tokens WHERE token_hash = ?', args: [tokenHash] });
        return NextResponse.json({ error: `Invio email non riuscito${err?.message ? `: ${err.message}` : ''}` }, { status: 503 });
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
