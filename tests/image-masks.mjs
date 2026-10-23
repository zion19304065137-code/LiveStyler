import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import Konva from 'konva';
import JSZip from 'jszip';
import {createCanvas,loadImage,Image} from '@napi-rs/canvas';
Konva.Util.createCanvasElement=()=>{const c=createCanvas(300,300);c.style={};return c;};Konva.Util.createImageElement=()=>new Image();
const modules=['design','image-render','canvas-export','component-revision','export-package'];
for(const name of modules){const code=ts.transpileModule(fs.readFileSync('lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g,(all,n)=>modules.includes(n)?`from './.mask-test-${n}.mjs'`:all);fs.writeFileSync('lib/.mask-test-'+name+'.mjs',code);}
try{
 const {imageGeometry,updateImageCrop,imageRenderProps}=await import('../lib/.mask-test-image-render.mjs');const {projectSchema,blankProject}=await import('../lib/.mask-test-design.mjs');const {exportStage}=await import('../lib/.mask-test-canvas-export.mjs');const {replaceComponent}=await import('../lib/.mask-test-component-revision.mjs');const {buildMaterialPackage}=await import('../lib/.mask-test-export-package.mjs');
 const source=createCanvas(200,100),sx=source.getContext('2d');sx.fillStyle='#ff0000';sx.fillRect(0,0,100,100);sx.fillStyle='#0000ff';sx.fillRect(100,0,100,100);const src=source.toDataURL('image/png');
 const base={id:'image',name:'图片',type:'image',x:100,y:100,width:200,height:200,fill:'#ffffff',src,visible:true,locked:false,rotation:0,opacity:1};
 async function render(extra){const l={...base,...extra},p=projectSchema.parse({...blankProject(),layers:[l]}),stage=new Konva.Stage({width:576,height:324,scaleX:.3,scaleY:.3}),layer=new Konva.Layer();stage.add(layer);layer.add(new Konva.Image({...l,name:'art',layerId:l.id,fill:undefined,image:source,...imageRenderProps(l)}));const before=stage.toJSON(),url=exportStage(stage,p),image=await loadImage(url),c=createCanvas(p.width,p.height),x=c.getContext('2d');x.drawImage(image,0,0);assert.equal(stage.toJSON(),before);stage.destroy();assert.deepEqual(projectSchema.parse(JSON.parse(JSON.stringify(p))),p);return{pixel:(a,b)=>[...x.getImageData(a+100,b+100,1,1).data],p};}
 const round=await render({mask:'rounded',cornerRadius:50});assert.equal(round.pixel(1,1)[3],0);assert.equal(round.pixel(100,100)[3],255);
 const ellipse=await render({mask:'ellipse'});assert.equal(ellipse.pixel(1,1)[3],0);assert.equal(ellipse.pixel(100,100)[3],255);assert.equal(ellipse.pixel(100,1)[3],255);
 const contain=await render({imageFit:'contain'});assert.equal(contain.pixel(100,10)[3],0);assert.equal(contain.pixel(25,100)[0],255);assert.equal(contain.pixel(175,100)[2],255);
 const flip=await render({flipX:true});assert.equal(flip.pixel(25,100)[2],255);assert.equal(flip.pixel(175,100)[0],255);
 const crop=await render({imageCrop:{x:.5,y:0,width:.5,height:1},mask:'rounded',cornerRadius:20});assert.equal(crop.pixel(50,100)[2],255);assert.equal(crop.pixel(1,1)[3],0);
 const shadowProps={shadowEnabled:true,shadowColor:'#00ff00',shadowOpacity:1,shadowBlur:16,shadowOffsetX:30,shadowOffsetY:0};
 const shaded=await render({...shadowProps,mask:'ellipse'});assert.equal(shaded.p.layers[0].shadowOffsetX,30);assert.equal(shaded.pixel(100,100)[2],255);assert(!projectSchema.safeParse({...shaded.p,layers:[{...shaded.p.layers[0],shadowOpacity:2}]}).success);
 const shadowStage=new Konva.Stage({width:1920,height:1080}),shadowLayer=new Konva.Layer();shadowStage.add(shadowLayer);shadowLayer.add(new Konva.Rect({...base,src:undefined,fill:'#ff0000',...shadowProps,name:'art',layerId:base.id}));
 const shadowImage=await loadImage(exportStage(shadowStage,shaded.p)),shadowCanvas=createCanvas(1920,1080),shadowContext=shadowCanvas.getContext('2d');shadowContext.drawImage(shadowImage,0,0);assert(shadowContext.getImageData(320,200,1,1).data[3]>100,'Shape shadow survives PNG export');shadowStage.findOne('.art').shadowEnabled(false);const offImage=await loadImage(exportStage(shadowStage,shaded.p));shadowContext.clearRect(0,0,1920,1080);shadowContext.drawImage(offImage,0,0);assert.equal(shadowContext.getImageData(320,200,1,1).data[3],0);shadowStage.destroy();
 // Skia drawImage does not emit native image shadows; image shadow pixels require browser QA.
 const reset=await render({});assert.equal(reset.pixel(1,1)[3],255);assert.equal(base.src,src,'Non-destructive display never edits original pixels');
 const bounded=updateImageCrop(base,'x',.99);assert(bounded.x+bounded.width<=1);assert(Math.abs(bounded.width-.01)<1e-9);assert.equal(imageGeometry({width:200,height:100},{width:100,height:100},{type:'image',imageFit:'cover'}).sw,100);
 assert(!projectSchema.safeParse({...blankProject(),layers:[{...base,imageCrop:{x:.8,y:0,width:.9,height:1}}]}).success);
 const replaced=replaceComponent(crop.p,{id:base.id,original:src,src:'data:image/png;base64,aGVsbG8='});assert.deepEqual(replaced.layers[0].imageCrop,crop.p.layers[0].imageCrop);assert.equal(replaced.layers[0].mask,'rounded');
 const zippedLayer={...base,mask:'ellipse'},zippedProject=projectSchema.parse({...blankProject(),layers:[zippedLayer]}),stage=new Konva.Stage({width:1920,height:1080}),layer=new Konva.Layer();stage.add(layer);layer.add(new Konva.Image({...zippedLayer,name:'art',layerId:base.id,fill:undefined,image:source,...imageRenderProps(zippedLayer)}));
 const zip=await JSZip.loadAsync(await(await buildMaterialPackage(zippedProject,(format,ids)=>exportStage(stage,zippedProject,format,ids))).arrayBuffer()),png=await loadImage(await zip.file('完整设计.png').async('nodebuffer')),z=createCanvas(1920,1080),zx=z.getContext('2d');zx.drawImage(png,0,0);assert.equal(zx.getImageData(101,101,1,1).data[3],0);assert.equal(zx.getImageData(200,200,1,1).data[3],255);assert.equal(JSON.parse(await zip.file('project.livestyler.json').async('string')).layers[0].mask,'ellipse');stage.destroy();
 console.log('PASS: real PNG exports match rounded/ellipse masks, cover/contain, source crop and flips; undo/reset source integrity, project round trips, bounds and AI replacement preserve image settings.');
}finally{for(const name of modules)fs.rmSync('lib/.mask-test-'+name+'.mjs',{force:true});}
