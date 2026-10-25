import { NextRequest, NextResponse } from 'next/server';
import { getServerDb } from '@/lib/serverDb';
import { COOKIE_NAME, cookieOptions, createSession, hashToken, publicUser } from '@/lib/serverAuth';
import { appOrigin } from '@/lib/serverMail';
export const dynamic = 'force-dynamic';

// GET is intentionally non-consuming: email security scanners must not activate or invalidate links.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  return NextResponse.redirect(appOrigin(req) + (token ? '/?verify=' + encodeURIComponent(token) : '/?notice=invalid'));
}
export async function POST(req: NextRequest) {
  try {
    const token = String((await req.json()).token || '');
    if (!token || token.length > 200) return NextResponse.json({ error: 'Link non valido.' }, { status: 400 });
    const db = await getServerDb();
    const tx = await db.transaction('write');
    let userId = '';
    try {
      const row = await tx.execute({ sql: 'SELECT t.user_id,t.used_at,t.expires_at,u.email_verified FROM auth_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ? AND t.purpose = ?', args: [hashToken(token), 'verify'] });
      if (!row.rows.length) { await tx.rollback(); return NextResponse.json({ error: 'Link non valido. Richiedi una nuova email.' }, { status: 400 }); }
      if (Number(row.rows[0].email_verified) === 1) { await tx.commit(); return NextResponse.json({ alreadyVerified: true, message: 'Email già verificata. Accedi con la tua password.' }); }
      if (row.rows[0].used_at || String(row.rows[0].expires_at) <= new Date().toISOString()) { await tx.rollback(); return NextResponse.json({ error: 'Link scaduto. Richiedi una nuova email.' }, { status: 400 }); }
      userId = String(row.rows[0].user_id);
      await tx.execute({ sql: 'UPDATE users SET email_verified = 1 WHERE id = ?', args: [userId] });
      await tx.execute({ sql: 'UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND purpose = ? AND used_at IS NULL', args: [new Date().toISOString(), userId, 'verify'] });
      await tx.commit();
    } catch (error) { await tx.rollback(); throw error; } finally { tx.close(); }
    const session = await createSession(userId);
    const response = NextResponse.json({ user: await publicUser(userId) });
    response.cookies.set(COOKIE_NAME, session, cookieOptions);
    return response;
  } catch { return NextResponse.json({ error: 'Verifica temporaneamente non disponibile. Il link non è stato perso: riprova.' }, { status: 503 }); }
}
