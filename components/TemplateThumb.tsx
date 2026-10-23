import {scenePhotos} from '../lib/scene-assets';
import type {Project} from '../lib/design';
export default function TemplateThumb({index,vertical=false,mode='overlay'}:{index:number;vertical?:boolean;mode?:Project['mode']}){
 const photo=scenePhotos[index];
 return <div className={'overlaythumb broadcastthumb '+(vertical?'vertical':'')} style={{aspectRatio:vertical?'9/16':'16/9'}}><img className="original-template-cover" src={vertical?photo.portraitSrc:photo.src} alt={photo.alt} loading="lazy"/></div>;
}
