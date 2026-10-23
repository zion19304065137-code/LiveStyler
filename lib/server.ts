import {publicCopy} from "./conversation";
export async function runtimeEnv(): Promise<Record<string, string>> {
  try {
    const { env } = await import("cloudflare:workers");
    return env as unknown as Record<string, string>;
  } catch {
    return process.env as Record<string, string>;
  }
}
export function error(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
export async function upstream(
  url: string,
  init: RequestInit,
  timeout = 90000,
) {
  let r: Response;
  try {
    r = await fetch(url, { ...init, signal: AbortSignal.timeout(timeout) });
  } catch {
    throw Error("服务连接超时或不可用，请稍后重试");
  }
  if (!r.ok) {
    console.error(JSON.stringify({event:"ai_upstream_rejected",status:r.status,path:new URL(url).pathname}));
    if (r.status === 524 || r.status === 504) throw Error("AI平台处理超时，未返回生成结果，当前设计未被替换（" + r.status + "）");
    if (r.status === 429) throw Error("服务限流或额度不足，请稍后重试");
    if (r.status === 401 || r.status === 403)
      throw Error("创作服务授权失败（"+r.status+"），请联系管理员检查密钥、模型权限及余额");
    throw Error("上游服务返回错误（" + r.status + "），请检查服务配置");
  }
  try {
    return (await r.json()) as any;
  } catch {
    throw Error("服务返回了非 JSON 数据，请检查 Base URL 是否为 API 地址");
  }
}
export function apiBase(base: string) {
  const u = new URL(base);
  if (u.protocol !== "https:") throw Error("API 地址必须使用 HTTPS");
  return base.replace(/\/$/, "");
}

/** Public workflow events only; never expose model reasoning or credentials. */
export function workflowResponse(work:(stage:(message:string)=>void,preview:(text:string)=>void)=>Promise<Record<string,unknown>>,context?:{requestId:string;action:string}) {
  const encoder=new TextEncoder();let closed=false;const started=Date.now();
  if(context)console.info(JSON.stringify({event:"ai_workflow",...context,phase:"start"}));
  return new Response(new ReadableStream({
    async start(controller) {
      const send=(event:Record<string,unknown>)=>{if(!closed)try{controller.enqueue(encoder.encode(JSON.stringify(event)+'\n'));}catch{closed=true;}};
      const heartbeat=setInterval(()=>send({type:'heartbeat'}),12000);
      try {const result=await work(message=>{if(context)console.info(JSON.stringify({event:'ai_workflow',...context,phase:'stage',message,elapsedMs:Date.now()-started}));send({type:'stage',message});},text=>send({type:'preview',text}));send({type:'result',...result});}
      catch(e){const message=publicCopy((e as Error).message||'暂时无法完成，请重试');if(context)console.error(JSON.stringify({event:'ai_workflow',...context,phase:'failed',elapsedMs:Date.now()-started,message}));send({type:'error',message});}
      finally {clearInterval(heartbeat);if(!closed){closed=true;controller.close();}}
    },
    cancel(){closed=true;},
  }),{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Accel-Buffering':'no'}});
}

/** Stream public answer content only. Never forward reasoning_content or provider metadata. */
export async function upstreamAnswer(url:string,init:RequestInit,onContent?:(text:string)=>void,timeout=180000){
 if(!onContent){const result=await upstream(url,init,timeout);return result.choices?.[0]?.message?.content;}
 let response:Response;try{response=await fetch(url,{...init,signal:AbortSignal.timeout(timeout)});}catch(e){const timedOut=['TimeoutError','AbortError'].includes((e as Error).name);console.error(JSON.stringify({event:'ai_upstream_connection',phase:'brief',kind:timedOut?'timeout':'network',timeoutMs:timeout}));throw Error(timedOut?'方案等待超时，尚未开始生图，请重试':'方案连接失败，尚未开始生图，请稍后重试');}
 if(response.status===524||response.status===504)throw Error('方案服务响应超时（'+response.status+'），尚未开始生图，请稍后重试');
 if(!response.ok)throw Error(response.status===429?'方案服务繁忙，请稍后重试':'方案服务暂不可用（'+response.status+'）');
 if(!response.headers.get('Content-Type')?.includes('text/event-stream')){let d:any;try{d=await response.json();}catch{throw Error('方案服务返回异常，请重试');}const text=d.choices?.[0]?.message?.content;if(typeof text==='string')onContent(text);return text;}
 if(!response.body)throw Error('方案服务未返回内容');
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',text='',lastSent='',lastEmit=0;
 const emit=(force=false)=>{if(text!==lastSent&&(force||!lastEmit||Date.now()-lastEmit>=120)){onContent(text);lastSent=text;lastEmit=Date.now();}};
 const line=(value:string)=>{if(!value.startsWith('data:'))return;const raw=value.slice(5).trim();if(!raw||raw==='[DONE]')return;const data=JSON.parse(raw);if(data.error)throw Error('方案生成中断，请重试');const delta=data.choices?.[0]?.delta?.content;if(typeof delta==='string'){text+=delta;if(text.length>24000)throw Error('方案过长，请简化需求后重试');emit();}};
 try{while(true){const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done});let pos;while((pos=buffer.indexOf('\n'))>=0){line(buffer.slice(0,pos).replace(/\r$/,''));buffer=buffer.slice(pos+1);}if(done)break;}if(buffer.trim())line(buffer);}catch(e){throw Error(publicCopy((e as Error).message||'方案生成中断，请重试'));}finally{await reader.cancel().catch(()=>{});}
 emit(true);return text;
}
