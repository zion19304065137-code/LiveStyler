import {createHash,randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {z} from 'zod';
export const connectionInput=z.object({userId:z.string().trim().regex(/^[A-Za-z0-9_-]{3,100}$/),appId:z.string().trim().regex(/^[A-Za-z0-9_-]{3,100}$/),appSecret:z.string().trim().min(16).max(256),channelId:z.string().trim().regex(/^\d{1,20}$/)}).strict();
export type PolyvCredentials=Pick<z.infer<typeof connectionInput>,'userId'|'appId'|'appSecret'>;
type StoredConnection={payload:string;verified_channel:string;updated_at:string};
type Db={prepare:(sql:string)=>{bind:(...values:string[])=>{first:<T>()=>Promise<T|null>;run:()=>Promise<unknown>}}};
export function connectionDb(env:Record<string,unknown>){if(!env.DB)throw Error('账号绑定服务尚未就绪');return env.DB as Db;}
function vaultKey(key:string){if(!/^[a-f0-9]{64}$/i.test(key||''))throw Error('账号加密服务尚未就绪');return Buffer.from(key,'hex');}
export function sealCredentials(owner:string,credentials:PolyvCredentials,key:string){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',vaultKey(key),iv);cipher.setAAD(Buffer.from(owner));const encrypted=Buffer.concat([cipher.update(JSON.stringify(credentials),'utf8'),cipher.final()]);return ['v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),encrypted.toString('base64')].join('.');}
export function openCredentials(owner:string,payload:string,key:string):PolyvCredentials{const [version,iv,tag,data]=payload.split('.');if(version!=='v1')throw Error('账号数据版本不支持');const decipher=createDecipheriv('aes-256-gcm',vaultKey(key),Buffer.from(iv,'base64'));decipher.setAAD(Buffer.from(owner));decipher.setAuthTag(Buffer.from(tag,'base64'));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data,'base64')),decipher.final()]).toString('utf8'));}
export async function loadConnection(db:Db,owner:string){return db.prepare('SELECT payload, verified_channel, updated_at FROM polyv_connections WHERE owner_id = ?').bind(owner).first<StoredConnection>();}
export async function saveConnection(db:Db,owner:string,payload:string,channel:string){return db.prepare('INSERT INTO polyv_connections (owner_id, payload, verified_channel, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(owner_id) DO UPDATE SET payload=excluded.payload, verified_channel=excluded.verified_channel, updated_at=excluded.updated_at').bind(owner,payload,channel,new Date().toISOString()).run();}
export async function deleteConnection(db:Db,owner:string){return db.prepare('DELETE FROM polyv_connections WHERE owner_id = ?').bind(owner).run();}
export async function queryPolyv(credentials:PolyvCredentials,channelId:string,fetcher:typeof fetch=fetch,path="/live/v4/channel/decorate/get",extra:Record<string,string>={}){
 const params:Record<string,string>={appId:credentials.appId,timestamp:String(Date.now()),...(channelId?{channelId}:{}),...extra};
 params.sign=createHash('md5').update(credentials.appSecret+Object.keys(params).sort().map(k=>k+params[k]).join('')+credentials.appSecret).digest('hex').toUpperCase();
 let r:Response;try{r=await fetcher('https://api.polyv.net'+path+'?'+new URLSearchParams(params),{signal:AbortSignal.timeout(15000)});}catch{throw Error('频道服务连接超时，请稍后重试');}
 if(!r.ok)throw Error('频道服务请求失败（'+r.status+'）');
 let d:any;try{d=await r.json();}catch{throw Error('频道服务返回异常，请稍后重试');}
 if(d.code!==200)throw Error('频道验证失败（'+String(d.code).slice(0,20)+'），请检查 AppID、AppSecret 及频道所属账号');
 return d.data;
}
