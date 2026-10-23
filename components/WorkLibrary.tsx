import {useState} from 'react';
import {Copy,Trash2,Plus} from 'lucide-react';
import {groupWorks,type SavedWork} from '../lib/storage';
import WorkPreview from './WorkPreview';
export default function WorkLibrary({works,active,onOpen,onCopy,onDelete,onNew,onLink}:{
 works:SavedWork[];active:string;onOpen:(w:SavedWork)=>void;onCopy:(w:SavedWork)=>void;onDelete:(w:SavedWork)=>void;onNew:()=>void;onLink:(a:SavedWork,b:SavedWork)=>Promise<void>;
}){
 const [linking,setLinking]=useState(false);
 return <>
  <p>一份作品包含直播包装与暖场，打开后可继续历史对话。</p>
  <button className="primary wide" onClick={onNew}><Plus size={16}/>新建作品</button>
  <div className="worklibrary">{groupWorks(works).map(group=>{
   const current=group.find(w=>w.id===active),lead=current||group[0];
   return <article className="workitem" key={group[0].id}>
    <button className="workopen" onClick={()=>onOpen(lead)}>
     <WorkPreview project={lead.project}/><div><b>{group[0].project.name}</b><small>{group.length===2?'直播包装 + 暖场':lead.project.mode==='overlay'?'直播包装':'暖场'} · {new Date(group.reduce((a,b)=>a.updatedAt>b.updatedAt?a:b).updatedAt).toLocaleString('zh-CN')}</small></div>{current&&<span className="currentwork">当前</span>}
    </button>
    <div className="work-variants">{group.map(w=><div key={w.id}>
     <button onClick={()=>onOpen(w)}>{w.project.mode==='overlay'?'打开直播包装':'打开暖场'}与对话</button>
     <button aria-label={'复制'+(w.project.mode==='overlay'?'直播包装':'暖场')} onClick={()=>onCopy(w)}><Copy size={13}/></button>
     <button disabled={w.id===active} aria-label={'删除'+(w.project.mode==='overlay'?'直播包装':'暖场')} onClick={()=>onDelete(w)}><Trash2 size={13}/></button>
    </div>)}</div>
    {group.length===1&&<select aria-label="关联到同一作品" disabled={linking} value="" onChange={async e=>{const other=works.find(w=>w.id===e.target.value);if(!other)return;setLinking(true);try{await onLink(lead,other);}finally{setLinking(false);}}}>
     <option value="">关联已有{lead.project.mode==='overlay'?'暖场':'直播包装'}…</option>{works.filter(w=>w.id!==lead.id&&w.project.mode!==lead.project.mode&&!w.pairedId).map(w=><option key={w.id} value={w.id}>{w.project.name} · {new Date(w.updatedAt).toLocaleString('zh-CN')}</option>)}
    </select>}
   </article>;
  })}{!works.length&&<p>还没有保存的作品。</p>}</div>
 </>;
}
