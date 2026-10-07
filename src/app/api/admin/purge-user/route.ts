import { NextRequest, NextResponse } from 'next/server';
import { getServerDb } from '@/lib/serverDb';
import { createToken, hashToken } from '@/lib/serverAuth';
import { appOrigin, sendAccountEmail } from '@/lib/serverMail';
import nodemailer from 'nodemailer';

function cleanEnv(val?: string): string {
  if (!val) return '';
  return val.trim().replace(/^["']|["']$/g, '').trim();
}

async function purgeUserByEmail(email: string) {
  const db = await getServerDb();
  const existing = await db.execute({
    sql: 'SELECT id, email, name FROM users WHERE email = ?',
    args: [email]
  });

  if (!existing.rows.length) {
    return { found: false, message: `Nessun utente trovato con email ${email}.` };
  }

  const userId = String(existing.rows[0].id);

  await db.execute({ sql: 'DELETE FROM auth_tokens WHERE email = ? OR user_id = ?', args: [email, userId] });
  await db.execute({ sql: 'DELETE FROM login_attempts WHERE email = ?', args: [email] });
  await db.execute({ sql: 'DELETE FROM passkeys WHERE user_id = ?', args: [userId] });
  await db.execute({ sql: 'DELETE FROM sessions WHERE user_id = ?', args: [userId] });
  await db.execute({ sql: 'DELETE FROM crm_data WHERE user_id = ?', args: [userId] });
  await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [userId] });
  await db.execute('DELETE FROM ip_rate_limits');

  return {
    found: true,
    deletedUser: { id: userId, email },
    message: `Utente ${email} rimosso con successo dal database (tokens, sessioni, rate limits azzerati).`
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const secret = String(body.secret || req.nextUrl.searchParams.get('secret') || '');

    if (secret !== 'purge_tia_commercial_2026') {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const action = String(body.action || req.nextUrl.searchParams.get('action') || 'delete');
    const email = String(body.email || req.nextUrl.searchParams.get('email') || 'tiachinaglia@gmail.com').trim().toLowerCase();

    if (action === 'send-all-verifications' || action === 'fix-and-verify-unverified') {
      return await handleSendAllVerifications(req);
    }

    const result = await purgeUserByEmail(email);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Errore durante la rimozione.' }, { status: 500 });
  }
}

async function handleSendAllVerifications(req: NextRequest) {
  const db = await getServerDb();
  const origin = appOrigin(req);

  // 1. Strictly enforce verification rules requested by the user:
  // - info@tiadesigns.it and tiachinaglia@gmail.com are the ONLY verified accounts
  // - All other accounts are unverified (email_verified = 0)
  await db.execute(`
    UPDATE users
    SET email_verified = 1
    WHERE LOWER(TRIM(email)) IN ('info@tiadesigns.it', 'tiachinaglia@gmail.com')
  `);

  await db.execute(`
    UPDATE users
    SET email_verified = 0
    WHERE LOWER(TRIM(email)) NOT IN ('info@tiadesigns.it', 'tiachinaglia@gmail.com')
  `);

  // 2. Fetch updated state
  const allUsers = await db.execute('SELECT id, email, name, email_verified FROM users ORDER BY created_at ASC');

  const verifiedAccounts: Array<{ email: string; name: string }> = [];
  const unverifiedAccounts: Array<{ id: string; email: string; name: string }> = [];

  for (const row of allUsers.rows) {
    const uEmail = String(row.email).trim().toLowerCase();
    const uName = String(row.name || 'Utente');
    const uId = String(row.id);
    if (Number(row.email_verified) === 1) {
      verifiedAccounts.push({ email: uEmail, name: uName });
    } else {
      unverifiedAccounts.push({ id: uId, email: uEmail, name: uName });
    }
  }

  // 3. For all unverified accounts, generate a fresh verification token and dispatch the verification email
  const results: Array<{
    email: string;
    name: string;
    ok: boolean;
    provider?: string;
    verifyUrl?: string;
    error?: string;
  }> = [];

  for (const user of unverifiedAccounts) {
    const targetEmail = user.email;
    const targetName = user.name;
    const userId = user.id;

    // Remove any previous unused verify tokens for this user
    await db.execute({
      sql: "DELETE FROM auth_tokens WHERE purpose = 'verify' AND (email = ? OR user_id = ?)",
      args: [targetEmail, userId]
    }).catch(() => {});

    const token = createToken();
    const tokenHash = hashToken(token);

    try {
      // Create new 24h verification token
      await db.execute({
        sql: 'INSERT INTO auth_tokens(token_hash, purpose, email, user_id, expires_at) VALUES (?, ?, ?, ?, ?)',
        args: [tokenHash, 'verify', targetEmail, userId, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()]
      });

      const verifyUrl = `${origin}/api/auth/verify?token=${encodeURIComponent(token)}`;

      const sendRes = await sendAccountEmail(
        targetEmail,
        'Verifica il tuo indirizzo email · Hub Commerciale',
        `Apri questo link per verificare il tuo account:\n\n${verifyUrl}\n\nIl link scade tra 24 ore.`,
        {
          title: 'Verifica il tuo account',
          intro: `Ciao ${targetName}, benvenuto in Hub Commerciale.`,
          bodyText: 'Clicca sul pulsante per verificare il tuo account e sbloccare immediatamente l’accesso completo al workspace commerciale.',
          actionUrl: verifyUrl,
          actionLabel: 'Verifica email ed entra',
          expiryText: 'Questo link scade tra 24 ore.'
        }
      );

      results.push({
        email: targetEmail,
        name: targetName,
        ok: true,
        provider: sendRes?.provider || 'sent',
        verifyUrl
      });
    } catch (err: any) {
      await db.execute({ sql: 'DELETE FROM auth_tokens WHERE token_hash = ?', args: [tokenHash] }).catch(() => {});
      results.push({
        email: targetEmail,
        name: targetName,
        ok: false,
        error: err?.message || String(err)
      });
    }
  }

  return NextResponse.json({
    success: true,
    totalAccounts: allUsers.rows.length,
    verifiedAccounts: verifiedAccounts.map(a => a.email),
    unverifiedAccountsCount: unverifiedAccounts.length,
    dispatchedEmails: results
  });
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret') || '';
  if (secret !== 'purge_tia_commercial_2026') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  const action = req.nextUrl.searchParams.get('action') || 'inspect';
  const email = (req.nextUrl.searchParams.get('email') || 'tiachinaglia@gmail.com').trim().toLowerCase();

  try {
    const db = await getServerDb();

    if (action === 'inspect') {
      const users = await db.execute('SELECT id, email, name, email_verified, created_at FROM users');
      const tokens = await db.execute('SELECT token_hash, purpose, email, expires_at, used_at FROM auth_tokens');
      const resendKey = cleanEnv(process.env.RESEND_API_KEY);
      const brevoKey = cleanEnv(process.env.BREVO_API_KEY);
      const smtpPass = cleanEnv(process.env.SMTP_PASSWORD || process.env.SMTP_PASS);

      return NextResponse.json({
        users: users.rows,
        tokens: tokens.rows,
        mailConfig: {
          hasResend: !!resendKey,
          resendKeyPrefix: resendKey ? `${resendKey.slice(0, 5)}... (len ${resendKey.length})` : 'none',
          resendFromEnv: cleanEnv(process.env.RESEND_FROM) || 'none',
          hasBrevoEnv: !!brevoKey,
          smtpPassPrefix: smtpPass ? `${smtpPass.slice(0, 8)}... (len ${smtpPass.length})` : 'none',
          smtpUser: (process.env.SMTP_USER || '').trim(),
          smtpFrom: (process.env.SMTP_FROM || '').trim(),
          smtpHost: (process.env.SMTP_HOST || '').trim(),
        }
      });
    }

    if (action === 'diagnose') {
      const origin = appOrigin(req);
      const testTo = email;
      const resendKey = cleanEnv(process.env.RESEND_API_KEY);
      const smtpPass = cleanEnv(process.env.SMTP_PASSWORD || process.env.SMTP_PASS);
      const brevoKey = cleanEnv(process.env.BREVO_API_KEY) || (smtpPass.startsWith('xkeysib-') ? smtpPass : '');
      const host = cleanEnv(process.env.SMTP_HOST);
      const port = Number(cleanEnv(process.env.SMTP_PORT) || 587);
      const user = cleanEnv(process.env.SMTP_USER);

      const diagnostics: any = {
        testRecipient: testTo,
        origin,
        timestamp: new Date().toISOString(),
      };

      // 1. Raw Resend API Test
      if (resendKey) {
        const start = Date.now();
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: cleanEnv(process.env.RESEND_FROM) || 'Hub Commerciale <onboarding@resend.dev>',
              to: [testTo],
              subject: 'Diagnostic Resend · Hub Commerciale',
              text: 'Test invio istantaneo Resend API.',
            }),
            signal: AbortSignal.timeout(6000),
          });
          const text = await res.text();
          let emailId = '';
          try { emailId = JSON.parse(text)?.id || ''; } catch {}

          let emailDetails: any = null;
          if (emailId) {
            try {
              const detailsRes = await fetch(`https://api.resend.com/emails/${emailId}`, {
                headers: { 'Authorization': `Bearer ${resendKey}` }
              });
              emailDetails = await detailsRes.json();
            } catch (err: any) {
              emailDetails = { error: err?.message };
            }
          }

          let domains: any = null;
          try {
            const domRes = await fetch('https://api.resend.com/domains', {
              headers: { 'Authorization': `Bearer ${resendKey}` }
            });
            domains = await domRes.json();
          } catch (err: any) {
            domains = { error: err?.message };
          }

          diagnostics.resend = {
            durationMs: Date.now() - start,
            status: res.status,
            ok: res.ok,
            response: text.slice(0, 500),
            emailDetails,
            domains
          };
        } catch (e: any) {
          diagnostics.resend = {
            durationMs: Date.now() - start,
            ok: false,
            error: e?.message || String(e)
          };
        }
      } else {
        diagnostics.resend = { skipped: 'RESEND_API_KEY missing' };
      }

      // 2. Raw Brevo REST API Test
      if (brevoKey) {
        const start = Date.now();
        try {
          const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'accept': 'application/json',
              'content-type': 'application/json',
              'api-key': brevoKey,
            },
            body: JSON.stringify({
              sender: { name: 'Hub Commerciale', email: 'tiachinaglia@gmail.com' },
              to: [{ email: testTo }],
              subject: 'Diagnostic Brevo REST · Hub Commerciale',
              textContent: 'Test invio istantaneo Brevo REST API v3.',
            }),
            signal: AbortSignal.timeout(6000),
          });
          const text = await res.text();
          diagnostics.brevo = {
            durationMs: Date.now() - start,
            status: res.status,
            ok: res.ok,
            response: text.slice(0, 500)
          };
        } catch (e: any) {
          diagnostics.brevo = {
            durationMs: Date.now() - start,
            ok: false,
            error: e?.message || String(e)
          };
        }
      } else {
        diagnostics.brevo = { skipped: 'Brevo API key not found' };
      }

      // 3. Raw SMTP Nodemailer check
      if (host && user && smtpPass) {
        const start = Date.now();
        try {
          const transport = nodemailer.createTransport({
            host, port, secure: port === 465, auth: { user, pass: smtpPass },
            connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 5000,
          });
          await transport.verify();
          diagnostics.smtpRelay = {
            durationMs: Date.now() - start,
            verified: true,
            host, port, user
          };
          transport.close();
        } catch (e: any) {
          diagnostics.smtpRelay = {
            durationMs: Date.now() - start,
            verified: false,
            error: e?.message || String(e)
          };
        }
      }

      return NextResponse.json(diagnostics);
    }

    if (action === 'test-mail') {
      try {
        const sendResult = await sendAccountEmail(
          email,
          'Test verifica email · Hub Commerciale',
          'Questo è un messaggio di test per verificare la ricezione.',
          {
            title: 'Test verifica',
            bodyText: 'Se ricevi questo messaggio, il server di posta è configurato ed operativo.',
            actionUrl: 'https://commercial-dashboard-silk.vercel.app',
            actionLabel: 'Vai alla dashboard'
          }
        );
        return NextResponse.json({
          success: true,
          message: `Email di test inviata con successo a ${email}!`,
          provider: sendResult?.provider,
          id: sendResult?.id
        });
      } catch (err: any) {
        return NextResponse.json({ success: false, error: err?.message || String(err), stack: err?.stack });
      }
    }

    if (action === 'send-all-verifications' || action === 'fix-and-verify-unverified') {
      return await handleSendAllVerifications(req);
    }

    // Default action: delete user
    const result = await purgeUserByEmail(email);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Errore database' }, { status: 500 });
  }
}
