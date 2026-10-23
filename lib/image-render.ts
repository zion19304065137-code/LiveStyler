import Konva from 'konva';
import type {Layer} from './design';
export function imageGeometry(source:{width:number;height:number},box:{width:number;height:number},layer:Pick<Layer,'imageCrop'|'imageFit'|'type'>){
 const c=layer.imageCrop||{x:0,y:0,width:1,height:1};let sx=c.x*source.width,sy=c.y*source.height,sw=c.width*source.width,sh=c.height*source.height,dx=0,dy=0,dw=box.width,dh=box.height;
 const fit=layer.imageFit||(layer.type==='background'?'cover':'stretch'),ratio=box.width/box.height;
 if(fit==='cover'){if(sw/sh>ratio){const width=sh*ratio;sx+=(sw-width)/2;sw=width;}else{const height=sw/ratio;sy+=(sh-height)/2;sh=height;}}
 if(fit==='contain'){const scale=Math.min(box.width/sw,box.height/sh);dw=sw*scale;dh=sh*scale;dx=(box.width-dw)/2;dy=(box.height-dh)/2;}
 return {sx,sy,sw,sh,dx,dy,dw,dh};
}
export function updateImageCrop(layer:Layer,key:'x'|'y'|'width'|'height',value:number){
 const c={x:0,y:0,width:1,height:1,...layer.imageCrop};c[key]=Math.max(key==='width'||key==='height'?.01:0,Math.min(1,Number.isFinite(value)?value:0));c.x=Math.min(.99,c.x);c.y=Math.min(.99,c.y);c.width=Math.max(.01,Math.min(c.width,1-c.x));c.height=Math.max(.01,Math.min(c.height,1-c.y));return c;
}
function maskPath(context:Konva.Context,layer:Layer,width:number,height:number){
 context.beginPath();if(layer.mask==='ellipse')context.ellipse(width/2,height/2,width/2,height/2,0,0,Math.PI*2);else if(layer.mask==='rounded')context.roundRect(0,0,width,height,Math.min(layer.cornerRadius??32,width/2,height/2));else context.rect(0,0,width,height);context.closePath();
}
const maskedImages=new WeakMap<Konva.Image,{image:CanvasImageSource;key:string;canvas:HTMLCanvasElement}>();
/** Same scene function is retained by Konva clones, so preview/PNG/ZIP share the mask. */
export function imageRenderProps(layer:Layer){
 if(!layer.mask&&!layer.imageCrop&&!layer.imageFit&&!layer.flipX&&!layer.flipY)return {};
 return {sceneFunc(context:Konva.Context,node:Konva.Shape){
  const shape=node as Konva.Image;
  const image=shape.image() as (CanvasImageSource&{naturalWidth?:number;naturalHeight?:number;videoWidth?:number;videoHeight?:number;width:number;height:number})|undefined;if(!image)return;
  const width=shape.width(),height=shape.height(),g=imageGeometry({width:image.naturalWidth||image.videoWidth||image.width,height:image.naturalHeight||image.videoHeight||image.height},{width,height},layer);
  if(shape.hasShadow()){
   const key=JSON.stringify([width,height,g,layer.mask,layer.cornerRadius,layer.flipX,layer.flipY]);let cached=maskedImages.get(shape);
   if(!cached||cached.image!==image||cached.key!==key){
    const canvas=Konva.Util.createCanvasElement();canvas.width=Math.ceil(width);canvas.height=Math.ceil(height);const ctx=canvas.getContext('2d')!;
    ctx.save();maskPath(ctx as unknown as Konva.Context,layer,width,height);ctx.clip();ctx.translate(layer.flipX?width:0,layer.flipY?height:0);ctx.scale(layer.flipX?-1:1,layer.flipY?-1:1);ctx.drawImage(image,g.sx,g.sy,g.sw,g.sh,g.dx,g.dy,g.dw,g.dh);ctx.restore();
    cached={image,key,canvas};maskedImages.set(shape,cached);
   }
   context.drawImage(cached.canvas,0,0,width,height);return;
  }
  context.save();maskPath(context,layer,width,height);context.clip();context.translate(layer.flipX?width:0,layer.flipY?height:0);context.scale(layer.flipX?-1:1,layer.flipY?-1:1);context.drawImage(image,g.sx,g.sy,g.sw,g.sh,g.dx,g.dy,g.dw,g.dh);context.restore();
 },hitFunc(context:Konva.Context,shape:Konva.Shape){maskPath(context,layer,shape.width(),shape.height());context.fillStrokeShape(shape);}};
}
