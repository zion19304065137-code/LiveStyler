import fs from "node:fs";
import ts from "typescript";
import assert from "node:assert/strict";
import { indexedDB } from "fake-indexeddb";
const modules = [
  "design",
  "layer-size",
  "packaging-plan",
  "conversation",
  "editor-actions",
  "commands",
  "ai-contract",
  "server",
  "ai-provider",
  "generated-design",
  "http-client",
  "storage",
  "work-bundle",
  "cloud-services",
  "brand",
  "component-revision",
  "footage-layer",
];
for (const name of modules) {
  let s = ts.transpileModule(fs.readFileSync("lib/" + name + ".ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  s = s.replace(/from ['"]\.\/([^'"]+)['"]/g, (all, n) =>
    modules.includes(n) ? `from './.product-test-${n}.mjs'` : all,
  );
  fs.writeFileSync("lib/.product-test-" + name + ".mjs", s);
}
const oldFetch = globalThis.fetch;
try {
  const { template, blankProject, projectSchema, resizeProject } = await import("../lib/.product-test-design.mjs");
  const {layerSize}=await import('../lib/.product-test-layer-size.mjs');
  {const {arrangeLayers}=await import('../lib/.product-test-editor-actions.mjs');
  const base=blankProject(0,'landscape','overlay');const sample=(id,x,y,width=100)=>({id,name:id,type:'shape',x,y,width,height:50,fill:'#fff',visible:true,locked:false,opacity:1,rotation:0});
  const arrangement={...base,layers:[sample('a',10,20),sample('b',210,100,50),sample('c',510,200),{...sample('locked',80,80),locked:true}]};
  const aligned=arrangeLayers(arrangement,['a','b','c','locked'],'left');assert.deepEqual(aligned.layers.map(l=>l.x),[10,10,10,80]);
  assert.deepEqual(arrangeLayers(arrangement,['a','b','c'],'distribute-x').layers.map(l=>l.x),[10,285,510,80]);
  assert.equal(arrangeLayers(arrangement,['b'],'right','canvas').layers[1].x,base.width-50);
  assert.throws(()=>arrangeLayers(arrangement,['a','b'],'distribute-x'),/至少三个/);
  const rotated={...arrangement,layers:[{...sample('r',100,100),rotation:90}]};assert(Math.abs(arrangeLayers(rotated,['r'],'left','canvas').layers[0].x-50)<1e-8);
  console.log('PASS: multi-layer alignment, canvas targets, equal edge gaps, locked-layer preservation and rotated visual bounds.');}
  const sized={id:'size',name:'Logo',type:'image',x:0,y:0,width:400,height:200,fill:'#fff',visible:true,locked:false,opacity:1,rotation:0,aspectLocked:true};
  assert.deepEqual(layerSize(sized,'width',800),{width:800,height:400});
  assert.deepEqual(layerSize(sized,'height',100),{width:200,height:100});
  const capped=layerSize(sized,'height',9999);assert.equal(capped.width/capped.height,2);assert(capped.width<=3840&&capped.height<=2160);
  assert.deepEqual(layerSize({...sized,aspectLocked:false},'width',800),{width:800});assert.deepEqual(layerSize(sized,'width',NaN),{});
  assert.equal(projectSchema.parse({...blankProject(),layers:[sized]}).layers[0].aspectLocked,true);
  for (const ratio of ['landscape','portrait']) {
    const blank = blankProject(0,ratio);
    assert.equal(blank.layers.length,0);
    assert.deepEqual(projectSchema.parse(JSON.parse(JSON.stringify(blank))),blank);
  }

  const {layerStack,reorderLayer}=await import('../lib/.product-test-footage-layer.mjs');
  const stacked=blankProject(),a={id:'a',name:'A',type:'shape',x:0,y:0,width:100,height:100,rotation:0,opacity:1,visible:true,locked:false,fill:'#fff'},stackProject={...stacked,layers:[a,{...a,id:'b'}]};
  assert.equal(layerStack(stackProject)[0],null,'Original footage defaults to bottom');
  assert.equal(reorderLayer(stackProject,'__footage',1),stackProject,'Original footage defaults to locked');
  const raised=reorderLayer({...stackProject,footageLocked:false},'__footage',1);
  assert.deepEqual(layerStack(raised).map(l=>l?.id||'footage'),['a','footage','b']);
  const above=reorderLayer(raised,'__footage',1);
  assert.deepEqual(layerStack(above).map(l=>l?.id||'footage'),['a','b','footage']);
  const below=reorderLayer(above,'b',1);
  assert.deepEqual(layerStack(below).map(l=>l?.id||'footage'),['a','footage','b']);
  assert.deepEqual(projectSchema.parse(JSON.parse(JSON.stringify(above))),above,'Footage lock and stacking order survive project serialization');
  const { executeCommand } = await import("../lib/.product-test-commands.mjs");
  const {
    toggleComponent,
    groupIds,
    inspection,
    addComponent,
    moveLayers,
    groupsForProject,
    reflowOverlay,
    alignElements,
    duplicateComponent,
  } = await import("../lib/.product-test-editor-actions.mjs");
  const uploadProject={...blankProject(),layers:[{...sized,id:'uploaded-logo',src:'data:image/png;base64,AAAA'}]};
  const uploadGroups=groupsForProject(uploadProject);assert.equal(Object.keys(uploadGroups).length,1);assert.deepEqual(Object.values(uploadGroups)[0],['uploaded-logo']);
  console.log('PASS: ratio-locked sizing in both axes, schema bounds, persistence, unlocked sizing and automatic uploaded-image component registration.');

  const { applyAiResult } = await import(
    "../lib/.product-test-ai-contract.mjs"
  );
  const p = template();
  const original = JSON.stringify(p);
  let q = executeCommand(p, "标题改成蓝色星球");
  assert.equal(q.layers.find((l) => l.id === "活动标题").text, "蓝色星球");
  assert.equal(
    q.layers.find((l) => l.id === "活动标题").fill,
    p.layers.find((l) => l.id === "活动标题").fill,
    "literal title must not recolor text",
  );
  q = executeCommand(p, "隐藏姓名条；标题字号48");
  assert(
    groupIds(p, "姓名条").every(
      (id) => !q.layers.find((l) => l.id === id).visible,
    ),
  );
  assert.equal(q.layers.find((l) => l.id === "活动标题").fontSize, 48);
  assert.throws(() => executeCommand(p, "隐藏姓名条；做一个不存在的魔法"));
  assert.equal(
    JSON.stringify(p),
    original,
    "failed batch cannot mutate original",
  );
  q = executeCommand(p, "姓名条移到右下角");
  const ids = groupIds(p, "姓名条");
  const dx =
    q.layers.find((l) => l.id === "姓名条").x -
    p.layers.find((l) => l.id === "姓名条").x;
  for (const id of ids)
    assert.equal(
      q.layers.find((l) => l.id === id).x - p.layers.find((l) => l.id === id).x,
      dx,
      "group must move together",
    );
  q = executeCommand(p, "生成一套竖屏女装直播包装");
  assert.equal(q.width, 1080);
  assert.equal(q.scene, 3);
  assert.equal(q.mode, "overlay");
  assert.equal(inspection(q).filter((x) => x.includes("保留区")).length, 0);
  q = executeCommand(p, "主题色改成金色");
  q = executeCommand(q, "主题色改成紫色");
  assert.equal(q.layers.find((l) => l.id === "顶部强调线").fill, "#7c58bb");
  assert.throws(() => executeCommand(p, "选中图层向左移动10", "背景"), /锁定/);
  assert.throws(() => executeCommand(p, "把Logo放到右上角"), /上传/);
  q = toggleComponent(p, "直播角标", false);
  assert.equal(q.layers.find((l) => l.id === "直播角标").visible, false);
  for (const kind of ["name", "badge", "notice", "product"]) {
    q = addComponent(template(0, "portrait"), kind);
    assert(q.layers.length > p.layers.length);
    assert(
      Object.keys(groupsForProject(q)).length >
        Object.keys(groupsForProject(p)).length,
    );
    assert.equal(new Set(q.layers.map((l) => l.id)).size, q.layers.length);
  }
  q = {
    ...p,
    layers: p.layers.map((l) =>
      l.id === "活动标题" ? { ...l, x: 900, y: 400 } : l,
    ),
  };
  assert(!inspection(q).some((x) => x.includes("保留区")),"Manual protection is disabled by default");
  assert(inspection({...q,protectedAreaEnabled:true}).some((x) => x.includes("保留区")));
  assert(
    inspection({
      ...p,
      layers: p.layers.map((l) =>
        l.type === "background" ? { ...l, opacity: 1 } : l,
      ),
    }).some((x) => x.includes("不透明")),
  );
  const layer = {
    id: "new",
    name: "新标签",
    type: "text",
    x: 50,
    y: 1000,
    width: 400,
    height: 40,
    fill: "#fff",
    text: "欢迎",
    fontSize: 24,
    opacity: 1,
    visible: true,
    locked: false,
    rotation: 0,
  };
  q = applyAiResult(p, { additions: [layer] });
  assert(q.layers.some((l) => l.id === "new"));
  q = applyAiResult(q, { removals: ["new"] });
  assert.equal(q.layers.length, p.layers.length);
  assert.throws(
    () =>
      applyAiResult(p, {
        operations: [
          {
            id: "活动标题",
            changes: { text: p.layers.find((l) => l.id === "活动标题").text },
          },
        ],
      }),
    /实际修改/,
  );
  assert.throws(() => applyAiResult(p, { removals: ["背景"] }));
  assert.throws(() =>
    applyAiResult(p, { additions: [{ ...layer, src: "https://evil.test" }] }),
  );
  assert.throws(
    () =>
      applyAiResult(p, {
        operations: [{ id: "活动标题", changes: { x: 1900 } }],
      }),
    /超出/,
  );
  console.log(
    "PASS: atomic multi-command edits, literal titles, grouped movement/visibility, local scene creation, repeat brand colors, locks, component insertion, layout warnings, safe AI add/remove/no-op rejection.",
  );
  const custom = addComponent(p, "product");
  const flipped = reflowOverlay(custom, "portrait");
  assert.equal(flipped.width, 1080);
  assert.notEqual(
    flipped.layers.find((l) => l.id === "姓名条底板").src,
    p.layers.find((l) => l.id === "姓名条底板").src,
    "ratio switching must use a separate generated asset",
  );
  assert.equal(flipped.layers.length, custom.layers.length);
  assert(flipped.layers.some((l) => l.groupName === "商品信息卡"));
  assert.equal(reflowOverlay(p, "landscape"), p);
  console.log(
    "PASS: custom component preservation on ratio changes; active ratio does not reset editing.",
  );
  const aligned = alignElements(p, groupIds(p, "姓名条"), "right");
  assert.equal(
    aligned.layers.find((l) => l.id === "姓名条底板").x,
    1920 - p.layers.find((l) => l.id === "姓名条底板").width - 40,
  );
  const duplicated = duplicateComponent(p, "姓名条");
  assert.equal(duplicated.layers.length, p.layers.length + 3);
  assert(
    Object.keys(groupsForProject(duplicated)).some((k) => k.includes("副本")),
  );
  const customHidden = executeCommand(
    custom,
    "隐藏选中组件",
    custom.layers[custom.layers.length - 1].id,
  );
  assert(customHidden.layers.filter((l) => l.groupId).every((l) => !l.visible));
  console.log(
    "PASS: whole-component alignment, independent group duplication, selected custom-component commands.",
  );
  const {applyGeneratedDesign,applyGeneratedObjects,applyWarmupDesign} = await import("../lib/.product-test-generated-design.mjs");
  const warmupSrc='data:image/png;base64,aGVsbG8=';
  const missingWarmup=applyWarmupDesign({...blankProject(),mode:'warmup',layers:[]},warmupSrc);assert.equal(missingWarmup.layers[0].src,warmupSrc);assert(missingWarmup.layers[0].visible);
  const hiddenWarmup=applyWarmupDesign({...missingWarmup,layers:missingWarmup.layers.map(l=>({...l,visible:false}))},warmupSrc);assert(hiddenWarmup.layers[0].visible,'Generated warmup must remain visible even if the previous background was hidden');
  const withOldImage = {...p,layers:[...p.layers,
    {...p.layers[0],id:'old-photo',name:'旧图片',type:'image',locked:false,visible:true},
    {...p.layers[0],id:'brand-logo',name:'品牌 Logo',type:'image',locked:false,visible:true}]};
  const replacedImages = applyGeneratedDesign(withOldImage,'data:image/png;base64,aGVsbG8=');
  assert.equal(replacedImages.layers.find(l=>l.id==='old-photo').visible,false);
  assert.equal(replacedImages.layers.find(l=>l.id==='brand-logo').visible,true);
  const integrated = applyGeneratedDesign(p,"data:image/png;base64,aGVsbG8=");
  assert.equal(integrated.layers.filter(l=>l.id === "ai-overlay-art").length,1);
  assert(integrated.layers.filter(l=>l.type === "text" && !l.locked).every(l=>!l.visible && l.groupId === "ai-source-text"));
  assert(integrated.layers.filter(l=>l.type === "shape" && !l.locked).every(l=>!l.visible));
  assert(p.layers.some(l=>l.type === "text" && l.visible),"Original project remains unchanged for undo");
  const objects=[{x:0,y:0,width:.3,height:.1,src:'data:image/png;base64,aGVsbG8='},{x:.6,y:.8,width:.3,height:.1,src:'data:image/png;base64,d29ybGQ='}];
  const separated=applyGeneratedObjects(p,'data:image/png;base64,aGVsbG8=',objects);
  assert.equal(separated.layers.filter(l=>l.id.startsWith('ai-overlay-art')).length,2);
  assert.equal(separated.layers.find(l=>l.id==='ai-overlay-art-2').x,.6*p.width);
  assert.equal(applyGeneratedObjects(separated,'data:image/png;base64,aGVsbG8=',objects).layers.length,separated.layers.length);
  const repeated = applyGeneratedDesign(integrated,"data:image/png;base64,d29ybGQ=");
  assert.equal(repeated.layers.length,integrated.layers.length);
  assert.equal(repeated.layers.filter(l=>l.id === "ai-overlay-art").length,1);
  console.log("PASS: integrated generated art is visible above old decoration, source copy preserved hidden, repeated generation replaces the previous art without duplicate lettering.");
  const { textContext, planDesign, generateHoldingBackground, createDesignBrief,briefRuntime,languageRuntime,languageOptions } = await import(
    "../lib/.product-test-ai-provider.mjs"
  );
  const context = textContext({
    ...p,
    layers: [
      ...p.layers,
      {
        ...layer,
        type: "image",
        src: "data:image/png;base64," + "A".repeat(2000000),
      },
    ],
  });
  assert(!JSON.stringify(context).includes("base64"));
  assert(JSON.stringify(context).length < 15000);
  const env = {
    TEXT_AI_BASE_URL: "https://provider.example/v1",
    TEXT_AI_API_KEY: "test-only",
    TEXT_AI_MODEL: "test-model",
    IMAGE_AI_BASE_URL: "https://provider.example/v1",
    IMAGE_AI_API_KEY: "test-only",
    IMAGE_AI_MODEL: "test-image",
  };
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    assert(url.endsWith("/chat/completions"));
    assert(!init.body.includes("base64"));
    return Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({
              operations: [
                { id: "活动标题", changes: { text: "真实上游契约测试" } },
              ],
            }),
          },
        },
      ],
    });
  };
  const planned = await planDesign(env, "修改标题", p);
  assert.equal(planned.operations[0].changes.text, "真实上游契约测试");
  globalThis.fetch = async () =>
    Response.json({ choices: [{ message: { content: "not json" } }] });
  await assert.rejects(planDesign(env, "修改标题", p), /格式/);
  globalThis.fetch = async () => new Response("busy", { status: 429 });
  await assert.rejects(planDesign(env, "修改标题", p), /限流/);
  globalThis.fetch = async (url, init) => {
    assert.equal(JSON.parse(init.body).size, "1024x1536");
    return Response.json({ data: [{ b64_json: "aGVsbG8=" }] });
  };
  assert(
    (await generateHoldingBackground(env, "背景", true)).startsWith(
      "data:image/png;base64,",
    ),
  );
  let referenceCalls=0;
  globalThis.fetch = async (url, init) => {
    referenceCalls++;const body=init.body instanceof FormData?Object.fromEntries(init.body):JSON.parse(init.body);
    if(url.endsWith("/chat/completions")) {
      assert.equal(body.messages[1].content[1].image_url.url, "data:image/jpeg;base64,aGVsbG8=");
      return Response.json({choices:[{message:{content:"Warm cream boutique; face in central upper region; keep central frame clear."}}]});
    }
    assert(url.endsWith("/images/edits"));
    assert.equal(Buffer.from(await body.image.arrayBuffer()).toString(),"hello");
    assert.equal(body.background,"transparent");
    assert.match(body.prompt,/Render the actual text as an integral/);
    assert(!body.prompt.includes("Do not render any text"));
    assert.match(body.prompt,/Warm cream boutique/);
    assert(init.body instanceof FormData,"Reference pixels reach the image editing endpoint");
    return Response.json({ data: [{ b64_json:"aGVsbG8=" }] });
  };
  await generateHoldingBackground(env, "参考实况", false, p, "data:image/jpeg;base64,aGVsbG8=");
  assert.equal(referenceCalls,2);
  await assert.rejects(generateHoldingBackground(env, "参考实况", false, p, "https://example.com/picture.jpg"), /格式/);
  console.log("PASS: actual frame sent to vision model; visual observations condition transparent image generation; remote URLs rejected.");
  const retryEnv={...env,TEXT_AI_FALLBACK_MODEL:'tested-backup-model'};
  assert.equal(briefRuntime(retryEnv),retryEnv,'Ordinary requests keep the configured primary model');
  assert.equal(briefRuntime(retryEnv,true).TEXT_AI_MODEL,'tested-backup-model');
  assert.equal(retryEnv.TEXT_AI_MODEL,env.TEXT_AI_MODEL,'A manual retry does not mutate runtime configuration');
  const moduleFixture={scene:{type:'电商直播',subjects:'中央主体',environment:'米白门店',colors:'咖啡棕',style:'简洁',ratio:'16:9',safeAreas:'四角',existingElements:'无'},theme:'确认后保留乐茜儿',style:'简洁',colors:'米白咖啡棕',typography:'黑体',decoration:'细线',modules:[{id:'brand',name:'品牌',purpose:'品牌识别',position:'左上',style:'平面',color:'#235FF5',text:'乐茜儿',size:'小',recommended:true,selected:true},{id:'price',name:'价格',purpose:'价格说明',position:'下方',style:'平面',color:'#235FF5',text:'UNSELECTED_PRICE',size:'小',recommended:false,selected:false}],questions:[]};
  const {compilePackagingPlan,readPackagingPlan}=await import('../lib/.product-test-packaging-plan.mjs');
  assert(!compilePackagingPlan(moduleFixture,1920,1080).includes('PPT'));
  const pptPlan=readPackagingPlan(JSON.stringify({...moduleFixture,reservePpt:true}));assert.equal(pptPlan.reservePpt,true);
  assert(compilePackagingPlan(pptPlan,1080,1920).includes('16:9 横向课件窗口'));assert(compilePackagingPlan(pptPlan,1080,1920).includes('真正透明'));
  let briefCalls=0;const briefStages=[];
  globalThis.fetch=async(url,init)=>{
    briefCalls++;assert(url.endsWith("/chat/completions"),"Preparing a plan must never call image generation");
    const body=JSON.parse(init.body);assert.equal(body.messages[1].content[1].image_url.url,"data:image/jpeg;base64,aGVsbG8=");
    return Response.json({choices:[{message:{content:JSON.stringify(moduleFixture)}}]});
  };
  const draft=await createDesignBrief(env,"女装直播",p,"data:image/jpeg;base64,aGVsbG8=",stage=>briefStages.push(stage));
  assert.equal(briefCalls,1);assert.match(draft,/确认后/);assert.equal(briefStages.length,2);
  globalThis.fetch=async(url,init)=>{
    assert(url.endsWith("/images/edits"),"Approved brief uses original frame directly");
    const prompt=init.body.get("prompt");assert(init.body.get("image") instanceof Blob);
    assert.match(prompt,/用户已确认的设计方案/);assert(!prompt.includes('UNSELECTED_PRICE'),'Unchecked module text must never reach image provider');assert(!prompt.includes('at most two accent colors'));assert(!prompt.includes('No metallic bevels'));assert(prompt.includes('Scene evidence:'));assert(prompt.includes('横屏直播包装设计'));
    return Response.json({data:[{b64_json:"aGVsbG8="}]});
  };
  await generateHoldingBackground(env,"按方案生图",false,p,"data:image/jpeg;base64,aGVsbG8=",draft);

  let componentCalls=0;
  globalThis.fetch=async(url,init)=>{
    componentCalls++;assert(url.endsWith('/images/edits'),'Component revision must edit the selected PNG, without another vision or full design call');
    assert.equal(Buffer.from(await init.body.get('image').arrayBuffer()).toString(),'hello');
    assert.equal(init.body.get('background'),'transparent');
    const prompt=init.body.get('prompt');assert(prompt.includes('价格改成299'));assert(prompt.includes('exactly ONE'));assert(!prompt.includes('Arial'));
    return Response.json({data:[{b64_json:'aGVsbG8='}]});
  };
  await generateHoldingBackground({...env,TEXT_AI_API_KEY:undefined,IMAGE_AI_REFERENCE_MODE:'text'},'价格改成299',false,undefined,'data:image/png;base64,aGVsbG8=',undefined,undefined,true);
  assert.equal(componentCalls,1);
  const {replaceComponent}=await import('../lib/.product-test-component-revision.mjs');
  const componentOriginalLayer={id:'component-test',name:'价格卡',type:'image',src:'original-component',x:-10,y:50,width:300,height:80,rotation:8,opacity:.7,visible:true,locked:false,fill:'transparent'};
  const revisionProject={...p,layers:[...p.layers,componentOriginalLayer]},revisionCandidate={id:componentOriginalLayer.id,original:'original-component',src:'new'};
  const revisionProjectAfter=replaceComponent(revisionProject,revisionCandidate);
  assert.equal(revisionProject.layers.at(-1).src,'original-component','Generating or confirming cannot mutate the original undo snapshot');
  assert.deepEqual(revisionProjectAfter.layers.at(-1),{...componentOriginalLayer,src:'new'});
  assert.deepEqual(revisionProjectAfter.layers.slice(0,-1),p.layers,'Neighboring components stay unchanged');
  assert.throws(()=>replaceComponent(revisionProjectAfter,revisionCandidate),/已变化/);
  assert.throws(()=>replaceComponent({...revisionProject,layers:[{...componentOriginalLayer,locked:true}]},revisionCandidate),/已变化/);
  console.log('PASS: single-component image edit sends original pixels once; confirmed replacement preserves position, scale, rotation, ordering, neighboring layers and undo state; stale or locked originals are rejected.');
  const warmProject={...p,mode:'warmup',name:'年度品牌发布',warmupContext:'现有包装：宝蓝与香槟金，标题聚势同行'};
  globalThis.fetch=async(url,init)=>{const body=JSON.parse(init.body);assert(body.messages[0].content.includes('暖场'));assert(body.messages[0].content.includes('成品活动海报'));assert(body.messages[0].content.includes('不默认添加LIVE'));assert(body.messages[0].content.includes('空白卖点框'));assert(body.messages[0].content.includes('未知信息直接省略'));assert(body.messages.at(-1).content[0].text.includes('年度品牌发布'));assert(body.messages.at(-1).content[0].text.includes('现有包装'));return Response.json({choices:[{message:{content:'暖场画面设计：\n- 顶部展示品牌主题，蓝金光线贯穿完整舞台。'}}]});};
  const warmBrief=await createDesignBrief(env,'延续项目设计',warmProject,'data:image/jpeg;base64,aGVsbG8=');
  globalThis.fetch=async(url,init)=>{assert(url.endsWith('/images/edits'));assert.equal(init.body.get('background'),'opaque');const text=init.body.get('prompt');assert(text.includes('年度品牌发布'));assert(text.includes('现有包装'));assert(text.includes('standalone brand campaign poster'));assert(text.includes('No default LIVE badge'));assert(text.includes('Full-bleed opaque'));assert(text.includes('empty selling-point boxes'));assert(!text.includes('Output ONLY transparent overlay'));return Response.json({data:[{b64_json:'aGVsbG8='}]});};
  await generateHoldingBackground(env,'设计暖场',false,warmProject,'data:image/jpeg;base64,aGVsbG8=',warmBrief);
  console.log('PASS: warmup proposals and image edits inherit project theme, existing packaging and composite reference; output is a full opaque screen.');
  let repairCalls=0;globalThis.fetch=async()=>{repairCalls++;return Response.json({choices:[{message:{content:repairCalls===1?'以下是暂未整理的文字方案':JSON.stringify(moduleFixture)}}]});};
  const repairedPlan=await createDesignBrief(env,'设计直播包装',p);assert.equal(repairCalls,2);assert(repairedPlan.includes('乐茜儿'),'Invalid initial format is repaired once without an image call');
  const areaProject={...p,protectedArea:{x:100,y:200,width:500,height:400}};
  assert.deepEqual(projectSchema.parse(areaProject).protectedArea,areaProject.protectedArea);
  const resizedArea=resizeProject(areaProject,"portrait");
  assert.equal(resizedArea.protectedArea.x,100*1080/1920);
  assert.deepEqual(reflowOverlay(areaProject,"portrait").protectedArea,resizedArea.protectedArea);
  console.log("PASS: proposal step makes only a text/vision call, waits for explicit confirmation; approved plan reaches image service without duplicate analysis; protected area survives validation and ratio changes.");
  const { requestJson } = await import("../lib/.product-test-http-client.mjs");
  globalThis.fetch = async () =>
    new Response("<html>sign in</html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  await assert.rejects(requestJson("/api/ai", {}), /非JSON/);
  globalThis.fetch = async () =>
    Response.json({ error: "缺少密钥" }, { status: 503 });
  await assert.rejects(requestJson("/api/ai", {}), /缺少密钥/);
  console.log(
    "PASS: image-free text payload, mocked provider schema and response parsing, portrait generation size, malformed JSON, rate limiting, HTML response and service error feedback. No real provider was called.",
  );
  globalThis.indexedDB = indexedDB;
  const { saveWorkspace, loadActiveId, listWorks, deleteWork, load } =
    await import("../lib/.product-test-storage.mjs");
  await saveWorkspace(p, "a");
  await saveWorkspace(template(3, "portrait"), "b");
  assert.equal(await loadActiveId(), "b");
  assert.equal((await listWorks()).length, 2);
  assert.equal((await load()).width, 1080);
  await deleteWork("a");
  assert.equal((await listWorks()).length, 1);
  await saveWorkspace({ ...p, name: "updated" }, "b");
  assert.equal((await listWorks()).length, 1);
  assert.equal((await listWorks())[0].project.name, "updated");
  const {saveConversation,loadConversation} = await import("../lib/.product-test-storage.mjs");
  const {conversationContext,publicCopy} = await import("../lib/.product-test-conversation.mjs");
  const history=[{role:"user",text:"品牌是乐茜儿，保留咖啡棕"},{role:"assistant",kind:"plan",text:"乐茜儿，顶部品牌，底部新品信息。可补充门店名，也可直接生成。"},{role:"user",kind:"confirmation",text:"按此方案生成"},{role:"assistant",kind:"result",text:"设计已更新，可继续修改。"}];
  await saveConversation("a",history);await saveConversation("b",[{role:"user",text:"另一个作品"}]);
  assert.deepEqual(await loadConversation("a"),history);assert.equal((await loadConversation("b")).length,1);
  await saveConversation("a",[...await loadConversation("a"),{role:"user",text:"只把字体换成黑体"}]);
  const contextHistory=conversationContext(await loadConversation("a"));
  assert.equal(contextHistory[0].text,"品牌是乐茜儿，保留咖啡棕");assert.match(contextHistory.at(-1).text,/黑体/);
  assert(!publicCopy("方案已提交生图平台，正在等待生成图片").includes("平台"));
  globalThis.fetch=async(url,init)=>{
    const body=JSON.parse(init.body);assert(body.messages.some(m=>m.role === "user" && m.content === history[0].text));
    assert.match(body.messages[0].content,/可补充（选填）/);assert.match(body.messages[0].content,/直接生成/);
    return Response.json({choices:[{message:{content:JSON.stringify(moduleFixture)}}]});
  };
  const continued=await createDesignBrief(env,"字体改黑体",p,undefined,undefined,await loadConversation("a"));assert.match(continued,/保留乐茜儿/);
  console.log("PASS: project conversations survive reload, remain isolated, retain plan/result turns, and are passed to AI for contextual changes; missing details are optional.");
  console.log(
    "PASS: multi-work persistence, active-work restore, independent deletion, updating without duplication.",
  );
  const {pairedWork,pairWorks,groupWorks,restoreCloudWorkspace}=await import('../lib/.product-test-storage.mjs');
  const placed={...integrated,previewImage:warmupSrc,layers:integrated.layers.map(l=>l.id==='ai-overlay-art'?{...l,x:123,y:45,width:800,height:450}:l)};
  const transcript=[{role:'user',text:'保留图片排版'}];
  await saveWorkspace(placed,'paired-overlay',transcript);await saveWorkspace(missingWarmup,'paired-warmup');await pairWorks({id:'paired-overlay',mode:'overlay'},{id:'paired-warmup',mode:'warmup'});
  assert.deepEqual((await pairedWork('paired-warmup','overlay')).project,placed,'Switch back restores generated pixels, layer placement and reference image');assert.deepEqual(await loadConversation('paired-overlay'),transcript);
  const grouped=groupWorks(await listWorks()).find(g=>g.some(w=>w.id==='paired-overlay'));assert.equal(grouped.length,2);assert.equal(grouped[0].project.mode,'overlay');assert.equal(grouped[1].id,'paired-warmup');assert.deepEqual(await loadConversation(grouped[0].id),transcript,'Grouped work retains its own transcript');
  await saveWorkspace({...missingWarmup,name:'修改后的暖场'},'paired-warmup');assert.equal((await pairedWork('paired-overlay','warmup')).project.name,'修改后的暖场');
  await deleteWork('paired-warmup');assert.equal(await pairedWork('paired-overlay','warmup'),undefined);assert.deepEqual((await listWorks()).find(w=>w.id==='paired-overlay').project,placed);
  assert.equal(groupWorks(await listWorks()).find(g=>g.some(w=>w.id==='paired-overlay')).length,1,'Missing counterparts do not hide the surviving work');
  console.log('PASS: mode counterparts restore current saved artwork and layout without creating fresh blanks; project and conversation persist together; deleted counterparts do not destroy originals.');
  await deleteWork('paired-overlay');
  await restoreCloudWorkspace(placed,'cloud-overlay',transcript,{id:'cloud-warmup',project:missingWarmup,messages:[{role:'user',text:'暖场历史'}]});
  assert.equal((await pairedWork('cloud-overlay','warmup')).id,'cloud-warmup');assert.equal((await loadConversation('cloud-warmup'))[0].text,'暖场历史');
  const updatedCloud={...placed,name:'云端新版本'};
  await restoreCloudWorkspace(updatedCloud,'cloud-overlay',transcript,{id:'cloud-warmup',project:missingWarmup,messages:[{role:'user',text:'暖场历史'}]});
  const backup=(await listWorks()).find(w=>w.project.name.endsWith(' · 本地备份'));assert(backup);assert.deepEqual(backup.project.layers,placed.layers);assert.deepEqual(await loadConversation(backup.id),transcript);
  const countBefore=(await listWorks()).length;await assert.rejects(restoreCloudWorkspace(updatedCloud,'cloud-overlay',transcript,{id:'cloud-overlay',project:missingWarmup,messages:[]}));assert.equal((await listWorks()).length,countBefore,'Invalid scene pairs do not modify saved works');
  for(const id of ['cloud-overlay','cloud-warmup',backup.id])await deleteWork(id);
  console.log('PASS: cloud bundle restores both scenes and transcripts atomically, reconnects paired scenes, preserves conflicting local work, and rejects invalid bundles before writes.');
  {
   const {DatabaseSync}=await import('node:sqlite');const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync('drizzle/0001_friendly_alice.sql','utf8'));const objects=new Map();
   globalThis.projectBundleEnv={DB:{prepare:q=>({bind:(...args)=>({first:async()=>sql.prepare(q).get(...args)||null,all:async()=>({results:sql.prepare(q).all(...args)}),run:async()=>sql.prepare(q).run(...args)})})},BUCKET:{put:async(k,v)=>objects.set(k,v),get:async k=>objects.has(k)?{text:async()=>objects.get(k)}:null}};
   let source=ts.transpileModule(fs.readFileSync('app/api/cloud-projects/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/import \{ runtimeEnv \} from [^;]+;/,'const runtimeEnv=async()=>globalThis.projectBundleEnv;').replace(/from ['"]\.\.\/\.\.\/\.\.\/lib\/([^'"]+)['"]/g,(_,name)=>`from './.product-test-${name}.mjs'`);
   fs.writeFileSync('lib/.product-test-cloud-route.mjs',source);const route=await import('../lib/.product-test-cloud-route.mjs');
   const body={id:'work-cloud-bundle',project:placed,messages:transcript,companion:{id:'cloud-warmup',project:missingWarmup,messages:[{role:'user',text:'暖场对话'}]}};
   const request=(owner,method='GET',data)=>new Request('https://test.site/api/cloud-projects'+(method==='GET'?'?id=work-cloud-bundle':''),{method,headers:{origin:'https://test.site',...(owner?{'oai-authenticated-user-id':owner}:{})},...(data?{body:JSON.stringify(data)}:{})});
   assert.notEqual((await route.POST(request(null,'POST',body))).status,200);assert.equal((await route.POST(request('alice','POST',body))).status,200);
   const restored=await (await route.GET(request('alice'))).json();assert.equal(restored.companion.project.mode,'warmup');assert.equal(restored.companion.messages[0].text,'暖场对话');assert.deepEqual(restored.project.layers,placed.layers);
   assert.equal((await route.GET(request('bob'))).status,404);assert.notEqual((await route.POST(request('bob','POST',body))).status,200);
   assert.notEqual((await route.POST(request('alice','POST',{...body,companion:{...body.companion,project:placed}}))).status,200);
   fs.unlinkSync('lib/.product-test-cloud-route.mjs');delete globalThis.projectBundleEnv;sql.close();
   console.log('PASS: real SQL cloud save/read includes both scenes and conversations, with anonymous/cross-account denial and invalid companion validation.');
  }
  const { applyBrand, brandFromProject } = await import(
    "../lib/.product-test-brand.mjs"
  );
  const branded = applyBrand(p, {
    name: "POLYV",
    accent: "#235ff5",
    logo: { src: "data:image/png;base64,aGVsbG8=", ratio: 3 },
  });
  assert.equal(branded.layers.find((l) => l.id === "品牌").text, "POLYV");
  const logo = branded.layers.find((l) => l.name === "品牌 Logo");
  assert.equal(logo.width / logo.height, 3);
  assert.equal(brandFromProject(branded).name, "POLYV");
  assert.equal(
    applyBrand(branded, brandFromProject(branded)).layers.filter(
      (l) => l.name === "品牌 Logo",
    ).length,
    1,
  );
  const { writeSetting, readSetting } = await import(
    "../lib/.product-test-storage.mjs"
  );
  await writeSetting("brand", brandFromProject(branded));
  assert.equal((await readSetting("brand")).name, "POLYV");
  assert.equal((await listWorks()).length, 1);
  console.log(
    "PASS: reusable brand text/color, transparent Logo reference and proportions, replacing without duplication, independent brand settings storage.",
  );
} finally {
  globalThis.fetch = oldFetch;
  for (const name of modules)
    fs.unlinkSync("lib/.product-test-" + name + ".mjs");
}
