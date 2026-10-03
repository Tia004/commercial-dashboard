import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/serverAuth';
import { getServerDb } from '@/lib/serverDb';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 });
    const db = await getServerDb();
    const result = await db.execute({ sql: 'SELECT payload,revision FROM crm_data WHERE user_id = ?', args: [user.workspaceId] });
    return NextResponse.json({ data: result.rows.length ? JSON.parse(String(result.rows[0].payload)) : null, revision: result.rows.length ? Number(result.rows[0].revision) : 0 }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Dati temporaneamente non disponibili.' }, { status: 503 }); }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 });
    const data = await req.json();
    if (!Array.isArray(data.opportunities) || !Array.isArray(data.tasks) || !Array.isArray(data.brands) || !Array.isArray(data.salesReps)) return NextResponse.json({ error: 'Formato dati non valido.' }, { status: 400 });
    const baseRevision = Number(data.baseRevision);
    if (!Number.isSafeInteger(baseRevision) || baseRevision < 0) return NextResponse.json({ error: 'Versione archivio non valida.' }, { status: 400 });
    const payload = JSON.stringify({ opportunities: data.opportunities, tasks: data.tasks, brands: data.brands, salesReps: data.salesReps });
    if (payload.length > 3_000_000) return NextResponse.json({ error: 'Archivio troppo grande.' }, { status: 413 });
    const db = await getServerDb();
    if (user.role === 'member') {
      const saved = await db.execute({ sql: 'SELECT payload FROM crm_data WHERE user_id = ?', args: [user.workspaceId] });
      const previous = saved.rows.length ? JSON.parse(String(saved.rows[0].payload)) : { opportunities: [], tasks: [], brands: [], salesReps: [] };
      if (JSON.stringify(data.brands) !== JSON.stringify(previous.brands) || JSON.stringify(data.salesReps) !== JSON.stringify(previous.salesReps)) return NextResponse.json({ error: 'Solo gli amministratori possono modificare brand e commerciali.' }, { status: 403 });
      for (const collection of ['opportunities', 'tasks'] as const) {
        const newIds = new Set((data[collection] || []).map((item: any) => item.id));
        if ((previous[collection] || []).some((item: any) => !newIds.has(item.id))) return NextResponse.json({ error: 'Solo gli amministratori possono eliminare elementi.' }, { status: 403 });
      }
    }
    const updated = await db.execute({ sql: 'UPDATE crm_data SET payload = ?, updated_at = ?, revision = revision + 1 WHERE user_id = ? AND revision = ?', args: [payload, new Date().toISOString(), user.workspaceId, baseRevision] });
    if (!updated.rowsAffected && baseRevision === 0) {
      const inserted = await db.execute({ sql: 'INSERT OR IGNORE INTO crm_data(user_id,payload,updated_at,revision) VALUES (?,?,?,1)', args: [user.workspaceId, payload, new Date().toISOString()] });
      if (inserted.rowsAffected) return NextResponse.json({ ok: true, revision: 1 });
    }
    if (!updated.rowsAffected) return NextResponse.json({ error: 'I dati sono cambiati in un’altra sessione. Ricarica prima di continuare.' }, { status: 409 });
    return NextResponse.json({ ok: true, revision: baseRevision + 1 });
  } catch { return NextResponse.json({ error: 'Salvataggio non riuscito.' }, { status: 503 }); }
}
