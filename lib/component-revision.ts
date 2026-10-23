import type {Project} from './design';
/** Confirm one generated candidate without changing any layer geometry or neighboring layers. */
export function replaceComponent(project:Project,candidate:{id:string;original:string;src:string}):Project{
 const target=project.layers.find(l=>l.id===candidate.id);
 if(!target||target.locked||target.type!=='image'||target.src!==candidate.original)throw Error('原组件已变化，请重新修改');
 return {...project,layers:project.layers.map(l=>l.id===target.id?{...l,src:candidate.src}:l)};
}
