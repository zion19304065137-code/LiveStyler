import type {Project,Layer} from './design';
export const FOOTAGE_ID='__footage';
export function layerStack(p:Project):(Layer|null)[]{
 if(p.mode!=='overlay')return [...p.layers];
 const i=Math.max(0,Math.min(p.layers.length,p.footageIndex??0));
 return [...p.layers.slice(0,i),null,...p.layers.slice(i)];
}
export function reorderLayer(p:Project,id:string,delta:number):Project{
 if(id===FOOTAGE_ID?p.footageLocked!==false:p.layers.find(l=>l.id===id)?.locked)return p;
 const stack=layerStack(p),i=stack.findIndex(l=>(l?.id??FOOTAGE_ID)===id),j=i+delta;
 if(i<0||j<0||j>=stack.length)return p;
 [stack[i],stack[j]]=[stack[j],stack[i]];
 return {...p,layers:stack.filter((l):l is Layer=>!!l),...(p.mode==='overlay'?{footageIndex:stack.indexOf(null)}:{})};
}
