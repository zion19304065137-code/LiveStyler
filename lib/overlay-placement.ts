/** Map separate objects to the target frame without distorting their lettering. */
export function placeOverlayObject(rect:{x:number;y:number;width:number;height:number},source:{width:number;height:number},target:{width:number;height:number}) {
 const scale=Math.min(target.width/source.width,target.height/source.height);
 const width=rect.width*scale,height=rect.height*scale;
 return {x:Math.max(0,Math.min(target.width-width,(rect.x+rect.width/2)/source.width*target.width-width/2)),y:Math.max(0,Math.min(target.height-height,(rect.y+rect.height/2)/source.height*target.height-height/2)),width,height};
}
