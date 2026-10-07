const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks, env = {}, fetch = async () => { throw Error('unexpected HTTP request'); }) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports, require: name => mocks[name] || require(name), process: { env }, console: { info() {}, warn() {}, error() {}, log() {} }, fetch, AbortSignal, URL, crypto: require('node:crypto').webcrypto });
  return exports;
}
const smtpEnv = { NODE_ENV: 'production', SMTP_HOST: 'smtp-relay.brevo.com', SMTP_PORT: '587', SMTP_USER: 'login@smtp-brevo.com', SMTP_PASS: 'smtp-secret', SMTP_FROM: 'Hub Commerciale <owner@gmail.com>' };
function mail(env, fetch, sendMail = async () => ({ accepted: ['customer@example.com'], messageId: 'smtp-1' })) {
  let closed = false;
  const mod = load('src/lib/serverMail.ts', { nodemailer: { createTransport: () => ({ sendMail, close: () => { closed = true; } }) } }, env, fetch);
  return { ...mod, closed: () => closed };
}
const send = mod => mod.sendAccountEmail('customer@example.com', 'Verifica email', 'Verifica https://example.com/verify');

test('Production uses Resend REST API when RESEND_API_KEY is configured', async () => {
  const mod = mail({ ...smtpEnv, RESEND_API_KEY: 'secret' }, async (url, opts) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.ok(opts.signal);
    return { ok: true, json: async () => ({ id: 'resend-1' }) };
  });
  assert.equal((await send(mod)).provider, 'resend');
});

test('Resend-only deployment does not require SMTP credentials', async () => {
  const mod = mail({ NODE_ENV: 'production', RESEND_API_KEY: 'secret', RESEND_FROM: 'Hub <auth@example.com>' }, async (url, opts) => {
    assert.equal(url, 'https://api.resend.com/emails'); assert.ok(opts.signal); assert.ok(opts.headers['Idempotency-Key']);
    assert.equal(JSON.parse(opts.body).from, 'Hub <auth@example.com>');
    return { ok: true, json: async () => ({ id: 'resend-1' }) };
  });
  assert.equal((await send(mod)).id, 'resend-1');
});

test('Resend rejection falls back to SMTP', async () => {
  const mod = mail({ ...smtpEnv, RESEND_API_KEY: 'secret', RESEND_FROM: 'Hub <auth@example.com>' }, async () => ({ ok: false, status: 403, json: async () => ({ message: 'domain not verified' }) }));
  assert.equal((await send(mod)).provider, 'smtp');
});

test('REST timeout falls back to SMTP', async () => {
  const mod = mail({ ...smtpEnv, RESEND_API_KEY: 'secret', RESEND_FROM: 'Hub <auth@example.com>' }, async () => { throw new DOMException('timeout', 'TimeoutError'); });
  assert.equal((await send(mod)).provider, 'smtp');
});

test('Brevo-only deployment parses sender and does not require SMTP', async () => {
  const mod = mail({ NODE_ENV: 'production', BREVO_API_KEY: 'secret', SMTP_FROM: 'Hub Commerciale <auth@example.com>' }, async (url, opts) => {
    assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
    assert.equal(JSON.parse(opts.body).sender.email, 'auth@example.com');
    return { ok: true, json: async () => ({ messageId: 'brevo-1' }) };
  }); assert.equal((await send(mod)).provider, 'brevo');
});

test('SMTP rejection reports failure and closes connection', async () => {
  const mod = mail(smtpEnv, undefined, async () => ({ accepted: [], rejected: ['customer@example.com'] }));
  await assert.rejects(send(mod), /destinatario non accettato/); assert.equal(mod.closed(), true);
});

test('Resend rejection without other provider reports configuration failure', async () => {
  await assert.rejects(send(mail({ NODE_ENV: 'production', RESEND_API_KEY: 'secret' }, async () => ({ ok: false, status: 403, json: async () => ({ message: 'forbidden' }) }))), /resend HTTP 403/i);
});

test('Provider success without message ID is not reported as sent', async () => {
  await assert.rejects(send(mail({ NODE_ENV: 'production', RESEND_API_KEY: 'secret', RESEND_FROM: 'auth@example.com' }, async () => ({ ok: true, json: async () => ({}) }))), /conferma di invio mancante/);
});

function resendRoute({ fail = false, verified = false, exists = true } = {}) {
  const queries = []; let sent = 0;
  const db = { execute: async query => { queries.push(query); return { rows: query.sql.startsWith('SELECT id, email_verified') && exists ? [{ id: 'user-1', email_verified: verified ? 1 : 0 }] : [] }; } };
  const mod = load('src/app/api/auth/resend/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    '@/lib/serverDb': { getServerDb: async () => db, getClientIp: () => '127.0.0.1', checkRateLimit: async () => true },
    '@/lib/serverAuth': { createToken: () => 'new-token', hashToken: () => 'new-hash' },
    '@/lib/serverMail': { appOrigin: () => 'https://example.com', emailConfigured: () => true, sendAccountEmail: async () => { sent++; if (fail) throw Error('provider failure'); } },
  });
  return { post: () => mod.POST({ json: async () => ({ email: 'customer@example.com' }) }), queries, sent: () => sent };
}

test('Resend immediately sends even with a recent token; old links remain usable', async () => {
  const route = resendRoute(); assert.equal((await route.post()).status, 200); assert.equal(route.sent(), 1);
  assert.equal(route.queries.filter(q => q.sql.startsWith('INSERT INTO auth_tokens')).length, 1);
  assert.equal(route.queries.some(q => q.sql.includes('SELECT token_hash') || q.sql.startsWith('UPDATE auth_tokens')), false);
});

test('Failed resend removes only the new token and returns 503', async () => {
  const route = resendRoute({ fail: true }); const response = await route.post();
  assert.equal(response.status, 503); assert.equal(route.queries.at(-1).sql, 'DELETE FROM auth_tokens WHERE token_hash = ?');
  assert.equal(response.body.error.includes('provider failure'), false);
});

test('Verified and absent accounts receive no verification emails', async () => {
  for (const options of [{ verified: true }, { exists: false }]) { const route = resendRoute(options); assert.equal((await route.post()).status, 200); assert.equal(route.sent(), 0); }
});

test('Successful verification invalidates every other verification link before creating session', async () => {
  const events = [];
  const db = {
    execute: async query => { events.push(query); return query.sql.startsWith('SELECT') ? { rows: [{ user_id: 'user-1' }] } : { rowsAffected: 1 }; },
    batch: async queries => { events.push(...queries); return []; },
  };
  const mod = load('src/app/api/auth/verify/route.ts', {
    'next/server': { NextResponse: { redirect: url => ({ url, cookies: { set() {} } }) } },
    '@/lib/serverDb': { getServerDb: async () => db },
    '@/lib/serverAuth': { hashToken: () => 'hash', createSession: async () => { assert.ok(events.some(q => q.sql.startsWith('UPDATE auth_tokens') && q.sql.includes('purpose = ? AND used_at IS NULL'))); return 'session'; }, COOKIE_NAME: 'session', cookieOptions: {} },
    '@/lib/serverMail': { appOrigin: () => 'https://example.com' },
  });
  const response = await mod.GET({ nextUrl: new URL('https://example.com/api/auth/verify?token=token') });
  assert.equal(response.url, 'https://example.com/?notice=verified');
  const revoke = events.find(q => q.sql.startsWith('UPDATE auth_tokens') && q.sql.includes('purpose = ? AND used_at IS NULL'));
  assert.equal(revoke.args[1], 'user-1'); assert.equal(revoke.args[2], 'verify');
});
