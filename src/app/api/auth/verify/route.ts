import { NextRequest, NextResponse } from 'next/server';
import { getServerDb } from '@/lib/serverDb';
import { COOKIE_NAME, cookieOptions, createSession, hashToken } from '@/lib/serverAuth';
import { appOrigin } from '@/lib/serverMail';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const origin = appOrigin(req);
  const destination = (status: string, sessionToken?: string) => {
    const res = NextResponse.redirect(`${origin}/?notice=${status}`);
    if (sessionToken) {
      res.cookies.set(COOKIE_NAME, sessionToken, cookieOptions);
    }
    return res;
  };
  try {
    const token = req.nextUrl.searchParams.get('token') || '';
    if (!token) return destination('invalid');
    const db = await getServerDb();
    const result = await db.execute({ sql: 'SELECT user_id FROM auth_tokens WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?', args: [hashToken(token), 'verify', new Date().toISOString()] });
    if (!result.rows.length) return destination('invalid');
    const userId = String(result.rows[0].user_id);
    const consumed = await db.execute({ sql: 'UPDATE auth_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL', args: [new Date().toISOString(), hashToken(token)] });
    if (!consumed.rowsAffected) return destination('invalid');
    await db.batch([
      { sql: 'UPDATE users SET email_verified = 1 WHERE id = ?', args: [userId] },
      { sql: 'UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND purpose = ? AND used_at IS NULL', args: [new Date().toISOString(), userId, 'verify'] },
    ], 'write');
    const sessionToken = await createSession(userId);
    return destination('verified', sessionToken);
  } catch { return destination('invalid'); }
}
