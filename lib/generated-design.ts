import { projectSchema, type Project } from './design';
/** Always retain a visible full-frame warmup, including projects imported without a background. */
export function applyWarmupDesign(project:Project,src:string):Project{
 const background=project.layers.find(l=>l.type==='background');
 const art=background?{...background,src,visible:true,opacity:1}:{id:'warmup-background',name:'暖场画面',type:'background' as const,x:0,y:0,width:project.width,height:project.height,src,fill:'#000000',visible:true,locked:true,opacity:1,rotation:0};
 return projectSchema.parse({...project,layers:[art,...project.layers.filter(l=>l.type!=='background').map(l=>l.locked||l.type==='image'?l:{...l,visible:false})]});
}
/** Generated lettering is baked into the image. Keep its source copy hidden for regeneration. */
export function applyGeneratedDesign(project: Project, src: string): Project {
  const previous = project.layers.filter(l => !l.id.startsWith('ai-overlay-art'));
  const sources = previous.map(l => {
    if (l.type === 'background') return {...l,visible:true,opacity:0};
    if (l.type === 'text' && !l.locked && (l.visible || l.groupId === 'ai-source-text'))
      return {...l,visible:false,groupId:'ai-source-text',groupName:'AI文案来源（已融入图片）'};
    // Existing template surfaces and prior vector design must not compete with the new complete artwork.
    if (!l.locked && (l.type === 'shape' || (l.type === 'image' && !/logo/i.test(l.name)))) return {...l,visible:false};
    return l;
  });
  const foreground = sources.filter(l => l.visible && l.type !== 'background' && (l.locked || (l.type === 'image' && /logo/i.test(l.name))));
  return projectSchema.parse({...project,layers:[
    ...sources.filter(l => !foreground.includes(l)),
    {id:'ai-overlay-art',name:'AI完整贴片（含文字）',type:'image',x:0,y:0,width:project.width,height:project.height,src,fill:'transparent',visible:true,locked:false,opacity:1,rotation:0},
    ...foreground,
  ]});
}

export function applyGeneratedObjects(project:Project,src:string,objects:{x:number;y:number;width:number;height:number;src:string}[]):Project {
 const base=applyGeneratedDesign(project,src);
 if(objects.length<2)return base;
 const index=base.layers.findIndex(l=>l.id==='ai-overlay-art'),prototype=base.layers[index];
 return projectSchema.parse({...base,layers:[...base.layers.slice(0,index),...objects.map((o,i)=>({...prototype,id:'ai-overlay-art-'+(i+1),name:'AI物件 '+(i+1),x:o.x*project.width,y:o.y*project.height,width:o.width*project.width,height:o.height*project.height,src:o.src})),...base.layers.slice(index+1)]});
}
