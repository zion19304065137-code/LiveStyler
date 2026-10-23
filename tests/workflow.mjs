import fs from 'node:fs';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';const require=createRequire(import.meta.url);import ts from 'typescript';import assert from 'node:assert/strict';import {createCanvas} from '@napi-rs/canvas';
function moduleUrl(file){let src=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;src=src.replace(/from ['"]zod['"]/g,'from "'+pathToFileURL(require.resolve('zod')).href+'"');if(file!=='lib/conversation.ts')src=src.replace(/from ['"]\.\/conversation['"]/g,'from "'+moduleUrl('lib/conversation.ts')+'"');return 'data:text/javascript;base64,'+Buffer.from(src).toString('base64');}
async function mod(file){return import(moduleUrl(file));}
const {downloadFile}=await mod('lib/download.ts');const {clampArea,presetArea}=await mod('lib/protected-area.ts');
const old={document:globalThis.document,create:URL.createObjectURL,revoke:URL.revokeObjectURL,timer:globalThis.setTimeout,fetch:globalThis.fetch};
try{
 let connected=false,clicked=false,downloaded,revoked=false,cleanup;
 globalThis.document={body:{appendChild:()=>connected=true},createElement:()=>({style:{},click(){assert(connected);assert.equal(this.download,'完整贴片.png');assert.equal(this.href,'blob:test');clicked=true},remove(){connected=false}})};
 URL.createObjectURL=b=>{downloaded=b;return 'blob:test'};URL.revokeObjectURL=()=>revoked=true;globalThis.setTimeout=(fn,delay)=>{assert.equal(delay,60000);cleanup=fn};
 const data='data:image/png;base64,'+Buffer.alloc(2*1024*1024,42).toString('base64');downloadFile('完整贴片.png',data);
 assert(clicked);assert(!connected);assert(!revoked);assert.equal(downloaded.type,'image/png');assert.equal(downloaded.size,2*1024*1024);cleanup();assert(revoked);
 console.log('PASS: large image downloads use attached Blob links with correct bytes, filename and delayed cleanup.');
 globalThis.setTimeout=old.timer;
 const p={width:1920,height:1080};for(const r of [16/9,9/16,4/3,3/4,1]){const a=presetArea(p,r);assert(Math.abs(a.width/a.height-r)<.001);assert(a.x>=0&&a.y>=0&&a.x+a.width<=p.width&&a.y+a.height<=p.height)}
 assert.deepEqual(clampArea({x:-5,y:10000,width:10000,height:10000},p),{width:1920,height:1080,x:0,y:0});
 console.log('PASS: protected-area presets, clamping and bounds.');
 const {workflowResponse,upstreamAnswer,upstream}=await mod('lib/server.ts');const {requestWorkflow}=await mod('lib/http-client.ts');let stages=[];
 globalThis.fetch=async()=>workflowResponse(async stage=>{stage('分析预览');await Promise.resolve();stage('方案完成');return {brief:'准确中文方案'}});
 const r=await requestWorkflow('/api/ai',{action:'brief'},s=>stages.push(s));assert.deepEqual(stages,['分析预览','方案完成']);assert.equal(r.brief,'准确中文方案');
 globalThis.fetch=async()=>workflowResponse(async stage=>{stage('提交');throw Error('平台超时')});await assert.rejects(requestWorkflow('/api/ai',{},()=>{}),/平台超时/);
 let release,seen;const gate=new Promise(r=>release=r),firstPreview=new Promise(r=>seen=r);let finished=false;
 globalThis.fetch=async()=>workflowResponse(async(stage,preview)=>{stage('正在分析');preview('场景：企业年会');await gate;preview('场景：企业年会\n主题：蓝金');return {brief:'完成'}});
 const previewValues=[];const live=requestWorkflow('/api/ai',{},()=>{},text=>{previewValues.push(text);seen();}).then(v=>{finished=true;return v;});await firstPreview;assert(!finished,'Preview must arrive before final result');release();await live;assert.equal(previewValues.length,2);
 const sse='data: '+JSON.stringify({choices:[{delta:{reasoning_content:'PRIVATE_REASONING'}}]})+'\n\n'+'data: '+JSON.stringify({choices:[{delta:{content:'场景'}}]})+'\n\n'+'data: '+JSON.stringify({choices:[{delta:{content:'分析'}}]})+'\n\ndata: [DONE]\n\n';
 const bytes=new TextEncoder().encode(sse);globalThis.fetch=async()=>new Response(new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=3)c.enqueue(bytes.slice(i,i+3));c.close();}}),{headers:{'Content-Type':'text/event-stream'}});
 const deltas=[];assert.equal(await upstreamAnswer('https://test.site',{},v=>deltas.push(v)),'场景分析');assert.deepEqual(deltas,['场景','场景分析']);assert(!deltas.join('').includes('PRIVATE_REASONING'));
 for(const where of ['upstream','browser','connect']) {
  const previews=[];let calls=0;
  globalThis.fetch=async()=>{calls++;if(where==='connect')throw new TypeError('Failed to fetch');let reads=0;return new Response(new ReadableStream({pull(c){if(reads++===0)c.enqueue(new TextEncoder().encode(where==='upstream'?'data: '+JSON.stringify({choices:[{delta:{content:'已识别年会'}}]})+'\n\n':JSON.stringify({type:'preview',text:'已识别年会'})+'\n'));else c.error(new DOMException('BodyStreamBuffer was aborted','AbortError'));}}),{headers:{'Content-Type':where==='upstream'?'text/event-stream':'application/x-ndjson'}});};
  await assert.rejects(where==='upstream'?upstreamAnswer('https://test.site',{},v=>previews.push(v)):requestWorkflow('/api/ai',{},()=>{},v=>previews.push(v)),e=>/连接中断/.test(e.message)&&!e.message.includes('BodyStreamBuffer'));
  assert.equal(calls,1,'Never automatically repeat a potentially paid task');if(where!=='connect')assert.deepEqual(previews,['已识别年会']);
 }


 for(const status of [401,403]){globalThis.fetch=async()=>new Response('{}',{status});await assert.rejects(upstream('https://test.site/v1/images/edits',{}),new RegExp('授权失败（'+status+'）'));}
 globalThis.fetch=async()=>new Response('gateway timed out',{status:524});
 await assert.rejects(upstreamAnswer('https://test.site',{},()=>{}),/尚未开始生图/);
 let attempts=0;globalThis.fetch=async()=>{attempts++;throw new DOMException('timed out','TimeoutError');};
 await assert.rejects(upstreamAnswer('https://test.site',{},()=>{},1),/尚未开始生图/);
 assert.equal(attempts,1,'Timeout must never silently repeat a potentially billed request');
 console.log('PASS: real workflow events arrive in order; Chinese payloads and streamed failures propagate without fabricated progress.');
}finally{globalThis.document=old.document;URL.createObjectURL=old.create;URL.revokeObjectURL=old.revoke;globalThis.setTimeout=old.timer;globalThis.fetch=old.fetch;}
