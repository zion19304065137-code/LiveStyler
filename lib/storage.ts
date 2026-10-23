import {conversationSchema,type ConversationMessage} from "./conversation";
import { projectSchema, newLocalId, type Project } from "./design";
import {workBundleSchema,type WorkCompanion} from './work-bundle';
function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const q = indexedDB.open("livestyler", 1);
    q.onupgradeneeded = () => q.result.createObjectStore("projects");
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  });
}
export async function save(p: Project, key = "current") {
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const t = d.transaction("projects", "readwrite");
    t.objectStore("projects").put(p, key);
    t.oncomplete = () => {
      d.close();
      resolve();
    };
    t.onerror = () => {
      d.close();
      reject(t.error);
    };
  });
}
export async function load(key = "current"): Promise<Project | undefined> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const q = d.transaction("projects").objectStore("projects").get(key);
    q.onsuccess = () => {
      d.close();
      resolve(q.result);
    };
    q.onerror = () => reject(q.error);
  });
}

export type SavedWork = { id: string; updatedAt: string; project: Project; pairedId?:string };
export function groupWorks(works:SavedWork[]):SavedWork[][]{
 const seen=new Set<string>(),groups:SavedWork[][]=[];
 for(const w of works){if(seen.has(w.id))continue;const pair=works.find(other=>other.id===w.pairedId&&other.pairedId===w.id&&other.project.mode!==w.project.mode&&!seen.has(other.id));const group=pair?[w,pair]:[w];group.forEach(item=>seen.add(item.id));groups.push(group.sort((a,b)=>a.project.mode==='overlay'?-1:1));}
 return groups;
}
async function readValue<T>(key: string): Promise<T | undefined> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const q = d.transaction("projects").objectStore("projects").get(key);
    q.onsuccess = () => {
      d.close();
      resolve(q.result);
    };
    q.onerror = () => {
      d.close();
      reject(q.error);
    };
  });
}
export async function saveWorkspace(project: Project, id: string, messages?:ConversationMessage[]) {
  project = projectSchema.parse(project);
  const conversation=messages?conversationSchema.parse(messages.slice(-500)):undefined;
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const t = d.transaction("projects", "readwrite"),
      s = t.objectStore("projects");
    if(conversation)s.put({version:1,messages:conversation},'setting:conversation:'+id);
    s.put(project, "current");
    s.put(id, "active-id");
    s.put(
      { id, updatedAt: new Date().toISOString(), project } satisfies SavedWork,
      "work:" + id,
    );
    t.oncomplete = () => {
      d.close();
      resolve();
    };
    t.onerror = () => {
      d.close();
      reject(t.error);
    };
    t.onabort = () => {
      d.close();
      reject(t.error || Error("保存已中止"));
    };
  });
}
/** Persist one counterpart per work; repeated mode switches reopen it instead of making blanks. */
export async function pairedWork(id:string,mode:Project['mode']):Promise<SavedWork|undefined>{
 const other=await readSetting<string>('mode-pair:'+id+':'+mode);
 return other?readValue<SavedWork>('work:'+other):undefined;
}
export async function pairWorks(a:{id:string;mode:Project['mode']},b:{id:string;mode:Project['mode']}){
 const d=await db();return new Promise<void>((resolve,reject)=>{const t=d.transaction('projects','readwrite'),s=t.objectStore('projects');s.put(b.id,'setting:mode-pair:'+a.id+':'+b.mode);s.put(a.id,'setting:mode-pair:'+b.id+':'+a.mode);t.oncomplete=()=>{d.close();resolve()};t.onerror=()=>{d.close();reject(t.error)};});
}
export async function loadActiveId() {
  return readValue<string>("active-id");
}
export async function listWorks(): Promise<SavedWork[]> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const s = d.transaction("projects").objectStore("projects"), keys=s.getAllKeys(),q=s.getAll();
    q.onsuccess = () => {
      d.close();
      resolve(
        q.result
          .filter(
            (v) => v && typeof v.id === "string" && v.project && v.updatedAt,
          )
          .map((w:SavedWork)=>{const mode=w.project.mode==='overlay'?'warmup':'overlay';const index=keys.result.indexOf('setting:mode-pair:'+w.id+':'+mode);const pairedId=index>=0?q.result[index]:undefined;return {...w,pairedId:typeof pairedId==='string'&&q.result.some(v=>v?.id===pairedId&&v.project?.mode===mode)?pairedId:undefined};})
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      );
    };
    q.onerror = () => {
      d.close();
      reject(q.error);
    };
  });
}
export async function deleteWork(id: string) {
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const t = d.transaction("projects", "readwrite");
    t.objectStore("projects").delete("work:" + id);
    t.objectStore("projects").delete("setting:conversation:"+id);
    t.oncomplete = () => {
      d.close();
      resolve();
    };
    t.onerror = () => {
      d.close();
      reject(t.error);
    };
  });
}
export async function writeSetting(key: string, value: unknown) {
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const t = d.transaction("projects", "readwrite");
    t.objectStore("projects").put(value, "setting:" + key);
    t.oncomplete = () => {
      d.close();
      resolve();
    };
    t.onerror = () => {
      d.close();
      reject(t.error);
    };
  });
}
export async function readSetting<T>(key: string) {
  return readValue<T>("setting:" + key);
}
/** Archive a work without changing which project opens on refresh. */
export async function archiveWork(project: Project, id: string) {
  project = projectSchema.parse(project);
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const t = d.transaction("projects", "readwrite");
    t.objectStore("projects").put(
      { id, updatedAt: new Date().toISOString(), project } satisfies SavedWork,
      "work:" + id,
    );
    t.oncomplete = () => {
      d.close();
      resolve();
    };
    t.onerror = () => {
      d.close();
      reject(t.error);
    };
  });
}

