import { NextRequest,NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/serverAuth';
import { getServerDb } from '@/lib/serverDb';
export async function GET(){
 const user=await getSessionUser();if(!user)return NextResponse.json({error:'Accesso richiesto.'},{status:401});
 const db=await getServerDb();const result=await db.execute({sql:'SELECT experience FROM user_preferences WHERE user_id=?',args:[user.id]});
 return NextResponse.json({experience:result.rows[0]?.experience||'standard'});
}
export async function POST(req:NextRequest){
 const user=await getSessionUser();if(!user)return NextResponse.json({error:'Accesso richiesto.'},{status:401});
 const experience=(await req.json()).experience;if(!['ai','standard'].includes(experience))return NextResponse.json({error:'Modalità non valida.'},{status:400});
 const db=await getServerDb();await db.execute({sql:'INSERT INTO user_preferences(user_id,experience) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET experience=excluded.experience',args:[user.id,experience]});
 return NextResponse.json({ok:true});
}
