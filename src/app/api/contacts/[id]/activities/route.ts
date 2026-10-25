import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/serverAuth';
import { getServerDb } from '@/lib/serverDb';
type Context = { params: Promise<{ id: string }> };
const mapActivity = (row: Record<string, unknown>) => ({ id: String(row.id), contactId: String(row.contact_id), text: String(row.text), authorName: String(row.author_name), createdAt: String(row.created_at), updatedAt: String(row.updated_at), revision: Number(row.revision) });
export async function GET(_req: NextRequest, context: Context) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 });
    const { id } = await context.params;
    const db = await getServerDb();
    const rows = await db.execute({ sql: 'SELECT * FROM contact_activities WHERE contact_id = ? AND workspace_id = ? ORDER BY created_at DESC,id DESC', args: [id, user.workspaceId] });
    return NextResponse.json({ activities: rows.rows.map(mapActivity) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Storico non disponibile.' }, { status: 503 }); }
}
export async function POST(req: NextRequest, context: Context) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 });
    const { id: contactId } = await context.params;
    const body = await req.json();
    if (body.workspaceId && body.workspaceId !== user.workspaceId) return NextResponse.json({ code: 'workspace_changed', error: 'Il workspace è cambiato. Aggiorna prima di salvare.' }, { status: 409 });
    const text = String(body.text || '').trim();
    if (!text || text.length > 20000) return NextResponse.json({ error: 'Scrivi un’attività di massimo 20.000 caratteri.' }, { status: 400 });
    const db = await getServerDb();
    const contact = await db.execute({ sql: 'SELECT id FROM contacts WHERE id = ? AND workspace_id = ?', args: [contactId, user.workspaceId] });
    if (!contact.rows.length) return NextResponse.json({ error: 'Contatto non trovato.' }, { status: 404 });
    const id = typeof body.id === 'string' && /^[\da-f-]{36}$/i.test(body.id) ? body.id : crypto.randomUUID();
    const now = new Date().toISOString();
    await db.execute({ sql: 'INSERT OR IGNORE INTO contact_activities(id,contact_id,workspace_id,text,author_id,author_name,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)', args: [id, contactId, user.workspaceId, text, user.id, user.name, now, now] });
    const saved = await db.execute({ sql: 'SELECT * FROM contact_activities WHERE id = ? AND workspace_id = ? AND contact_id = ?', args: [id, user.workspaceId, contactId] });
    return NextResponse.json({ activity: mapActivity(saved.rows[0]) }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Attività non salvata. Il testo resta disponibile per riprovare.' }, { status: 503 }); }
}
async function handlePATCH(req: NextRequest, context: Context) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 });
  const { id: contactId } = await context.params;
  const body = await req.json();
    if (body.workspaceId && body.workspaceId !== user.workspaceId) return NextResponse.json({ code: 'workspace_changed', error: 'Il workspace è cambiato. Aggiorna prima di salvare.' }, { status: 409 });
  const text = String(body.text || '').trim();
  if (!text || text.length > 20000) return NextResponse.json({ error: 'Testo non valido.' }, { status: 400 });
  const db = await getServerDb();
  const tx = await db.transaction('write');
  try {
    const old = await tx.execute({ sql: 'SELECT * FROM contact_activities WHERE id = ? AND contact_id = ? AND workspace_id = ?', args: [String(body.activityId || ''), contactId, user.workspaceId] });
    if (!old.rows.length) { await tx.rollback(); return NextResponse.json({ error: 'Attività non trovata.' }, { status: 404 }); }
    if (Number(body.baseRevision) !== Number(old.rows[0].revision)) { await tx.rollback(); return NextResponse.json({ error: 'Questa attività è stata modificata da un’altra sessione. Ricarica lo storico prima di riprovare.' }, { status: 409 }); }
    const now = new Date().toISOString();
    await tx.execute({ sql: 'INSERT INTO activity_revisions(id,activity_id,workspace_id,text,edited_at,edited_by) VALUES (?,?,?,?,?,?)', args: [crypto.randomUUID(), String(body.activityId), user.workspaceId, String(old.rows[0].text), now, user.id] });
    await tx.execute({ sql: 'UPDATE contact_activities SET text = ?, updated_at = ?, revision = revision + 1 WHERE id = ? AND workspace_id = ?', args: [text, now, String(body.activityId), user.workspaceId] });
    await tx.commit();
    return NextResponse.json({ activity: { ...mapActivity(old.rows[0]), text, updatedAt: now, revision: Number(old.rows[0].revision) + 1 } });
  } catch { await tx.rollback(); return NextResponse.json({ error: 'Modifica non salvata.' }, { status: 503 }); } finally { tx.close(); }
}


export async function PATCH(req: NextRequest, context: Context) {
  try { return await handlePATCH(req, context); } catch { return NextResponse.json({ error: "Servizio temporaneamente non disponibile. Riprova." }, { status: 503 }); }
}
