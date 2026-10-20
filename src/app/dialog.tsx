'use client';
import {useEffect,useRef} from 'react';

export function Dialog({children,className,labelledBy,onClose,busy=false}:{children:React.ReactNode;className:string;labelledBy:string;onClose:()=>void;busy?:boolean}){
 const ref=useRef<HTMLElement>(null);
 const close=useRef(onClose);close.current=onClose;
 const locked=useRef(busy);locked.current=busy;
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;
  const element=ref.current;
  const overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const focusable=()=>Array.from(element?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')||[]).filter(el=>el.getClientRects().length>0);
  (focusable()[0]||element)?.focus();
  function keydown(event:KeyboardEvent){
   if(event.key==='Escape'&&!locked.current){event.preventDefault();close.current();}
   if(event.key==='Tab'){
    const fields=focusable();const first=fields[0],last=fields.at(-1);
    if(!first){event.preventDefault();element?.focus();return;}
    if(event.shiftKey&&(document.activeElement===first||document.activeElement===element)){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
   }
  }
  document.addEventListener('keydown',keydown);
  return()=>{document.removeEventListener('keydown',keydown);document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();};
 },[]);
 return <div className="overlay"><section ref={ref} className={className} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}>{children}</section></div>;
}