export async function saveConversation(id:string,messages:ConversationMessage[]) {
  return writeSetting('conversation:'+id,{version:1,messages:conversationSchema.parse(messages.slice(-500))});
}
export async function loadConversation(id:string):Promise<ConversationMessage[]> {
  const value=await readSetting<{version:number;messages:unknown}>('conversation:'+id);
  if(!value)return [];
  return conversationSchema.parse(value.messages);
}

/** Restore both scenes, transcripts and links in one transaction, with local conflict backups. */
export async function restoreCloudWorkspace(project:Project,id:string,messages:ConversationMessage[],companion?:WorkCompanion){
 const checked=workBundleSchema.parse({project,messages,companion});
 if(checked.companion?.id===id)throw Error('关联作品编号重复');
 const incoming=[{id,project:checked.project,messages:checked.messages},...(checked.companion?[checked.companion]:[])];
 const writes:Array<{id:string;project:Project;messages:ConversationMessage[]}>=[];
 for(const item of incoming){
  const old=await readValue<SavedWork>('work:'+item.id),history=old?await loadConversation(item.id):[];
  if(old&&(JSON.stringify(old.project)!==JSON.stringify(item.project)||JSON.stringify(history)!==JSON.stringify(item.messages))){writes.push({id:newLocalId(),project:{...old.project,name:(old.project.name+' · 本地备份').slice(0,100)},messages:history});}
  writes.push(item);
 }
 const d=await db();await new Promise<void>((resolve,reject)=>{const t=d.transaction('projects','readwrite'),s=t.objectStore('projects'),updatedAt=new Date().toISOString();
  for(const w of writes){s.put({id:w.id,project:w.project,updatedAt},'work:'+w.id);s.put({version:1,messages:w.messages},'setting:conversation:'+w.id);}
  if(checked.companion){s.put(checked.companion.id,'setting:mode-pair:'+id+':'+checked.companion.project.mode);s.put(id,'setting:mode-pair:'+checked.companion.id+':'+checked.project.mode);}
  s.put(id,'active-id');s.put(checked.project,'current');
  t.oncomplete=()=>{d.close();resolve()};t.onerror=t.onabort=()=>{d.close();reject(t.error||Error('恢复作品失败'))};
 });
}
