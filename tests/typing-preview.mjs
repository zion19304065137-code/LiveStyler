import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {KonvaRenderer} from 'react-konva';
const require=createRequire(import.meta.url);
const source=ts.transpileModule(fs.readFileSync('hooks/useTypingPreview.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]react['"]/,`from '${pathToFileURL(require.resolve('react')).href}'`);
const {useTypingPreview}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const originals={window:globalThis.window,raf:globalThis.requestAnimationFrame,cancel:globalThis.cancelAnimationFrame};
const frames=new Map();let serial=0,time=0,probe,reduced=false;
globalThis.window={matchMedia:()=>({get matches(){return reduced},addEventListener(){},removeEventListener(){}})};
globalThis.requestAnimationFrame=fn=>{frames.set(++serial,fn);return serial};globalThis.cancelAnimationFrame=id=>frames.delete(id);
const errors=[];const root=KonvaRenderer.createContainer({},1,null,false,null,'',e=>errors.push(e),e=>errors.push(e),e=>errors.push(e),null);
function Probe(){probe=useTypingPreview();return null;}
const flush=()=>{KonvaRenderer.flushSyncWork();KonvaRenderer.flushPassiveEffects();};
function frame(){time+=16;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(time));flush();}
try{
 KonvaRenderer.updateContainerSync(React.createElement(Probe),root,null,null);flush();
 const text='暖场画面设计：中文标题、时间地点与品牌信息。'.repeat(15);
 probe[1](text);flush();frame();frame();assert(probe[0].length>0&&probe[0].length<text.length,'A complete packet must reveal incrementally');
 let complete=false;const finish=probe[2](text+'结束').then(()=>complete=true);
 frame();await Promise.resolve();assert(!complete,'Completion waits for visible text');
 for(let i=0;i<1600&&frames.size;i++){const before=Array.from(probe[0]).length;frame();assert(Array.from(probe[0]).length-before<=2,'Even a large packet reveals at most two characters per frame');}await finish;assert.equal(probe[0],text+'结束');
 probe[1]('新方案🙂');flush();for(let i=0;i<100&&frames.size;i++)frame();assert.equal(probe[0],'新方案🙂');
 probe[1]('');flush();assert.equal(probe[0],'');assert.equal(frames.size,0);
 probe[1]('');flush();probe[1]('A。B');flush();for(let i=0;i<3;i++)frame();assert.equal(probe[0],'A。');for(let i=0;i<3;i++)frame();assert.equal(probe[0],'A。','Punctuation receives a short natural pause');for(let i=0;i<20&&frames.size;i++)frame();assert.equal(probe[0],'A。B');
 probe[1]('');flush();probe[1]('尚未显示完的回答'.repeat(100));const pending=probe[2]('尚未显示完的回答'.repeat(100));
 KonvaRenderer.updateContainerSync(null,root,null,null);flush();await pending;assert.equal(frames.size,0);assert.deepEqual(errors,[]);
 console.log('PASS: actual React hook buffers full packets, reveals incrementally, drains before completion, handles replacement/reset and cancels on unmount.');
}finally{globalThis.window=originals.window;globalThis.requestAnimationFrame=originals.raf;globalThis.cancelAnimationFrame=originals.cancel;}
