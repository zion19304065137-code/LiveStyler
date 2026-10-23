import {channelParameters} from "../../../lib/channel-match";
import {runtimeEnv} from '../../../lib/server';
import {connectionDb,loadConnection,openCredentials,queryPolyv} from '../../../lib/polyv-account';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:Request){
 const owner=req.headers.get('oai-authenticated-user-id');if(!owner)return json({error:'请先配置频道账号'},401);
 const channelId=new URL(req.url).searchParams.get('channelId')||'';if(!/^\d{1,20}$/.test(channelId))return json({error:'频道 ID 必须为数字'},400);
 try{const env=await runtimeEnv(),row=await loadConnection(connectionDb(env),owner);if(!row)return json({error:'请先绑定自己的直播账号'},409);
 const credentials=openCredentials(owner,row.payload,env.POLYV_VAULT_KEY),data=await queryPolyv(credentials,channelId);
 let parameters=null;try{parameters=channelParameters(channelId,await queryPolyv(credentials,channelId,fetch,'/live/v4/channel/basic/get'));}catch{}
 return json({channelId,queriedAt:new Date().toISOString(),data,parameters,mode:'live-read-only'});
 }catch(e){const message=(e as Error).message;return json({error:message.startsWith('频道')?message:'读取账号配置失败，请重新绑定或稍后重试'},400);}
}
export async function POST(){return json({error:'频道写入暂未开放'},403);}
