import {connectionDb,loadConnection} from '../../../lib/polyv-account';
import {cloud,ownerOf,reserveTask} from "../../../lib/cloud-services";
import {readPackagingPlan,compilePackagingPlan} from "../../../lib/packaging-plan";
import {conversationMessageSchema,publicCopy} from "../../../lib/conversation";
import { z } from "zod";
import { projectSchema } from "../../../lib/design";
import {
  planDesign,
  briefRuntime,
  createDesignBrief,
  generateHoldingBackground,
} from "../../../lib/ai-provider";
import { runtimeEnv, error, workflowResponse } from "../../../lib/server";
const input = z.object({
  action: z.enum(["edit", "image", "brief", "component"]),
  stream: z.boolean().optional(),
  retryBrief:z.boolean().optional(),
  requestId:z.string().regex(/^[a-zA-Z0-9_-]{8,100}$/).optional(),
  history:z.array(conversationMessageSchema).max(24).default([]),
  designBrief: z.string().min(1).max(12000).optional(),
  prompt: z.string().min(1).max(2500),
  project: projectSchema.optional(),
  portrait: z.boolean().optional(),
  referenceImage: z.string().max(8000000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).optional(),
  imageLayerIds: z.array(z.string().max(100)).max(100).default([]),
});
// Best-effort per-isolate throttling; provider token quota remains the hard spending cap.
const usage = new Map<string, { count: number; until: number }>();
function allowed(key: string, limit: number) {
  const now = Date.now();
  for (const [k, v] of usage) if (v.until <= now) usage.delete(k);
  const v = usage.get(key) || { count: 0, until: now + 60000 };
  if (v.count >= limit || usage.size > 5000) return false;
  v.count++; usage.set(key, v); return true;
}
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return error("不允许跨站调用", 403);
  try {
    const text = await req.text();
    if (text.length > 8500000) return error("请求过大，请压缩参考截图", 413);
    const b = input.parse(JSON.parse(text)),
      env = await runtimeEnv();
    const connection=await loadConnection(connectionDb(env),ownerOf(req));
    if(!connection?.verified_channel)return error('请先在频道设置中验证并保存频道账号',403);
    if (b.action === "edit" && text.length > 500000) return error("文字修改请只发送图层属性", 413);
    if (b.referenceImage && (!["image","brief","component"].includes(b.action))) return error("参考图仅用于方案或图片生成");
    const visitor = req.headers.get("oai-authenticated-user-id") || req.headers.get("cf-connecting-ip") || "anonymous";
    if (!allowed("global", 30) || !allowed(visitor + ":" + b.action, ["image","component"].includes(b.action) ? 1 : 5))
      return error("当前试用请求较多，请一分钟后重试", 429);
    if (b.action === "brief") {
      if(!b.project)return error("缺少画布数据");
      const work=async(stage:(message:string)=>void,preview?:(text:string)=>void)=>({brief:await createDesignBrief(briefRuntime(env,b.retryBrief),b.prompt,b.project!,b.referenceImage,stage,b.history,preview)});
      return b.stream ? workflowResponse(work,{requestId:b.requestId||crypto.randomUUID(),action:b.action}) : Response.json(await work(()=>{}));
    }
    if (b.action === "image" || b.action === "component") {
      if(b.action==="component"&&!b.referenceImage)return error("请选择一个图片组件");
      if(b.action==='image'&&b.project?.mode==='overlay'){const plan=readPackagingPlan(b.designBrief||'');if(!plan)return error('请先拟定方案并选择包装模块');compilePackagingPlan(plan,b.project.width,b.project.height);}

      const owner=ownerOf(req),{db,bucket}=cloud(env),id=b.requestId||crypto.randomUUID();
      const previous=await db.prepare('SELECT owner,state,result_key FROM ai_tasks WHERE id=?').bind(id).first();
      if(previous){if(previous.owner!==owner)return error('任务编号无效',403);if(previous.state==='completed'&&previous.result_key){const result=await bucket.get(previous.result_key);if(result)return new Response(await result.text(),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}return error('该任务已提交，请在任务记录查看，勿重复生成',409);}
      // Daily creation caps are temporarily disabled; concurrency and burst guards remain.
      await reserveTask(db,owner,id,0,0);
      const work=async(stage:(message:string)=>void)=>{
        try{const result={src:await generateHoldingBackground(env,b.prompt,b.project?b.project.height>b.project.width:!!b.portrait,b.project,b.referenceImage,b.designBrief,stage,b.action==="component")};
          const key='tasks/'+owner+'/'+id+'.json';await bucket.put(key,JSON.stringify(result),{httpMetadata:{contentType:'application/json'}});
          await db.prepare("UPDATE ai_tasks SET state='completed',result_key=?,message='设计已完成',updated=? WHERE id=? AND owner=?").bind(key,new Date().toISOString(),id,owner).run();return result;
        }catch(e){await db.prepare("UPDATE ai_tasks SET state='failed',message=?,updated=? WHERE id=? AND owner=?").bind(publicCopy((e as Error).message).slice(0,200),new Date().toISOString(),id,owner).run();throw e;}
      };
      return b.stream ? workflowResponse(work,{requestId:b.requestId||crypto.randomUUID(),action:b.action}) : Response.json(await work(()=>{}));
    }
    if (!b.project) return error("缺少画布数据");
    return Response.json(await planDesign(env, b.prompt, b.project, b.imageLayerIds,b.history));
  } catch (e) {
    return error(
      e instanceof z.ZodError
        ? "AI 数据未通过校验，画布保持原样"
        : publicCopy((e as Error).message || "服务暂时不可用"),
      400,
    );
  }
}
