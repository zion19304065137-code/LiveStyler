"use client";
import ChannelBackups from "./ChannelBackups";
import {useEffect,useState,useRef} from 'react';
import type {ChannelParameters} from '../lib/channel-match';
import {downloadFile} from '../lib/download';
type Account={connected:boolean;appIdHint?:string;userIdHint?:string;channelId?:string;updatedAt?:string};
export default function ChannelConnection({notify,onConnected,exportWarmup,exportOverlay,exportPackage,mode,currentChannel}:{notify:(message:string)=>void;onConnected:(p:ChannelParameters)=>void;exportWarmup:()=>Promise<Blob>;exportOverlay:()=>void;exportPackage:()=>Promise<void>;mode:'overlay'|'warmup';currentChannel?:string}){
 const [account,setAccount]=useState<Account>(),[loading,setLoading]=useState(true),[login,setLogin]=useState(false),[busy,setBusy]=useState(false),[editing,setEditing]=useState(false),[error,setError]=useState(''),[channel,setChannel]=useState(''),[snapshot,setSnapshot]=useState<unknown>();
 const listTicket=useRef(0);
 const [channels,setChannels]=useState<{channelId:string;name:string;status:string}[]>([]),[listLoading,setListLoading]=useState(false),[listError,setListError]=useState(''),[page,setPage]=useState(0),[hasMore,setHasMore]=useState(false);
 const [prepared,setPrepared]=useState<{file:Blob;preview:string;channelId:string}>(),[result,setResult]=useState('');
 useEffect(()=>()=>{if(prepared)URL.revokeObjectURL(prepared.preview)},[prepared]);
 const [fields,setFields]=useState({userId:'',appId:'',appSecret:'',channelId:''});
 useEffect(()=>{const abort=new AbortController();fetch('/api/polyv/account',{signal:abort.signal}).then(async r=>{const d=(await r.json()) as Account&{error?:string};if(!r.ok){if(r.status===401)setLogin(true);throw Error(d.error||'无法读取账号');}setAccount(d);setChannel(currentChannel||d.channelId||'');}).catch(e=>{if(!abort.signal.aborted)setError(e.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false)});return()=>abort.abort();},[]);
 async function loadChannels(next=1){const ticket=++listTicket.current;setListLoading(true);setListError('');try{const r=await fetch('/api/polyv/channels?page='+next),d=await r.json() as {error?:string;channels:{channelId:string;name:string;status:string}[];hasMore:boolean};if(ticket!==listTicket.current)return;if(!r.ok)throw Error(d.error||'频道读取失败');setChannels(previous=>next===1?d.channels:[...previous,...d.channels.filter((c:{channelId:string})=>!previous.some(p=>p.channelId===c.channelId))]);setPage(next);setHasMore(d.hasMore);}catch(e){if(ticket===listTicket.current)setListError((e as Error).message);}finally{if(ticket===listTicket.current)setListLoading(false);}}
 useEffect(()=>{setChannels([]);setPage(0);setHasMore(false);if(account?.connected)void loadChannels();return()=>{listTicket.current++;};},[account?.connected,account?.updatedAt]);
 async function selectChannel(id:string){setChannel(id);setBusy(true);setError('');setPrepared(undefined);setSnapshot(undefined);setResult('');try{await connectChannel(id);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function bind(){setBusy(true);setError('');try{const r=await fetch('/api/polyv/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(fields)}),d=(await r.json()) as Account&{error?:string};if(!r.ok){if(r.status===401)setLogin(true);throw Error(d.error||'绑定失败');}setAccount(d);setChannel(d.channelId||'');setFields({userId:'',appId:'',appSecret:'',channelId:''});setEditing(false);setSnapshot(undefined);setPrepared(undefined);setResult('');notify('账号已保存，下次无需重复填写');await connectChannel(d.channelId||'');}catch(e){setError((e as Error).message);}finally{setBusy(false)}}
 async function unbind(){setBusy(true);setError('');try{const r=await fetch('/api/polyv/account',{method:'DELETE'}),d=(await r.json()) as Account&{error?:string};if(!r.ok)throw Error(d.error||'解绑失败');setAccount(d);setChannel('');setSnapshot(undefined);setPrepared(undefined);setResult('');setFields({userId:'',appId:'',appSecret:'',channelId:''});notify('已解除直播账号绑定');}catch(e){setError((e as Error).message);}finally{setBusy(false)}}
 async function connectChannel(id:string){const r=await fetch('/api/polyv?channelId='+encodeURIComponent(id)),d=await r.json() as {error?:string;parameters?:ChannelParameters};if(!r.ok)throw Error(d.error||'连接失败');setSnapshot(d);if(d.parameters)onConnected(d.parameters);else notify('已连接，未读取到频道画幅');}
 async function query(){setBusy(true);setError('');setSnapshot(undefined);setPrepared(undefined);setResult('');try{await connectChannel(channel);}catch(e){setError((e as Error).message);}finally{setBusy(false)}}
 async function prepare(){setBusy(true);setError('');setResult('');try{const file=await exportWarmup();await apply({file,preview:"",channelId:channel});}catch(e){setError((e as Error).message);}finally{setBusy(false)}}
 async function apply(ready=prepared){if(!ready)return;setBusy(true);setError('');try{const form=new FormData();form.append('file',ready.file,'warmup.jpg');form.append('channelId',ready.channelId);form.append('target','warmup');form.append('confirmed','true');const r=await fetch('/api/polyv/apply',{method:'POST',body:form}),d=await r.json() as {error?:string;verified?:boolean};if(!r.ok)throw Error(d.error||'应用失败');setResult(d.verified?'已设置为频道暖场，并核对成功。':'已提交暖场图片，尚未确认生效，请到频道核对。');setPrepared(undefined);}catch(e){setError((e as Error).message);}finally{setBusy(false)}}

 return <div className="channelconnection"><h2>配置到频道</h2><p>保存直播账号，选择频道。</p>

   {loading?<p role="status">正在读取绑定状态…</p>:login?<button onClick={()=>location.reload()}>刷新会话</button>:<>
    {account?.connected&&<div className="connection-summary"><strong>已绑定 · {account.appIdHint}</strong><small>账号 {account.userIdHint} · 已保存</small><div><button disabled={busy} onClick={()=>setEditing(!editing)}>{editing?'取消更换':'更换账号'}</button><button disabled={busy} onClick={unbind}>解除绑定</button></div></div>}
    {(!account?.connected||editing)&&<form onSubmit={e=>{e.preventDefault();void bind()}}>
      {(['userId','appId','appSecret','channelId'] as const).map(key=><label key={key}>{({userId:'UserID（账号 ID）',appId:'AppID（应用 ID）',appSecret:'AppSecret（应用密钥）',channelId:'验证频道 ID'})[key]}<input required disabled={busy} type={key==='appSecret'?'password':'text'} autoComplete={key==='appSecret'?'new-password':'off'} spellCheck={false} inputMode={key==='channelId'?'numeric':undefined} value={fields[key]} maxLength={key==='appSecret'?256:100} onChange={e=>setFields(f=>({...f,[key]:e.target.value}))} placeholder={key==='channelId'?'填写该账号下的一个频道':key==='appSecret'?'填写应用密钥':'在保利威后台「开发设置」中获取'}/></label>)}
      <small>保存后自动记住账号，密钥加密保存。</small>
      <button className="primary wide" disabled={busy||!Object.values(fields).every(v=>v.trim())}>{busy?'正在验证…':'验证并保存账号'}</button>
    </form>}
    {account?.connected&&!editing&&<section className="recent-channels" aria-label="最近新建频道"><header><h3>最近新建频道</h3><button disabled={listLoading||busy} onClick={()=>loadChannels()}>刷新</button></header><div className="recent-channel-scroll" tabIndex={0} aria-label="频道列表">
      {channels.map(c=><button key={c.channelId} disabled={busy} className={channel===c.channelId?'active':''} onClick={()=>selectChannel(c.channelId)}><strong>{c.name}</strong><small>{c.channelId}{c.status?' · '+c.status:''}</small><span>{channel===c.channelId?'已选择':'连接'}</span></button>)}
      {listLoading&&<p role="status">正在读取频道…</p>}{!listLoading&&!channels.length&&!listError&&<p>暂无频道</p>}
      {hasMore&&<button disabled={listLoading||busy} onClick={()=>loadChannels(page+1)}>加载更多</button>}
    </div>{listError&&<p role="alert">{listError}<button disabled={listLoading} onClick={()=>loadChannels()}>重试</button></p>}</section>}
    {account?.connected&&!editing&&<div className="channelquery"><label>频道 ID<input value={channel} onChange={e=>{setChannel(e.target.value);setSnapshot(undefined);setPrepared(undefined);setResult('')}} inputMode="numeric" placeholder="输入该账号下的频道 ID"/></label><button className="primary wide" disabled={busy||!/^\d{1,20}$/.test(channel)} onClick={query}>{busy?'正在连接…':'连接频道'}</button></div>}
   </>}
   {account?.connected&&!editing&&<div className="channelpublish">
    <ChannelBackups key={channel} channel={channel}/><div className="prelive-package"><h3>开播前准备</h3><button disabled={busy} onClick={async()=>{setBusy(true);try{await exportPackage();}finally{setBusy(false)}}}>下载整套包装</button>
      <a className="button" href={/^\d{1,20}$/.test(channel)?'https://live.polyv.net/web-start/login?channelId='+encodeURIComponent(channel):undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!/^\d{1,20}$/.test(channel)}>打开网页开播 ↗</a>
      <small>在网页开播中添加素材包里的「完整设计.png」。当前不会自动导入场景。</small>
    </div>
    {mode==='warmup'?<button disabled={busy||!/^\d{1,20}$/.test(channel)} onClick={prepare}>一键配置到频道</button>:<><button disabled={busy} onClick={exportOverlay}>下载透明贴片</button><small>当前支持一键配置暖场；直播贴片可下载后导入开播端。</small></>}
    {prepared&&<div className="publish-confirm"><h3>确认应用到频道 {prepared.channelId}？</h3><img src={prepared.preview} alt="待应用暖场"/><p>替换该频道的暖场画面，非直播时显示。</p><button disabled={busy} className="primary" onClick={()=>apply()}>{busy?'正在应用…':'确认应用'}</button><button disabled={busy} onClick={()=>setPrepared(undefined)}>取消</button></div>}
    {result&&<p role="status">{result}</p>}
   </div>}
   {error&&<p className="connection-error" role="alert">{error}</p>}
   {snapshot!==undefined&&<details className="connection-result" open><summary>频道配置</summary><pre>{JSON.stringify(snapshot,null,2)}</pre><button onClick={()=>downloadFile("polyv-"+channel+"-snapshot.json",new Blob([JSON.stringify(snapshot,null,2)],{type:"application/json"}))}>下载配置快照</button></details>}
   <small></small>
   <a href="https://help.polyv.net/live/api/v4/channel/decorate/get/" target="_blank" rel="noreferrer">接入说明 ↗</a>
 </div>;
}
