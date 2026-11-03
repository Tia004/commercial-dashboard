import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/serverAuth';
import { getServerDb } from '@/lib/serverDb';
import { ensureWorkspaceContacts, contactFromRow } from '@/lib/contactRepository';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Accesso richiesto.' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) return NextResponse.json({ error: 'Solo gli amministratori possono esportare il backup completo.' }, { status: 403 });
    await ensureWorkspaceContacts(user.workspaceId);
    const db = await getServerDb();
    const tx = await db.transaction('read');
    try {
      const contacts = await tx.execute({ sql: 'SELECT * FROM contacts WHERE workspace_id=?', args: [user.workspaceId] });
      const activities = await tx.execute({ sql: 'SELECT * FROM contact_activities WHERE workspace_id=? ORDER BY created_at DESC', args: [user.workspaceId] });
      const revisions = await tx.execute({ sql: 'SELECT * FROM activity_revisions WHERE workspace_id=?', args: [user.workspaceId] });
      const legacy = await tx.execute({ sql: 'SELECT payload FROM crm_data WHERE user_id=?', args: [user.workspaceId] });
      const files=await tx.execute({sql:'SELECT id,contact_id,name,mime,size,author_id,author_name,created_at FROM contact_files WHERE workspace_id=? ORDER BY created_at',args:[user.workspaceId]});
      await tx.commit();
      const snapshot={ format: 'commercial-workspace-backup', version: 2, exportedAt: new Date().toISOString(), workspaceId: user.workspaceId, company: user.company, contacts: contacts.rows.map(contactFromRow), activities: activities.rows, activityRevisions: revisions.rows, commercialData: legacy.rows.length ? JSON.parse(String(legacy.rows[0].payload)) : null };
      const encoder=new TextEncoder();
      const stream=new ReadableStream({async start(controller){
        try{
          controller.enqueue(encoder.encode(JSON.stringify(snapshot).slice(0,-1)+',"files":['));
          for(let index=0;index<files.rows.length;index++){
            const metadata=files.rows[index];
            const content=await db.execute({sql:'SELECT content FROM contact_files WHERE id=? AND workspace_id=?',args:[String(metadata.id),user.workspaceId]});
            const file={...metadata,contentBase64:content.rows.length?Buffer.from(content.rows[0].content as ArrayBuffer).toString('base64'):null};
            controller.enqueue(encoder.encode((index?',':'')+JSON.stringify(file)));
          }
          controller.enqueue(encoder.encode(']}'));controller.close();
        }catch(error){controller.error(error);}
      }});
      return new NextResponse(stream,{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Content-Disposition':'attachment; filename="workspace-backup-'+new Date().toISOString().slice(0,10)+'.json"'}});

    } catch (error) { await tx.rollback(); throw error; } finally { tx.close(); }
  } catch { return NextResponse.json({ error: 'Backup non disponibile. Riprova.' }, { status: 503 }); }
}
