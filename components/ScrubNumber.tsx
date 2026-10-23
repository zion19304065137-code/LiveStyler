"use client";
import {useRef,type InputHTMLAttributes} from 'react';
export default function ScrubNumber(props:InputHTMLAttributes<HTMLInputElement>) {
  const drag=useRef<{x:number;value:number;active:boolean;pointer:number}|undefined>(undefined);
  const end=(e:React.PointerEvent<HTMLInputElement>)=>{const d=drag.current;if(d?.active){e.preventDefault();e.currentTarget.releasePointerCapture(d.pointer);e.currentTarget.blur();}drag.current=undefined;};
  return <input {...props} title="左右拖动调整 · Shift 加速 · Alt 精调" style={{...props.style,cursor:'ew-resize',touchAction:'none'}}
    onPointerDown={e=>{if(e.button!==0||props.disabled||props.readOnly)return;drag.current={x:e.clientX,value:Number(props.value)||0,active:false,pointer:e.pointerId};e.currentTarget.setPointerCapture(e.pointerId);}}
    onPointerMove={e=>{const d=drag.current;if(!d)return;const dx=e.clientX-d.x;if(!d.active&&Math.abs(dx)<4)return;d.active=true;e.preventDefault();const step=Number(props.step)||1;const multiplier=e.altKey?.1:e.shiftKey?10:1;const v=Math.min(props.max===undefined?Infinity:Number(props.max),Math.max(props.min===undefined?-Infinity:Number(props.min),d.value+Math.round(dx*multiplier)*step));const el=e.currentTarget;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!;setter.call(el,String(Number(v.toFixed(4))));props.onChange?.({target:el,currentTarget:el} as React.ChangeEvent<HTMLInputElement>);}}
    onPointerUp={end} onPointerCancel={end} onLostPointerCapture={()=>{drag.current=undefined;}} />;
}
