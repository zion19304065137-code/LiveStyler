import {createHash} from 'node:crypto';
type AssetObject={body:ReadableStream;customMetadata?:Record<string,string>;httpMetadata?:{contentType?:string}};
export type AssetBucket={delete:(key:string)=>Promise<unknown>;put:(key:string,value:ArrayBuffer,options:unknown)=>Promise<unknown>;get:(key:string)=>Promise<AssetObject|null>;list:(options:{prefix:string;limit:number;cursor?:string;include:string[]})=>Promise<{objects:{key:string;size:number;customMetadata?:Record<string,string>}[];truncated:boolean;cursor?:string}>};
export function assetPrefix(owner:string){return 'account-assets/'+createHash('sha256').update(owner).digest('hex')+'/';}
export function assetBucket(env:Record<string,unknown>){if(!env.BUCKET)throw Error('素材库暂不可用');return env.BUCKET as AssetBucket;}
export function assetId(value:string){if(!/^\d{13}-[a-f0-9-]{36}$/.test(value))throw Error('素材编号无效');return value;}
export async function validateAsset(file:File){
 if(file.size<12||file.size>4*1024*1024)throw Error('图片请控制在 4MB 以内');
 const bytes=new Uint8Array(await file.arrayBuffer()),png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10,jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 if(!((file.type==='image/png'&&png)||(file.type==='image/jpeg'&&jpeg)||(file.type==='image/webp'&&webp)))throw Error('请上传有效的 PNG、JPG 或 WebP 图片');
 return bytes.buffer;
}
