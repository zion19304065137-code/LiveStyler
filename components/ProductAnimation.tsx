"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {Pause,Play} from 'lucide-react';

export default function ProductAnimation({src="/livestyler-animation.html",title="LiveStyler 直播包装功能演示动画"}:{src?:string;title?:string}){
 const frame=useRef<HTMLIFrameElement>(null);
 const region=useRef<HTMLDivElement>(null);
 const [paused,setPaused]=useState(false);
 const visible=useRef(true);
 const preference=useRef(false);
 const sync=useCallback(()=>frame.current?.contentWindow?.postMessage({type:'livestyler-playback',playing:visible.current&&!preference.current},'*'),[]);
 useEffect(()=>{
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const update=()=>{preference.current=motion.matches;setPaused(motion.matches);sync();};
  update();motion.addEventListener('change',update);
  const observer=new IntersectionObserver(entries=>{visible.current=entries[0]?.isIntersecting??false;sync();});
  if(region.current)observer.observe(region.current);
  return()=>{observer.disconnect();motion.removeEventListener('change',update);};
 },[sync]);
 return <div className="product-animation" ref={region}>
  <iframe ref={frame} src={src} title={title} sandbox="allow-scripts" onLoad={sync}/>
  <button className="animation-playback" aria-label={paused?'播放演示动画':'暂停演示动画'} onClick={()=>{preference.current=!paused;setPaused(!paused);sync();}}>{paused?<Play size={14}/>:<Pause size={14}/>}</button>
 </div>;
}
