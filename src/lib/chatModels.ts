import { getServerDb } from './serverDb';
let cache: { expires: number; models: { id:string; label:string }[] } | null = null;
export async function availableModels() {
  const local = { id:'workspace-local',label:'Assistente workspace · locale' };
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return [local];
  if (cache && cache.expires > Date.now()) return [local,...cache.models];
  const allow = (process.env.AI_ALLOWED_MODELS || 'gemini-2.5-flash,gemini-2.5-flash-lite').split(',').map((value)=>value.trim()).filter(Boolean);
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',{headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(8000)});
    if (!response.ok) return [local];
    const data=await response.json();
    const models=(data.models||[]).filter((model:any)=>model.supportedGenerationMethods?.includes('generateContent') && allow.includes(String(model.name).replace('models/',''))).map((model:any)=>({id:String(model.name).replace('models/',''),label:String(model.displayName)}));
    cache={expires:Date.now()+300000,models};return [local,...models];
  } catch { return [local]; }
}
export async function localReply(workspaceId:string,prompt:string) {
  const db=await getServerDb();
  const rows=await db.execute({sql:'SELECT data FROM contacts WHERE workspace_id=?',args:[workspaceId]});
  const contacts=rows.rows.map((row)=>JSON.parse(String(row.data))).filter((contact)=>!contact.archived);
  const q=prompt.toLocaleLowerCase('it-IT');
  const statuses=['Richiama','Appuntamento fissato','In attesa di conferma','Da risentire per informazioni','Gestisci'];
  const status=statuses.find((value)=>q.includes(value.toLowerCase()) || (value==='Richiama' && /richiam|richiamare/.test(q)));
  const match=contacts.filter((contact)=>status ? contact.statuses.includes(status) : [contact.company,contact.city,contact.province,contact.zone].some((value)=>value && q.includes(String(value).toLowerCase())));
  if(status || match.length) return (status ? status + ': ' : 'Aziende trovate: ') + match.length + '.\n\n' + (match.slice(0,30).map((contact)=>'• '+contact.company+' · '+contact.type+(contact.city?' · '+contact.city:'')).join('\n') || 'Nessuna azienda in questa situazione.');
  return 'Nel workspace ci sono '+contacts.length+' aziende: '+contacts.filter((contact)=>contact.type==='Contatto').length+' contatti, '+contacts.filter((contact)=>contact.type==='Notizia').length+' notizie e '+contacts.filter((contact)=>contact.type==='Cliente effettivo').length+' clienti effettivi.\n\nPosso cercare aziende per nome o zona e mostrarti chi richiamare, gli appuntamenti e i clienti da gestire. Per scrivere testi o ragionare liberamente, scegli un modello Gemini configurato.';
}
