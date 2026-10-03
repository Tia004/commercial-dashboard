import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { getServerDb } from './serverDb';

export const COOKIE_NAME = 'commercial_session';
export const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 14 };
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const createToken = () => randomBytes(32).toString('base64url');
export const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
};
export const verifyPassword = (password: string, stored: string) => {
  const [salt, expectedHex] = stored.split(':');
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(expected, actual);
};
export async function getSessionUser() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  const db = await getServerDb();
  const result = await db.execute({ sql: 'SELECT u.id, u.email, u.name, u.company, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?', args: [hashToken(token), new Date().toISOString()] });
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return { id: String(row.id), email: String(row.email), name: String(row.name), company: String(row.company || ''), role: String(row.role || 'Commerciale'), hasPasskey: false, passkeys: [] };
}
