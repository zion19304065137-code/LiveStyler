export type CloudDb={prepare:(sql:string)=>{bind:(...args:any[])=>any;first:<T>()=>Promise<T|null>;all:()=>Promise<{results:any[]}>;run:()=>Promise<any>}};
export type CloudBucket={put:(key:string,value:any,options?:any)=>Promise<any>;get:(key:string)=>Promise<{text:()=>Promise<string>}|null>;delete:(key:string)=>Promise<any>};
export function cloud(env:Record<string,unknown>){if(!env.DB||!env.BUCKET)throw Error('云端保存暂不可用，请稍后重试');return {db:env.DB as CloudDb,bucket:env.BUCKET as CloudBucket};}
export function ownerOf(req:Request){const owner=req.headers.get('oai-authenticated-user-id');if(!owner)throw Error('会话尚未初始化，请刷新页面');return owner;}
export function sameOrigin(req:Request){if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)throw Error('不允许跨站调用');}
export function validId(id:string){if(!/^[a-zA-Z0-9_-]{8,100}$/.test(id))throw Error('记录编号无效');return id;}
export function configuredLimit(value:unknown,fallback:number){const n=Number(value);return Number.isFinite(n)&&n>=1?Math.min(Math.floor(n),10000):fallback;}
export async function reserveTask(db:CloudDb,owner:string,id:string,userLimit:number,globalLimit:number){
 const now=new Date().toISOString(),since=now.slice(0,10)+'T00:00:00.000Z',activeSince=new Date(Date.now()-300000).toISOString();
 if(userLimit===0&&globalLimit===0){
  const r=await db.prepare("INSERT INTO ai_tasks (id,owner,state,created,updated,message) SELECT ?,?,'running',?,?,? WHERE NOT EXISTS (SELECT 1 FROM ai_tasks WHERE owner=? AND state='running' AND updated>?)").bind(id,owner,now,now,'正在生成设计',owner,activeSince).run();
  if(!r.meta?.changes)throw Error('已有设计任务正在进行，请等待完成后再提交');
  return;
 }
 const r=await db.prepare("INSERT INTO ai_tasks (id,owner,state,created,updated,message) SELECT ?,?,'running',?,?,? WHERE (SELECT COUNT(*) FROM ai_tasks WHERE owner=? AND created>=? AND state!='failed')<? AND (SELECT COUNT(*) FROM ai_tasks WHERE created>=? AND state!='failed')<? AND NOT EXISTS (SELECT 1 FROM ai_tasks WHERE owner=? AND state='running' AND updated>?)").bind(id,owner,now,now,'正在生成设计',owner,since,userLimit,since,globalLimit,owner,activeSince).run();
 if(!r.meta?.changes)throw Error('今日创作额度已用完，或已有任务正在进行');
}
