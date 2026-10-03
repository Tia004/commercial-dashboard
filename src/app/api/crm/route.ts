import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/serverAuth';
import { getServerDb } from '@/lib/serverDb';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 });
    const db = await getServerDb();
    const result = await db.execute({ sql: 'SELECT payload FROM crm_data WHERE user_id = ?', args: [user.id] });
    return NextResponse.json({ data: result.rows.length ? JSON.parse(String(result.rows[0].payload)) : null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Dati temporaneamente non disponibili.' }, { status: 503 }); }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 });
    const data = await req.json();
    if (!Array.isArray(data.opportunities) || !Array.isArray(data.tasks) || !Array.isArray(data.brands) || !Array.isArray(data.salesReps)) return NextResponse.json({ error: 'Formato dati non valido.' }, { status: 400 });
    const payload = JSON.stringify(data);
    if (payload.length > 3_000_000) return NextResponse.json({ error: 'Archivio troppo grande.' }, { status: 413 });
    const db = await getServerDb();
    await db.execute({ sql: 'INSERT INTO crm_data(user_id,payload,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at', args: [user.id, payload, new Date().toISOString()] });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Salvataggio non riuscito.' }, { status: 503 }); }
}
