import {runtimeEnv} from '../../../../lib/server';
import {connectionInput,connectionDb,loadConnection,saveConnection,deleteConnection,sealCredentials,openCredentials,queryPolyv} from '../../../../lib/polyv-account';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const usage=new Map<string,number>();
export async function GET(req:Request){
 const owner=req.headers.get('oai-authenticated-user-id');if(!owner)return json({error:'请刷新页面后配置频道账号',signInRequired:true},401);
 try{const env=await runtimeEnv(),row=await loadConnection(connectionDb(env),owner);if(!row)return json({connected:false});const credentials=openCredentials(owner,row.payload,env.POLYV_VAULT_KEY);return json({connected:true,appIdHint:'••••'+credentials.appId.slice(-4),userIdHint:'••••'+credentials.userId.slice(-4),channelId:row.verified_channel,updatedAt:row.updated_at});}catch{return json({error:'无法读取账号绑定，请稍后重试'},503);}
}
export async function POST(req:Request){
 const owner=req.headers.get('oai-authenticated-user-id');if(!owner)return json({error:'请刷新页面后配置频道账号',signInRequired:true},401);
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return json({error:'不允许跨站绑定'},403);
 const now=Date.now();for(const [key,until] of usage)if(until<=now)usage.delete(key);if((usage.get(owner)||0)>now||usage.size>5000)return json({error:'请稍等片刻再验证'},429);usage.set(owner,now+3000);
 try{const text=await req.text();if(text.length>4096)return json({error:'绑定信息过长'},413);const parsed=connectionInput.safeParse(JSON.parse(text));if(!parsed.success)return json({error:'请完整填写 UserID、AppID、AppSecret 和数字频道 ID'},400);
 const env=await runtimeEnv(),db=connectionDb(env),b=parsed.data;
 const encrypted=sealCredentials(owner,b,env.POLYV_VAULT_KEY);await queryPolyv(b,b.channelId);await saveConnection(db,owner,encrypted,b.channelId);
 return json({connected:true,appIdHint:'••••'+b.appId.slice(-4),userIdHint:'••••'+b.userId.slice(-4),channelId:b.channelId,updatedAt:new Date().toISOString()});
 }catch(e){const message=(e as Error).message;return json({error:message.startsWith('频道')?message:'账号绑定失败，请检查填写信息或稍后重试'},400);}
}
export async function DELETE(req:Request){
 const owner=req.headers.get('oai-authenticated-user-id');if(!owner)return json({error:'请刷新页面'},401);
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return json({error:'不允许跨站操作'},403);
 try{await deleteConnection(connectionDb(await runtimeEnv()),owner);return json({connected:false});}catch{return json({error:'解绑失败，请稍后重试'},503);}
}
