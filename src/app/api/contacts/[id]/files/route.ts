import { NextRequest,NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/serverAuth';
import { getServerDb,checkRateLimit } from '@/lib/serverDb';
import { contactFileMetadata,CONTACT_FILE_LIMIT,CONTACT_FILE_COUNT,validateContactFile } from '@/lib/contactFiles';
type Context = {params:Promise<{id:string}>};
export async function GET(_req:NextRequest,context:Context) {
  try {
    const user=await getSessionUser();if(!user)return NextResponse.json({error:'Accesso richiesto.'},{status:401});
    const {id}=await context.params;const db=await getServerDb();
    if(!(await db.execute({sql:'SELECT id FROM contacts WHERE id=? AND workspace_id=?',args:[id,user.workspaceId]})).rows.length)return NextResponse.json({error:'Contatto non trovato.'},{status:404});
    const result=await db.execute({sql:'SELECT id,name,mime,size,author_id,author_name,created_at FROM contact_files WHERE contact_id=? AND workspace_id=? ORDER BY created_at DESC,id DESC',args:[id,user.workspaceId]});
    return NextResponse.json({files:result.rows.map(contactFileMetadata)},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'Allegati temporaneamente non disponibili.'},{status:503});}
}
export async function POST(req:NextRequest,context:Context) {
  try {
    const user=await getSessionUser();if(!user)return NextResponse.json({error:'Accesso richiesto.'},{status:401});
    const {id}=await context.params;const db=await getServerDb();
    if(!(await db.execute({sql:'SELECT id FROM contacts WHERE id=? AND workspace_id=?',args:[id,user.workspaceId]})).rows.length)return NextResponse.json({error:'Contatto non trovato.'},{status:404});
    if(!await checkRateLimit(db,user.id,'contact-file',30,15))return NextResponse.json({error:'Troppi caricamenti. Attendi qualche minuto.'},{status:429});
    if(Number(req.headers.get('content-length')||0)>CONTACT_FILE_LIMIT+20000)return NextResponse.json({error:'Ogni file può pesare al massimo 2 MB.'},{status:413});
    const form=await req.formData();
    if(form.get('workspaceId')!==user.workspaceId)return NextResponse.json({error:'Il workspace è cambiato. Riapri la scheda prima di caricare.'},{status:409});
    const file=form.get('file');if(!(file instanceof File))return NextResponse.json({error:'Seleziona un file.'},{status:400});
    if(file.size>CONTACT_FILE_LIMIT)return NextResponse.json({error:'Ogni file può pesare al massimo 2 MB.'},{status:413});
    const bytes=new Uint8Array(await file.arrayBuffer());let metadata;
    try{metadata=validateContactFile(file.name,bytes);}catch(error){return NextResponse.json({error:(error as Error).message},{status:400});}
    const requestId=String(form.get('id')||'');if(!/^[a-f\d-]{36}$/i.test(requestId))return NextResponse.json({error:'Richiesta non valida.'},{status:400});
    const tx=await db.transaction('write');
    try{
      const prior=await tx.execute({sql:'SELECT id,name,mime,size,author_id,author_name,created_at FROM contact_files WHERE id=? AND workspace_id=? AND contact_id=?',args:[requestId,user.workspaceId,id]});
      if(prior.rows.length){await tx.commit();return NextResponse.json({file:contactFileMetadata(prior.rows[0])});}
      const count=await tx.execute({sql:'SELECT count(*) AS total,COALESCE(sum(size),0) AS bytes FROM contact_files WHERE workspace_id=? AND contact_id=?',args:[user.workspaceId,id]});
      if(Number(count.rows[0].total)>=CONTACT_FILE_COUNT||Number(count.rows[0].bytes)+bytes.length>20*1024*1024){await tx.rollback();return NextResponse.json({error:'Limite della scheda raggiunto: 20 allegati e 20 MB complessivi.'},{status:409});}
      const total=await tx.execute({sql:'SELECT COALESCE(sum(size),0) AS bytes FROM contact_files WHERE workspace_id=?',args:[user.workspaceId]});
      if(Number(total.rows[0].bytes)+bytes.length>100*1024*1024){await tx.rollback();return NextResponse.json({error:'Archivio allegati del workspace pieno (100 MB). Scarica e rimuovi i file non più necessari.'},{status:409});}
      const now=new Date().toISOString();
      await tx.execute({sql:'INSERT INTO contact_files(id,workspace_id,contact_id,name,mime,size,content,author_id,author_name,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',args:[requestId,user.workspaceId,id,metadata.name,metadata.mime,bytes.length,bytes,user.id,user.name,now]});
      await tx.commit();return NextResponse.json({file:{id:requestId,...metadata,size:bytes.length,authorId:user.id,authorName:user.name,createdAt:now}},{status:201});
    }catch(error){await tx.rollback();throw error;}finally{tx.close();}
  }catch{return NextResponse.json({error:'File non caricato. Riprova.'},{status:503});}
}
