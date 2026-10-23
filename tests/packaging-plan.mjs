import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),source=ts.transpileModule(fs.readFileSync('lib/packaging-plan.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText.replace(/from ["']zod["']/,'from "'+pathToFileURL(require.resolve('zod')).href+'"');
const {readPackagingPlan,compilePackagingPlan,previewPackagingPlan,partialPlanPreview,summarizePlan}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const plan={scene:{type:'通用直播',subjects:'未知',environment:'未提供画面',colors:'未知',style:'未知',ratio:'未知',safeAreas:'需确认',existingElements:'未知'},theme:'品牌直播',style:'简洁',colors:'蓝白',typography:'黑体',decoration:'细线',modules:[{id:'title',name:'标题',purpose:'主题展示',position:'左上',style:'平面',color:'#235FF5',text:'真实标题',size:'主标题',recommended:true,selected:true},{id:'price',name:'商品卡',purpose:'商品说明',position:'下方',style:'平面',color:'#FF0000',text:'绝不可输出的价格999',size:'小',recommended:false,selected:false}],questions:[]};
assert(readPackagingPlan(JSON.stringify(plan)));assert.equal(readPackagingPlan('{}'),undefined);
const prompt=compilePackagingPlan(plan,1080,1920);assert(prompt.includes('真实标题'));assert(!prompt.includes('绝不可输出的价格999'));assert(!prompt.includes('商品卡'));assert(prompt.startsWith('**竖屏直播包装设计：**'));assert(!prompt.includes('A. 原始场景描述'));assert(!prompt.includes('#235FF5'));
assert.throws(()=>compilePackagingPlan({...plan,modules:plan.modules.map(m=>({...m,selected:false}))},1920,1080),/至少选择/);
assert.doesNotThrow(()=>previewPackagingPlan({...plan,style:''},1920,1080));
assert.throws(()=>compilePackagingPlan({...plan,modules:[plan.modules[0],plan.modules[0]]},1920,1080));
console.log('PASS: structured plan validation, selected-only prompts, empty-selection rejection, original-frame protection, aspect layout and safe preview while editing.');

const imperfect={...plan,scene:{...plan.scene,ratio:'',existingElements:null},modules:plan.modules.map(({id,...m})=>({...m,color:'品牌蓝 #235FF5',purpose:''}))};
const normalized=readPackagingPlan('方案如下：\n```json\n'+JSON.stringify(imperfect)+'\n```');assert(normalized);assert.equal(normalized.scene.ratio,'未识别');assert.equal(normalized.modules[0].color,'#235FF5');assert.equal(normalized.modules[0].text,'真实标题');
assert(partialPlanPreview('{"scene":{"type":"教育培训","subjects":"讲师"').includes('画面主体：讲师'));assert(!partialPlanPreview('{"reasoning":"hidden"}').includes('hidden'));

const expanded={...plan,modules:Array.from({length:20},(_,i)=>({...plan.modules[0],id:'choice-'+i,selected:i===0,recommended:i===0}))};assert(readPackagingPlan(JSON.stringify(expanded)));assert.throws(()=>compilePackagingPlan({...expanded,modules:[...expanded.modules,{...plan.modules[0],id:'extra'}]},1080,1920));
const visible=summarizePlan(plan,1080,1920);assert(visible.includes('**竖屏直播包装设计：**'));assert(visible.includes('真实标题'));assert(!visible.includes('绝不可输出的价格999'));assert(!visible.includes('推荐模块：'));

const commerce=readPackagingPlan(JSON.stringify({...plan,scene:{...plan.scene,type:'美妆电商直播'}}));
for(const text of ['七天无理由退货','24小时发货','顺丰包邮','正品保障']){
 const module=commerce.modules.find(m=>m.text===text);assert(module);assert.equal(module.selected,false);assert(!compilePackagingPlan(commerce,1080,1920).includes(text));
}
assert(!compilePackagingPlan(plan,1080,1920).includes('黑体'),'The output prompt must not impose the plan typography field');
commerce.modules.find(m=>m.text==='24小时发货').selected=true;
assert(compilePackagingPlan(commerce,1080,1920).includes('24小时发货'));

const automatic=readPackagingPlan(JSON.stringify({...plan,modules:plan.modules.map(m=>({...m,position:'右侧 x=80%–90%'}))}));
assert(automatic.modules.every(m=>m.position===''),'Automatic and legacy placement suggestions default to blank');
const free=compilePackagingPlan(automatic,1080,1920);assert(!free.includes('右侧'));assert(!free.includes('留白区域'));assert(!free.includes('80%'));
const located=readPackagingPlan(JSON.stringify({...plan,modules:plan.modules.map(m=>({...m,position:'右下角，x=80%–90%',positionExplicit:true}))}));
assert.equal(located.modules[0].position,'右下角，x=80%–90%');assert(compilePackagingPlan(located,1080,1920).includes('右下角，x=80%–90%'),'Manual positions survive editing and are never cut into broken phrases');
