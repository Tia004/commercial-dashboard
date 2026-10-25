import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE_NAME, getSessionUser, hashToken } from '@/lib/serverAuth';
import { getServerDb } from '@/lib/serverDb';
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 });
    const db = await getServerDb();
    const result = await db.execute({ sql: 'SELECT w.id,w.name,m.role FROM workspace_memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.user_id=? ORDER BY w.name', args: [user.id] });
    return NextResponse.json({ workspaces: result.rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Aziende temporaneamente non disponibili.' }, { status: 503 }); }
}
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 });
    const workspaceId = String((await req.json()).workspaceId || '');
    const token = (await cookies()).get(COOKIE_NAME)?.value || '';
    const db = await getServerDb(); const tx = await db.transaction('write');
    try {
      const membership = await tx.execute({ sql: 'SELECT role FROM workspace_memberships WHERE user_id=? AND workspace_id=?', args: [user.id, workspaceId] });
      if (!membership.rows.length) { await tx.rollback(); return NextResponse.json({ error: 'Workspace non autorizzato.' }, { status: 403 }); }
      await tx.execute({ sql: 'UPDATE sessions SET workspace_id=? WHERE token_hash=? AND user_id=?', args: [workspaceId, hashToken(token), user.id] });
      await tx.execute({ sql: 'UPDATE users SET workspace_id=? WHERE id=?', args: [workspaceId, user.id] });
      await tx.commit(); return NextResponse.json({ ok: true });
    } catch (error) { await tx.rollback(); throw error; } finally { tx.close(); }
  } catch { return NextResponse.json({ error: 'Cambio azienda non riuscito. Riprova.' }, { status: 503 }); }
}
