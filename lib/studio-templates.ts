import {projectSchema,resizeProject,type Project,type Ratio,styles} from './design';
import {aiTemplateData} from './ai-template-data';
export function studioTemplate(scene=0,ratio:Ratio='landscape',mode:Project['mode']='overlay'):Project{
 const vertical=ratio==='portrait',width=vertical?1080:1920,height=vertical?1920:1080,art=aiTemplateData[scene+'-'+ratio];
 if(!art)throw Error('模板不存在');
 const base={visible:true,locked:false,rotation:0,opacity:1,fill:'#ffffff',aspectLocked:true};
 const layers=mode==='warmup'?[{...base,id:'ai-warmup',name:'暖场画面',type:'background' as const,locked:true,x:0,y:0,width,height,src:art.warmup}]:art.pieces.map((p,i)=>({...base,id:'ai-piece-'+i,name:(p.y<.3?'顶部包装':p.y>.74?'底部包装':'独立贴片')+' '+(i+1),type:'image' as const,x:p.x*width,y:p.y*height,width:p.width*width,height:p.height*height,src:p.src}));
 const footage=mode==='overlay'&&scene===2?{footageViewport:vertical?{x:.02,y:.15,width:.96,height:.29}:{x:.025,y:.16,width:.31,height:.52}}:{};
 return projectSchema.parse({version:1,packagingVersion:2,templateStyle:'ai-v1',mode,scene,width,height,name:styles[scene].name+' · '+(vertical?'竖屏':'横屏')+(mode==='warmup'?'暖场':'包装'),reservePpt:scene===2,protectedAreaEnabled:false,...footage,layers});
}
export function reflowStudioTemplate(p:Project,ratio:Ratio):Project{
 if((p.height>p.width?'portrait':'landscape')===ratio)return p;
 const next=studioTemplate(p.scene,ratio,p.mode),original=studioTemplate(p.scene,p.height>p.width?'portrait':'landscape',p.mode),defaults=new Map(original.layers.map(l=>[l.id,l])),scaled=resizeProject(p,ratio),prior=new Map(p.layers.map(l=>[l.id,l]));
 next.layers=next.layers.map(l=>{const old=prior.get(l.id),source=defaults.get(l.id);return old?{...l,visible:old.visible,locked:old.locked,opacity:old.opacity,mask:old.mask,cornerRadius:old.cornerRadius,imageCrop:old.imageCrop,imageFit:old.imageFit,flipX:old.flipX,flipY:old.flipY,...(old.src!==source?.src?{src:old.src}: {})}:l;});
 next.layers=next.layers.map(l=>{const old=prior.get(l.id);return old?{...l,shadowEnabled:old.shadowEnabled,shadowColor:old.shadowColor,shadowOpacity:old.shadowOpacity,shadowBlur:old.shadowBlur,shadowOffsetX:old.shadowOffsetX,shadowOffsetY:old.shadowOffsetY}:l;});
 const ids=new Set(next.layers.map(l=>l.id));next.layers.push(...scaled.layers.filter(l=>!ids.has(l.id)));
 return projectSchema.parse({...scaled,...next,name:p.name,reservePpt:p.reservePpt,previewImage:p.previewImage,protectedArea:scaled.protectedArea,protectedAreaEnabled:p.protectedAreaEnabled});
}
/** The editor checks for a saved counterpart before creating this one. */
export function companionTemplate(p:Project):Project{return studioTemplate(p.scene,p.height>p.width?'portrait':'landscape',p.mode==='overlay'?'warmup':'overlay');}
/** Only migrate the retired template-authored offset; preserve uploaded footage and user transforms. */
export function restoreTemplateFootage(p:Project):Project{
 const t=p.footageTransform,vertical=p.height>p.width;
 const retired=p.mode==='overlay'&&p.templateStyle==='ai-v1'&&!p.previewImage&&p.footageLocked!==false&&(p.scene===1||p.scene===0&&vertical)&&t?.x===0&&t.scale===1&&t.y===(vertical?.2:.23);
 return retired?{...p,footageTransform:undefined}:p;
}
