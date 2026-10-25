import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/serverAuth';
import { getServerDb } from '@/lib/serverDb';
import { contactFromRow, ensureWorkspaceContacts, validateContact } from '@/lib/contactRepository';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 });
    await ensureWorkspaceContacts(user.workspaceId);
    const db = await getServerDb();
    const result = await db.execute({ sql: 'SELECT * FROM contacts WHERE workspace_id = ? ORDER BY updated_at DESC', args: [user.workspaceId] });
    return NextResponse.json({ workspaceId: user.workspaceId, contacts: result.rows.map(contactFromRow) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Impossibile caricare i contatti. Riprova.' }, { status: 503 }); }
}
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 });
    if (Number(req.headers.get('content-length') || 0) > 10000) return NextResponse.json({ error: 'Richiesta troppo grande.' }, { status: 413 });
    const body = await req.json();
    if (body.workspaceId && body.workspaceId !== user.workspaceId) return NextResponse.json({ code: 'workspace_changed', error: 'Il workspace è cambiato. Aggiorna prima di salvare.' }, { status: 409 });
    let data;
    try { data = validateContact(body); } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
    await ensureWorkspaceContacts(user.workspaceId);
    const db = await getServerDb();
    const id = typeof body.id === 'string' && /^[\da-f-]{36}$/i.test(body.id) ? body.id : crypto.randomUUID();
    const existing = await db.execute({ sql: 'SELECT * FROM contacts WHERE id = ? AND workspace_id = ?', args: [id, user.workspaceId] });
    if (existing.rows.length) return NextResponse.json({ contact: contactFromRow(existing.rows[0]) });
    const duplicates = await db.execute({ sql: "SELECT id FROM contacts WHERE workspace_id = ? AND lower(json_extract(data,'$.company')) = lower(?) AND lower(json_extract(data,'$.city')) = lower(?) AND json_extract(data,'$.archived') = 0", args: [user.workspaceId, String(data.company), String(data.city)] });
    if (duplicates.rows.length) return NextResponse.json({ error: 'Questa azienda è già in archivio.', existingId: String(duplicates.rows[0].id) }, { status: 409 });
    if (data.type !== 'Cliente effettivo') data.statuses = data.statuses?.filter((status) => status !== 'Gestisci');
    const now = new Date().toISOString();
    await db.execute({ sql: 'INSERT INTO contacts(id,workspace_id,data,created_at,updated_at) VALUES (?,?,?,?,?)', args: [id, user.workspaceId, JSON.stringify(data), now, now] });
    return NextResponse.json({ contact: { ...data, id, revision: 1, createdAt: now, updatedAt: now } }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Salvataggio non riuscito. Riprova.' }, { status: 503 }); }
}
