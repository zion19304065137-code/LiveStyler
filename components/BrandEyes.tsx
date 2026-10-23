"use client";
import {useEffect,useRef} from "react";

/** Separate gaze, eyelids and atmosphere so none clips or fights another motion. */
export default function BrandEyes({compact=false}:{compact?:boolean}={}){
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const el=root.current;if(!el)return;
  const preference=window.matchMedia("(prefers-reduced-motion: reduce)");
  const gazes=Array.from(el.querySelectorAll<HTMLElement>(".eye-gaze"));
  const values=gazes.map(()=>({x:0,y:0}));let target={x:0,y:0},lastPointer=-Infinity,frame=0,lastTime=0;
  const timers=new Set<ReturnType<typeof setTimeout>>();
  let stopped=false;
  const later=(callback:()=>void,delay:number)=>{const timer=setTimeout(()=>{timers.delete(timer);if(!stopped)callback();},delay);timers.add(timer);};
  const blink=(double=false)=>{
   if(document.hidden||preference.matches)return;
   el.dataset.blink="true";later(()=>{el.dataset.blink="false";if(double)later(()=>blink(),220);},165);
  };
  const nextBlink=()=>later(()=>{blink(Math.random()<.22);nextBlink();},3200+Math.random()*3800);
  later(()=>{blink();nextBlink();},2000+Math.random()*1200);
  const update=(now:number)=>{
   if(stopped)return;
   const dt=Math.min(48,lastTime?now-lastTime:16);lastTime=now;
   const awake=now-lastPointer<2800;
   const gazeEase=1-Math.exp(-dt/110);
   gazes.forEach((eye,i)=>{
    const tx=awake&&!preference.matches?target.x:0,ty=awake&&!preference.matches?target.y:0;
    values[i].x+=(tx-values[i].x)*gazeEase;values[i].y+=(ty-values[i].y)*gazeEase;
    eye.style.setProperty("--gaze-x",values[i].x.toFixed(2)+"px");eye.style.setProperty("--gaze-y",values[i].y.toFixed(2)+"px");
   });
   if(!document.hidden)frame=requestAnimationFrame(update);
  };
  const move=(event:PointerEvent)=>{
   if(event.pointerType==="touch")return;
   const box=el.getBoundingClientRect(),dx=event.clientX-box.left-box.width/2,dy=event.clientY-box.top-box.height/2,distance=Math.hypot(dx,dy);
   const proximity=Math.max(0,Math.min(1,(280-distance)/210));
   el.style.setProperty("--eye-near",(proximity*proximity*(3-2*proximity)).toFixed(3));
   if(preference.matches)return;
   const amount=Math.min(1,distance/160);
   const size=compact ? 0.34 : 1;
   target={x:distance?dx/distance*10*amount*size:0,y:distance?dy/distance*7*amount*size:0};lastPointer=performance.now();
  };
  const rest=()=>{lastPointer=-Infinity;el.style.setProperty("--eye-near","0");};
  const leave=(event:PointerEvent)=>{if(!event.relatedTarget)rest();};
  const visibility=()=>{cancelAnimationFrame(frame);lastTime=0;rest();el.dataset.blink="false";if(!document.hidden)frame=requestAnimationFrame(update);};
  const reduce=()=>{el.dataset.blink="false";rest();};
  frame=requestAnimationFrame(update);
  window.addEventListener("pointermove",move,{passive:true});window.addEventListener("blur",rest);document.addEventListener("pointerout",leave);document.addEventListener("visibilitychange",visibility);preference.addEventListener("change",reduce);
  return()=>{stopped=true;cancelAnimationFrame(frame);timers.forEach(clearTimeout);window.removeEventListener("pointermove",move);window.removeEventListener("blur",rest);document.removeEventListener("pointerout",leave);document.removeEventListener("visibilitychange",visibility);preference.removeEventListener("change",reduce);};
 },[compact]);
 return <div className={compact?"brand-eyes brand-eyes-compact":"brand-eyes"} ref={root} role="img" aria-label="LiveStyler 双眼，会眨眼并跟随鼠标" data-blink="false">
  <div className="eye-atmosphere">{[0,1].map(i=><span className="brand-eye-opening" key={i}><span className="eye-gaze"><span className="eye-wake"><span className="eye-lid"><span className="brand-eye"/></span></span></span></span>)}</div>
 </div>;
}
