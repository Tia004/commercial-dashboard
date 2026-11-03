import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/serverAuth';
import { getServerDb } from '@/lib/serverDb';
type Context={params:Promise<{id:string;fileId:string}>};
export async function GET(_req:Request,context:Context){
  try{
    const user=await getSessionUser();if(!user)return NextResponse.json({error:'Accesso richiesto.'},{status:401});
    const {id,fileId}=await context.params;const db=await getServerDb();
    const result=await db.execute({sql:'SELECT name,mime,content FROM contact_files WHERE id=? AND contact_id=? AND workspace_id=?',args:[fileId,id,user.workspaceId]});
    if(!result.rows.length)return NextResponse.json({error:'Allegato non trovato.'},{status:404});
    const row=result.rows[0];const filename=encodeURIComponent(String(row.name)).replace(/['()*]/g,char=>'%'+char.charCodeAt(0).toString(16));
    return new NextResponse(new Uint8Array(row.content as ArrayBuffer),{headers:{'Content-Type':String(row.mime),'Content-Disposition':"attachment; filename=\"documento\"; filename*=UTF-8''"+filename,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"}});
  }catch{return NextResponse.json({error:'Download non disponibile.'},{status:503});}
}
export async function DELETE(_req:Request,context:Context){
  try{
    const user=await getSessionUser();if(!user)return NextResponse.json({error:'Accesso richiesto.'},{status:401});
    const {id,fileId}=await context.params;const db=await getServerDb();
    const result=await db.execute({sql:'DELETE FROM contact_files WHERE id=? AND contact_id=? AND workspace_id=? AND (author_id=? OR ? IN (?,?))',args:[fileId,id,user.workspaceId,user.id,user.role,'owner','admin']});
    if(!result.rowsAffected)return NextResponse.json({error:'File non trovato o rimozione non consentita.'},{status:404});
    return NextResponse.json({ok:true});
  }catch{return NextResponse.json({error:'Rimozione non riuscita.'},{status:503});}
}
