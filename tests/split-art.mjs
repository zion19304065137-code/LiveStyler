import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const source=ts.transpileModule(fs.readFileSync('lib/split-art.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {findArtObjects}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const w=320,h=240,pixels=new Uint8ClampedArray(w*h*4);
const draw=(x,y,width,height)=>{for(let yy=y;yy<y+height;yy++)for(let xx=x;xx<x+width;xx++)pixels[(yy*w+xx)*4+3]=255;};
assert.deepEqual(findArtObjects(pixels,w,h),[]);
draw(0,0,90,32);draw(105,8,8,16);draw(230,180,90,60);
const objects=findArtObjects(pixels,w,h);assert.equal(objects.length,2,'Nearby lettering joins its plaque, separated material stays independent');
for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[(y*w+x)*4+3])assert.equal(objects.filter(r=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height).length,1,'Every visible pixel belongs to exactly one crop');
assert.equal(objects[1].x+objects[1].width,w);assert.equal(objects[1].y+objects[1].height,h);
pixels.fill(255);assert.equal(findArtObjects(pixels,w,h).length,1,'Opaque connected artwork is not falsely described as separate objects');
console.log('PASS: transparent-gap object splitting retains lettering, exact pixel coverage, edge pixels and connected artwork.');
const {splitArtPixels}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function fixture(){const p=new Uint8ClampedArray(w*h*4);const fill=(x,y,ww,hh,a)=>{for(let yy=y;yy<y+hh;yy++)for(let xx=x;xx<x+ww;xx++){const i=(yy*w+xx)*4;p.set([60,100,180,a],i);}};return{p,fill};}
function verify(p,pieces){const rebuilt=new Uint8ClampedArray(p.length),hits=new Uint8Array(w*h);for(const b of pieces)for(let y=0;y<b.height;y++)for(let x=0;x<b.width;x++){const i=(y*b.width+x)*4;if(!b.data[i+3])continue;const dst=(y+b.y)*w+x+b.x;hits[dst]++;rebuilt.set(b.data.subarray(i,i+4),dst*4);}for(let i=0;i<w*h;i++){assert(hits[i]<=1,'No shadow/text pixels can be duplicated');if(p[i*4+3]>6)assert.deepEqual(rebuilt.subarray(i*4,i*4+4),p.subarray(i*4,i*4+4),'All meaningful RGBA pixels are preserved exactly');}}
{
 const {p,fill}=fixture();fill(0,0,w,h,2);fill(15,20,90,32,230);fill(215,170,90,50,255);fill(60,52,210,118,18);
 const pieces=splitArtPixels(p,w,h);assert.equal(pieces.length,2,'Faint full-frame residue and connecting glow do not glue two stickers together');verify(p,pieces);
}
{
 const {p,fill}=fixture();fill(10,30,100,40,255);fill(210,30,100,40,255);fill(110,48,100,1,255);
 const pieces=splitArtPixels(p,w,h);assert.equal(pieces.length,2,'A sparse single-pixel connector does not merge complete cards');verify(p,pieces);
}
{
 const {p,fill}=fixture();fill(10,10,180,5,255);fill(10,10,5,160,255);fill(90,80,70,40,255);
 const pieces=splitArtPixels(p,w,h);assert.equal(pieces.length,2,'Overlapping bounding rectangles do not force separate pieces into one');verify(p,pieces);
}
console.log('PASS: noisy alpha, diffuse connected shadows, thin bridges, overlapping bounds and lossless masked recomposition.');
{
 const {p,fill}=fixture();fill(10,30,100,40,40);fill(210,130,100,40,40);
 const pieces=splitArtPixels(p,w,h);assert.equal(pieces.length,2,'Wholly translucent cards still split without solid lettering');verify(p,pieces);
}
