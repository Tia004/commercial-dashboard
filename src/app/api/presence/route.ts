import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE_NAME, getSessionUser, hashToken } from '@/lib/serverAuth';
import { getServerDb } from '@/lib/serverDb';
const views = ['cockpit','contacts','chat','focus','kanban','opportunities','calendar','standby','analytics','sales'];
function deviceName(agent: string) {
  const system = /iPhone/i.test(agent) ? 'iPhone' : /iPad/i.test(agent) ? 'iPad' : /Android/i.test(agent) ? 'Android' : /Windows/i.test(agent) ? 'Windows' : /Macintosh/i.test(agent) ? 'Mac' : 'Dispositivo';
  return system + (/Edg\//.test(agent) ? ' · Edge' : /Chrome\//.test(agent) ? ' · Chrome' : /Firefox\//.test(agent) ? ' · Firefox' : /Safari\//.test(agent) ? ' · Safari' : '');
}
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 });
    const body = await req.json();
    if (!/^[a-f\d-]{36}$/i.test(String(body.tabId || '')) || !views.includes(body.view)) return NextResponse.json({ error: 'Sessione non valida.' }, { status: 400 });
    const token = (await cookies()).get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({}, { status: 401 });
    const sessionHash = hashToken(token);
    const db = await getServerDb();
    await db.execute({ sql: 'INSERT INTO presence_connections(connection_key,session_hash,workspace_id,user_id,name,device,view,target_id,focus,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(connection_key) DO UPDATE SET workspace_id=excluded.workspace_id,name=excluded.name,view=excluded.view,target_id=excluded.target_id,focus=excluded.focus,updated_at=excluded.updated_at', args: [sessionHash + ':' + body.tabId,sessionHash,user.workspaceId,user.id,user.name,deviceName(req.headers.get('user-agent') || ''),body.view,String(body.targetId || '').slice(0,100),String(body.focus || '').replace(/[\u0000-\u001f<>]/g,'').slice(0,80),new Date().toISOString()] });
    await db.execute({ sql: 'DELETE FROM presence_connections WHERE updated_at < ?', args: [new Date(Date.now()-86400000).toISOString()] });
    const rows = await db.execute({ sql: 'SELECT number,user_id,name,device,view,target_id,focus,updated_at,connection_key FROM presence_connections WHERE workspace_id = ? AND updated_at > ? ORDER BY number', args: [user.workspaceId,new Date(Date.now()-60000).toISOString()] });
    return NextResponse.json({ sessions: rows.rows.map((row) => ({ number: Number(row.number), name: String(row.name), device: String(row.device), view: String(row.view), targetId: String(row.target_id), focus: String(row.focus), lastSeen: String(row.updated_at), isSelf: String(row.connection_key) === sessionHash + ':' + body.tabId })) }, { headers: { 'Cache-Control':'no-store' } });
  } catch { return NextResponse.json({ error: 'Presenza temporaneamente non disponibile.' }, { status: 503 }); }
}
