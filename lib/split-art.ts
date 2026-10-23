export type ArtRect={x:number;y:number;width:number;height:number};
type Segmentation={rects:ArtRect[];owners:Int16Array;cols:number;step:number};
const NOISE_ALPHA=6;
/** Find solid artwork first; faint shadows must not glue independent stickers together. */
function segment(rgba:Uint8ClampedArray,width:number,height:number):Segmentation {
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||rgba.length!==width*height*4)throw Error('图片像素无效');
 const step=8,cols=Math.ceil(width/step),rows=Math.ceil(height/step),size=cols*rows;
 const counts=new Uint16Array(size),owners=new Int16Array(size);owners.fill(-1);
 const buildMask=(alpha:number)=>{
  counts.fill(0);const mask=new Uint8Array(size);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(rgba[(y*width+x)*4+3]>=alpha)counts[Math.floor(y/step)*cols+Math.floor(x/step)]++;
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const area=Math.min(step,width-x*step)*Math.min(step,height-y*step);mask[y*cols+x]=counts[y*cols+x]>=Math.max(1,Math.ceil(area*.2))?1:0;}
  return mask;
 };
 let mask=buildMask(64);if(!mask.some(Boolean))mask=buildMask(16);
 const groups:number[][]=[];
 for(let start=0;start<size;start++){
  if(!mask[start])continue;const cells=[start];mask[start]=0;
  for(let i=0;i<cells.length;i++){const n=cells[i],x=n%cols,y=Math.floor(n/cols);
   // Join nearby glyphs with their plaque, but ignore sparse one-pixel bridges.
   for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=cols||yy>=rows)continue;const k=yy*cols+xx;if(mask[k]){mask[k]=0;cells.push(k);}}
  }
  groups.push(cells);
 }
 // Tiny speckles are attached later to their nearest real object, never made into layers.
 let seeds=groups.filter(g=>g.length>=2).sort((a,b)=>b.length-a.length).slice(0,24);
 if(!seeds.length&&groups.length)seeds=[groups.sort((a,b)=>b.length-a.length)[0]];
 if(!seeds.length){const all:number[]=[];for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(rgba[(y*width+x)*4+3]>NOISE_ALPHA)all.push(Math.floor(y/step)*cols+Math.floor(x/step));if(all.length)seeds=[[all[0]]];}
 // Multi-source expansion assigns every retained pixel to one object. Unlike rectangular
 // cropping, this preserves overlapping shadow bounds without duplicating other stickers.
 const queue=new Int32Array(size);let head=0,tail=0;
 seeds.forEach((cells,id)=>cells.forEach(n=>{owners[n]=id;queue[tail++]=n;}));
 while(head<tail){const n=queue[head++],x=n%cols,y=Math.floor(n/cols);for(const k of [x>0?n-1:-1,x+1<cols?n+1:-1,y>0?n-cols:-1,y+1<rows?n+cols:-1])if(k>=0&&owners[k]<0){owners[k]=owners[n];queue[tail++]=k;}}
 const bounds=seeds.map(()=>({left:width,top:height,right:-1,bottom:-1}));
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){if(rgba[(y*width+x)*4+3]<=NOISE_ALPHA)continue;const id=owners[Math.floor(y/step)*cols+Math.floor(x/step)];if(id<0)continue;const b=bounds[id];b.left=Math.min(b.left,x);b.top=Math.min(b.top,y);b.right=Math.max(b.right,x);b.bottom=Math.max(b.bottom,y);}
 const order=bounds.map((b,id)=>({b,id})).filter(({b})=>b.right>=0).sort((a,b)=>a.b.top-b.b.top||a.b.left-b.b.left);
 const remap=new Int16Array(seeds.length);remap.fill(-1);order.forEach(({id},i)=>remap[id]=i);for(let i=0;i<size;i++)if(owners[i]>=0)owners[i]=remap[owners[i]];
 return{rects:order.map(({b})=>({x:b.left,y:b.top,width:b.right-b.left+1,height:b.bottom-b.top+1})),owners,cols,step};
}
export function findArtObjects(rgba:Uint8ClampedArray,width:number,height:number):ArtRect[]{return segment(rgba,width,height).rects;}
/** Pixel masks ensure reassembling the pieces does not double any text, shadow or glow. */
export function splitArtPixels(rgba:Uint8ClampedArray,width:number,height:number){
 const {rects,owners,cols,step}=segment(rgba,width,height);
 const pieces=rects.map(rect=>({...rect,data:new Uint8ClampedArray(rect.width*rect.height*4)}));
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const from=(y*width+x)*4;if(rgba[from+3]<=NOISE_ALPHA)continue;const id=owners[Math.floor(y/step)*cols+Math.floor(x/step)];if(id<0)continue;const p=pieces[id],to=((y-p.y)*p.width+x-p.x)*4;p.data.set(rgba.subarray(from,from+4),to);}
 return pieces;
}
export async function splitArtImage(src:string){
 const image=new Image();image.src=src;await image.decode();const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext('2d')!;ctx.drawImage(image,0,0);
 const pieces=splitArtPixels(ctx.getImageData(0,0,c.width,c.height).data,c.width,c.height);
 return pieces.map(({data,...rect})=>{const piece=document.createElement('canvas');piece.width=rect.width;piece.height=rect.height;piece.getContext('2d')!.putImageData(new ImageData(data,rect.width,rect.height),0,0);return{x:rect.x/c.width,y:rect.y/c.height,width:rect.width/c.width,height:rect.height/c.height,src:piece.toDataURL('image/png')};});
}
