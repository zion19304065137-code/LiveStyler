import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
const COOKIE='livestyler_session',TTL=30*24*60*60;
function key(secret:string){if(!secret||secret.length<32)throw Error('SESSION_SECRET must contain at least 32 characters');return secret;}
function sign(payload:string,secret:string){return createHmac('sha256',key(secret)).update(payload).digest('hex');}
export function visitorSession(request:Request,secret:string,now=Date.now()){
 key(secret);
 const raw=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
 const parts=raw.split('.');
 if(parts.length===3&&/^[a-f0-9]{32}$/.test(parts[0])&&/^\d{10}$/.test(parts[1])&&/^[a-f0-9]{64}$/.test(parts[2])){
  const payload=parts[0]+'.'+parts[1],issued=Number(parts[1]);
  if(issued<=now/1000+60&&issued+TTL>now/1000&&timingSafeEqual(Buffer.from(parts[2],'hex'),Buffer.from(sign(payload,secret),'hex')))return {owner:'visitor_'+parts[0],cookie:null};
 }
 const id=randomBytes(16).toString('hex'),payload=id+'.'+Math.floor(now/1000);
 return {owner:'visitor_'+id,cookie:COOKIE+'='+payload+'.'+sign(payload,secret)+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+TTL+(new URL(request.url).protocol==='https:'?'; Secure':'')};
}
export async function withVisitorSession(request:Request,env:Record<string,any>,next:(request:Request)=>Promise<Response>,options:{platformIdentity?:boolean}={}){
 const url=new URL(request.url);
 if(!['GET','HEAD','OPTIONS'].includes(request.method)){
  if(request.headers.get('sec-fetch-site')==='cross-site'||(request.headers.get('origin')&&request.headers.get('origin')!==url.origin))return Response.json({error:'不允许跨站调用'},{status:403});
 }
 // Sites validates and supplies this identity. Preserve existing signed-in owners.
 // Never enable this option on an independent host accepting arbitrary request headers.
 if(options.platformIdentity&&request.headers.get('oai-authenticated-user-id')){
  const result=await next(request);const response=new Response(result.body,result);response.headers.set('Cache-Control','private, no-store');return response;
 }
 let session;try{session=visitorSession(request,env.SESSION_SECRET);}catch{return Response.json({error:'服务尚未完成初始化，请联系部署者'},{status:503});}
 const headers=new Headers(request.headers);for(const k of [...headers.keys()])if(k.startsWith('oai-authenticated-user-'))headers.delete(k);
 headers.set('oai-authenticated-user-id',session.owner);
 const response=await next(new Request(request,{headers}));
 // Authenticated data and bootstrap responses must never be cached across visitors.
 const output=new Response(response.body,response);output.headers.set('Cache-Control','private, no-store');
 if(session.cookie)output.headers.append('Set-Cookie',session.cookie);return output;
}
