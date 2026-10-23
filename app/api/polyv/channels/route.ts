import {runtimeEnv} from '../../../../lib/server';
import {connectionDb,loadConnection,openCredentials,queryPolyv} from '../../../../lib/polyv-account';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:Request){
 const owner=req.headers.get('oai-authenticated-user-id');if(!owner)return json({error:'请刷新页面'},401);
 const raw=new URL(req.url).searchParams.get('page')||'1';if(!/^[1-9]\d{0,4}$/.test(raw))return json({error:'页码无效'},400);
 try{const env=await runtimeEnv(),row=await loadConnection(connectionDb(env),owner);if(!row)return json({error:'请先绑定直播账号'},409);
 const credentials=openCredentials(owner,row.payload,env.POLYV_VAULT_KEY);
 const data=await queryPolyv(credentials,'',fetch,'/live/v4/channel/basic/list',{pageNumber:raw,pageSize:'20',orderBy:'channelCreatedTimeDesc'});
 if(!data||!Array.isArray(data.contents))throw Error('invalid');
 const channels=data.contents.filter((c:any)=>/^\d{1,20}$/.test(String(c.channelId))).map((c:any)=>({channelId:String(c.channelId),name:String(c.name||'未命名频道').slice(0,200),status:String(c.watchStatusText||'').slice(0,30)}));
 return json({channels,page:Number(raw),hasMore:Number(raw)<Number(data.totalPages)});
 }catch{return json({error:'频道列表读取失败，请重试或输入频道 ID'},502);}
}
