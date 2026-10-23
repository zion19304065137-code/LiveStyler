import type {Project} from './design';
export type ProtectedRect = {x:number;y:number;width:number;height:number};
export function clampArea(a:ProtectedRect,p:Pick<Project,'width'|'height'>):ProtectedRect {
  const width=Math.min(p.width,Math.max(24,a.width)),height=Math.min(p.height,Math.max(24,a.height));
  return {width,height,x:Math.min(p.width-width,Math.max(0,a.x)),y:Math.min(p.height-height,Math.max(0,a.y))};
}
export function presetArea(p:Pick<Project,'width'|'height'>,ratio:number):ProtectedRect {
  const width=Math.min(p.width*.88,p.height*.68*ratio),height=width/ratio;
  return clampArea({x:(p.width-width)/2,y:(p.height-height)/2,width,height},p);
}
