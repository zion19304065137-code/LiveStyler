import {createHash} from 'node:crypto';
import {type PolyvCredentials,queryPolyv} from './polyv-account';
function signed(c:PolyvCredentials,values:Record<string,string>){const p={...values,appId:c.appId,timestamp:String(Date.now())};return {...p,sign:createHash('md5').update(c.appSecret+Object.keys(p).sort().map(k=>k+p[k as keyof typeof p]).join('')+c.appSecret).digest('hex').toUpperCase()};}
async function checked(response:Response){if(!response.ok)throw Error('频道应用失败（'+response.status+'）');let d:any;try{d=await response.json();}catch{throw Error('频道应用返回异常');}if(d.code!==200)throw Error('频道应用失败（'+String(d.code).slice(0,20)+'）');return d.data;}
export async function applyWarmup(c:PolyvCredentials,channelId:string,file:File,fetcher:typeof fetch=fetch,beforeWrite?:(before:string,after:string)=>Promise<void>){
 await queryPolyv(c,channelId,fetcher); // Authorize the selected channel before uploading or writing.
 const form=new FormData();for(const [k,v]of Object.entries(signed(c,{type:'warmImage'})))form.append(k,v);form.append('file',file,'warmup.jpg');
 const uploaded=await checked(await fetcher('https://api.polyv.net/live/v3/common/upload-image',{method:'POST',body:form,signal:AbortSignal.timeout(30000)}));
 const image=Array.isArray(uploaded)?uploaded[0]:null;if(typeof image!=='string')throw Error('图片上传未返回有效地址，未修改频道');
 const imageUrl=new URL(image.startsWith('//')?'https:'+image:image);
 if(imageUrl.protocol!=='https:'||!['videocc.net','polyv.net'].some(domain=>imageUrl.hostname===domain||imageUrl.hostname.endsWith('.'+domain)))throw Error('图片地址异常，未修改频道');
 const basic=await queryPolyv(c,channelId,fetcher,'/live/v4/channel/basic/get');
 if(beforeWrite){if(!Object.prototype.hasOwnProperty.call(basic,'bgImg')||(basic.bgImg!==null&&typeof basic.bgImg!=='string'))throw Error('频道原暖场配置无法读取，未执行替换');await beforeWrite(basic.bgImg||'',imageUrl.href);}
 const body=new URLSearchParams(signed(c,{coverImage:imageUrl.href}));
 await checked(await fetcher('https://api.polyv.net/live/v2/channels/'+channelId+'/update',{method:'POST',body,signal:AbortSignal.timeout(15000)}));
 let verified=false;try{const basic=await queryPolyv(c,channelId,fetcher,'/live/v4/channel/basic/get');const actual=typeof basic.bgImg==='string'?new URL(basic.bgImg.startsWith('//')?'https:'+basic.bgImg:basic.bgImg).href:'';verified=actual===imageUrl.href;}catch{}
 return {channelId,imageUrl:imageUrl.href,submitted:true,verified,target:'warmup'};
}

export async function restoreWarmup(c:PolyvCredentials,channelId:string,before:string,expected:string,fetcher:typeof fetch=fetch){
 const current=await queryPolyv(c,channelId,fetcher,'/live/v4/channel/basic/get');
 const normalize=(value:string)=>value.startsWith('//')?'https:'+value:value;
 if(typeof current.bgImg!=='string'||normalize(current.bgImg)!==normalize(expected))throw Error('频道已被再次修改，请重新查询，未覆盖当前配置');
 await checked(await fetcher('https://api.polyv.net/live/v2/channels/'+channelId+'/update',{method:'POST',body:new URLSearchParams(signed(c,{coverImage:before||'http://'})),signal:AbortSignal.timeout(15000)}));
 const verified=await queryPolyv(c,channelId,fetcher,'/live/v4/channel/basic/get');
 if(!Object.prototype.hasOwnProperty.call(verified,'bgImg')||normalize(verified.bgImg||'').replace(/^http:\/\/$/,'')!==normalize(before))throw Error('恢复已提交，尚未确认生效，请刷新频道');
 return {restored:true};
}
