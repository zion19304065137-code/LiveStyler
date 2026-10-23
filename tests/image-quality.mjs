import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const src=ts.transpileModule(fs.readFileSync('lib/image-quality.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {checkOverlayPixels}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const w=100,h=100,safe={x:20,y:20,width:60,height:60};
const empty=new Uint8ClampedArray(w*h*4);assert.throws(()=>checkOverlayPixels(empty,w,h,safe),/没有可见/);
const opaque=new Uint8ClampedArray(w*h*4).fill(255);assert.throws(()=>checkOverlayPixels(opaque,w,h,safe),/透明背景/);
const valid=empty.slice();for(let y=0;y<12;y++)for(let x=0;x<w;x++)valid[(y*w+x)*4+3]=255;checkOverlayPixels(valid,w,h,safe);
for(let y=30;y<70;y++)for(let x=30;x<70;x++)valid[(y*w+x)*4+3]=255;checkOverlayPixels(valid,w,h,safe);
console.log('PASS: visible transparent artwork accepted; blank and opaque output rejected; warning-area overlap remains editable.');
