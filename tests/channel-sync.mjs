import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const code=f=>ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const accountUrl=url(code('lib/polyv-account.ts').replace(/from ["']zod["']/,'from "'+pathToFileURL(require.resolve('zod')).href+'"'));
const {channelParameters}=await import(url(code('lib/channel-match.ts')));
assert.equal(channelParameters('123',{template:'portrait_alone'}).ratio,'portrait');assert.equal(channelParameters('123',{template:'ppt'}).liveType,'三分屏');assert.equal(channelParameters('123',{template:'unknown'}).ratio,null,'Unknown ratio must never be guessed');assert.equal(channelParameters('123',{template:'seminar'}).ratio,null);
const applyUrl=url(code('lib/polyv-apply.ts').replace("'./polyv-account'",'"'+accountUrl+'"'));const {applyWarmup}=await import(applyUrl);
const credentials={userId:'user-test',appId:'app-test',appSecret:'test-secret-only'};let uploaded=false,written=false,cover='',deny=false,failUpload=false;
function assertSignature(params){const p=Object.fromEntries(params);const sign=p.sign;delete p.sign;delete p.file;assert.equal(sign,createHash('md5').update(credentials.appSecret+Object.keys(p).sort().map(k=>k+p[k]).join('')+credentials.appSecret).digest('hex').toUpperCase())}
const fetcher=async (input,init)=>{const u=new URL(input);
 if(u.pathname.endsWith('/decorate/get')){assertSignature(u.searchParams);return Response.json({code:deny?403:200,data:{}})}
 if(u.pathname.endsWith('/upload-image')){uploaded=true;assertSignature(init.body);assert.equal(init.body.get('type'),'warmImage');assert(init.body.get('file') instanceof File);return Response.json({code:failUpload?400:200,data:['//liveimages.videocc.net/test.jpg']})}
 if(u.pathname.endsWith('/update')){written=true;assertSignature(init.body);assert.deepEqual([...init.body.keys()].sort(),['appId','coverImage','sign','timestamp']);cover=init.body.get('coverImage');return Response.json({code:200,data:true})}
 if(u.pathname.endsWith('/basic/get'))return Response.json({code:200,data:{bgImg:cover}});
 throw Error('Unexpected API call');};
const file=new File([new Uint8Array([255,216,255,0,0,0,0,0,0,0,0])],'warmup.jpg',{type:'image/jpeg'});
const result=await applyWarmup(credentials,'123',file,fetcher);assert(uploaded&&written);assert.equal(result.verified,true);assert.equal(result.target,'warmup');
cover=null;let emptyBackup;await applyWarmup(credentials,'123',file,fetcher,async before=>{emptyBackup=before;});assert.equal(emptyBackup,'','A documented null bgImg means no previous warmup, not a read failure');assert.equal(cover,'https://liveimages.videocc.net/test.jpg');
written=false;uploaded=false;deny=true;await assert.rejects(applyWarmup(credentials,'456',file,fetcher));assert(!uploaded&&!written,'Unauthorized channel cannot upload or write');deny=false;failUpload=true;await assert.rejects(applyWarmup(credentials,'123',file,fetcher));assert(!written,'Failed upload must not update channel');
console.log('PASS: documented channel-template mapping, unknown ratio handling, signed upload/update, channel authorization before mutation, failed-upload preservation and read-back verification.');

const {sealCredentials}=await import(accountUrl),vaultKey='ef'.repeat(32),payload=sealCredentials('alice',credentials,vaultKey);
const originalFetch=globalThis.fetch;globalThis.fetch=fetcher;globalThis.applyTestEnv={POLYV_VAULT_KEY:vaultKey,BUCKET:{},DB:{prepare:sql=>({bind:(...args)=>({first:async()=>sql.includes('polyv_connections')&&args[0]==='alice'?{payload}:null,run:async()=>({meta:{changes:1}})})})}};
try{
 const cloudUrl=url(code('lib/cloud-services.ts'));
 const routeCode=code('app/api/polyv/apply/route.ts').replace(/from ["'][^"']*lib\/cloud-services["']/,'from "'+cloudUrl+'"').replace(/import \{ runtimeEnv \} from [^;]+;/,'const runtimeEnv=async()=>globalThis.applyTestEnv;').replace(/from ["'][^"']*lib\/polyv-account["']/,'from "'+accountUrl+'"').replace(/from ["'][^"']*lib\/polyv-apply["']/,'from "'+applyUrl+'"');
 const {POST}=await import(url(routeCode));
 const req=(owner,confirm,origin='https://test.site')=>{const form=new FormData();form.append('channelId','123');form.append('target','warmup');form.append('confirmed',confirm);form.append('file',file);return new Request('https://test.site/api/polyv/apply',{method:'POST',headers:{origin,...(owner?{'oai-authenticated-user-id':owner}:{})},body:form})};
 assert.equal((await POST(req(null,'true'))).status,401);assert.equal((await POST(req('alice','true','https://evil.site'))).status,403);assert.equal((await POST(req('alice','false'))).status,400);assert.equal((await POST(req('bob','true'))).status,409);
 failUpload=false;const r=await POST(req('alice','true'));assert.equal(r.status,200);assert.equal((await r.json()).verified,true);
 console.log('PASS: publish endpoint rejects anonymous, cross-site, unconfirmed and unbound requests; authenticated confirmed warmup upload succeeds with read-back.');
}finally{globalThis.fetch=originalFetch;delete globalThis.applyTestEnv;}
const {restoreWarmup}=await import(applyUrl);failUpload=false;deny=false;cover='https://liveimages.videocc.net/new.jpg';written=false;
await assert.rejects(restoreWarmup(credentials,'123','https://liveimages.videocc.net/old.jpg','https://liveimages.videocc.net/unrelated.jpg',fetcher),/再次修改/);assert(!written);
await restoreWarmup(credentials,'123','https://liveimages.videocc.net/old.jpg','https://liveimages.videocc.net/new.jpg',fetcher);assert.equal(cover,'https://liveimages.videocc.net/old.jpg');
let protectedWrite=false;await assert.rejects(applyWarmup(credentials,'123',file,async(...args)=>{if(new URL(args[0]).pathname.endsWith('/update'))protectedWrite=true;return fetcher(...args)},async()=>{throw Error('snapshot unavailable')}),/snapshot/);assert(!protectedWrite,'Backup failure prevents external mutation');
console.log('PASS: restore checks current value, verifies read-back, and backup failure prevents channel mutation.');
