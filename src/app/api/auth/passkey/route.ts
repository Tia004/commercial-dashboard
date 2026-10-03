import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';
import { getServerDb } from '@/lib/serverDb';
import { COOKIE_NAME, cookieOptions, createSession, getSessionUser, publicUser } from '@/lib/serverAuth';
import { appOrigin } from '@/lib/serverMail';

const rp = () => ({ rpID: new URL(appOrigin()).hostname, expectedOrigin: appOrigin() });
const challengeKey = (type: string, id: string) => type + ':' + id;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = await getServerDb();
    const { rpID, expectedOrigin } = rp();
    if (body.action === 'register-options') {
      const user = await getSessionUser();
      if (!user) return NextResponse.json({ error: 'Accedi prima di creare una passkey.' }, { status: 401 });
      const existing = await db.execute({ sql: 'SELECT id,transports FROM passkeys WHERE user_id = ?', args: [user.id] });
      const options = await generateRegistrationOptions({
        rpName: 'Hub Commerciale', rpID, userName: user.email, userDisplayName: user.name,
        userID: new TextEncoder().encode(user.id), attestationType: 'none',
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
        excludeCredentials: existing.rows.map((row) => ({ id: String(row.id), transports: JSON.parse(String(row.transports)) })),
      });
      await db.execute({ sql: 'INSERT INTO webauthn_challenges(key,challenge,expires_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET challenge=excluded.challenge,expires_at=excluded.expires_at', args: [challengeKey('reg', user.id), options.challenge, new Date(Date.now() + 5 * 60 * 1000).toISOString()] });
      return NextResponse.json({ options });
    }
    if (body.action === 'register-verify') {
      const user = await getSessionUser();
      if (!user) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 });
      const key = challengeKey('reg', user.id);
      const challenge = await db.execute({ sql: 'SELECT challenge FROM webauthn_challenges WHERE key = ? AND expires_at > ?', args: [key, new Date().toISOString()] });
      if (!challenge.rows.length) return NextResponse.json({ error: 'Richiesta scaduta. Riprova.' }, { status: 400 });
      const consumed = await db.execute({ sql: 'DELETE FROM webauthn_challenges WHERE key = ? AND expires_at > ?', args: [key, new Date().toISOString()] });
      if (!consumed.rowsAffected) return NextResponse.json({ error: 'Richiesta già utilizzata.' }, { status: 400 });
      const verified = await verifyRegistrationResponse({ response: body.response, expectedChallenge: String(challenge.rows[0].challenge), expectedOrigin, expectedRPID: rpID, requireUserVerification: true });
      if (!verified.verified || !verified.registrationInfo) return NextResponse.json({ error: 'Passkey non verificata.' }, { status: 400 });
      const { credential, credentialDeviceType, credentialBackedUp } = verified.registrationInfo;
      await db.execute({ sql: 'INSERT INTO passkeys(id,user_id,name,public_key,counter,transports,device_type,backed_up,created_at) VALUES (?,?,?,?,?,?,?,?,?)', args: [credential.id, user.id, String(body.name || 'Passkey').trim().slice(0, 64) || 'Passkey', Buffer.from(credential.publicKey).toString('base64url'), credential.counter, JSON.stringify(credential.transports || []), credentialDeviceType, credentialBackedUp ? 1 : 0, new Date().toISOString()] });
      return NextResponse.json({ ok: true, user: await publicUser(user.id) });
    }
    if (body.action === 'login-options') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) return NextResponse.json({ error: 'Inserisci prima la tua email.' }, { status: 400 });
      const result = await db.execute({ sql: 'SELECT id FROM users WHERE email = ? AND email_verified = 1', args: [email] });
      if (!result.rows.length) return NextResponse.json({ error: 'Nessuna passkey disponibile per questo account.' }, { status: 404 });
      const userId = String(result.rows[0].id);
      const keys = await db.execute({ sql: 'SELECT id,transports FROM passkeys WHERE user_id = ?', args: [userId] });
      if (!keys.rows.length) return NextResponse.json({ error: 'Nessuna passkey disponibile per questo account.' }, { status: 404 });
      const options = await generateAuthenticationOptions({ rpID, userVerification: 'required', allowCredentials: keys.rows.map((row) => ({ id: String(row.id), transports: JSON.parse(String(row.transports)) })) });
      await db.execute({ sql: 'INSERT INTO webauthn_challenges(key,challenge,expires_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET challenge=excluded.challenge,expires_at=excluded.expires_at', args: [challengeKey('auth', userId), options.challenge, new Date(Date.now() + 5 * 60 * 1000).toISOString()] });
      return NextResponse.json({ options });
    }
    if (body.action === 'login-verify') {
      const email = String(body.email || '').trim().toLowerCase();
      const result = await db.execute({ sql: 'SELECT id FROM users WHERE email = ? AND email_verified = 1', args: [email] });
      if (!result.rows.length) return NextResponse.json({ error: 'Passkey non valida.' }, { status: 401 });
      const userId = String(result.rows[0].id);
      const key = challengeKey('auth', userId);
      const challenge = await db.execute({ sql: 'SELECT challenge FROM webauthn_challenges WHERE key = ? AND expires_at > ?', args: [key, new Date().toISOString()] });
      if (!challenge.rows.length) return NextResponse.json({ error: 'Richiesta scaduta. Riprova.' }, { status: 400 });
      const consumed = await db.execute({ sql: 'DELETE FROM webauthn_challenges WHERE key = ? AND expires_at > ?', args: [key, new Date().toISOString()] });
      if (!consumed.rowsAffected) return NextResponse.json({ error: 'Richiesta già utilizzata.' }, { status: 400 });
      const credentialId = String(body.response?.id || '');
      const stored = await db.execute({ sql: 'SELECT id,public_key,counter,transports FROM passkeys WHERE id = ? AND user_id = ?', args: [credentialId, userId] });
      if (!stored.rows.length) return NextResponse.json({ error: 'Passkey non riconosciuta.' }, { status: 401 });
      const passkey = stored.rows[0];
      const verification = await verifyAuthenticationResponse({
        response: body.response, expectedChallenge: String(challenge.rows[0].challenge), expectedOrigin, expectedRPID: rpID, requireUserVerification: true,
        credential: { id: String(passkey.id), publicKey: new Uint8Array(Buffer.from(String(passkey.public_key), 'base64url')), counter: Number(passkey.counter), transports: JSON.parse(String(passkey.transports)) },
      });
      if (!verification.verified) return NextResponse.json({ error: 'Passkey non valida.' }, { status: 401 });
      await db.execute({ sql: 'UPDATE passkeys SET counter = ? WHERE id = ?', args: [verification.authenticationInfo.newCounter, credentialId] });
      const token = await createSession(userId);
      const response = NextResponse.json({ user: await publicUser(userId) });
      response.cookies.set(COOKIE_NAME, token, cookieOptions);
      return response;
    }
    return NextResponse.json({ error: 'Azione non valida.' }, { status: 400 });
  } catch { return NextResponse.json({ error: 'Passkey non verificata. Riprova sullo stesso dominio.' }, { status: 400 }); }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 });
    const body = await req.json();
    const db = await getServerDb();
    await db.execute({ sql: 'DELETE FROM passkeys WHERE id = ? AND user_id = ?', args: [String(body.id || ''), user.id] });
    return NextResponse.json({ ok: true, user: await publicUser(user.id) });
  } catch { return NextResponse.json({ error: 'Rimozione non riuscita.' }, { status: 503 }); }
}
