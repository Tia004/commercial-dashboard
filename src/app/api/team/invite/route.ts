import { NextRequest, NextResponse } from 'next/server';
import { getServerDb } from '@/lib/serverDb';
import { cookies } from 'next/headers';
import { COOKIE_NAME, getSessionUser, hashToken } from '@/lib/serverAuth';
export async function GET(req: NextRequest) {
  try {
    const token=req.nextUrl.searchParams.get('token')||'';
    const db=await getServerDb();
    const result=await db.execute({sql:'SELECT t.email,t.role,w.name FROM auth_tokens t JOIN workspaces w ON w.id=t.workspace_id WHERE t.token_hash=? AND t.purpose=? AND t.used_at IS NULL AND t.expires_at>?',args:[hashToken(token),'invite',new Date().toISOString()]});
    if(!result.rows.length)return NextResponse.json({error:'Invito scaduto o non valido.'},{status:404});
    const account=await db.execute({sql:'SELECT id FROM users WHERE email=?',args:[String(result.rows[0].email)]});
    return NextResponse.json({email:String(result.rows[0].email),role:String(result.rows[0].role),company:String(result.rows[0].name),existingAccount:account.rows.length>0},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'Invito temporaneamente non disponibile.'},{status:503});}
}
async function handlePOST(req:NextRequest){
  const user=await getSessionUser();
  if(!user)return NextResponse.json({error:'Accedi prima di accettare l’invito.'},{status:401});
  const token=String((await req.json()).token||'');
  const db=await getServerDb();const tx=await db.transaction('write');
  try{
    const result=await tx.execute({sql:'SELECT email,role,workspace_id FROM auth_tokens WHERE token_hash=? AND purpose=? AND used_at IS NULL AND expires_at>?',args:[hashToken(token),'invite',new Date().toISOString()]});
    if(!result.rows.length||String(result.rows[0].email)!==user.email){await tx.rollback();return NextResponse.json({error:'Accedi con l’email a cui è stato inviato l’invito.'},{status:403});}
    const row=result.rows[0];const role=row.role==='admin'?'admin':'member';
    await tx.execute({sql:'INSERT OR IGNORE INTO workspace_memberships(user_id,workspace_id,role,created_at) VALUES (?,?,?,?)',args:[user.id,String(row.workspace_id),role,new Date().toISOString()]});
    await tx.execute({sql:'UPDATE users SET workspace_id=? WHERE id=?',args:[String(row.workspace_id),user.id]});
    const sessionToken=(await cookies()).get(COOKIE_NAME)?.value || '';
    await tx.execute({sql:'UPDATE sessions SET workspace_id=? WHERE token_hash=? AND user_id=?',args:[String(row.workspace_id),hashToken(sessionToken),user.id]});
    await tx.execute({sql:'UPDATE auth_tokens SET used_at=? WHERE token_hash=?',args:[new Date().toISOString(),hashToken(token)]});
    await tx.commit();return NextResponse.json({ok:true});
  }catch{await tx.rollback();return NextResponse.json({error:'Invito non accettato. Riprova.'},{status:503});}finally{tx.close();}
}


export async function POST(req: NextRequest) {
  try { return await handlePOST(req); } catch { return NextResponse.json({ error: "Servizio temporaneamente non disponibile. Riprova." }, { status: 503 }); }
}
