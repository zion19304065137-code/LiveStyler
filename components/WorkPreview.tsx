import {useEffect,useId,useState} from 'react';
import type {Project,Layer} from '../lib/design';
import {imageGeometry} from '../lib/image-render';
function ImagePreview({layer:l}:{layer:Layer}){
 const id=useId().replace(/[^a-zA-Z0-9]/g,''),[size,setSize]=useState({width:l.width,height:l.height});
 useEffect(()=>{let active=true;const image=new Image();image.onload=()=>{if(active)setSize({width:image.naturalWidth,height:image.naturalHeight});};image.src=l.src!;return()=>{active=false;};},[l.src]);
 const g=imageGeometry(size,l,l),radius=Math.min(l.cornerRadius??32,l.width/2,l.height/2);
 return <g><defs><clipPath id={id}>{l.mask==='ellipse'?<ellipse cx={l.width/2} cy={l.height/2} rx={l.width/2} ry={l.height/2}/>:<rect width={l.width} height={l.height} rx={l.mask==='rounded'?radius:0}/>}</clipPath></defs><g clipPath={`url(#${id})`}><g transform={`translate(${l.flipX?l.width:0} ${l.flipY?l.height:0}) scale(${l.flipX?-1:1} ${l.flipY?-1:1})`}><svg x={g.dx} y={g.dy} width={g.dw} height={g.dh} viewBox={`${g.sx} ${g.sy} ${g.sw} ${g.sh}`} preserveAspectRatio="none"><image href={l.src} width={size.width} height={size.height} preserveAspectRatio="none"/></svg></g></g></g>;
}
function LayerPreview({layer:l}:{layer:Layer}){
 const id='shadow'+useId().replace(/[^a-zA-Z0-9]/g,''),pad=Math.max(Math.abs(l.shadowOffsetX??0),Math.abs(l.shadowOffsetY??8))+(l.shadowBlur??16)*3+2;
 return <g opacity={l.opacity} transform={`translate(${l.x} ${l.y}) rotate(${l.rotation})`}>{l.shadowEnabled&&<defs><filter id={id} filterUnits="userSpaceOnUse" x={-pad} y={-pad} width={l.width+2*pad} height={l.height+2*pad} colorInterpolationFilters="sRGB"><feDropShadow dx={l.shadowOffsetX??0} dy={l.shadowOffsetY??8} stdDeviation={(l.shadowBlur??16)/2} floodColor={l.shadowColor||'#000000'} floodOpacity={l.shadowOpacity??0.35}/></filter></defs>}<g filter={l.shadowEnabled?`url(#${id})`:undefined}>{l.src?<ImagePreview layer={l}/>:l.type==='text'?<text fill={l.fill} fontSize={l.fontSize||40} fontWeight={l.id==='活动标题'?700:400} fontFamily="Arial, Microsoft YaHei, sans-serif">{(l.text||'').split('\n').map((line,i)=><tspan key={i} x="0" y={(l.fontSize||40)*(.85+i*1.2)}>{line}</tspan>)}</text>:<rect width={l.width} height={l.height} rx={l.cornerRadius||0} fill={l.fill}/>}</g></g>;
}
export default function WorkPreview({project,backdrop}:{project:Project;backdrop?:string}){
 const photo=project.previewImage||backdrop;
 return <svg className="work-preview" viewBox={`0 0 ${project.width} ${project.height}`} role="img" aria-label={project.name+' 作品预览'} preserveAspectRatio="xMidYMid meet"><rect width={project.width} height={project.height} fill="#181722"/>{project.mode==='overlay'&&photo&&<image href={photo} width={project.width} height={project.height} preserveAspectRatio="xMidYMid slice"/>}{project.layers.filter(l=>l.visible&&l.opacity>0).map(l=><LayerPreview key={l.id} layer={l}/>)}</svg>;
}
