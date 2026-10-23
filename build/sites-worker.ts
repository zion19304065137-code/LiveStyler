import handler from "vinext/server/fetch-handler";
import {withVisitorSession} from '../lib/visitor-session';
export default {
 async fetch(request:Request,env:Cloudflare.Env,ctx:ExecutionContext){
  return withVisitorSession(request,env as unknown as Record<string,any>,r=>handler.fetch(r,env,ctx));
 }
};
