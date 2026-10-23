import type {Layer} from './design';
/** Clamp both axes together, preserving the current ratio even at schema limits. */
export function layerSize(layer:Layer,axis:'width'|'height',value:number){
 if(!Number.isFinite(value))return{};
 if(!layer.aspectLocked)return{[axis]:Math.min(axis==='width'?3840:2160,Math.max(1,value))};
 const scale=Math.max(Math.max(1/layer.width,1/layer.height),Math.min(value/layer[axis],3840/layer.width,2160/layer.height));
 return{width:layer.width*scale,height:layer.height*scale};
}
