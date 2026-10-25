'use client';
import {useEffect} from 'react';
// Keeps keyboard focus inside the topmost dialog, including nested command palettes.
export function ModalFocusManager(){
 useEffect(()=>{
  let top:HTMLElement|null=null;let previous:HTMLElement|null=null;const priorOverflow=document.body.style.overflow;
  const update=()=>{
   const dialogs=Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')).filter((dialog)=>dialog.getClientRects().length>0);
   dialogs.sort((a,b)=>Number(getComputedStyle(a.parentElement!).zIndex||0)-Number(getComputedStyle(b.parentElement!).zIndex||0));
   const next=dialogs.at(-1)||null;if(next===top)return;
   if(next){if(!top)previous=document.activeElement as HTMLElement;top=next;document.body.style.overflow='hidden';const target=next.querySelector<HTMLElement>('[autofocus],textarea,input:not([type="hidden"]),button,select,[tabindex="0"]');target?.focus({preventScroll:true});}
   else{top=null;document.body.style.overflow=priorOverflow;if(previous?.isConnected)previous.focus({preventScroll:true});previous=null;}
  };
  const keys=(event:KeyboardEvent)=>{
   if(!top)return;
   if(event.key==='Escape'){const close=top.querySelector<HTMLElement>('button[aria-label^="Chiudi"]');if(close){event.preventDefault();event.stopPropagation();close.click();}return;}
   if(event.key!=='Tab')return;
   const items=Array.from(top.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled):not([type="hidden"]),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')).filter((element)=>element.getClientRects().length>0);
   const first=items[0],last=items.at(-1);if(!first){event.preventDefault();return;}
   if(event.shiftKey&&(document.activeElement===first||!top.contains(document.activeElement))){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&(document.activeElement===last||!top.contains(document.activeElement))){event.preventDefault();first.focus();}
  };
  const observer=new MutationObserver(update);observer.observe(document.body,{childList:true,subtree:true});document.addEventListener('keydown',keys,true);update();
  return()=>{observer.disconnect();document.removeEventListener('keydown',keys,true);document.body.style.overflow=priorOverflow;};
 },[]);
 return null;
}
