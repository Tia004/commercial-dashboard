import { NextRequest, NextResponse } from 'next/server';
import { getServerDb } from '@/lib/serverDb';
import { hashToken } from '@/lib/serverAuth';

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token') || '';
    if (!token) return NextResponse.json({ error: 'Invito mancante.' }, { status: 400 });
    const db = await getServerDb();
    const result = await db.execute({ sql: 'SELECT email,role FROM auth_tokens WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?', args: [hashToken(token), 'invite', new Date().toISOString()] });
    if (!result.rows.length) return NextResponse.json({ error: 'Invito scaduto o non valido.' }, { status: 404 });
    return NextResponse.json({ email: String(result.rows[0].email), role: String(result.rows[0].role) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Invito non disponibile.' }, { status: 503 }); }
}
