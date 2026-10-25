import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/serverAuth';
import { getServerDb } from '@/lib/serverDb';
import { contactFromRow, validateContact } from '@/lib/contactRepository';
import { CONTACT_STATUSES } from '@/types/contacts';
type Context = { params: Promise<{ id: string }> };

async function handlePATCH(req: NextRequest, context: Context) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 });
  const { id } = await context.params;
  const body = await req.json();
    if (body.workspaceId && body.workspaceId !== user.workspaceId) return NextResponse.json({ code: 'workspace_changed', error: 'Il workspace è cambiato. Aggiorna prima di salvare.' }, { status: 409 });
  const db = await getServerDb();
  const tx = await db.transaction('write');
  try {
    const result = await tx.execute({ sql: 'SELECT * FROM contacts WHERE id = ? AND workspace_id = ?', args: [id, user.workspaceId] });
    if (!result.rows.length) { await tx.rollback(); return NextResponse.json({ error: 'Contatto non trovato.' }, { status: 404 }); }
    const old = contactFromRow(result.rows[0]);
    let patch;
    if (body.action === 'toggle-status') {
      if (!CONTACT_STATUSES.includes(body.status)) { await tx.rollback(); return NextResponse.json({ error: 'Situazione non valida.' }, { status: 400 }); }
      if (body.status === 'Gestisci' && old.type !== 'Cliente effettivo') { await tx.rollback(); return NextResponse.json({ error: 'Gestisci è disponibile per i clienti effettivi.' }, { status: 400 }); }
      patch = { statuses: old.statuses.includes(body.status) ? old.statuses.filter((value) => value !== body.status) : [...old.statuses, body.status] };
    } else {
      try { patch = validateContact(body, true); } catch (error) { await tx.rollback(); return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
      if (body.baseRevision !== undefined && Number(body.baseRevision) !== old.revision) { await tx.rollback(); return NextResponse.json({ error: 'La scheda è stata aggiornata da un’altra sessione. Rivedi i dati prima di salvare.', contact: old }, { status: 409 }); }
    }
    const merged = { ...old, ...patch };
    if (merged.type !== 'Cliente effettivo') merged.statuses = merged.statuses.filter((status) => status !== 'Gestisci');
    const { id: _id, revision: _revision, createdAt: _created, updatedAt: _updated, ...data } = merged;
    const now = new Date().toISOString();
    await tx.execute({ sql: 'UPDATE contacts SET data = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND workspace_id = ?', args: [JSON.stringify(data), now, id, user.workspaceId] });
    await tx.commit();
    return NextResponse.json({ contact: { ...data, id, revision: old.revision + 1, createdAt: old.createdAt, updatedAt: now } });
  } catch { await tx.rollback(); return NextResponse.json({ error: 'Modifica non riuscita.' }, { status: 503 }); } finally { tx.close(); }
}


export async function PATCH(req: NextRequest, context: Context) {
  try { return await handlePATCH(req, context); } catch { return NextResponse.json({ error: "Servizio temporaneamente non disponibile. Riprova." }, { status: 503 }); }
}
