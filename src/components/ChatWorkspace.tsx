'use client';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from '@/lib/auth';
import {useCRM} from '@/lib/store';
import {playAiBriefing,stopAllAudio} from '@/lib/speechVoice';
import BorderGlow from './reactbits/BorderGlow';
import DotGrid from './reactbits/DotGrid';
type Message={id:string;role:'user'|'assistant';text:string;model:string;created_at?:string};
type Thread={id:string;title:string};
type Model={id:string;label:string};
export function ChatWorkspace(){
 const {user,refreshSession}=useAuth();const {theme}=useCRM();
 const [threads,setThreads]=useState<Thread[]>([]);const [threadId,setThreadId]=useState<string|null>(null);const [messages,setMessages]=useState<Message[]>([]);
 const [models,setModels]=useState<Model[]>([{id:'workspace-local',label:'Assistente workspace · locale'}]);const [model,setModel]=useState('workspace-local');
 const [text,setText]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [includeWorkspace,setIncludeWorkspace]=useState(false);
 const [voiceOn,setVoiceOn]=useState(false);const [voiceState,setVoiceState]=useState('');const voiceRef=useRef(false);const recognitionRef=useRef<any>(null);
 const sendRef=useRef<(value:string)=>Promise<void>>(async()=>{});const startRecognitionRef=useRef<()=>void>(()=>{});const requestRef=useRef<{id:string;text:string}|null>(null);
 const archiveKey=user?.id+':'+user?.workspaceId;const archiveRef=useRef(archiveKey);archiveRef.current=archiveKey;
 const busyRef=useRef(false);const threadRef=useRef<string|null>(null);threadRef.current=threadId;const loadVersion=useRef(0);const bottomRef=useRef<HTMLDivElement>(null);
 const invalidateLoads=useCallback(()=>{loadVersion.current++;},[]);
 const load=useCallback(async(id:string|null)=>{
  const version=++loadVersion.current;
  try{const response=await fetch('/api/chat'+(id?'?threadId='+encodeURIComponent(id):''),{cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();if(version!==loadVersion.current)return;setThreads(data.threads);setModels(data.models);if(id)setMessages(data.messages);setError('');}
  catch{setError('Impossibile aggiornare la chat. Riprova.');}
 },[]);
 useEffect(()=>{setThreadId(null);setMessages([]);void load(null);const poll=window.setInterval(()=>{if(!busyRef.current&&document.visibilityState==='visible')void load(threadRef.current);},8000);return()=>{invalidateLoads();window.clearInterval(poll);};},[user?.id,user?.workspaceId,load,invalidateLoads]);
 useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth',block:'end'});},[messages,busy]);
 useEffect(()=>()=>{voiceRef.current=false;recognitionRef.current?.abort();stopAllAudio();},[]);
 const stopVoice=()=>{voiceRef.current=false;setVoiceOn(false);setVoiceState('');recognitionRef.current?.abort();stopAllAudio();};
 startRecognitionRef.current=()=>{
  if(!voiceRef.current)return;
  const Recognition=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
  if(!Recognition){setError('La dettatura non è disponibile in questo browser. Puoi scrivere e ascoltare le risposte.');stopVoice();return;}
  const recognition=new Recognition();recognitionRef.current=recognition;recognition.lang='it-IT';recognition.continuous=false;recognition.interimResults=true;
  let finalText='';recognition.onstart=()=>setVoiceState('Ti ascolto…');
  recognition.onresult=(event:any)=>{const result=Array.from(event.results as any).map((part:any)=>part[0].transcript).join(' ');setText(result);if(event.results[event.results.length-1].isFinal)finalText=result;};
  recognition.onerror=(event:any)=>{if(event.error!=='aborted'){setError(event.error==='not-allowed'?'Autorizza il microfono per avviare la chat vocale.':'Ascolto interrotto. Tocca di nuovo il microfono per riprendere.');stopVoice();}};
  recognition.onend=()=>{if(finalText&&voiceRef.current)void sendRef.current(finalText);else if(voiceRef.current){setVoiceState('In pausa · premi il microfono per riprendere');voiceRef.current=false;setVoiceOn(false);}};
  try{recognition.start();}catch{setError('Microfono occupato. Riprova.');stopVoice();}
 };
 const speak=(reply:string)=>{setVoiceState('Sto rispondendo…');void playAiBriefing({text:reply,onEnd:()=>{if(voiceRef.current)startRecognitionRef.current();},onError:()=>{if(voiceRef.current){setVoiceState('Audio non disponibile');stopVoice();}}});};
 const send=async(value:string)=>{
  const prompt=value.trim();if(!prompt||busyRef.current)return;
  busyRef.current=true;setBusy(true);setError('');setVoiceState(voiceRef.current?'Sto elaborando…':'');
  if(!requestRef.current||requestRef.current.text!==prompt)requestRef.current={id:crypto.randomUUID(),text:prompt};
  const requestId=requestRef.current.id; loadVersion.current++;
  const activeArchive = user?.id + ':' + user?.workspaceId;
  setMessages((current)=>current.some((message)=>message.id===requestId)?current:[...current,{id:requestId,role:'user',text:prompt,model}]);setText('');
  try{
   const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workspaceId:user?.workspaceId,threadId:threadRef.current,text:prompt,requestId,model,includeWorkspace}),signal:AbortSignal.timeout(55000)});
   const result=await response.json();if(result.code==='workspace_changed')void refreshSession();if(archiveRef.current!==activeArchive)return;if(result.threadId){threadRef.current=result.threadId;setThreadId(result.threadId);}
   if(!response.ok)throw Error(result.error||'Risposta non disponibile.');
   requestRef.current=null;setMessages((current)=>[...current.filter((message)=>message.id!=='reply-'+requestId),{id:'reply-'+requestId,role:'assistant',text:result.reply,model:result.model}]);
   if(voiceRef.current)speak(result.reply);
   void load(result.threadId);
  }catch(err){setError((err as Error).message||'Connessione interrotta. Riprova.');setText(prompt);if(voiceRef.current)stopVoice();}
  finally{busyRef.current=false;setBusy(false);}
 };
 sendRef.current=send;
 const hasMessages=messages.length>0;
 return <div className={'chat-workspace '+(hasMessages?'has-messages':'')}>
  <div className="chat-dot-backdrop" aria-hidden="true"><DotGrid dotSize={2} gap={24} baseColor={theme==='light'?'#a5a5b8':'#41414f'} activeColor={theme==='light'?'#6860bc':'#b8a8ff'} proximity={190} strength={5} bounce={0.8} tension={0.3} shockStrength={14} opacity={0.35} intro={false}/></div>
  <div className="chat-topline"><div><span className="section-eyebrow">COPILOTA</span><span>Uno spazio per pensare e agire meglio.</span></div><button className="quiet-button" disabled={busy} onClick={()=>{loadVersion.current++;stopVoice();setThreadId(null);threadRef.current=null;setMessages([]);setText('');requestRef.current=null;setError('');}}><span className="material-symbols-outlined">add</span> Nuova chat</button></div>
  <div className="chat-content">{!hasMessages&&<div className="chat-welcome"><span className="chat-spark" aria-hidden="true">✧</span><h1>Da cosa partiamo, {user?.name.split(' ')[0]}?</h1><p>Metti a fuoco una conversazione, un cliente, la prossima idea.</p></div>}
  {hasMessages&&<div className="chat-messages" aria-live="polite">{messages.map((message)=><article key={message.id} className={'chat-message '+message.role}><span className="chat-message-label">{message.role==='user'?'Tu':message.model==='workspace-local'?'Assistente workspace':'Copilota'}</span><p>{message.text}</p>{message.role==='assistant'&&<button className="chat-listen" aria-label="Ascolta risposta" onClick={()=>void playAiBriefing({text:message.text})}><span className="material-symbols-outlined">volume_up</span></button>}</article>)}{busy&&<div className="chat-thinking" role="status"><span/><span/><span/> Sto preparando la risposta</div>}<div ref={bottomRef}/></div>}
  <div className="chat-composer-area">{error&&<div className="inline-error" role="alert">{error}</div>}<BorderGlow className="chat-border-glow" backgroundColor={theme==='light'?'#ffffff':theme==='oled'?'#070709':'#141419'} borderRadius={22} glowColor="255 80 75" glowIntensity={0.6} fillOpacity={0.06} colors={['#a5a1ff','#7badee','#c797e5']}><form className="chat-composer" onSubmit={(event)=>{event.preventDefault();void send(text);}}><textarea aria-label="Messaggio al copilota" data-presence-focus="Messaggio chat" value={text} onChange={(event)=>setText(event.target.value)} placeholder="Chiedi, ragiona, prepara una conversazione…" rows={hasMessages?2:3} maxLength={8000} onKeyDown={(event)=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void send(text);}}}/><div className="chat-composer-controls"><select aria-label="Modello AI" value={model} onChange={(event)=>setModel(event.target.value)} disabled={busy}>{models.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select><div><button className={'chat-mic '+(voiceOn?'active':'')} type="button" aria-pressed={voiceOn} aria-label={voiceOn?'Termina chat vocale':'Avvia chat vocale'} onClick={()=>{if(voiceOn)stopVoice();else{voiceRef.current=true;setVoiceOn(true);startRecognitionRef.current();}}}><span className="material-symbols-outlined">{voiceOn?'stop_circle':'graphic_eq'}</span></button><button className="chat-send" type="submit" disabled={busy||!text.trim()} aria-label="Invia messaggio"><span className="material-symbols-outlined">{busy?'hourglass_top':'arrow_upward'}</span></button></div></div></form></BorderGlow><div className="chat-context-row"><label><input type="checkbox" checked={includeWorkspace} onChange={(event)=>setIncludeWorkspace(event.target.checked)}/> Usa contesto CRM</label><small>{voiceState|| (includeWorkspace?'Invia aziende, località e classificazioni al modello selezionato.':'Le chat sono personali. Verifica le risposte prima di usarle.')}</small></div></div>
  {!hasMessages&&<div className="chat-suggestions">{['Quali aziende devo richiamare?','Fammi un riepilogo dei contatti','Aiutami a preparare una telefonata'].map((suggestion)=><button key={suggestion} onClick={()=>void send(suggestion)}>{suggestion}<span className="material-symbols-outlined">north_east</span></button>)}</div>}
  {!hasMessages&&threads.length>0&&<div className="chat-recent"><span className="section-eyebrow">RIPRENDI UNA CONVERSAZIONE</span>{threads.slice(0,5).map((thread)=><button key={thread.id} onClick={()=>{setThreadId(thread.id);threadRef.current=thread.id;void load(thread.id);}}><span className="material-symbols-outlined">chat_bubble_outline</span>{thread.title}<span className="material-symbols-outlined">arrow_forward</span></button>)}</div>}
  </div>
 </div>;
}
