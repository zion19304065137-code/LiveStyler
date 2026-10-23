import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {createCanvas,loadImage,Image} from '@napi-rs/canvas';
import Konva from 'konva';
import JSZip from 'jszip';
Konva.Util.createCanvasElement=()=>{const c=createCanvas(300,300);c.style={};return c;};Konva.Util.createImageElement=()=>new Image();
const modules=['design','ai-template-data','studio-templates','editor-actions','canvas-export','export-package'];
for(const name of modules){const code=ts.transpileModule(fs.readFileSync('lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,(all,n)=>modules.includes(n)?`from './.studio-test-${n}.mjs'`:all);fs.writeFileSync('lib/.studio-test-'+name+'.mjs',code);}
try{
 const {studioTemplate,reflowStudioTemplate,companionTemplate,restoreTemplateFootage}=await import('../lib/.studio-test-studio-templates.mjs');
 const {exportStage}=await import('../lib/.studio-test-canvas-export.mjs');const {buildMaterialPackage}=await import('../lib/.studio-test-export-package.mjs');
 const {inspection}=await import('../lib/.studio-test-editor-actions.mjs');const {projectSchema,blankProject}=await import('../lib/.studio-test-design.mjs');
 const out=process.env.TEMPLATE_QA_DIR||path.join(os.tmpdir(),'livestyler-ai-templates');fs.mkdirSync(out,{recursive:true});
 for(const mode of ['overlay','warmup'])for(const ratio of ['landscape','portrait'])for(let scene=0;scene<4;scene++){
  const p=studioTemplate(scene,ratio,mode);assert.deepEqual(projectSchema.parse(JSON.parse(JSON.stringify(p))),p);assert.equal(p.templateStyle,'ai-v1');assert.equal(inspection(p).length,0);assert(p.layers.length>0);assert(p.layers.every(l=>!!l.src),'All template artwork comes from image pixels, not authored plates or text');
  const stage=new Konva.Stage({width:p.width*.3,height:p.height*.3,scaleX:.3,scaleY:.3}),layer=new Konva.Layer();stage.add(layer);const guide=new Konva.Group({name:'preview-only'});guide.add(new Konva.Rect({width:p.width,height:p.height,fill:'#ff00ff'}));layer.add(guide);
  for(const l of p.layers){assert(l.x>=0&&l.y>=0&&l.x+l.width<=p.width+.1&&l.y+l.height<=p.height+.1);layer.add(new Konva.Image({...l,fill:undefined,name:'art',layerId:l.id,image:await loadImage(l.src)}));}
  const before=stage.toJSON(),url=exportStage(stage,p),image=await loadImage(url),canvas=createCanvas(p.width,p.height),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);assert.equal(image.width,p.width);assert.equal(image.height,p.height);assert.equal(ctx.getImageData(p.width/2,p.height/2,1,1).data[3],mode==='overlay'?0:255);assert.equal(stage.toJSON(),before);fs.writeFileSync(path.join(out,`${mode}-${ratio}-${scene}.png`),Buffer.from(url.split(',')[1],'base64'));
  if(mode==='overlay'&&ratio==='landscape'){const zip=await JSZip.loadAsync(await(await buildMaterialPackage(p,(format,ids)=>exportStage(stage,p,format,ids))).arrayBuffer());assert.deepEqual(projectSchema.parse(JSON.parse(await zip.file('project.livestyler.json').async('string'))),p);const manifest=JSON.parse(await zip.file('素材清单.json').async('string'));assert.equal(manifest.layers.length,p.layers.length);for(const item of manifest.layers)assert(zip.file(item.file));}
  if(mode==='overlay'&&scene===3){const face=ratio==='portrait'?{x:.4,y:.3,w:.26,h:.17}:{x:.37,y:.29,w:.20,h:.25},pixels=ctx.getImageData(Math.round(face.x*p.width),Math.round(face.y*p.height),Math.round(face.w*p.width),Math.round(face.h*p.height)).data;let blocked=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>20)blocked++;assert(blocked/(pixels.length/4)<.02,'Fixed commerce packaging leaves the regenerated presenter face clear');}
  stage.destroy();
  const next=reflowStudioTemplate(p,ratio==='landscape'?'portrait':'landscape');assert.equal(inspection(next).length,0);assert.equal(next.scene,p.scene);assert.equal(next.name,p.name);
  const masked={...p,layers:p.layers.map((l,i)=>i===0?{...l,mask:'rounded',cornerRadius:24,imageFit:'contain',imageCrop:{x:0,y:0,width:.8,height:1},flipX:true}:l)},maskedNext=reflowStudioTemplate(masked,ratio==='landscape'?'portrait':'landscape');assert.equal(maskedNext.layers[0].mask,'rounded');assert.equal(maskedNext.layers[0].imageCrop.width,.8);assert.equal(maskedNext.layers[0].flipX,true);
  const custom={...p,layers:[...p.layers,{id:'custom-copy',name:'我的文字',type:'text',text:'自定义主题',fontSize:30,x:100,y:100,width:400,height:80,fill:'#fff',visible:true,locked:false,rotation:0,opacity:1}]};assert(reflowStudioTemplate(custom,ratio==='landscape'?'portrait':'landscape').layers.some(l=>l.id==='custom-copy'&&l.text==='自定义主题'));
  const companion=companionTemplate(p);assert.notEqual(companion.mode,p.mode);assert.equal(companion.scene,p.scene);if(scene===2)assert(p.reservePpt);
 }
 const clean=studioTemplate(1,'portrait','overlay'),legacy={...clean,footageTransform:{x:0,y:.2,scale:1}};assert.equal(clean.footageTransform,undefined);assert.equal(restoreTemplateFootage(legacy).footageTransform,undefined);assert.equal(restoreTemplateFootage({...legacy,previewImage:'data:image/png;base64,aGVsbG8='}).footageTransform.y,.2);assert.equal(restoreTemplateFootage({...legacy,footageLocked:false}).footageTransform.y,.2);assert.equal(restoreTemplateFootage({...legacy,footageTransform:{x:0,y:.3,scale:1}}).footageTransform.y,.3);
 const thumb=fs.readFileSync('components/TemplateThumb.tsx','utf8');assert(thumb.includes('scenePhotos')&&thumb.includes('portraitSrc'));assert(!thumb.includes('studioTemplate'),'Original eight covers remain separate from generated assets');assert.equal(blankProject().layers.length,0);
 console.log('PASS: 8 AI overlays plus 8 original-image warmups; production PNG/ZIP exports, alpha, bounds, ratio changes, custom layers, paired templates and original covers.');
}finally{for(const name of modules)fs.rmSync('lib/.studio-test-'+name+'.mjs',{force:true});}
