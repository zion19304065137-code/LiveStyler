import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
function transpile(file){return ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;}
const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const libraryUrl=url(transpile('lib/polyv-account.ts').replace(/from ["']zod["']/g,'from "'+pathToFileURL(require.resolve('zod')).href+'"'));
const lib=await import(libraryUrl);
const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync('drizzle/0000_steady_doctor_octopus.sql','utf8'));
const db={prepare:query=>({bind:(...args)=>({first:async()=>sql.prepare(query).get(...args)||null,run:async()=>sql.prepare(query).run(...args)})})};
const key='ab'.repeat(32),a={userId:'userAAA',appId:'appAAA',appSecret:'secretAAA'.repeat(4)},b={userId:'userBBB',appId:'appBBB',appSecret:'secretBBB'.repeat(4)};
const sealed=lib.sealCredentials('alice',a,key);assert(!sealed.includes(a.appSecret));assert(!sealed.includes(a.appId));assert.deepEqual(lib.openCredentials('alice',sealed,key),a);assert.throws(()=>lib.openCredentials('bob',sealed,key));assert.throws(()=>lib.openCredentials('alice',sealed.slice(0,-4)+'AAAA',key));
await lib.saveConnection(db,'alice',sealed,'123');assert.equal(await lib.loadConnection(db,'bob'),null);await lib.saveConnection(db,'bob',lib.sealCredentials('bob',b,key),'456');assert.equal(lib.openCredentials('bob',(await lib.loadConnection(db,'bob')).payload,key).appId,b.appId);
const oldFetch=globalThis.fetch;let fail=false,lastApp,calls=0;
globalThis.fetch=async input=>{calls++;const u=new URL(input);lastApp=u.searchParams.get('appId');const secret=lastApp===a.appId?a.appSecret:b.appSecret;const p=Object.fromEntries(u.searchParams);delete p.sign;assert.equal(u.searchParams.get('sign'),createHash('md5').update(secret+Object.keys(p).sort().map(k=>k+p[k]).join('')+secret).digest('hex').toUpperCase());return Response.json({code:fail?403:200,data:{skin:{theme:'blue'}}})};
globalThis.polyvTestEnv={DB:db,POLYV_VAULT_KEY:key,POLYV_APP_ID:'must-not-fallback',POLYV_APP_SECRET:'must-not-fallback'};
const matchUrl=url(transpile('lib/channel-match.ts'));
function route(file){return import(url(transpile(file).replace(/from ["'][^"']*lib\/channel-match["']/,'from "'+matchUrl+'"').replace(/import \{ runtimeEnv \} from [^;]+;/,'const runtimeEnv=async()=>globalThis.polyvTestEnv;').replace(/from ["'][^"']*lib\/polyv-account["']/,'from "'+libraryUrl+'"')));}
try{
 const account=await route('app/api/polyv/account/route.ts'),channel=await route('app/api/polyv/route.ts');
 const request=(owner,method='GET',body,path='/api/polyv/account',origin)=>new Request('https://test.site'+path,{method,headers:{...(owner?{'oai-authenticated-user-id':owner}:{}),...(origin?{origin}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await account.GET(request(null))).status,401);assert.equal((await account.POST(request(null,'POST',a))).status,401);assert.equal((await account.DELETE(request(null,'DELETE'))).status,401);
 const metadata=await (await account.GET(request('alice'))).json();assert(metadata.connected);assert(!JSON.stringify(metadata).includes(a.appSecret));assert(!JSON.stringify(metadata).includes(a.appId));
 assert.equal((await account.POST(request('alice','POST',{...a,channelId:'123'},undefined,'https://evil.site'))).status,403);
 assert.equal((await account.POST(request('carol','POST',{...a,channelId:'123'}))).status,200);assert(await lib.loadConnection(db,'carol'));
 fail=true;const before=(await lib.loadConnection(db,'alice')).payload;assert.equal((await account.POST(request('alice','POST',{...b,channelId:'456'}))).status,400);assert.equal((await lib.loadConnection(db,'alice')).payload,before,'Failed verification must not replace existing connection');fail=false;
 assert.equal((await channel.GET(request('alice','GET',null,'/api/polyv?channelId=123'))).status,200);assert.equal(lastApp,a.appId);
 assert.equal((await channel.GET(request('bob','GET',null,'/api/polyv?channelId=456'))).status,200);assert.equal(lastApp,b.appId);
 const list=await route('app/api/polyv/channels/route.ts');
 assert.equal((await list.GET(request(null,'GET',null,'/api/polyv/channels'))).status,401);
 assert.equal((await list.GET(request('unbound','GET',null,'/api/polyv/channels'))).status,409);
 assert.equal((await list.GET(request('alice','GET',null,'/api/polyv/channels?page=-1'))).status,400);
 const originalMock=globalThis.fetch;
 globalThis.fetch=async input=>{await originalMock(input);const u=new URL(input);assert.equal(u.pathname,'/live/v4/channel/basic/list');assert.equal(u.searchParams.get('orderBy'),'channelCreatedTimeDesc');assert.equal(u.searchParams.get('pageNumber'),'2');assert(!u.searchParams.has('channelId'));return Response.json({code:200,data:{contents:[{channelId:123,name:'新频道',watchStatusText:'未开始',channelPasswd:'never-return'}],totalPages:3}})};
 const listed=await (await list.GET(request('alice','GET',null,'/api/polyv/channels?page=2'))).json();assert.equal(lastApp,a.appId);assert.deepEqual(listed,{channels:[{channelId:'123',name:'新频道',status:'未开始'}],page:2,hasMore:true});assert(!JSON.stringify(listed).includes('never-return'));
 globalThis.fetch=async()=>Response.json({code:403});assert.equal((await list.GET(request('bob','GET',null,'/api/polyv/channels'))).status,502);globalThis.fetch=originalMock;
 console.log('PASS: recent-channel route enforces owner binding, signs newest-first pagination, rejects invalid pages, strips private fields and reports upstream failures.');
 const count=calls;assert.equal((await channel.GET(request('unbound','GET',null,'/api/polyv?channelId=123'))).status,409);assert.equal(calls,count,'Unbound users cannot access shared server credentials');
 assert.equal((await account.DELETE(request('alice','DELETE',null,undefined,'https://evil.site'))).status,403);
 assert.equal((await account.DELETE(request('alice','DELETE'))).status,200);assert.equal(await lib.loadConnection(db,'alice'),null);assert(await lib.loadConnection(db,'bob'),'Unbinding one user preserves other connections');
 console.log('PASS: real SQL migration, AES-GCM encryption and tamper/owner protection; route authentication, CSRF, verified binding, failed-bind preservation, per-user signing/query isolation, no shared-credential fallback and isolated unbind.');
}finally{globalThis.fetch=oldFetch;delete globalThis.polyvTestEnv;sql.close();}
