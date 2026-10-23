"use client";
import {useEffect,useState} from 'react';
import {requestJson} from '../lib/http-client';
import {downloadFile} from '../lib/download';
import {projectSchema,type Project} from '../lib/design';
import type {ConversationMessage} from '../lib/conversation';
import WorkPreview from './WorkPreview';
import {pairedWork,loadConversation} from '../lib/storage';
import {workBundleSchema,type WorkCompanion} from '../lib/work-bundle';
type CloudWork={id:string;name:string;updated:string};
type Task={id:string;created:string;updated:string;state:string;message:string};
export default function CloudPanel({project,messages,onOpen,workId,view='projects',onSaved}:{workId:string;project:Project;messages:ConversationMessage[];onOpen:(project:Project,messages:ConversationMessage[],id:string,companion?:WorkCompanion)=>Promise<void>;view?:'projects'|'tasks';onSaved?:()=>void}){
 const [projects,setProjects]=useState<CloudWork[]>([]),[tasks,setTasks]=useState<Task[]>([]),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[chosen,setChosen]=useState<{id:string;project:Project;messages:ConversationMessage[];companion?:WorkCompanion}>();
 async function refresh(){setBusy(true);setNotice('');try{if(view==='projects'){const p=await requestJson<{projects:CloudWork[]}>('/api/cloud-projects');setProjects(p.projects);}else{const t=await requestJson<{tasks:Task[]}>('/api/tasks');setTasks(t.tasks);}}catch(e){setNotice((e as Error).message);}finally{setBusy(false);}}
 useEffect(()=>{setChosen(undefined);void refresh()},[view]);
 async function save(){setBusy(true);try{
  const pair=await pairedWork(workId,project.mode==='overlay'?'warmup':'overlay');
  const other=pair?{id:pair.id,project:pair.project,messages:await loadConversation(pair.id)}:undefined;
  const root=project.mode==='warmup'&&other?other:{id:workId,project,messages};
  const companion=project.mode==='warmup'&&other?{id:workId,project,messages}:other;
  await requestJson('/api/cloud-projects',{id:'work-'+root.id,project:root.project,messages:root.messages,...(companion?{companion}:{})});await refresh();setNotice(companion?'整套作品已同步：直播包装、暖场及各自对话':'已同步到云端，包含完整图层和对话');onSaved?.();
 }catch(e){setNotice((e as Error).message);}finally{setBusy(false);}}
 async function preview(id:string){setBusy(true);setNotice('');try{const d=await requestJson('/api/cloud-projects?id='+encodeURIComponent(id));setChosen({id,...workBundleSchema.parse(d)});}catch(e){setNotice((e as Error).message);}finally{setBusy(false);}}
 async function result(id:string){setBusy(true);try{const d=await requestJson<{src?:string;message?:string}>('/api/tasks?id='+encodeURIComponent(id));if(d.src)downloadFile('直播设计-'+id+'.png',d.src);else setNotice(d.message||'仍在生成，请稍后刷新');}catch(e){setNotice((e as Error).message);}finally{setBusy(false);}}
 return <div className="cloud-panel"><p>{view==='projects'?'云端保留当前浏览器的完整图层与对话。跨设备请导出作品文件后导入。':'这里保留 AI 返回的原始图片，画布上的排版请在作品中打开。'}</p><div className="match-actions">{view==='projects'&&<button className="primary" disabled={busy} onClick={save}>同步当前作品到云端</button>}<button disabled={busy} onClick={refresh}>刷新</button></div>{notice&&<p role="status">{notice}</p>}
 {view==='projects'?<>{projects.length===0&&<p>暂无云端作品</p>}{projects.map(p=><button className="cloud-work-row" key={p.id} disabled={busy} onClick={()=>preview(p.id)}><strong>{p.name}</strong><small>{new Date(p.updated).toLocaleString('zh-CN')}</small><span>预览 / 打开</span></button>)}{chosen&&<div className="publish-confirm"><WorkPreview project={chosen.project}/>{chosen.companion&&<WorkPreview project={chosen.companion.project}/>}<p>{chosen.companion?'直播包装 + 暖场 · ':''}{chosen.project.name} · {chosen.project.mode==='overlay'?'直播包装':'暖场画面'} · {chosen.project.layers.length} 个图层</p><button className="primary" disabled={busy} onClick={async()=>{setBusy(true);try{await onOpen(chosen.project,chosen.messages,chosen.id,chosen.companion);}finally{setBusy(false);}}}>{chosen.companion?'打开整套作品':'打开完整作品'}</button><button onClick={()=>setChosen(undefined)}>关闭预览</button></div>}</>:<>{tasks.length===0&&<p>暂无生成记录</p>}{tasks.map(t=><div key={t.id} className="connection-summary"><span>{new Date(t.created).toLocaleString('zh-CN')}</span><p>{t.state==='running'&&Date.now()-Date.parse(t.updated)>300000?'连接已中断':t.message}</p><button disabled={busy} onClick={()=>result(t.id)}>{t.state==='completed'?'下载原始生成图':'查看状态'}</button></div>)}</>}</div>;
}
