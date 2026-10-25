'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useContacts } from '@/lib/contacts';
const viewNames: Record<string,string> = { cockpit:'Panoramica',contacts:'Contatti',chat:'Chat AI',focus:'Focus',kanban:'Pipeline',opportunities:'Opportunità',calendar:'Attività',standby:'Avvisi',analytics:'Analisi' };
const sessionColor = (number:number) => 'hsl(' + ((number * 137.508) % 360) + ' 70% 70%)';
type Session = { number:number; name:string; device:string; view:string; targetId:string; focus:string; lastSeen:string; isSelf:boolean };
export function PresenceBar({ view }: { view:string }) {
  const { selectedId, contacts } = useContacts();
  const [sessions,setSessions] = useState<Session[]>([]);
  const [expanded,setExpanded] = useState(false);
  const latest = useRef({ view, targetId:selectedId, focus:'' });
  latest.current.view=view; latest.current.targetId=selectedId;
  useEffect(() => {
    let tabId = sessionStorage.getItem('hub_presence_tab');
    if (!tabId) { tabId=crypto.randomUUID();sessionStorage.setItem('hub_presence_tab',tabId); }
    let cancelled=false;
    const beat = async () => {
      if (document.visibilityState !== 'visible') return;
      try { const response=await fetch('/api/presence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tabId,...latest.current})});if (response.ok) { const data=await response.json();if (!cancelled) setSessions(data.sessions); } } catch {}
    };
    const focus = (event:FocusEvent) => { const element=event.target as HTMLElement;latest.current.focus=element.getAttribute('data-presence-focus') || element.getAttribute('aria-label') || (element.matches('input,textarea,select') ? 'Anagrafica' : '');void beat(); };
    void beat();const interval=window.setInterval(()=>void beat(),10000);document.addEventListener('focusin',focus);window.addEventListener('focus',beat);
    return ()=>{cancelled=true;window.clearInterval(interval);document.removeEventListener('focusin',focus);window.removeEventListener('focus',beat);};
  },[]);
  useEffect(()=>{latest.current.focus='';},[view,selectedId]);
  if (!sessions.length) return null;
  return <div className="presence-wrap"><button className="presence-summary" onClick={()=>setExpanded(!expanded)} aria-expanded={expanded} aria-label="Sessioni presenti nel workspace"><span className="presence-dots">{sessions.slice(0,4).map((session)=><span key={session.number} style={{background:sessionColor(session.number)}}>{session.number}</span>)}</span><span>{sessions.length} {sessions.length===1?'sessione':'sessioni'} online</span><span className="material-symbols-outlined">expand_more</span></button>{expanded&&<div className="presence-popover"><strong>Nel workspace adesso</strong><p>Ogni numero identifica una sessione o un dispositivo.</p>{sessions.map((session)=><div key={session.number}><span className="presence-number" style={{background:sessionColor(session.number)}}>{session.number}</span><span><strong>{session.name}{session.isSelf?' · tu':''}</strong><small>{session.device}</small><small>{viewNames[session.view] || session.view}{session.targetId?' / '+(contacts.find((contact)=>contact.id===session.targetId)?.company || 'Scheda contatto'):''}{session.focus?' · '+session.focus:''}</small></span></div>)}</div>}</div>;
}
