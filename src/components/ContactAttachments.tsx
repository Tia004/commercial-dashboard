'use client';
import React,{useEffect,useRef,useState} from 'react';
import {useAuth} from '@/lib/auth';
import {CONTACT_FILE_LIMIT} from '@/lib/contactFiles';
type Attachment={id:string;name:string;mime:string;size:number;authorId:string;authorName:string;createdAt:string};
export function ContactAttachments({contactId}:{contactId:string}){
 const {user}=useAuth();const [files,setFiles]=useState<Attachment[]>([]);const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [selection,setSelection]=useState<File|null>(null);const input=useRef<HTMLInputElement>(null);const fileVersion=useRef(0);const requestId=useRef('');const active=useRef(contactId);active.current=contactId;
 const base='/api/contacts/'+encodeURIComponent(contactId)+'/files';
 useEffect(()=>{
  let cancelled=false;setFiles([]);setError('');setLoading(true);setSelection(null);requestId.current='';
  const load=async()=>{const version=fileVersion.current;try{const response=await fetch(base,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error();const data=await response.json();if(!cancelled&&version===fileVersion.current)setFiles(data.files);}catch{if(!cancelled)setError('Impossibile caricare gli allegati. Riprova dalla scheda.');}finally{if(!cancelled)setLoading(false);}};
  void load();const interval=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},10000);return()=>{cancelled=true;window.clearInterval(interval);};
 },[base]);
 const upload=async(event:React.FormEvent)=>{
  event.preventDefault();if(!selection||busy)return;setBusy(true);setError('');fileVersion.current++;const selectedContact=contactId;
  try{
   if(selection.size>CONTACT_FILE_LIMIT)throw Error('Ogni file può pesare al massimo 2 MB.');
   if(!requestId.current)requestId.current=crypto.randomUUID();const form=new FormData();form.set('file',selection);form.set('workspaceId',user?.workspaceId||'');form.set('id',requestId.current);
   const response=await fetch(base,{method:'POST',body:form,signal:AbortSignal.timeout(30000)});const result=await response.json();if(!response.ok)throw Error(result.error||'Caricamento non riuscito.');
   if(active.current!==selectedContact)return;
   fileVersion.current++;setFiles(current=>[result.file,...current.filter(file=>file.id!==result.file.id)]);setSelection(null);requestId.current='';if(input.current)input.current.value='';
  }catch(error){if(active.current===selectedContact)setError((error as Error).message||'Connessione interrotta. Il file resta selezionato per riprovare.');}finally{if(active.current===selectedContact)setBusy(false);}
 };
 return <section className="contact-attachments" aria-labelledby="contact-files-title"><div className="contact-section-label"><div><h3 id="contact-files-title">Allegati</h3><p>Conserva qui resoconti, PDF e file delle chiamate.</p></div><span className="contact-diary-count">{files.length}</span></div>
  <form className="contact-file-upload" onSubmit={upload}><label htmlFor="contact-file-input">Scegli un documento o una registrazione</label><input id="contact-file-input" ref={input} type="file" accept=".pdf,.docx,.txt,.md,.csv,.mp3,.wav,.ogg,.opus,.m4a,.webm" disabled={busy} onChange={event=>{setSelection(event.target.files?.[0]||null);requestId.current=crypto.randomUUID();setError('');}} aria-describedby="contact-file-limits"/><div><small id="contact-file-limits">Massimo 2 MB per file · 20 allegati per contatto</small><button className="primary-button" disabled={busy||!selection}>{busy?'Caricamento…':'Carica allegato'}</button></div></form>
  {error&&<p className="inline-error" role="alert">{error}</p>}{loading?<p role="status">Caricamento allegati…</p>:files.length===0?<p className="contact-files-empty">Nessun allegato. Aggiungi il primo file quando ti serve.</p>:<ul className="contact-file-list">{files.map(file=><li key={file.id}><a href={base+'/'+encodeURIComponent(file.id)} download><span className="material-symbols-outlined" aria-hidden="true">{file.mime.startsWith('audio/')?'audio_file':'description'}</span><span><strong>{file.name}</strong><small>{Math.max(1,Math.ceil(file.size/1024))} KB · {file.authorName} · {new Intl.DateTimeFormat('it-IT',{dateStyle:'short',timeZone:'Europe/Rome'}).format(new Date(file.createdAt))}</small></span><span className="material-symbols-outlined" aria-hidden="true">download</span></a>{(user?.id===file.authorId||user?.role==='owner'||user?.role==='admin')&&<button type="button" aria-label={'Rimuovi allegato '+file.name} disabled={busy} onClick={async()=>{if(!window.confirm('Rimuovere questo allegato?'))return;setError('');setBusy(true);fileVersion.current++;try{const response=await fetch(base+'/'+encodeURIComponent(file.id),{method:'DELETE'});if(!response.ok)throw Error('Allegato non rimosso. Riprova.');if(active.current===contactId){fileVersion.current++;setFiles(current=>current.filter(item=>item.id!==file.id));}}catch(error){setError((error as Error).message);}finally{setBusy(false);}}}><span className="material-symbols-outlined" aria-hidden="true">delete</span></button>}</li>)}</ul>}
 </section>;
}
