"use client";
import {useEffect,useRef,useState,useCallback} from 'react';

/** Buffer cumulative network chunks; reveal characters independently of packet boundaries. */
export function useTypingPreview(){
 const [text,setText]=useState('');
 const state=useRef({target:[] as string[],shown:0,frame:0,last:0,credit:0,pause:0,speed:62,reduced:false,disposed:false,waiters:[] as (()=>void)[]});
 const settle=()=>{state.current.waiters.splice(0).forEach(resolve=>resolve());};
 const tick=useCallback((now:number)=>{
  const s=state.current;if(s.disposed)return;
  const dt=Math.min(48,s.last?now-s.last:16);s.last=now;
  const remaining=s.target.length-s.shown;
  // Packet size must never turn into a sudden paragraph-sized burst.
  // Ease toward a bounded pace, with small pauses at natural reading boundaries.
  s.speed+=(Math.min(90,62+remaining/100)-s.speed)*Math.min(1,dt/400);
  if(s.pause>0)s.pause=Math.max(0,s.pause-dt);
  else s.credit=Math.min(2,s.credit+dt*s.speed/1000);
  let count=s.reduced?remaining:Math.min(remaining,2,Math.floor(s.credit));
  if(!s.reduced&&count>0){
   for(let i=0;i<count;i++){
    const char=s.target[s.shown+i];
    if(/[。！？!?；;]/.test(char)||char==='\n'){
     count=i+1;s.pause=char==='\n'?100:80;break;
    }
   }
  }
  if(count>0){s.shown+=count;s.credit=Math.max(0,s.credit-count);if(s.pause)s.credit=0;setText(s.target.slice(0,s.shown).join(''));}
  if(s.shown<s.target.length)s.frame=requestAnimationFrame(tick);
  else{s.frame=0;s.last=0;s.credit=0;s.pause=0;settle();}
 },[]);
 const push=useCallback((value:string)=>{
  const s=state.current;if(s.disposed)return;
  const next=Array.from(value);let shared=0;
  while(shared<Math.min(s.shown,next.length)&&next[shared]===s.target[shared])shared++;
  s.shown=shared;s.target=next;
  if(!value){cancelAnimationFrame(s.frame);s.frame=0;s.last=0;s.credit=0;s.pause=0;s.speed=62;setText('');settle();return;}
  if(!s.frame)s.frame=requestAnimationFrame(tick);
 },[tick]);
 const finish=useCallback((value:string)=>{push(value);const s=state.current;if(s.disposed||s.shown===s.target.length)return Promise.resolve();return new Promise<void>(resolve=>s.waiters.push(resolve));},[push]);
 useEffect(()=>{const s=state.current;s.disposed=false;const preference=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>{s.reduced=preference.matches;};update();preference.addEventListener('change',update);return()=>{s.disposed=true;cancelAnimationFrame(s.frame);s.frame=0;settle();preference.removeEventListener('change',update);};},[]);
 return [text,push,finish] as const;
}
