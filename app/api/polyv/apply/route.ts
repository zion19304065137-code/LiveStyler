import {cloud} from "../../../../lib/cloud-services";
import {runtimeEnv} from '../../../../lib/server';
import {connectionDb,loadConnection,openCredentials} from '../../../../lib/polyv-account';
import {applyWarmup} from '../../../../lib/polyv-apply';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:Request){
 const owner=req.headers.get('oai-authenticated-user-id');if(!owner)return json({error:'请刷新页面'},401);
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return json({error:'不允许跨站应用'},403);
 if(Number(req.headers.get('content-length')||0)>2300000)return json({error:'图片请控制在 2MB 以内'},413);
 try{const form=await req.formData(),channel=String(form.get('channelId')||''),file=form.get('file');
 if(form.get('target')!=='warmup'||form.get('confirmed')!=='true')return json({error:'请先确认应用频道及用途'},400);
 if(!/^\d{1,20}$/.test(channel)||!(file instanceof File)||file.size>2*1024*1024||file.size<10||!['image/jpeg','image/png'].includes(file.type))return json({error:'频道或图片无效'},400);
 const head=new Uint8Array(await file.slice(0,8).arrayBuffer());if(!(head[0]===255&&head[1]===216&&head[2]===255)&&!(head[0]===137&&head[1]===80&&head[2]===78&&head[3]===71))return json({error:'图片格式无效'},400);
 const env=await runtimeEnv(),row=await loadConnection(connectionDb(env),owner);if(!row)return json({error:'请先绑定直播账号'},409);
 const {db}=cloud(env),id=crypto.randomUUID();
 const result=await applyWarmup(openCredentials(owner,row.payload,env.POLYV_VAULT_KEY),channel,file,fetch,async(before,after)=>{await db.prepare("INSERT INTO channel_snapshots (id,owner,channel,created,before_image,after_image,state) VALUES (?,?,?,?,?,?,?)").bind(id,owner,channel,new Date().toISOString(),before,after,'pending').run();});
 await db.prepare('UPDATE channel_snapshots SET state=? WHERE id=? AND owner=?').bind(result.verified?'verified':'submitted',id,owner).run();
 return json({...result,snapshotId:id});
 }catch(e){const m=(e as Error).message;console.error(JSON.stringify({event:'channel_apply',phase:'failed',message:m.slice(0,200)}));return json({error:m.startsWith('频道')||m.startsWith('图片')||m.startsWith('账号')?m:'应用失败，请检查连接后重试'},400);}
}
