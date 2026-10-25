import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/serverAuth';
import { getServerDb } from '@/lib/serverDb';
import { mergeWorkspace, validWorkspace, emptyWorkspace } from '@/lib/workspaceMerge';
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 });
    const db = await getServerDb();
    const result = await db.execute({ sql: 'SELECT payload,revision FROM crm_data WHERE user_id = ?', args: [user.workspaceId] });
    return NextResponse.json({ workspaceId: user.workspaceId, data: result.rows.length ? JSON.parse(String(result.rows[0].payload)) : null, revision: result.rows.length ? Number(result.rows[0].revision) : 0 }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Dati temporaneamente non disponibili.' }, { status: 503 }); }
}
export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 });
    const body = await req.json();
    if (body.workspaceId !== user.workspaceId) return NextResponse.json({ code: 'workspace_changed', error: 'Il workspace è cambiato. Aggiorna prima di salvare.' }, { status: 409 });
    const baseRevision = body.baseRevision; const baseData = body.baseData;
    if (!validWorkspace(body) || JSON.stringify(body).length > 3300000) return NextResponse.json({ error: 'Formato archivio non valido.' }, { status: 400 });
    const data = { opportunities: body.opportunities, tasks: body.tasks, brands: body.brands, salesReps: body.salesReps };
    const db = await getServerDb();
    const tx = await db.transaction('write');
    try {
      const saved = await tx.execute({ sql: 'SELECT payload,revision FROM crm_data WHERE user_id = ?', args: [user.workspaceId] });
      const previous = saved.rows.length ? JSON.parse(String(saved.rows[0].payload)) : emptyWorkspace();
      const revision = saved.rows.length ? Number(saved.rows[0].revision) : 0;
      if (revision !== Number(baseRevision) && !validWorkspace(baseData)) { await tx.rollback(); return NextResponse.json({ error: 'Aggiorna il browser per continuare.', data: previous, revision }, { status: 409 }); }
      const merged = revision === Number(baseRevision) ? data : mergeWorkspace(baseData, data, previous);
      if (user.role === 'member') {
        if (JSON.stringify(merged.brands) !== JSON.stringify(previous.brands) || JSON.stringify(merged.salesReps) !== JSON.stringify(previous.salesReps)) { await tx.rollback(); return NextResponse.json({ error: 'Solo gli amministratori possono modificare brand e commerciali.' }, { status: 403 }); }
        for (const key of ['opportunities','tasks'] as const) if (previous[key].some((item: any) => !merged[key].some((next: any) => next.id === item.id))) { await tx.rollback(); return NextResponse.json({ error: 'Solo gli amministratori possono eliminare elementi.' }, { status: 403 }); }
      }
      const payload = JSON.stringify(merged);
      if (payload.length > 3000000) { await tx.rollback(); return NextResponse.json({ error: 'Archivio troppo grande.' }, { status: 413 }); }
      await tx.execute({ sql: 'INSERT INTO crm_data(user_id,payload,updated_at,revision) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at,revision=excluded.revision', args: [user.workspaceId,payload,new Date().toISOString(),revision+1] });
      await tx.commit();
      return NextResponse.json({ ok: true, revision: revision+1, data: merged });
    } catch (error) { await tx.rollback(); throw error; } finally { tx.close(); }
  } catch { return NextResponse.json({ error: 'Salvataggio non riuscito. Riprova.' }, { status: 503 }); }
}
