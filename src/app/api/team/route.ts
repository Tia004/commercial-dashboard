import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, createToken, hashToken } from '@/lib/serverAuth';
import { getServerDb } from '@/lib/serverDb';
import { appOrigin, emailConfigured, sendAccountEmail } from '@/lib/serverMail';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 });
    const db = await getServerDb();
    const members = await db.execute({ sql: 'SELECT id,email,name,role,email_verified FROM users WHERE workspace_id = ? ORDER BY created_at', args: [user.workspaceId] });
    const invites = ['owner', 'admin'].includes(user.role) ? await db.execute({ sql: 'SELECT email,role,expires_at FROM auth_tokens WHERE workspace_id = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?', args: [user.workspaceId, 'invite', new Date().toISOString()] }) : { rows: [] };
    return NextResponse.json({ members: members.rows.map((row) => ({ id: String(row.id), email: String(row.email), name: String(row.name), role: String(row.role), verified: Number(row.email_verified) === 1 })), invites: invites.rows.map((row) => ({ email: String(row.email), role: String(row.role), expiresAt: String(row.expires_at) })) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Team non disponibile.' }, { status: 503 }); }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) return NextResponse.json({ error: 'Permesso richiesto: amministratore.' }, { status: 403 });
    if (!emailConfigured()) return NextResponse.json({ error: 'SMTP non configurato.' }, { status: 503 });
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const role = body.role === 'admin' && user.role === 'owner' ? 'admin' : 'member';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Email non valida.' }, { status: 400 });
    const db = await getServerDb();
    const existing = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] });
    if (existing.rows.length) return NextResponse.json({ error: 'Questo indirizzo ha già un account. Usa un indirizzo nuovo per l’invito.' }, { status: 409 });
    const prior = await db.execute({ sql: 'SELECT token_hash FROM auth_tokens WHERE workspace_id = ? AND purpose = ? AND email = ? AND used_at IS NULL AND expires_at > ?', args: [user.workspaceId, 'invite', email, new Date().toISOString()] });
    if (prior.rows.length) return NextResponse.json({ error: 'Esiste già un invito attivo per questa email.' }, { status: 409 });
    const token = createToken();
    const tokenHash = hashToken(token);
    await db.execute({ sql: 'INSERT INTO auth_tokens(token_hash,purpose,email,workspace_id,role,expires_at) VALUES (?,?,?,?,?,?)', args: [tokenHash, 'invite', email, user.workspaceId, role, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()] });
    try {
      const inviteUrl = appOrigin() + '/?invite=' + encodeURIComponent(token);
      await sendAccountEmail(
        email,
        'Invito al team · Hub Commerciale',
        user.name + ' ti ha invitato nel workspace commerciale.\n\nApri questo link per creare il tuo account:\n' + inviteUrl + '\n\nL’invito scade tra 7 giorni.',
        {
          title: 'Invito al workspace',
          intro: `${user.name} ti ha invitato a collaborare nel workspace commerciale.`,
          bodyText: 'Unisciti al team per gestire opportunità, clienti e pipeline in un unico spazio condiviso.',
          actionUrl: inviteUrl,
          actionLabel: 'Accetta invito',
          expiryText: 'Questo link scade tra 7 giorni.'
        }
      );
    } catch {
      await db.execute({ sql: 'DELETE FROM auth_tokens WHERE token_hash = ?', args: [tokenHash] });
      return NextResponse.json({ error: 'Invio email non riuscito.' }, { status: 503 });
    }
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Invito non riuscito.' }, { status: 503 }); }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 });
    if (user.role !== 'owner') return NextResponse.json({ error: 'Solo il proprietario può cambiare i ruoli.' }, { status: 403 });
    const body = await req.json();
    if (body.role !== 'admin' && body.role !== 'member') return NextResponse.json({ error: 'Ruolo non valido.' }, { status: 400 });
    const db = await getServerDb();
    const result = await db.execute({ sql: 'UPDATE users SET role = ? WHERE id = ? AND workspace_id = ? AND role != ?', args: [body.role, String(body.userId || ''), user.workspaceId, 'owner'] });
    if (!result.rowsAffected) return NextResponse.json({ error: 'Membro non trovato.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Modifica non riuscita.' }, { status: 503 }); }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) return NextResponse.json({ error: 'Permesso richiesto: amministratore.' }, { status: 403 });
    const body = await req.json();
    const targetId = String(body.userId || '');
    if (!targetId || targetId === user.id) return NextResponse.json({ error: 'Operazione non consentita.' }, { status: 400 });
    const db = await getServerDb();
    const result = await db.execute({ sql: 'SELECT role FROM users WHERE id = ? AND workspace_id = ?', args: [targetId, user.workspaceId] });
    if (!result.rows.length || String(result.rows[0].role) === 'owner' || (user.role === 'admin' && String(result.rows[0].role) === 'admin')) return NextResponse.json({ error: 'Non puoi rimuovere questo membro.' }, { status: 403 });
    await db.execute({ sql: 'INSERT OR IGNORE INTO workspaces(id,name,created_at) VALUES (?,?,?)', args: [targetId, 'Workspace personale', new Date().toISOString()] });
    await db.execute({ sql: 'UPDATE users SET workspace_id = ?, role = ? WHERE id = ?', args: [targetId, 'owner', targetId] });
    await db.execute({ sql: 'DELETE FROM sessions WHERE user_id = ?', args: [targetId] });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Rimozione non riuscita.' }, { status: 503 }); }
}
