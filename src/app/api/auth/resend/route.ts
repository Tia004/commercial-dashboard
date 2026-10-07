import { NextRequest, NextResponse } from 'next/server';
import { getServerDb, getClientIp, checkRateLimit } from '@/lib/serverDb';
import { createToken, hashToken } from '@/lib/serverAuth';
import { appOrigin, emailConfigured, sendAccountEmail } from '@/lib/serverMail';

export async function POST(req: NextRequest) {
  try {
    const email = String((await req.json()).email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Email non valida.' }, { status: 400 });
    if (!emailConfigured()) return NextResponse.json({ error: 'Servizio email non configurato.' }, { status: 503 });
    const generic = { ok: true, message: 'Se l’indirizzo corrisponde a un account da verificare, l’email è stata inviata. Controlla anche la cartella Spam.' };
    const db = await getServerDb();
    const clientIp = getClientIp(req);
    const isAllowed = await checkRateLimit(db, clientIp, 'resend', 5, 60);
    if (!isAllowed) return NextResponse.json({ error: 'Troppe richieste di invio. Riprova più tardi.' }, { status: 429 });
    const user = await db.execute({ sql: 'SELECT id, email_verified FROM users WHERE email = ?', args: [email] });
    if (!user.rows.length) return NextResponse.json(generic);
    if (Number(user.rows[0].email_verified) === 1) {
      return NextResponse.json({ ok: true, message: 'La tua email risulta già verificata! Puoi accedere direttamente inserendo la tua password.' });
    }
    const userId = String(user.rows[0].id);
    const token = createToken();
    const tokenHash = hashToken(token);
    await db.execute({ sql: 'INSERT INTO auth_tokens(token_hash,purpose,email,user_id,expires_at) VALUES (?,?,?,?,?)', args: [tokenHash, 'verify', email, userId, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()] });
    try {
      const verifyUrl = `${appOrigin(req)}/api/auth/verify?token=${encodeURIComponent(token)}`;
      await sendAccountEmail(
        email,
        'Verifica il tuo indirizzo email · Hub Commerciale',
        `Apri questo link per verificare il tuo account:\n\n${verifyUrl}\n\nIl link scade tra 24 ore.`,
        {
          title: 'Verifica il tuo indirizzo email',
          bodyText: 'Clicca sul pulsante qui sotto per confermare il tuo indirizzo email ed accedere al workspace commerciale.',
          actionUrl: verifyUrl,
          actionLabel: 'Verifica email',
          expiryText: 'Questo link scade tra 24 ore.'
        }
      );
    } catch (err) {
      console.error('[AUTH EMAIL FAILED]', err);
      await db.execute({ sql: 'DELETE FROM auth_tokens WHERE token_hash = ?', args: [tokenHash] });
      return NextResponse.json({ error: 'Invio email non riuscito. Riprova tra poco o contatta l’assistenza.' }, { status: 503 });
    }
    return NextResponse.json(generic);
  } catch { return NextResponse.json({ error: 'Operazione non disponibile.' }, { status: 503 }); }
}
