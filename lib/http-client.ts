import {publicCopy} from "./conversation";
export async function requestJson<T = Record<string, unknown>>(
  url: string,
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(270000),
    });
  } catch {
    throw Error("请求超时或网络中断，请检查连接后重试");
  }
  let result: any;
  try {
    result = await response.json();
  } catch {
    throw Error(
      response.redirected
        ? "登录状态可能已失效，请刷新页面后重试"
        : "服务返回了非JSON数据，请检查接口地址或稍后重试",
    );
  }
  if (!response.ok)
    throw Error(
      typeof result.error === "string"
        ? result.error
        : "服务暂时不可用（" + response.status + "）",
    );
  return result as T;
}

export async function requestWorkflow<T>(url:string,body:unknown,onStage:(message:string)=>void,onPreview?:(text:string)=>void):Promise<T> {
  let response:Response;
  try {response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(270000)});}catch{throw Error('连接中断或等待超时，请重试，当前设计已保留');}
  if(!response.ok) {let d:any;try{d=await response.json();}catch{}throw Error(d?.error||`服务请求失败（${response.status}）`);}
  if(response.headers.get('Content-Type')?.includes('application/json'))return await response.json() as T;
  if(!response.body) throw Error('浏览器未收到服务响应');
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',result:T|undefined;
  function event(line:string) {
    if(!line.trim())return;
    const d=JSON.parse(line);
    if(d.type==='preview'&&typeof d.text==='string')onPreview?.(d.text);
    if(d.type==='stage'&&typeof d.message==='string')onStage(d.message);
    if(d.type==='error')throw Error(d.message||'生成失败');
    if(d.type==='result')result=d as T;
  }
  try {while(true){const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done});let pos;while((pos=buffer.indexOf('\n'))>=0){event(buffer.slice(0,pos));buffer=buffer.slice(pos+1);}if(done)break;}event(buffer);}
  catch(e){throw Error(publicCopy((e as Error).message||'连接中断，请重试'));}
  finally{await reader.cancel().catch(()=>{});}
  if(!result)throw Error('服务连接已结束，但没有返回结果，请稍后查看或重试');
  return result;
}
