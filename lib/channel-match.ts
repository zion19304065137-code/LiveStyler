export type ChannelParameters={channelId:string;template:string;liveType:string;scene:string;ratio:'portrait'|'landscape'|null;source:'频道模板'};
export function channelParameters(channelId:string,raw:Record<string,unknown>):ChannelParameters{
 const template=typeof raw.template==='string'?raw.template.slice(0,100):'',scene=typeof raw.newScene==='string'&&raw.newScene!=='undefined'?raw.newScene.slice(0,100):typeof raw.scene==='string'?raw.scene.slice(0,100):'';
 const labels:Record<string,string>={portrait_alone:'纯视频',alone:'纯视频',portrait_ppt:'三分屏',ppt:'三分屏',topclass:'纯视频·极速',seminar:'研讨会'};
 return {channelId,template,scene,liveType:labels[template]||'未识别',ratio:['portrait_alone','portrait_ppt'].includes(template)?'portrait':['alone','ppt','topclass'].includes(template)?'landscape':null,source:'频道模板'};
}
