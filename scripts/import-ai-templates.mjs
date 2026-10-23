import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {createCanvas,loadImage,ImageData} from '@napi-rs/canvas';
// Import AI-rendered pixels only. No artwork or lettering is drawn here.
const input=process.argv[2];if(!input)throw Error('Provide the directory containing the eight AI PNG files');
const module=ts.transpileModule(fs.readFileSync('lib/split-art.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {splitArtPixels}=await import('data:text/javascript;base64,'+Buffer.from(module).toString('base64'));
const data={};fs.mkdirSync('public/ai-templates',{recursive:true});
for(const [scene,index]of ['launch','gala','training','commerce'].map((s,i)=>[s,i]))for(const ratio of ['landscape','portrait']){
 const key=scene+'-'+ratio,source=path.join(input,key+'.webp'),image=await loadImage(source),c=createCanvas(image.width,image.height),ctx=c.getContext('2d');ctx.drawImage(image,0,0);
 const pixels=ctx.getImageData(0,0,c.width,c.height).data;
 if(pixels[(Math.floor(c.height/2)*c.width+Math.floor(c.width/2))*4+3]>6)throw Error(key+': live content center is not transparent');
 const copy='public/ai-templates/'+key+'.webp';if(path.resolve(source)!==path.resolve(copy))fs.copyFileSync(source,copy);
 const pieces=splitArtPixels(pixels,c.width,c.height).sort((a,b)=>a.y-b.y||a.x-b.x);
 data[index+'-'+ratio]={pieces:pieces.map(p=>{const crop=createCanvas(p.width,p.height);crop.getContext('2d').putImageData(new ImageData(p.data,p.width,p.height),0,0);return{x:p.x/c.width,y:p.y/c.height,width:p.width/c.width,height:p.height/c.height,src:crop.toDataURL('image/png')};}),warmup:'data:image/webp;base64,'+fs.readFileSync('public/scenes/'+key+'-v2.webp').toString('base64')};
 console.log(key+': '+pieces.length+' transparent components');
}
fs.writeFileSync('lib/ai-template-data.ts','// AI-generated packaging; imported pixels preserve alpha and text.\nexport const aiTemplateData:Record<string,{pieces:{x:number;y:number;width:number;height:number;src:string}[];warmup:string}>='+JSON.stringify(data)+';\n');
