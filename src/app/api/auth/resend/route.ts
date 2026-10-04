import { NextRequest, NextResponse } from 'next/server';
import { getServerDb } from '@/lib/serverDb';
import { createToken, hashToken } from '@/lib/serverAuth';
import { appOrigin, emailConfigured, sendAccountEmail } from '@/lib/serverMail';

export async function POST(req: NextRequest) {
  try {
    const email = String((await req.json()).email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Email non valida.' }, { status: 400 });
    if (!emailConfigured()) return NextResponse.json({ error: 'Servizio email non configurato.' }, { status: 503 });
    const generic = { ok: true, message: 'Se l’account deve essere verificato, riceverai un nuovo link.' };
    const db = await getServerDb();
    const user = await db.execute({ sql: 'SELECT id FROM users WHERE email = ? AND email_verified = 0', args: [email] });
    if (!user.rows.length) return NextResponse.json(generic);
    const userId = String(user.rows[0].id);
    const recent = await db.execute({ sql: 'SELECT token_hash FROM auth_tokens WHERE user_id = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?', args: [userId, 'verify', new Date(Date.now() + 23 * 60 * 60 * 1000 + 55 * 60 * 1000).toISOString()] });
    if (recent.rows.length) return NextResponse.json(generic);
    const token = createToken();
    const tokenHash = hashToken(token);
    await db.execute({ sql: 'INSERT INTO auth_tokens(token_hash,purpose,email,user_id,expires_at) VALUES (?,?,?,?,?)', args: [tokenHash, 'verify', email, userId, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()] });
    try { await sendAccountEmail(email, 'Verifica il tuo indirizzo email · Hub Commerciale', 'Apri questo link per verificare il tuo account:\n\n' + appOrigin(req) + '/api/auth/verify?token=' + encodeURIComponent(token) + '\n\nIl link scade tra 24 ore.'); }
    catch (err: any) { await db.execute({ sql: 'DELETE FROM auth_tokens WHERE token_hash = ?', args: [tokenHash] }); return NextResponse.json({ error: `Invio email non riuscito${err?.message ? `: ${err.message}` : ''}` }, { status: 503 }); }
    await db.execute({ sql: 'UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND purpose = ? AND token_hash != ? AND used_at IS NULL', args: [new Date().toISOString(), userId, 'verify', tokenHash] });
    return NextResponse.json(generic);
  } catch { return NextResponse.json({ error: 'Operazione non disponibile.' }, { status: 503 }); }
}
