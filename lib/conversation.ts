import {z} from 'zod';
export const conversationMessageSchema=z.object({role:z.enum(['user','assistant','error']),text:z.string().max(12000),kind:z.enum(['plan','result','confirmation']).optional()});
export const conversationSchema=z.array(conversationMessageSchema).max(500);
export type ConversationMessage=z.infer<typeof conversationMessageSchema>;
/** Keep full local history; send a bounded text-only context to AI. */
export function conversationContext(value:unknown):Array<{role:'user'|'assistant';text:string}> {
  const history=conversationSchema.parse(Array.isArray(value)?value.slice(-500):value);const recent:Array<{role:'user'|'assistant';text:string}>=[];let budget=24000;
  for(const m of history.slice().reverse()) {
    if(m.role==='error'||!m.text.trim())continue;
    const text=m.text.slice(0,6000);if(text.length>budget)break;
    recent.unshift({role:m.role,text});budget-=text.length;if(recent.length>=24)break;
  }
  return recent;
}
export function publicCopy(message:string) {
  if (/BodyStreamBuffer|aborted|AbortError|TimeoutError|terminated|Failed to fetch|network error|fetch failed/i.test(message)) return '连接中断或等待超时，请重试，当前设计已保留';
  return message.replace(/方案已提交生图平台，正在等待生成图片/g,'正在生成设计').replace(/生图平台已返回结果，正在接收图片/g,'正在整理图片').replace(/AI平台处理超时，未返回生成结果，当前设计未被替换/g,'生成超时，当前设计已保留').replace(/上游服务返回错误（(\d+)），请检查服务配置/g,'暂时无法完成，请稍后重试（$1）').replace(/含文字的完整贴片已叠加到当前直播预览，旧文字和底板已隐藏，可撤销。/g,'设计已更新，可继续修改。').replace(/已通过本地指令更新画布，可撤销。本次未调用大模型。/g,'已更新画布，可撤销。').replace(/服务鉴权失败，请检查服务端密钥及权限/g,'创作服务暂不可用，请稍后重试').replace(/服务连接超时或不可用，请稍后重试/g,'连接超时，请稍后重试');
}
