import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import React from 'react';
import Konva from 'konva';
import { KonvaRenderer } from 'react-konva';
import { createCanvas, Image, loadImage } from '@napi-rs/canvas';
Konva.Util.createCanvasElement = () => { const c = createCanvas(300, 300); c.style = {}; return c; };
globalThis.Image = Image;
const generated = [];
function moduleFile(path, source) {
  fs.writeFileSync(path, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText);
  generated.push(path);
}
try {
  moduleFile('lib/.canvas-area-test.mjs', fs.readFileSync('lib/protected-area.ts','utf8'));
  moduleFile('lib/.canvas-scene-test.mjs', fs.readFileSync('lib/scene-assets.ts', 'utf8').replaceAll('"/scenes/', '"' + process.cwd() + '/public/scenes/'));
  moduleFile('lib/.canvas-design-test.mjs', fs.readFileSync('lib/design.ts', 'utf8'));
  moduleFile('lib/.canvas-image-render-test.mjs',fs.readFileSync('lib/image-render.ts','utf8'));
  const source = fs.readFileSync('components/Canvas.tsx', 'utf8');
  const ast = ts.createSourceFile('Canvas.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let layer;
  function visit(n) { if (ts.isJsxElement(n) && n.openingElement.tagName.getText(ast) === 'KL') layer = n; ts.forEachChild(n, visit); }
  visit(ast);
  assert.ok(layer, 'Test must render the actual editor layer tree');
  const preamble = source.slice(0, source.indexOf('export type CanvasHandle'))
    .replace('../lib/scene-assets', '../lib/.canvas-scene-test.mjs')
    .replace('../lib/design', '../lib/.canvas-design-test.mjs').replace('../lib/protected-area','../lib/.canvas-area-test.mjs').replace('../lib/image-render','../lib/.canvas-image-render-test.mjs');
  moduleFile('components/.canvas-react-test.mjs', preamble + `
export function Scene({project,video}) {
  const editingFootage=false,onFootageChange=undefined; const preview = true, guides = true, previewKind = '主播', previewSrc = undefined, liveVideo=video;
  const selected = '', alignmentIds = [], select = () => {}, change = () => {}, onEditText = () => {};
  const tr = useRef(null), safe = safeArea(project);
  const drawingArea=false,areaDraft=undefined,areaStart=useRef(undefined),areaNode=useRef(null),areaTransformer=useRef(null),scale=1;
  const setAreaDraft=()=>{},onAreaChange=()=>{};
  return (${layer.getText(ast)});
}`);
  moduleFile('lib/.canvas-capture-test.mjs', fs.readFileSync('lib/canvas-export.ts','utf8'));
  const {capturePreviewStage,exportStage} = await import('../lib/.canvas-capture-test.mjs');
  const { Scene,fitView,zoomView,captureLiveFrame } = await import('../components/.canvas-react-test.mjs');
  const { template } = await import('../lib/.canvas-design-test.mjs');
  const oldDocument=globalThis.document;
  globalThis.document={createElement:()=>createCanvas(1,1)};
  try {
    const video=createCanvas(160,90);video.readyState=2;video.videoWidth=160;video.videoHeight=90;video.srcObject={getVideoTracks:()=>[{readyState:'live',muted:false}]};
    video.getContext('2d').fillStyle='#ff0000';video.getContext('2d').fillRect(0,0,160,90);
    const firstFrame=captureLiveFrame(video,{width:108,height:192});const frame=await loadImage(firstFrame);const sampled=createCanvas(108,192);sampled.getContext('2d').drawImage(frame,0,0);
    assert(sampled.getContext('2d').getImageData(54,96,1,1).data[0]>240,'AI snapshot contains actual video frame');
    assert(sampled.getContext('2d').getImageData(54,5,1,1).data[0]<40,'Wide shared window keeps full frame with letterbox');
    video.getContext('2d').fillStyle='#0000ff';video.getContext('2d').fillRect(0,0,160,90);
    assert.notEqual(captureLiveFrame(video,{width:108,height:192}),firstFrame,'Snapshot reads current frame');
    video.readyState=0;assert.throws(()=>captureLiveFrame(video,{width:108,height:192}),/尚未就绪/);
  }finally{globalThis.document=oldDocument;}
  for(const size of [{width:324,height:400},{width:900,height:540},{width:160,height:110}])for(const project of [{width:1080,height:1920},{width:1920,height:1080}]){
    const v=fitView(project,size);assert(v.x>=0&&v.y>=0);assert(project.width*v.scale<=size.width&&project.height*v.scale<=size.height,'Fit must show complete portrait/landscape frame within viewport');
    const pointer={x:77,y:55},world={x:(pointer.x-v.x)/v.scale,y:(pointer.y-v.y)/v.scale};
    const z=zoomView(v,v.scale*2,pointer);assert(Math.abs((pointer.x-z.x)/z.scale-world.x)<.0001);assert(Math.abs((pointer.y-z.y)/z.scale-world.y)<.0001,'Zoom keeps the point beneath pointer fixed');
    assert.equal(zoomView(v,99,pointer).scale,4);assert.equal(zoomView(v,.00001,pointer).scale,.01);
  }
  for (const ratio of ['landscape', 'portrait']) {
    const stage = new Konva.Stage({ width: ratio === 'landscape' ? 1920 : 1080, height: ratio === 'landscape' ? 1080 : 1920 });
    const errors = [];
    const root = KonvaRenderer.createContainer(stage, 1, null, false, null, '', e => errors.push(e), e => errors.push(e), e => errors.push(e), null);
    function render(project,video) { KonvaRenderer.updateContainerSync(React.createElement(Scene, {project,video}), root, null, null); KonvaRenderer.flushSyncWork(); }
    const p = template(0, ratio);
    render(p);
    await new Promise(r => setTimeout(r, 100));
    KonvaRenderer.flushSyncWork();
    assert.deepEqual(errors, [], 'React canvas must mount without reconciler errors');
    assert.equal(stage.find('.art').length, p.layers.length);

    assert.ok(stage.find('Image').every(n => n.image()), 'Template and preview images must decode');
    assert.equal(stage.findOne('.footage-layer').draggable(),false,'Default footage cannot be dragged');
    render({...p,footageLocked:false,footageIndex:p.layers.length});
    assert.equal(stage.findOne('.footage-layer').draggable(),true,'Unlocked footage can be dragged');
    const sourceGroup=stage.findOne('.footage-layer').getParent();
    const children=sourceGroup.getParent().getChildren();
    assert(children.indexOf(sourceGroup)>children.indexOf(stage.find('.art').at(-1)),'Footage stacking order is reflected in the real canvas');
    render(p);

    const uploaded = createCanvas(40,40); uploaded.getContext('2d').fillRect(0,0,40,40);
    const next = {...p, layers: [...p.layers, {id:'uploaded',name:'upload.png',type:'image',x:200,y:200,width:40,height:40,src:uploaded.toDataURL('image/png'),fill:'#fff',visible:true,locked:false,opacity:1,rotation:0}]};
    render(next);
    await new Promise(r => setTimeout(r, 100));
    KonvaRenderer.flushSyncWork();
    assert.deepEqual(errors, []);
    const node = stage.find('.art').find(n => n.getAttr('layerId') === 'uploaded');
    assert.ok(node?.image(), 'Inserted upload must reach the live React canvas');
    const selection=stage.find('Transformer').at(-1);
    assert.equal(selection.getParent().getClassName(),'Layer','Selection handles must live outside the clipped live frame');
    assert.equal(node.getParent().clipWidth(),p.width,'Artwork remains clipped to the actual live frame');
    selection.nodes([node]);node.x(-20);stage.draw();
    assert(selection.getClientRect({skipTransform:true}).width>0,'Selected off-frame artwork still has an adjustment outline');
    selection.nodes([]);node.x(200);

    node.fire('dragstart',{evt:{shiftKey:true}});
    node.position({x:p.width/2-17,y:220});node.fire('dragmove',{evt:{shiftKey:true}});
    assert.equal(node.y(),200,'Shift drag keeps the original Y coordinate');
    assert.equal(node.x(),p.width/2-20,'Shift drag snaps the moving center to canvas center');
    node.position({x:220,y:260});node.fire('dragmove',{evt:{shiftKey:false}});
    assert.equal(node.x(),220);assert.equal(node.y(),260,'Releasing Shift restores free dragging');
    node.fire('dragend',{evt:{shiftKey:false}});node.position({x:200,y:200});
    stage.draw();
    assert.ok(stage.toDataURL().length > 1000);
    const snapshot = capturePreviewStage(stage,p);
    const snapshotImage = await loadImage(snapshot);
    assert.equal(snapshotImage.width,p.width);assert.equal(snapshotImage.height,p.height);
    const cover=new Konva.Rect({x:0,y:0,width:p.width,height:p.height,fill:'#ff00ff'});stage.getLayers()[0].add(cover);
    stage.scale({x:0.25,y:0.25});
    assert.equal(capturePreviewStage(stage,p),snapshot,'Capture excludes all overlay nodes and editing zoom');
    cover.destroy();
    const sheet=createCanvas(p.width,p.height);sheet.getContext('2d').fillRect(0,0,p.width,p.height);
    const masked={...p,protectedArea:{x:100,y:200,width:300,height:400},layers:[p.layers[0],{id:'ai-overlay-art',name:'AI',type:'image',x:0,y:0,width:p.width,height:p.height,src:sheet.toDataURL('image/png'),fill:'transparent',visible:true,locked:false,opacity:1,rotation:0}]};
    render(masked);await new Promise(r=>setTimeout(r,100));KonvaRenderer.flushSyncWork();
    const beforePan=exportStage(stage,masked);
    stage.position({x:-523,y:127});stage.scale({x:1.7,y:1.7});stage.size({width:600,height:400});
    assert.equal(exportStage(stage,masked),beforePan,'Viewport zoom, size and pan must not change exported pixels');
    assert.equal(capturePreviewStage(stage,masked),snapshot,'Viewport pan must not affect the footage snapshot');
    const live=createCanvas(160,90);live.videoWidth=160;live.videoHeight=90;const events=new EventTarget();live.addEventListener=events.addEventListener.bind(events);live.removeEventListener=events.removeEventListener.bind(events);
    render(masked,live);await new Promise(r=>setTimeout(r,30));KonvaRenderer.flushSyncWork();
    assert.equal(stage.findOne('.preview-footage').image(),live,'Live source is mounted beneath artwork');
    assert.equal(exportStage(stage,masked),beforePan,'Live footage must never appear in exported artwork');
    assert.equal(stage.x(),-523);assert.equal(stage.scaleX(),1.7,'Export must leave interactive viewport intact');
    const exported=await loadImage(exportStage(stage,masked));const pixels=createCanvas(p.width,p.height);pixels.getContext('2d').drawImage(exported,0,0);
    assert.equal(pixels.getContext('2d').getImageData(150,250,1,1).data[3],255,'Warning region must not erase artwork in actual PNG export');
    assert.equal(pixels.getContext('2d').getImageData(20,20,1,1).data[3],255,'Artwork outside protected region must remain visible');
    assert.deepEqual(errors,[]);
    KonvaRenderer.updateContainerSync(null,root,null,null);KonvaRenderer.flushSyncWork();stage.destroy();
  }
  console.log('PASS: actual React-Konva editor tree mounts in both ratios, decodes template/preview images, inserts uploaded PNG; automatic preview capture keeps full dimensions and excludes decoration and editing zoom; warning area does not erase artwork in PNG exports.');
} finally { for (const path of generated) fs.rmSync(path, {force:true}); }
