"use client";
import {useEffect,useRef,useState} from "react";
export type CaptureKind="screen"|"camera";
export type CaptureIssue={source:CaptureKind;code:string;title:string;help:string;detail:string;embedded:boolean};
export function captureIssue(error:unknown,source:CaptureKind,context:{embedded?:boolean;policyBlocked?:boolean;secure?:boolean}={}):CaptureIssue{
  const e=error as Error,code=e?.name||"CaptureError",embedded=!!context.embedded;
  let title="画面连接失败",help="请重新连接，或先上传参考图。";
  if(context.secure===false){title="当前页面不是安全连接";help="请通过 HTTPS 打开网站，再连接画面。";}
  else if(context.policyBlocked){title="当前页面的权限策略禁止"+(source==='screen'?"窗口共享":"摄像头访问");help=embedded?"请在独立窗口打开网站后重试；内嵌页面未获得所需权限。":"请检查浏览器或组织的权限策略设置。";}
  else if(code==='NotAllowedError'){title=source==='screen'?"窗口共享未获授权":"摄像头未获授权";help=embedded?"可能是取消了授权，或内嵌环境限制。请在独立窗口重试。":source==='screen'?"请重新连接，在弹窗中选中窗口后点击分享；若仍失败，检查浏览器或系统的录屏权限。":"请在地址栏的网站权限中允许摄像头，并检查系统相机权限。";}
  else if(code==='InvalidStateError'){title="共享请求未能启动";help="请保持网页处于前台，直接点击共享窗口重试。";}
  else if(code==='NotFoundError'){title=source==='screen'?"没有找到可共享的画面":"没有找到摄像头";help=source==='screen'?"请打开要共享的窗口，再重新选择。":"请检查摄像头是否已连接。";}
  else if(code==='OverconstrainedError'){title='所选摄像头不可用';help='请刷新设备列表，重新选择摄像头；使用 OBS 时先启动虚拟摄像头。';}
  else if(code==='NotReadableError'){title="无法读取画面";help="请检查系统录屏或相机权限，并确认设备可用。";}
  else if(code==='UnsupportedError'){title="当前浏览器不支持此连接方式";help="请用桌面版 Chrome 或 Edge 独立打开网站重试。";}
  return {source,code,title,help,detail:e?.message||"",embedded};
}
function captureContext(source:CaptureKind){
  let embedded=false;try{embedded=typeof window!=="undefined"&&window.self!==window.top;}catch{embedded=true;}
  const doc=document as Document&{permissionsPolicy?:{allowsFeature:(name:string)=>boolean;features?:()=>string[]};featurePolicy?:{allowsFeature:(name:string)=>boolean;features?:()=>string[]}};
  const policy=doc.permissionsPolicy||doc.featurePolicy,feature=source==='screen'?'display-capture':'camera';
  let policyBlocked=false;try{if(policy&&(!policy.features||policy.features().includes(feature)))policyBlocked=!policy.allowsFeature(feature);}catch{}
  return {embedded,policyBlocked,secure:typeof window==='undefined'?true:window.isSecureContext};
}
export function useLiveCapture(notify:(message:string)=>void){
  const [video,setVideo]=useState<HTMLVideoElement>(),[kind,setKind]=useState<CaptureKind>(),[pending,setPending]=useState(false);
  const [issue,setIssue]=useState<CaptureIssue>();
  const [cameras,setCameras]=useState<{deviceId:string;label:string}[]>([]),[cameraId,setCameraId]=useState(''),[deviceError,setDeviceError]=useState('');
  const devicesTicket=useRef(0);
  async function refreshCameras(){const id=++devicesTicket.current;try{if(!navigator.mediaDevices?.enumerateDevices)throw Error('当前浏览器无法读取设备列表');const devices=await navigator.mediaDevices.enumerateDevices();if(!mounted.current||id!==devicesTicket.current)return;setCameras(devices.filter(d=>d.kind==='videoinput'&&d.deviceId).map((d,i)=>({deviceId:d.deviceId,label:d.label||'摄像头 '+(i+1)})));setDeviceError('');}catch{if(mounted.current&&id===devicesTicket.current)setDeviceError('设备列表读取失败，请刷新重试');}}
  const current=useRef<{stream:MediaStream;video:HTMLVideoElement}|undefined>(undefined),ticket=useRef(0),requesting=useRef(false),mounted=useRef(true);
  const message=useRef(notify);message.current=notify;
  function release(){const old=current.current;current.current=undefined;if(old){old.stream.getTracks().forEach(t=>t.stop());old.video.pause();old.video.srcObject=null;}}
  function stop(){ticket.current++;release();if(mounted.current){setVideo(undefined);setKind(undefined);}}
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;ticket.current++;release();};},[]);
  useEffect(()=>{const media=navigator.mediaDevices;const changed=()=>{void refreshCameras();};media?.addEventListener?.('devicechange',changed);return()=>{devicesTicket.current++;media?.removeEventListener?.('devicechange',changed);};},[]);
  async function start(next:CaptureKind,deviceId=''){
    if(requesting.current)return;
    const context=captureContext(next);
    const fail=(error:unknown)=>{const result=captureIssue(error,next,context);setIssue(result);message.current(result.title+"。"+result.help);};
    setIssue(undefined);
    if(context.secure===false||context.policyBlocked){fail(Object.assign(new Error("Browser capture permission policy"),{name:"SecurityError"}));return;}
    if(!navigator.mediaDevices||(next==="screen"?!navigator.mediaDevices.getDisplayMedia:!navigator.mediaDevices.getUserMedia)){fail(Object.assign(new Error("Media capture API is unavailable"),{name:"UnsupportedError"}));return;}
    const id=++ticket.current;requesting.current=true;setPending(true);let stream:MediaStream|undefined,element:HTMLVideoElement|undefined;
    try{
      stream=next==="screen"?await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:24,max:30}},audio:false}):await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1920},height:{ideal:1080},...(deviceId?{deviceId:{exact:deviceId}}:{facingMode:"user"})},audio:false});
      if(id!==ticket.current||!mounted.current){stream.getTracks().forEach(t=>t.stop());return;}
      element=document.createElement('video');element.muted=true;element.autoplay=true;element.playsInline=true;element.srcObject=stream;
      const ready=new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>done(new Error("画面加载超时，请重新连接。")),10000);const done=(error?:Error)=>{clearTimeout(timer);element!.removeEventListener('loadeddata',loaded);element!.removeEventListener('error',failed);error?reject(error):resolve();};const loaded=()=>done();const failed=()=>done(new Error("画面读取失败，请重新连接。"));element!.addEventListener('loadeddata',loaded);element!.addEventListener('error',failed);if(element!.readyState>=2)done();});
      await Promise.all([element.play(),ready]);
      if(id!==ticket.current||!mounted.current){stream.getTracks().forEach(t=>t.stop());element.pause();element.srcObject=null;return;}
      if(!stream.getVideoTracks().some(t=>t.readyState==='live'))throw Error("画面连接已结束，请重新选择。");
      release();current.current={stream,video:element};setVideo(element);setKind(next);if(next==='camera'){setCameraId(stream.getVideoTracks()[0]?.getSettings?.().deviceId||deviceId);void refreshCameras();}
      const selected=stream;
      selected.getVideoTracks().forEach(t=>t.addEventListener('ended',()=>{if(current.current?.stream===selected){stop();message.current("画面连接已结束。");}},{once:true}));
      message.current(next==="screen"?"窗口已连接，AI 将截取当前画面。":"摄像头已连接，AI 将截取当前画面。");
    }catch(error){stream?.getTracks().forEach(t=>t.stop());if(element){element.pause();element.srcObject=null;}
      if(id===ticket.current&&mounted.current){fail(error);}
    }finally{requesting.current=false;if(mounted.current)setPending(false);}
  }
  return {video,kind,pending,start,stop,issue,cameras,cameraId,refreshCameras,deviceError,clearIssue:()=>setIssue(undefined)};
}
