"use client";
import type {WorkCompanion} from '../lib/work-bundle';
import {studioTemplate,reflowStudioTemplate,companionTemplate,restoreTemplateFootage} from '../lib/studio-templates';
import {layerSize} from "../lib/layer-size";
import {replaceComponent} from "../lib/component-revision";
import {layerStack,reorderLayer} from "../lib/footage-layer";
import CloudPanel from "./CloudPanel";
import BrandEyes from "./BrandEyes";
import {findArtObjects} from "../lib/split-art";
import {placeOverlayObject} from "../lib/overlay-placement";
import {scenePhotos} from "../lib/scene-assets";
import {readPackagingPlan,compilePackagingPlan,previewPackagingPlan,summarizePlan,type PackagingPlan} from "../lib/packaging-plan";
import { newLocalId } from "../lib/design";
import { useState, useEffect, useRef } from "react";
import type {ChannelParameters} from "../lib/channel-match";
import ChannelConnection from "./ChannelConnection";
import AccountAssets from "./AccountAssets";
import {useLiveCapture} from "../hooks/useLiveCapture";
import {useTypingPreview} from "../hooks/useTypingPreview";
import {
  Layers,
  Sparkles,
  ArrowUp,
  ArrowLeft,
  Undo2,
  Redo2,
  Download,
  Upload,
  Plus,
  Image as ImageIcon,
  Type,
  Square,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  ChevronUp,
  ChevronDown,
  Link,
  Settings,
  Check,
  Save,
  X,
  FolderOpen,
  Monitor,
  Maximize2,
  Loader2,
  Copy,
} from "lucide-react";
import Canvas, { CanvasHandle } from "./Canvas";
import TemplateThumb from "./TemplateThumb";
import WorkLibrary from "./WorkLibrary";
import BrandPanel from "./BrandPanel";
import {
  applyBrand,
  brandFromProject,
  brandSchema,
  type BrandKit,
} from "../lib/brand";
import { executeCommand } from "../lib/commands";
import { applyAiResult } from "../lib/ai-contract";
import { requestJson, requestWorkflow } from "../lib/http-client";
import {
  groupsForProject,
  groupIds,
  toggleComponent,
  moveLayers,
  alignLayer,
  arrangeLayers,
  alignElements,
  duplicateComponent,
  inspection,
  addComponent,
  reflowOverlay,
} from "../lib/editor-actions";
import {
  template,
  blankProject,
  applyBroadcastMaterials,
  styles,
  Project,
  Layer,
  projectSchema,
  resizeProject,
  Ratio,
  safeArea,
} from "../lib/design";
import {
  save,
  load,
  saveWorkspace,
  pairedWork,
  pairWorks,
  loadActiveId,
  listWorks,
  deleteWork,
  archiveWork,
  writeSetting,
  readSetting,
  saveConversation,
  loadConversation,
  restoreCloudWorkspace,
  type SavedWork,
} from "../lib/storage";
import {conversationContext,publicCopy,type ConversationMessage} from "../lib/conversation";
import ScrubNumber from "./ScrubNumber";
import {clampArea,presetArea} from "../lib/protected-area";
import { downloadFile } from "../lib/download";
import { splitArtImage } from "../lib/split-art";
import {updateImageCrop} from '../lib/image-render';
import { applyGeneratedObjects,applyWarmupDesign } from "../lib/generated-design";
import { checkOverlayPixels } from "../lib/image-quality";
import { buildMaterialPackage } from "../lib/export-package";
type Msg = ConversationMessage;
type DesignDraft = {plan?:PackagingPlan;brief:string;prompt:string;project:Project;reference?:string;whole:boolean;fromFrame:boolean};
const download = downloadFile;
export default function Editor({
  preset,
  home,
  initialRatio = "landscape",
}: {
  preset?: number;
  initialRatio?: Ratio;
  home: () => void;
}) {
  const [editingFootage,setEditingFootage]=useState(false);
  const [answerPreview,setAnswerPreview,finishPreview]=useTypingPreview();
  const answerElement=useRef<HTMLPreElement>(null),followAnswer=useRef(true);
  useEffect(()=>{if(!answerPreview){followAnswer.current=true;return;}const el=answerElement.current;if(el&&followAnswer.current)el.scrollTop=el.scrollHeight;},[answerPreview]);
  const [p, setP] = useState<Project>(()=>preset===undefined?blankProject(0,initialRatio):studioTemplate(preset,initialRatio)),
    [ready, setReady] = useState(false),
    [selected, setSelected] = useState(""),
    [alignmentIds,setAlignmentIds] = useState<string[]>([]),
    [alignmentTarget,setAlignmentTarget] = useState<'selection'|'canvas'>('selection'),
    [past, setPast] = useState<Project[]>([]),
    [future, setFuture] = useState<Project[]>([]),
    [prompt, setPrompt] = useState(""),
    [messages, setMessages] = useState<Msg[]>([]),
    [chatWorkId,setChatWorkId] = useState<string>(),
    [busy, setBusy] = useState(false),
    [switchingMode,setSwitchingMode]=useState(false),
    [workSection,setWorkSection]=useState<'local'|'cloud'|'tasks'>('local'),
    [elapsed,setElapsed] = useState(0),
    [workflowSteps,setWorkflowSteps] = useState<string[]>([]),
    [designDraft,setDesignDraft] = useState<DesignDraft>(),
    [componentPrompt,setComponentPrompt]=useState(""),
    [componentCandidate,setComponentCandidate]=useState<{id:string;original:string;src:string;work:string}>(),
    [drawingArea,setDrawingArea] = useState(false),
    [notice, setNotice] = useState(""),
    [modal, setModal] = useState(""),
    [generated, setGenerated] = useState<{src:string;frame?:string;warning:string;canApply:boolean;applied:boolean;project:Project}>(),
    [tab, setTab] = useState("助手"),
    [preview, setPreview] = useState(true),
    [guides, setGuides] = useState(false),
    [previewKind, setPreviewKind] = useState(
      preset === 3 ? "商品" : preset === 2 ? "共享画面" : "主播",
    ),
    [previewSrc, setPreviewSrc] = useState<string>(),
    [legacy, setLegacy] = useState<Project>(),
    [status, setStatus] = useState({ text: false, image: false, polyv: false }),
    [real, setReal] = useState(false),
    [saved, setSaved] = useState("正在恢复项目"),
    [channel, setChannel] = useState(""),
    [channelData, setChannelData] = useState<any>(),
    [exportType, setExportType] = useState("png"),
    [exportReady,setExportReady] = useState<{url:string;name:string}>(),
    [exportScope, setExportScope] = useState("all"),
    [exporting, setExporting] = useState(false),
    [workId, setWorkId] = useState<string>(() => newLocalId()),
    [works, setWorks] = useState<SavedWork[]>([]),
    [checked, setChecked] = useState(false),
    [linked, setLinked] = useState(true),
    [draggingFile, setDraggingFile] = useState(false),
    [brand, setBrand] = useState<BrandKit>({
      name: "YOUR BRAND",
      accent: "#235ff5",
    });
  const [connectedChannel,setConnectedChannel]=useState<string>();
  const [matchProposal,setMatchProposal]=useState<{source:string;ratio:Ratio;sourceSize?:string;channel?:ChannelParameters}>();
  const liveCapture=useLiveCapture(setNotice);
  const [cameraPanel,setCameraPanel]=useState(false),[chosenCamera,setChosenCamera]=useState('');
  useEffect(()=>{const video=liveCapture.video;if(!video)return;setMatchProposal({source:liveCapture.kind==='camera'?'摄像头':'共享窗口',ratio:video.videoHeight>video.videoWidth?'portrait':'landscape',sourceSize:video.videoWidth+' × '+video.videoHeight});},[liveCapture.video]);
  function matchChannel(parameters:ChannelParameters){setConnectedChannel(parameters.channelId);setModal('');setMatchProposal({source:'频道 '+parameters.channelId,ratio:parameters.ratio||(latest.current.height>latest.current.width?'portrait':'landscape'),channel:parameters});}
  function applyMatch(){if(!matchProposal)return;const current=latest.current,next=current.templateStyle?reflowStudioTemplate(current,matchProposal.ratio):current.mode==='overlay'?reflowOverlay(current,matchProposal.ratio):resizeProject(current,matchProposal.ratio);commit({...next,...(matchProposal.channel?{channelContext:{channelId:matchProposal.channel.channelId,template:matchProposal.channel.template,liveType:matchProposal.channel.liveType,scene:matchProposal.channel.scene}}:{})});setDesignDraft(undefined);setMatchProposal(undefined);setNotice('已匹配画布，可撤销');}
  async function exportWarmup(){const current=latest.current;if(current.mode!=='warmup')throw Error('请先切换到开场／暖场画面');const data=canvas.current?.export('jpg');if(!data)throw Error('画布尚未就绪');const image=new Image();image.src=data;await image.decode();const c=document.createElement('canvas'),scale=Math.min(1,1280/image.width);c.width=Math.round(image.width*scale);c.height=Math.round(image.height*scale);c.getContext('2d')!.drawImage(image,0,0,c.width,c.height);for(const quality of [.9,.78,.65,.5]){const file=await new Promise<Blob|null>(resolve=>c.toBlob(resolve,'image/jpeg',quality));if(file&&file.size<=2*1024*1024)return file;}throw Error('图片过大，请减少素材后重试');}
  async function exportWholePackage(){try{const current=latest.current;download(current.name+'.zip',await buildMaterialPackage(current,(format,ids)=>canvas.current!.export(format,ids),groups));setNotice('整套包装已下载');}catch(e){setNotice((e as Error).message);}}
  async function splitSelectedArt(){const current=latest.current,l=current.layers.find(l=>l.id===selected);if(!l?.src||l.type!=='image'||l.locked)return;if(l.rotation){setNotice('请先将图片旋转角度设为 0，再拆分');return;}try{const baked=!!(l.shadowEnabled||l.mask&&l.mask!=='none'||l.imageCrop||l.imageFit||l.flipX||l.flipY),source=baked?canvas.current?.export('png',[l.id]):l.src;if(!source)throw Error('图片尚未就绪');const objects=await splitArtImage(source);if(latest.current!==current)throw Error('设计已变化，请重试');if(objects.length<2){setNotice('未识别到独立贴片；相连的底板或不透明背景无法自动分开');return;}if(current.layers.length+objects.length-1>100)throw Error('物件过多，请先减少图层');const index=current.layers.indexOf(l),id=newLocalId();commit({...current,layers:[...current.layers.slice(0,index),...objects.map((o,i)=>({...l,id:id+'-'+i,name:'物件 '+(i+1),groupId:undefined,groupName:undefined,src:o.src,x:baked?o.x*current.width:l.x+o.x*l.width,y:baked?o.y*current.height:l.y+o.y*l.height,width:o.width*(baked?current.width:l.width),height:o.height*(baked?current.height:l.height),...(baked?{shadowEnabled:false,shadowColor:undefined,shadowOpacity:undefined,shadowBlur:undefined,shadowOffsetX:undefined,shadowOffsetY:undefined,mask:undefined,cornerRadius:undefined,imageCrop:undefined,imageFit:undefined,flipX:undefined,flipY:undefined}:{})})),...current.layers.slice(index+1)]});setSelected(id+'-0');setNotice('已拆成 '+objects.length+' 个物件，可撤销');}catch(e){setNotice((e as Error).message);}}
  function clearPackaging(){const current=latest.current;commit({...blankProject(current.scene,current.height>current.width?'portrait':'landscape',current.mode),name:current.name,...(current.channelContext?{channelContext:current.channelContext}:{})});setSelected('');setDesignDraft(undefined);setGenerated(undefined);setNotice('已清空包装，可撤销');}
  async function exportAccountImage(){const data=canvas.current?.export('png');if(!data)throw Error('画布尚未就绪');const r=await fetch(data);const blob=await r.blob();if(blob.size>4*1024*1024)throw Error('当前画面超过 4MB，请先导出压缩后上传');return blob;}
  async function useAccountImage(file:File){uploadKind.current='image';await upload(file,true);}
  function exportOverlay(){try{const data=canvas.current?.export('png');if(data)download('直播贴片.png',data);}catch(e){setNotice((e as Error).message);}}

  useEffect(()=>()=>liveCapture.stop(),[]);
  const connectCapture=async(kind:"screen"|"camera")=>{setPreview(true);await liveCapture.start(kind,kind==='camera'?chosenCamera:'');};
  const canvas = useRef<CanvasHandle>(null),
    file = useRef<HTMLInputElement>(null),
    importer = useRef<HTMLInputElement>(null),
    uploadKind = useRef("image"),
    historyStamp = useRef({ key: "", time: 0 }),
    latest = useRef(p),
    end = useRef<HTMLDivElement>(null);
  latest.current = p;
  useEffect(()=>{
    if(exportScope === "text" && !p.layers.some(l=>l.type === "text" && l.visible && l.opacity>0))setExportScope("all");
  },[p,exportScope]);
  useEffect(()=>{
    if(!busy)return;
    const start=Date.now();setElapsed(0);
    const timer=setInterval(()=>setElapsed(Math.floor((Date.now()-start)/1000)),1000);
    return ()=>clearInterval(timer);
  },[busy]);
  const progress = (message:string)=>setWorkflowSteps(list=>list[list.length-1]===publicCopy(message)?list:[...list,publicCopy(message)]);
  useEffect(()=>{
    if(!ready)return;
    let active=true;setAlignmentIds([]);setChatWorkId(undefined);setMessages([]);setDesignDraft(undefined);setGenerated(undefined);
    loadConversation(workId).then(history=>{
      if(!active)return;setMessages(history);setChatWorkId(workId);
      const last=history.filter(m=>m.role!=="error").at(-1);
      if(last?.kind === "plan")setDesignDraft({plan:readPackagingPlan(last.text),brief:last.text,prompt:history.filter(m=>m.role === "user").at(-1)?.text||"继续设计",project:latest.current,whole:latest.current.mode === "warmup",fromFrame:false});
      const art=latest.current.layers.find(l=>l.id === "ai-overlay-art" && l.src && l.visible);
      if(art)setGenerated({src:art.src!,warning:"",canApply:true,applied:true,project:latest.current});
    }).catch(()=>{if(active)setNotice("对话暂时无法恢复，请稍后重试");});
    return()=>{active=false;};
  },[ready,workId]);
  useEffect(()=>{
    if(!ready||chatWorkId!==workId)return;
    saveConversation(workId,messages).catch(()=>setNotice("对话保存失败，请勿关闭页面"));
  },[messages,workId,chatWorkId,ready]);
  useEffect(() => {
    (async () => {
      let recovered: Project | undefined;
      try {
        const old = await load();
        if (old) recovered = restoreTemplateFootage(projectSchema.parse(old));
        const active = await loadActiveId();
        const previousId = active || newLocalId();
        if (recovered) await archiveWork(recovered, previousId);
        if (preset === undefined && recovered) {
          if (old && !("mode" in old)) {
            await save(recovered, "legacy-warmup");
            setLegacy(recovered);
            setP(blankProject(0));
            setNotice(
              "旧版设计已保留在我的作品及暖场备份中，新版进入直播包装。",
            );
          } else {
            setWorkId(previousId);
            setP(projectSchema.parse(recovered));
          }
        }
        setSaved("本地作品已恢复");
      } catch {
        if (recovered) setP(projectSchema.parse(recovered));
        setNotice(
          "作品恢复或备份遇到问题，原设计已尽可能保留，请下载项目备份。",
        );
      } finally {
        setReady(true);
      }
    })();
    readSetting("brand")
      .then((b) => {
        if (b) setBrand(brandSchema.parse(b));
      })
      .catch(() => {});
    load("legacy-warmup")
      .then((old) => {
        if (old) setLegacy(projectSchema.parse(old));
      })
      .catch(() => {});
    fetch("/api/status")
      .then((r) => r.json())
      .then((d: any) => {
        setStatus({ text: !!d.text, image: !!d.image, polyv: !!d.polyv });
        if (d.text && localStorage.getItem("livestyler-ai-mode") !== "demo")
          setReal(true);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!ready) return;
    setSaved("正在保存…");
    const t = setTimeout(
      () =>
        saveWorkspace(p, workId,chatWorkId===workId?messages:undefined)
          .then(() => setSaved("本地已自动保存"))
          .catch(() => setSaved("保存失败，请下载项目备份")),
      700,
    );
    return () => clearTimeout(t);
  }, [p, ready, workId]);
  useEffect(() => {
    setPreviewKind(
      p.scene === 3 ? "商品" : p.scene === 2 ? "共享画面" : "主播",
    );
  }, [p.scene]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 6000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  useEffect(
    () => { end.current?.scrollIntoView({ behavior: "smooth" }); },
    [messages, busy, workflowSteps],
  );
  const commit = (next: Project, key = "") => {
    const prior=latest.current;
    if(prior.mode==="overlay"&&next.mode==="overlay"&&next.footageIndex===prior.footageIndex&&(prior.footageIndex??0)>0){
      const removedBelow=prior.layers.slice(0,prior.footageIndex).filter(l=>!next.layers.some(n=>n.id===l.id)).length;
      if(removedBelow)next={...next,footageIndex:Math.max(0,prior.footageIndex!-removedBelow)};
    }
    if (next.layers.length > 100) {
      setNotice("最多支持100个图层，请先删除不需要的图层");
      return;
    }
    const now = Date.now();
    if (
      !key ||
      historyStamp.current.key !== key ||
      now - historyStamp.current.time > 700
    )
      setPast((x) => [...x.slice(-39), latest.current]);
    historyStamp.current = { key, time: now };
    setFuture([]);
    setP(next);
  };
  const patch = (id: string, c: Partial<Layer>) => {
    const item = latest.current.layers.find((l) => l.id === id);
    if (!item || Object.entries(c).every(([k, v]) => (item as any)[k] === v))
      return;
    commit(
      {
        ...latest.current,
        layers: latest.current.layers.map((l) =>
          l.id === id ? { ...l, ...c } : l,
        ),
      },
      id + ":" + Object.keys(c).sort().join(","),
    );
  };
  const undo = () => {
    historyStamp.current = { key: "", time: 0 };
    if (!past.length) return;
    setFuture((x) => [p, ...x]);
    setP(past[past.length - 1]);
    setPast((x) => x.slice(0, -1));
  };
  const redo = () => {
    historyStamp.current = { key: "", time: 0 };
    if (!future.length) return;
    setPast((x) => [...x, p]);
    setP(future[0]);
    setFuture((x) => x.slice(1));
  };
  const l = p.layers.find((l) => l.id === selected);
  const alignIds=alignmentIds.filter(id=>p.layers.some(l=>l.id===id&&l.visible&&!l.locked));
  function toggleAlign(id:string){setAlignmentIds(ids=>ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]);}
  function arrange(action:Parameters<typeof arrangeLayers>[2]){try{commit(arrangeLayers(p,alignIds,action,alignmentTarget));}catch(e){setNotice((e as Error).message);}}
  const groups = groupsForProject(p);
  const selectedComponent = Object.entries(groups).find(([, ids]) =>
    ids.includes(selected),
  )?.[0];
  function canvasChange(id: string, c: Partial<Layer>) {
    const group = Object.entries(groupsForProject(latest.current)).find(
      ([, ids]) => ids.includes(id),
    )?.[0];
    const item = latest.current.layers.find((l) => l.id === id);
    if (
      linked &&
      group &&
      item &&
      Object.keys(c).every((k) => k === "x" || k === "y")
    ) {
      try {
        commit(
          moveLayers(
            latest.current,
            groupIds(latest.current, group),
            (c.x ?? item.x) - item.x,
            (c.y ?? item.y) - item.y,
          ),
        );
      } catch (e) {
        setNotice((e as Error).message);
      }
    } else patch(id, c);
  }
  const openUpload = (kind: string) => {
    uploadKind.current = kind;
    file.current?.click();
  };
  async function upload(f?: File, strict=false) {
    if (!f) return;
    const kind = uploadKind.current;
    try {
      if (!["image/png", "image/jpeg", "image/webp"].includes(f.type) && !(!f.type && /\.(png|jpe?g|webp)$/i.test(f.name)))
        throw Error("请上传 PNG、JPG 或 WebP 图片");
      if (f.size > 8 * 1024 * 1024) throw Error("单张图片请控制在 8MB 以内");
      const src = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(f);
      });
      const image = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error("图片读取失败，请重新选择 PNG、JPG 或 WebP 图片"));
        i.src = src;
      });
      const current = latest.current;
      const isBg = kind === "background";
      if(kind.startsWith('replace:')){const target=current.layers.find(l=>l.id===kind.slice(8));if(!target||target.type!=='image'||target.locked)throw Error('请先选择未锁定的图片组件');const scale=Math.min(target.width/image.width,target.height/image.height);patch(target.id,{src,width:image.width*scale,height:image.height*scale,x:target.x+(target.width-image.width*scale)/2,y:target.y+(target.height-image.height*scale)/2});setSelected(target.id);setNotice('组件图片已更换');return;}

      if (kind === "preview") {
        const c = document.createElement("canvas");
        c.width = current.width;
        c.height = current.height;
        const scale = Math.max(
          current.width / image.width,
          current.height / image.height,
        );
        c.getContext("2d")!.drawImage(
          image,
          (current.width - image.width * scale) / 2,
          (current.height - image.height * scale) / 2,
          image.width * scale,
          image.height * scale,
        );
        liveCapture.stop();
        setPreviewSrc(c.toDataURL("image/jpeg", 0.88));
        commit({...current,previewImage:c.toDataURL("image/jpeg",0.88)});
        setPreview(true);
        setNotice("参考画面已更新");
        return;
      }
      if (isBg) {
        const c = document.createElement("canvas");
        c.width = current.width;
        c.height = current.height;
        const ctx = c.getContext("2d")!;
        const scale = Math.max(
          current.width / image.width,
          current.height / image.height,
        );
        ctx.drawImage(
          image,
          (current.width - image.width * scale) / 2,
          (current.height - image.height * scale) / 2,
          image.width * scale,
          image.height * scale,
        );
        commit({
          ...current,
          layers: current.layers.map((l) =>
            l.type === "background"
              ? { ...l, src: c.toDataURL("image/png"), opacity: 1 }
              : l,
          ),
        });
        setNotice("背景已替换，按比例填满画布");
      } else {
        const w = Math.min(
            kind === "logo" ? current.width * 0.16 : current.width * 0.4,
            image.width,
          ),
          id = newLocalId();
        commit({
          ...latest.current,
          layers: [
            ...latest.current.layers,
            {
              id,
              name: kind === "logo" ? "Logo" : f.name,
              aspectLocked:true,
              type: "image",
              x: 135,
              y: 90,
              width: w,
              height: (w * image.height) / image.width,
              src,
              fill: "#ffffff",
              visible: true,
              locked: false,
              opacity: 1,
              rotation: 0,
            },
          ],
        });
        setSelected(id);
        setNotice("素材已添加，可拖动或在右侧调整");
      }
    } catch (e) {
      setNotice((e as Error)?.message || "图片插入失败，请重新选择图片");
      if(strict)throw e;
    }
  }
  function add(type: "text" | "shape") {
    const id = newLocalId();
    commit({
      ...p,
      layers: [
        ...p.layers,
        {
          id,
          name: type === "text" ? "新文字" : "矩形",
          type,
          x: 300,
          y: 300,
          width: 500,
          height: 100,
          fill: type === "text" ? "#ffffff" : "#235ff5",
          text: type === "text" ? "在右侧编辑文字" : undefined,
          fontSize: 48,
          opacity: 1,
          locked: false,
          visible: true,
          rotation: 0,
        },
      ],
    });
    setSelected(id);
  }
  async function send() {
    if (!prompt.trim() || busy || chatWorkId!==workId) return;
    if(real&&p.layers.some(l=>l.id===selected&&l.type==="image"&&!!l.src)&&!/^(移动|上移|下移|左移|右移|隐藏|显示|删除|放大|缩小)/.test(prompt)){
      setComponentPrompt(prompt.trim());await reviseComponent(prompt.trim());setPrompt("");return;
    }
    if(real && (designDraft || messages.some(m=>m.kind === "plan")) && !/^(移动|上移|下移|左移|右移|隐藏|显示|删除|放大|缩小)/.test(prompt)) {
      await prepareDesign(p.mode === "warmup",p.mode === "overlay");return;
    }
    if (real && p.mode === "overlay" && (/设计|生成|风格|字体|文字|标题|文案|品牌|价格/.test(prompt) || (p.layers.some(l=>l.id === "ai-overlay-art" && l.visible) && !/^(移动|上移|下移|左移|右移|隐藏|显示|删除|放大|缩小)/.test(prompt)))) {
      await generate(false,true);
      return;
    }
    const q = prompt.trim();
    setPrompt("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      let next: Project;
      if (real) {
        const d = await requestJson("/api/ai", {
          prompt: q,
          project: { ...p, layers: p.layers.map(({ src, ...l }) => l) },
          action: "edit",
          history:conversationContext(messages),
          imageLayerIds: p.layers.filter(l => !!l.src).map(l => l.id),
        });
        next = applyAiResult(p, d);
      } else next = executeCommand(p, q, selected);
      if (latest.current !== p)
        throw Error("设计已发生变化，本次指令未覆盖你的新修改，请重试");
      commit(next);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: real
            ? "已更新，可继续修改。"
            : "已更新画布，可撤销。",
        },
      ]);
    } catch (e) {
      setMessages((m) => [...m, { role: "error", text: (e as Error).message }]);
    } finally {
      setBusy(false);
    }
  }
  async function captureFrame() {
    setPreview(true);progress("正在截取当前预览底图");
    const deadline=Date.now()+5000;
    let frameError="当前预览画面未加载成功，请等待图片显示后重试";
    while(Date.now()<deadline) {
      try {const frame=canvas.current?.capturePreview();if(frame)return frame;}catch(e){frameError=(e as Error).message;}
      await new Promise(r=>setTimeout(r,100));
    }
    throw Error(frameError);
  }
  async function reviseComponent(instruction=componentPrompt){
    const item=latest.current.layers.find(item=>item.id===selected);
    if(busy||!item?.src||item.locked||!instruction.trim())return;
    if(!status.image){setModal("settings");return;}
    const snapshot=latest.current,source=item.src,taskWork=workId;
    setBusy(true);setWorkflowSteps([]);setAnswerPreview("");setComponentCandidate(undefined);
    setMessages(m=>[...m,{role:"user",text:"修改「"+item.name+"」："+instruction.trim()}]);
    try{
      const result=await requestWorkflow<{src:string}>("/api/ai",{action:"component",stream:true,requestId:newLocalId(),prompt:instruction.trim(),referenceImage:source,portrait:item.height>item.width},progress);
      const image=new Image();image.src=result.src;await image.decode();
      const raw=document.createElement("canvas");raw.width=image.naturalWidth;raw.height=image.naturalHeight;const ctx=raw.getContext("2d")!;ctx.drawImage(image,0,0);
      const pixels=ctx.getImageData(0,0,raw.width,raw.height).data;
      let transparent=false,visible=false;for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)transparent=true;if(pixels[i]>0)visible=true;}
      if(!transparent||!visible)throw Error("结果缺少透明背景，请重试；原组件已保留。");
      const boxes=findArtObjects(pixels,raw.width,raw.height),x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y)),right=Math.max(...boxes.map(b=>b.x+b.width)),bottom=Math.max(...boxes.map(b=>b.y+b.height));
      const cropped=document.createElement("canvas");cropped.width=right-x;cropped.height=bottom-y;cropped.getContext("2d")!.drawImage(raw,x,y,right-x,bottom-y,0,0,right-x,bottom-y);
      // Fit within the existing component bounds without stretching, keeping its layer geometry.
      const output=document.createElement("canvas");output.width=Math.max(1,Math.round(item.width));output.height=Math.max(1,Math.round(item.height));const scale=Math.min(output.width/cropped.width,output.height/cropped.height);
      output.getContext("2d")!.drawImage(cropped,(output.width-cropped.width*scale)/2,(output.height-cropped.height*scale)/2,cropped.width*scale,cropped.height*scale);
      if(latest.current!==snapshot)throw Error("画布已变化，原组件已保留，请重新修改。");
      setComponentCandidate({id:item.id,original:source,src:output.toDataURL("image/png"),work:taskWork});
      setMessages(m=>[...m,{role:"assistant",text:"修改预览已准备好，请在右侧确认替换。"}]);
    }catch(e){setNotice((e as Error).message);}finally{setBusy(false);}
  }
  function confirmComponent(){
    const candidate=componentCandidate,current=latest.current;
    const item=current.layers.find(l=>l.id===candidate?.id);
    if(!candidate||candidate.work!==workId||!item||item.locked||item.src!==candidate.original){setNotice("原组件已变化，请重新修改");return;}
    commit(replaceComponent(current,candidate));
    setComponentCandidate(undefined);setComponentPrompt("");setNotice("组件已替换，可撤销");
  }
  async function prepareDesign(whole:boolean,fromFrame:boolean,override?:string,retryBrief=false) {
    if(busy||chatWorkId!==workId)return;
    if(!status.text){setModal("settings");return;}
    const q=(override||prompt.trim() || (p.mode==='warmup'?"结合当前项目主题和已有包装的品牌风格，设计一张完整的开播前活动海报。重新构思主视觉和文字排版，画面满版，不沿用直播贴片布局，不添加未确认的商品卖点或服务承诺。":"根据当前预览画面设计一套含文字的完整直播包装，配色协调，避让重要人物与内容。"))+(p.mode==='overlay'?(p.reservePpt?' 需要预留完整的16:9 PPT课件窗口，课件区域透明且不被包装遮挡，与讲师画面协调布局。':' 不额外预留PPT窗口，保留原画已有课件内容。'):'');
    let partial='';
    const snapshot=p;setAnswerPreview('');setWorkflowSteps([]);setBusy(true);
    setMessages(m=>[...m,{role:"user",text:q}]);
    try {
      const reference=snapshot.mode==='warmup'?snapshot.warmupReference:(fromFrame?await captureFrame():undefined);
      progress("正在拟定方案");
      const d=await requestWorkflow<{brief:string}>("/api/ai",{action:"brief",stream:true,retryBrief,prompt:q,history:conversationContext(messages),project:{...snapshot,layers:snapshot.layers.map(({src,...l})=>l)},...(reference?{referenceImage:reference}:{})},progress,text=>{setAnswerPreview(text);partial=text;});
      await finishPreview(snapshot.mode==='warmup'?d.brief:partial);
      if(latest.current!==snapshot)throw Error("画布已变化，请基于当前画面重新拟定方案");
      const parsed=readPackagingPlan(d.brief),plan=parsed?{...parsed,reservePpt:!!snapshot.reservePpt}:undefined,brief=plan?JSON.stringify(plan):d.brief;
      setMessages(m=>[...m,{role:"assistant",kind:"plan",text:brief}]);
      setDesignDraft({plan,brief,prompt:q,project:snapshot,reference,whole,fromFrame});
      setPrompt("");
    }catch(e){await finishPreview(partial);setMessages(m=>[...m,...(partial?[{role:"assistant" as const,text:"未完成的方案：\n"+partial}]:[]),{role:"error",text:(e as Error).message}]);}
    finally{setBusy(false);}
  }
  async function generate(whole = false, fromFrame = false, approved?:DesignDraft) {
    if (busy) return;
    if(!approved){await prepareDesign(whole,fromFrame);return;}
    if(latest.current!==approved.project){setNotice("画布或保留区已变化，请重新拟定方案再确认生图");return;}
    if(approved.plan){try{compilePackagingPlan(approved.plan,p.width,p.height);}catch{setNotice('请完善所选模块的参数');return;}}
    if(approved.project.mode==='overlay'&&!approved.plan){setNotice('请重新拟定方案并选择包装模块');return;}
    if(approved.plan&&!approved.plan.modules.some(m=>m.selected)){setNotice('请至少选择一个包装模块');return;}
    if(!approved.brief.trim()){setNotice("请先补充设计方案");return;}
    if (!status.image) {
      setModal("settings");
      return;
    }
    setAnswerPreview('');setWorkflowSteps([]);setBusy(true);
    setMessages(m=>{
      const next=[...m];
      const confirmed=approved.plan?JSON.stringify(approved.plan):approved.brief;if(next.filter(item=>item.kind === "plan").at(-1)?.text!==confirmed)next.push({role:"assistant",kind:"plan",text:confirmed});
      next.push({role:"user",kind:"confirmation",text:"确认方案并生成。"});return next;
    });
    try {
      const referenceImage=approved.reference;
      progress("正在准备设计");
      let base = p;
      const d = await requestWorkflow<{ src: string }>("/api/ai", {
        action: "image",stream:true,requestId:newLocalId(),
        prompt: "确认方案并生成。"+approved.prompt+(approved.plan?(approved.plan.reservePpt?' 最终确认：需要预留16:9透明PPT窗口，以确认方案为准。':' 最终确认：不额外预留PPT窗口，以确认方案为准。'):''),
        history: conversationContext(messages),
        designBrief: approved.plan?JSON.stringify(approved.plan):approved.brief,
        portrait: p.height > p.width,
        ...(referenceImage?{referenceImage}:{}),
        project: { ...p, layers: p.layers.map(({ src, ...l }) => l) },
      },progress);
      progress("正在整理设计");
      const image = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error("图片读取失败，请重新选择 PNG、JPG 或 WebP 图片"));
        i.src = d.src;
      });
      if(p.mode==='overlay'){
        const sample=document.createElement('canvas'),scale=Math.min(1,1024/Math.max(image.width,image.height));sample.width=Math.max(1,Math.round(image.width*scale));sample.height=Math.max(1,Math.round(image.height*scale));const ctx=sample.getContext('2d')!;ctx.drawImage(image,0,0,sample.width,sample.height);
        checkOverlayPixels(ctx.getImageData(0,0,sample.width,sample.height).data,sample.width,sample.height,{x:0,y:0,width:sample.width,height:sample.height});
      }
      const c = document.createElement("canvas");
      c.width = p.width;
      c.height = p.height;
      if(p.mode==='overlay') {
        const raw=document.createElement('canvas');raw.width=image.width;raw.height=image.height;
        const ctx=raw.getContext('2d')!;ctx.drawImage(image,0,0);
        const pieces=await splitArtImage(d.src);
        for(const piece of pieces){const art=new Image();art.src=piece.src;await art.decode();const box={x:piece.x*raw.width,y:piece.y*raw.height,width:piece.width*raw.width,height:piece.height*raw.height};const rect=placeOverlayObject(box,raw,p);c.getContext('2d')!.drawImage(art,rect.x,rect.y,rect.width,rect.height);}
      } else {
        const scale=Math.max(p.width/image.width,p.height/image.height);
        c.getContext('2d')!.drawImage(image,(p.width-image.width*scale)/2,(p.height-image.height*scale)/2,image.width*scale,image.height*scale);
      }
      if (latest.current !== p)
        throw Error("设计已发生变化，生成结果未覆盖新修改");
      const resultSrc = c.toDataURL("image/png");
      setDesignDraft(undefined);
      progress("正在更新预览");
      if (p.mode === "overlay") {
        let warning = "", canApply = true;
        try {
          const ctx = c.getContext("2d")!;
          checkOverlayPixels(ctx.getImageData(0,0,p.width,p.height).data,p.width,p.height,safeArea(p));
        } catch(e) {
          warning = (e as Error).message;
          canApply = warning.includes("遮挡");
        }
        let frame = referenceImage;
        if (!frame) try { frame = canvas.current?.capturePreview(); } catch { /* Preview is optional. */ }
        const applied = !warning;
        setGenerated({src:resultSrc,frame,warning,canApply,applied,project:p});
        if (applied) {
          const objects=await splitArtImage(resultSrc);
          if(latest.current!==p)throw Error("设计已变化，请重新生成");
          const next=applyGeneratedObjects(p,resultSrc,objects);commit(next);
          setPreview(true); setSelected(next.layers.find(l=>l.id.startsWith("ai-overlay-art"))?.id||"");
        }
        if(!applied)setModal("generated");
        setMessages(m=>[...m,{role:"assistant",kind:"result",text:applied ? "设计已更新，可继续修改。" : "设计已生成，请查看预览。"}]);
        return;
      } else commit(applyWarmupDesign(base,resultSrc));
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          kind:"result",
          text: whole
            ? "设计已更新，可继续修改。"
            : "设计已更新，可继续修改。",
        },
      ]);
    } catch (e) {
      const message = (e as Error).message || "生成失败，当前设计未被替换";
      setNotice(message);
      setMessages(m => [...m,{role:"error",text:message}]);
    } finally {
      setBusy(false);
    }
  }
  async function exportFile() {
    if (exporting) return;
    setExporting(true);
    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      let ids: string[] | undefined;
      if (exportScope === "text")
        ids = p.layers
          .filter((l) => l.type === "text" && l.visible && l.opacity > 0)
          .map((l) => l.id);
      if (exportScope === "logo")
        ids = p.layers
          .filter(
            (l) =>
              l.name.toLowerCase().includes("logo") &&
              l.visible &&
              l.opacity > 0,
          )
          .map((l) => l.id);
      if (exportScope === "selected") ids = alignIds.length?alignIds:l ? [l.id] : [];
      if (exportScope.startsWith("component:"))
        ids = groupIds(p, exportScope.slice(10));
      if (ids && !ids.length) throw Error("没有可导出的目标图层");
      if (exportType === "zip") {
        const blob=await buildMaterialPackage(
            p,
            (format, ids) => canvas.current!.export(format, ids),
            groups,
            ids,
          );
        setExportReady({url:URL.createObjectURL(blob),name:p.name+'.zip'});
        setNotice('ZIP 已准备好，点击下载 ZIP');
        return;
      } else {
        download(
          p.name + "." + exportType,
          canvas.current!.export(exportType, ids),
        );
      }
      setNotice(
        "已发起下载，请查看浏览器下载列表；参考画面不会导出",
      );
      setModal("");
    } catch (e) {
      setNotice("导出失败：" + (e as Error).message);
    } finally {
      setExporting(false);
    }
  }
  useEffect(()=>{if(modal!=='export')setExportReady(undefined);},[modal]);
  useEffect(()=>{setExportReady(undefined);},[p,exportScope,exportType]);
  useEffect(()=>{return()=>{if(exportReady)setTimeout(()=>URL.revokeObjectURL(exportReady.url),60000);};},[exportReady]);
  const reorder = (delta: number) => {
    const next=reorderLayer(p,selected,delta);if(next!==p)commit(next);
  };

  function changeRatio(ratio: Ratio) {
    const next =
      p.templateStyle?reflowStudioTemplate(p,ratio):p.mode === "overlay" ? reflowOverlay(p, ratio) : resizeProject(p, ratio);
    if (next === p) return;
    commit(next);
    setPreviewSrc(undefined);
    setNotice("画幅已切换；文字、品牌素材和自定义组件已保留，可撤销。");
  }
  async function changeMode(mode: Project["mode"]) {
    if (mode === p.mode||busy||switchingMode) return;
    setSwitchingMode(true);
    try {
      await saveWorkspace(p, workId,chatWorkId===workId?messages:undefined);
      const previous=await pairedWork(workId,mode);
      const next=previous?.project||(p.templateStyle?companionTemplate(p):blankProject(p.scene,p.height>p.width?"portrait":"landscape",mode));
      const nextId=previous?.id||newLocalId();
      if(mode==='warmup'){
        if(!previous)next.name=p.name;
        try{next.warmupReference=canvas.current?.captureComposition()||next.warmupReference;}catch{}
        next.warmupContext=JSON.stringify({theme:p.name,previousPlan:messages.filter(m=>m.kind==='plan').at(-1)?.text,copy:p.layers.filter(l=>l.type==='text').map(l=>l.text)}).slice(0,12000);
      }
      await saveWorkspace(next,nextId);
      await pairWorks({id:workId,mode:p.mode},{id:nextId,mode});
      setWorkId(nextId);setP(next);setEditingFootage(false);
      setPast([]);
      setFuture([]);
      historyStamp.current = { key: "", time: 0 };
      setSelected("");
      setPreviewSrc(undefined);
      setNotice(previous?'已恢复'+(mode==='overlay'?'直播包装':'暖场画面'):'已创建'+(mode==='overlay'?'直播包装':'暖场画面')+'，可随时切回');
    } catch {
      setNotice("原作品保存失败，设计用途保持不变，请先下载备份。");
    }finally{setSwitchingMode(false);}
  }
  async function openWorks() {
    try {
      if(chatWorkId===workId)await saveConversation(workId,messages);
      await saveWorkspace(p, workId);
      setWorks(await listWorks());
      setModal("works");
    } catch {
      setNotice("作品列表无法读取，请下载项目备份");
    }
  }
  async function saveCurrentWork(){try{await saveWorkspace(latest.current,workId,chatWorkId===workId?messages:undefined);setSaved('已保存到本地');setNotice('完整画面与图层已保存到本地作品');}catch{setSaved('本地保存失败');setNotice('保存失败，请下载项目备份');}}
  async function openCloudWork(project:Project,history:Msg[],cloudId:string,companion?:WorkCompanion){
    try{const checked=projectSchema.parse(project);await saveWorkspace(latest.current,workId,chatWorkId===workId?messages:undefined);const id=cloudId.startsWith('work-')?cloudId.slice(5):cloudId;await restoreCloudWorkspace(checked,id,history,companion);setMessages(history);setChatWorkId(id);setDesignDraft(undefined);setGenerated(undefined);setWorkId(id);setP(checked);setTab('助手');setPast([]);setFuture([]);setSelected('');setPreviewSrc(undefined);setModal('');setNotice(companion?'整套作品与历史对话已恢复':'云端作品已打开，完整图层已恢复');}catch{setNotice('打开失败，当前作品已保留');}
  }
  async function openWork(w: SavedWork) {
    if(w.id === workId){setTab('助手');setModal("");return;}
    try {
      if(chatWorkId===workId)await saveConversation(workId,messages);
      await saveWorkspace(p, workId);
      setP(restoreTemplateFootage(projectSchema.parse(w.project)));
      setWorkId(w.id);
      setTab('助手');
      setPast([]);
      setFuture([]);
      historyStamp.current = { key: "", time: 0 };
      setSelected("");
      setPreviewSrc(undefined);
      setModal("");
      setNotice("已打开 " + w.project.name);
    } catch {
      setNotice("打开作品失败，原设计保持不变");
    }
  }
  async function copyWork(w: SavedWork) {
    try {
      if(chatWorkId===workId)await saveConversation(workId,messages);
      await saveWorkspace(p, workId);
      const project = { ...w.project, name: (w.project.name + " 副本").slice(0,100) };
      const id = newLocalId();
      await saveWorkspace(project, id);
      await saveConversation(id,await loadConversation(w.id));
      setWorkId(id);
      setP(project);
      setPast([]);
      setFuture([]);
      historyStamp.current = { key: "", time: 0 };
      setSelected("");
      setPreviewSrc(undefined);
      setModal("");
      setNotice("已创建独立副本");
    } catch {
      setNotice("复制失败");
    }
  }
  async function removeWork(w: SavedWork) {
    if (w.id === workId) return;
    try {
      await deleteWork(w.id);
      setWorks(await listWorks());
      setNotice("已删除 " + w.project.name);
    } catch {
      setNotice("删除失败");
    }
  }
  async function newWork() {
    try {
      if(chatWorkId===workId)await saveConversation(workId,messages);
      await saveWorkspace(p, workId);
      setWorkId(newLocalId());
      setP(
        blankProject(
          p.scene,
          p.height > p.width ? "portrait" : "landscape",
          p.mode,
        ),
      );
      setPast([]);
      setFuture([]);
      historyStamp.current = { key: "", time: 0 };
      setSelected("");
      setPreviewSrc(undefined);
      setModal("");
      setNotice("已新建作品，上一份设计保留在我的作品中");
    } catch {
      setNotice("当前作品保存失败，请先下载项目备份");
    }
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing =
        (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)&&!(el instanceof HTMLInputElement&&el.type==='checkbox')) ||
        el.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveCurrentWork();
        return;
      }
      if (typing&&!(el.tagName==='SELECT'&&(e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase()))) return;
      if (e.key === "Escape") {
        setModal("");
        setSelected("");setAlignmentIds([]);setEditingFootage(false);
        return;
      }
      if (modal) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      const multi=p.layers.filter(l=>alignmentIds.includes(l.id)&&l.visible&&!l.locked);
      if(multi.length){
        if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
          e.preventDefault();const n=e.shiftKey?10:1;try{commit(moveLayers(p,multi.map(l=>l.id),e.key==='ArrowLeft'?-n:e.key==='ArrowRight'?n:0,e.key==='ArrowUp'?-n:e.key==='ArrowDown'?n:0));}catch(e){setNotice((e as Error).message);}return;
        }
        if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();const ids=multi.filter(l=>l.type!=='background').map(l=>l.id);commit({...p,layers:p.layers.filter(l=>!ids.includes(l.id))});setAlignmentIds([]);setSelected('');return;}
        if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){
          e.preventDefault();if(p.layers.length+multi.length>100){setNotice('最多保留100个图层，请先精简设计');return;}
          const copies=multi.map(item=>({...item,id:newLocalId(),name:(item.name+' 副本').slice(0,100),groupId:undefined,groupName:undefined,x:item.x+20,y:item.y+20}));commit({...p,layers:[...p.layers,...copies]});setAlignmentIds(copies.map(l=>l.id));setSelected(copies[0].id);return;
        }
      }
      if(selected==="__footage"&&p.footageLocked===false&&["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)){
        e.preventDefault();const n=e.shiftKey?10:1,t={x:0,y:0,scale:1,...p.footageTransform};
        t.x+=(e.key==="ArrowLeft"?-n:e.key==="ArrowRight"?n:0)/p.width;t.y+=(e.key==="ArrowUp"?-n:e.key==="ArrowDown"?n:0)/p.height;
        t.x=Math.max(-2,Math.min(2,t.x));t.y=Math.max(-2,Math.min(2,t.y));commit({...p,footageTransform:t});return;
      }
      const item = p.layers.find((x) => x.id === selected);
      if (!item || item.locked) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        const id = newLocalId();
        commit({
          ...p,
          layers: [
            ...p.layers,
            {
              ...item,
              id,
              name: item.name + " 副本",
              groupId: undefined,
              groupName: undefined,
              x: item.x + 20,
              y: item.y + 20,
            },
          ],
        });
        setSelected(id);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (item.type !== "background") {
          commit({ ...p, layers: p.layers.filter((x) => x.id !== selected) });
          setSelected("");
        }
        return;
      }
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        const n = e.shiftKey ? 10 : 1;
        try {
          commit(
            moveLayers(
              p,
              linked && selectedComponent
                ? groupIds(p, selectedComponent)
                : [selected],
              e.key === "ArrowLeft" ? -n : e.key === "ArrowRight" ? n : 0,
              e.key === "ArrowUp" ? -n : e.key === "ArrowDown" ? n : 0,
            ),
          );
        } catch {}
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [p, selected, alignmentIds, past, future, modal, workId, linked, messages, chatWorkId]);
  return (
    <div className="studio">
      <header className="studiohead">
        <button className="icon" onClick={home} title="返回首页">
          <ArrowLeft size={18} />
        </button>
        <button className="brand studioBrand brand-home" onClick={home} aria-label="LiveStyler 返回首页"><img className="studio-mascot" src="/brand/mascot.webp" alt="" /><img className="brand-logo" src="/brand/wordmark.webp" alt="LiveStyler" /></button>
        <span className="divider" />
        <input
          className="projectname"
          value={p.name}
          onBlur={() => {
            if (!p.name.trim()) commit({ ...p, name: "未命名直播包装" });
          }}
          maxLength={100}
          onChange={(e) =>
            commit({ ...p, name: e.target.value }, "project-name")
          }
        />
        <span className="savestate">
          <Check size={13} />
          {saved}
        </span>
        <div className="headtools">
          <button
            className="icon"
            onClick={undo}
            disabled={!past.length}
            title="撤销"
          >
            <Undo2 size={18} />
          </button>
          <button
            className="icon"
            onClick={redo}
            disabled={!future.length}
            title="重做"
          >
            <Redo2 size={18} />
          </button>
          <button onClick={openWorks}>
            <FolderOpen size={16} />
            <span>我的作品</span>
          </button>
          <button
            className="icon"
            onClick={saveCurrentWork}
            title="保存到本地作品"
          >
            <Save size={18} />
          </button>
          <button onClick={() => setModal("channel")}>
            <Link size={16} />
            <span>配置到频道</span>
          </button>
          <button onClick={()=>setModal("assets")}>账号素材库</button>
          <button
            className="primary"
            onClick={() => {
              setExportType("png");
              setModal("export");
            }}
          >
            <Download size={16} />
            导出素材
          </button>
        </div>
      </header>
      <div className="workgrid">
        <aside className="assistant">
          <div className="projectsetup">
            <label>
              设计用途
              <select
                disabled={busy||switchingMode}
                value={p.mode}
                onChange={(e) => changeMode(e.target.value as Project["mode"])}
              >
                <option value="overlay">直播画面包装</option>
                <option value="warmup">开场／暖场画面</option>
              </select>
            </label>
            <div className="ratiobuttons">
              <button
                className={p.width > p.height ? "active" : ""}
                onClick={() => changeRatio("landscape")}
              >
                16:9 横屏
              </button>
              <button
                className={p.height > p.width ? "active" : ""}
                onClick={() => changeRatio("portrait")}
              >
                9:16 竖屏
              </button>
            </div>
          </div>
          <div className="lefttabs">
            {["助手", "模板", "组件", "素材"].map((t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t === "助手" ? (
                  <Sparkles size={16} />
                ) : t === "模板" ? (
                  <Layers size={16} />
                ) : (
                  <ImageIcon size={16} />
                )}{" "}
                {t}
              </button>
            ))}
          </div>
          {tab === "助手" ? (
            <>
              <div className="chatbody">
                
                {messages.length===0 && <><div className="assistantintro">
                  <div className="assistant-eyes"><BrandEyes compact /></div>
                  <h2>设计你的直播间</h2>
                  <p>
                    描述需求，让 AI 为你设计。
                  </p>
                </div>
                <div className="suggestions">
                  <span>试试这样修改</span>
                  {[
                    "标题改成春季新品直播",
                    "姓名条移到右下角",
                    "隐藏底部信息条",
                    "标题改成2027 AI创新大会",
                  ].map((q) => (
                    <button key={q} onClick={() => setPrompt(q)}>
                      {q}
                      <ArrowUp size={13} />
                    </button>
                  ))}
                </div>
                </>}
                {messages.map((m, i) => (
                  <div key={i} className={"msg " + m.role}>
                    {m.role === "assistant" && <Sparkles size={14} />}
                    <div>{readPackagingPlan(m.text)?<details className="history-plan"><summary>设计方案 · {readPackagingPlan(m.text)!.scene.type}</summary><pre>{summarizePlan(readPackagingPlan(m.text)!,p.width,p.height)}</pre></details>:<span>{m.role==="user"?m.text:publicCopy(m.text)}</span>}
                    {m.role==="error"&&/方案/.test(m.text)&&<button className="chat-result-link" disabled={busy} onClick={()=>prepareDesign(p.mode==="warmup",p.mode==="overlay",undefined,true)}>重新生成方案</button>}
                    {m.kind === "result" && generated && i===messages.findLastIndex(item=>item.kind === "result") && <button className="chat-result-link" onClick={()=>setModal("generated")}>查看结果</button>}</div>
                  </div>
                ))}
                {designDraft && !busy && <div className="design-draft">
                  <h3>方案已准备好</h3>
                  {designDraft.plan&&<div className="packaging-plan"><label>直播场景<input aria-label="直播场景" list="scene-categories" value={designDraft.plan.scene.type} maxLength={200} onChange={e=>setDesignDraft({...designDraft,plan:{...designDraft.plan!,scene:{...designDraft.plan!.scene,type:e.target.value}}})}/></label><datalist id="scene-categories">{["科技发布会","企业年会","教育培训","美妆电商直播","服装电商直播","食品电商直播","会议访谈","通用直播"].map(scene=><option key={scene} value={scene}/>)}</datalist><button disabled={busy} onClick={()=>prepareDesign(designDraft.whole,designDraft.fromFrame,"按"+designDraft.plan!.scene.type+"场景重新分析当前画面并推荐贴片。"+designDraft.prompt)}>按此场景重新推荐</button><details className="final-design-prompt"><summary>查看最终提示词</summary><pre>{previewPackagingPlan(designDraft.plan,p.width,p.height)}</pre></details><details><summary>画面分析</summary><dl>{Object.entries(designDraft.plan.scene).map(([key,value])=><div key={key}><dt>{({type:'直播类型',subjects:'画面主体',environment:'背景与光线',colors:'主色调',style:'画面风格',ratio:'原始比例',safeAreas:'安全区域',existingElements:'已有元素'} as Record<string,string>)[key]}</dt><dd>{value}</dd></div>)}</dl></details><h4>{designDraft.plan.theme}</h4><p>{designDraft.plan.style} · {designDraft.plan.colors}</p><h4>选择包装模块</h4>{designDraft.plan.modules.map((module,index)=><div className="packaging-module" key={module.id}><label><input type="checkbox" checked={module.selected} onChange={e=>{const plan={...designDraft.plan!,modules:designDraft.plan!.modules.map((m,i)=>i===index?{...m,selected:e.target.checked}:m)};setDesignDraft({...designDraft,plan});}}/>{module.name}{module.recommended&&<small>推荐</small>}</label><p>{module.purpose}</p>{!module.selected&&module.text&&<p>{module.text}</p>}{module.selected&&<div>{(['name','text','position'] as const).map(key=><label key={key}>{({name:'名称',text:'文字',position:'位置',style:'样式',size:'大小与层级',color:'颜色'})[key]}<input type="text" value={module[key]} placeholder={key==="position"?"留空，由 AI 自主布局":undefined} maxLength={key==='text'?200:350} onChange={e=>{const plan={...designDraft.plan!,modules:designDraft.plan!.modules.map((m,i)=>i===index?{...m,[key]:e.target.value,...(key==="position"?{positionExplicit:true}:{})}:m)};setDesignDraft({...designDraft,plan});}}/></label>)}</div>}</div>)}<button className="wide" onClick={()=>{const plan=designDraft.plan!;if(plan.modules.length>=20)return;setDesignDraft({...designDraft,plan:{...plan,modules:[...plan.modules,{id:"custom-"+Date.now(),name:"自定义贴片",purpose:"补充信息",position:"",style:"与整体包装协调",color:"#808080",text:"",size:"自主安排",recommended:false,selected:true}]}});}}>＋ 添加贴片</button>{designDraft.plan.questions.map(q=><p key={q}>可补充：{q}</p>)}</div>}
                  {!designDraft.plan&&<details><summary>编辑方案</summary><textarea aria-label="可修改的AI设计方案" value={designDraft.brief} maxLength={6000} onChange={e=>setDesignDraft({...designDraft,brief:e.target.value})}/></details>}
                  <small>可补充信息，也可直接生成。</small>
                  <button className="primary wide" disabled={busy||!designDraft.brief.trim()||p!==designDraft.project||!!designDraft.plan&&!designDraft.plan.modules.some(m=>m.selected)} onClick={()=>generate(designDraft.whole,designDraft.fromFrame,designDraft)}>确认方案并生成</button>
                  {p!==designDraft.project&&<small>画布已变化，请重新拟定方案。</small>}
                  <button className="wide" disabled={busy} onClick={()=>document.querySelector<HTMLTextAreaElement>(".composer textarea")?.focus()}>补充信息</button>
                </div>}
                {busy && (
                  <div className="msg">
                    <Loader2 className="spin" size={16} />
                    <div><b>{workflowSteps[workflowSteps.length-1]||"正在处理请求"}</b><br/><small>已用时 {Math.floor(elapsed/60)} 分 {elapsed%60} 秒</small>
                    {answerPreview&&<pre ref={answerElement} onScroll={e=>{const el=e.currentTarget;followAnswer.current=el.scrollHeight-el.scrollTop-el.clientHeight<40;}} className="answer-preview typing-preview" aria-live="polite">{answerPreview}<span className="typing-caret" aria-hidden="true"/></pre>}
                    {workflowSteps.length>1&&<ol style={{paddingLeft:18,margin:"6px 0",fontSize:11}}>{workflowSteps.slice(0,-1).map((step,i)=><li key={i}>{step}</li>)}</ol>}</div>
                  </div>
                )}
                <div ref={end} />
              </div>
              <div className="composer">
                {p.mode==='overlay'&&<label className="ppt-reserve-option"><input type="checkbox" disabled={busy} checked={!!p.reservePpt} onChange={e=>{const next={...p,reservePpt:e.target.checked};commit(next);if(designDraft?.project===p&&designDraft.plan)setDesignDraft({...designDraft,project:next,plan:{...designDraft.plan,reservePpt:e.target.checked}});}}/>预留 PPT / 课件位置</label>}
                <button
                  className="designbutton"
                  disabled={busy}
                  onClick={() =>
                    p.mode === "warmup" ? generate(true) : generate(false,true)
                  }
                >
                  <Sparkles size={14} />
                  {p.mode === "overlay"
                    ? "生成设计方案"
                    : "生成暖场方案"}
                </button>
                <textarea
                  value={prompt}
                  maxLength={2000}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  aria-label="设计需求"
                  placeholder="补充需求，或告诉我想修改哪里…"
                />
                <div className="composer-actions"><button className="primary composer-send" disabled={busy||!prompt.trim()||chatWorkId!==workId} onClick={()=>send()} aria-label="发送需求"><ArrowUp size={16}/>发送</button></div>
              </div>
            </>
          ) : tab === "组件" ? (
            <div className="componentpanel">
              <h3>直播包装组件</h3>
              <p>整组显示或隐藏；新增组件均可独立编辑。</p>
              <button className="wide" onClick={()=>openUpload('logo')}>＋ 上传 Logo / 图片组件</button>
              {Object.keys(groups).map((name) => {
                const ids = groupIds(p, name),
                  visible = p.layers.some(
                    (l) => ids.includes(l.id) && l.visible,
                  );
                return (
                  <div className="componentrow" key={name}>
                    <button className="component-select" onClick={()=>setSelected(ids[0])}>{ids.length===1&&p.layers.find(l=>l.id===ids[0])?.src&&<img src={p.layers.find(l=>l.id===ids[0])!.src} alt=""/>}{name}</button>
                    {ids.length===1&&p.layers.find(l=>l.id===ids[0])?.type==='image'&&<button disabled={!!p.layers.find(l=>l.id===ids[0])?.locked} onClick={()=>openUpload('replace:'+ids[0])}>更换</button>}
                    <button
                      className="icon"
                      title="复制整组组件"
                      onClick={() => {
                        try {
                          commit(duplicateComponent(p, name));
                          setNotice("已复制整组组件，文字与底板保持关联");
                        } catch (e) {
                          setNotice((e as Error).message);
                        }
                      }}
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      disabled={!ids.length}
                      onClick={() => {
                        commit(toggleComponent(p, name, !visible));
                        setNotice(
                          visible ? "已隐藏整组组件" : "已显示整组组件",
                        );
                      }}
                    >
                      {visible ? <Eye size={14} /> : <EyeOff size={14} />}{" "}
                      {visible ? "隐藏" : "显示"}
                    </button>
                  </div>
                );
              })}
              <h4>添加组件</h4>
              {(
                [
                  ["name", "嘉宾姓名条"],
                  ["badge", "直播角标"],
                  ["notice", "底部公告条"],
                  ["product", "商品信息卡"],
                ] as const
              ).map(([kind, label]) => (
                <button
                  className="wide"
                  key={kind}
                  onClick={() => {
                    try {
                      const next = addComponent(p, kind);
                      commit(next);
                      setSelected(next.layers[next.layers.length - 1].id);
                    } catch (e) {
                      setNotice((e as Error).message);
                    }
                  }}
                >
                  <Plus size={15} />
                  {label}
                </button>
              ))}
              <button
                className="wide"
                onClick={() => {
                  setChecked(true);
                  setNotice(
                    inspection(p).length
                      ? "发现需要检查的地方，请查看画布下方"
                      : "检查通过：未发现遮挡保留区、越界或文字尺寸问题",
                  );
                }}
              >
                <Check size={15} />
                检查当前布局
              </button>
            </div>
          ) : tab === "模板" ? (
            <div className="templatepanel">
              <h3>
                {p.mode === "overlay" ? "直播包装模板" : "开场／暖场模板"}
              </h3>
              <p>
                选择模板，开始设计。
              </p>
              {legacy && (
                <button
                  className="legacybutton"
                  onClick={() => {
                    commit(legacy);
                    setNotice("已打开旧版设计，归类为开场／暖场");
                  }}
                >
                  打开已保留的旧版设计
                </button>
              )}
              {styles.map((s, i) => (
                <button
                  key={s.name}
                  onClick={() => {
                    const vertical=p.height>p.width,next=studioTemplate(i,vertical?'portrait':'landscape',p.mode);
                    commit(next);setPreviewSrc(undefined);setSelected('');
                    setNotice("已使用" + s.name + "模板");
                  }}
                >
                  <TemplateThumb
                    index={i}
                    vertical={p.height > p.width}
                    mode={p.mode}
                  />
                  <span>
                    {s.name}
                    <ArrowUp size={14} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="assetpanel">
              <h3>品牌素材</h3>
              <p>上传品牌素材，并把常用配置保存下来复用。</p>
              <BrandPanel
                kit={brand}
                onChange={setBrand}
                onCapture={() => {
                  setBrand(brandFromProject(p));
                  setNotice("已提取当前品牌名、强调色及Logo，点击保存即可复用");
                }}
                onSave={async () => {
                  try {
                    await writeSetting("brand", brandSchema.parse(brand));
                    setNotice("品牌配置已保存");
                  } catch {
                    setNotice("保存失败，请填写品牌名和有效颜色");
                  }
                }}
                onApply={() => {
                  try {
                    commit(applyBrand(p, brand));
                    setNotice("品牌配置已应用，不改变其他文字和内容布局");
                  } catch (e) {
                    setNotice((e as Error).message);
                  }
                }}
              />
              <button onClick={() => openUpload("logo")}>
                <Upload size={22} />
                <b>上传品牌 Logo</b>
                <small>PNG 透明底效果更佳</small>
              </button>
              <button
                onClick={() =>
                  openUpload(p.mode === "overlay" ? "preview" : "background")
                }
              >
                <ImageIcon size={22} />
                <b>
                  {p.mode === "overlay" ? "放入直播参考图" : "替换暖场背景"}
                </b>
                <small>
                  {p.mode === "overlay"
                    ? "更换参考画面"
                    : "按当前画幅等比例填满"}
                </small>
              </button>
              <button onClick={() => openUpload("image")}>
                <Plus size={22} />
                <b>添加图片素材</b>
                <small>PNG / JPG / WebP，最大 8MB</small>
              </button>
              <button
                className="flat"
                onClick={() => importer.current?.click()}
              >
                <FolderOpen size={18} />
                打开项目文件
              </button>
              <button
                className="flat"
                onClick={() =>
                  download(
                    p.name + ".livestyler.json",
                    new Blob([JSON.stringify(p)], { type: "application/json" }),
                  )
                }
              >
                <Download size={18} />
                下载可编辑项目
              </button>
            </div>
          )}
        </aside>
        <section
          className={"canvasarea " + (draggingFile ? "filehover" : "")}
          onDragOver={(e) => {
            if (Array.from(e.dataTransfer.types).includes("Files")) {
              e.preventDefault();
              setDraggingFile(true);
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node))
              setDraggingFile(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDraggingFile(false);
            const f = e.dataTransfer.files?.[0];
            if (f) {
              uploadKind.current = "image";
              upload(f);
              if (e.dataTransfer.files.length > 1)
                setNotice("每次拖入一张素材，避免误覆盖；其余图片可继续添加");
            }
          }}
        >
          <div className="canvasbar">
            <span>
              <Monitor size={15} />
              {p.mode === "overlay" ? "直播画面包装" : "开场／暖场"}
              <span className="muted">
                / {p.width} × {p.height}
              </span>
            </span>
            <span className="tinybadge">
              {p.mode === "overlay" ? "透明包装层" : "完整画面"}
            </span>
          </div>
          <div className="previewbar">
            <button
              className={linked ? "active" : ""}
              onClick={() => setLinked(!linked)}
              title="拖动已知组件时让底板与文字一起移动"
            >
              <Link size={13} />
              {linked ? "组件联动" : "独立移动"}
            </button>
            {p.mode === "overlay" && (
              <>
                <button
                  className={preview ? "active" : ""}
                  onClick={() => setPreview(!preview)}
                >
                  <Eye size={14} />
                  {preview ? "隐藏直播预览" : "显示直播预览"}
                </button>
                <select
                  aria-label="直播预览类型"
                  value={previewKind}
                  onChange={(e) => {
                    liveCapture.stop();
                    setPreviewKind(e.target.value);
                    setPreviewSrc(undefined);
                    setPreview(true);
                  }}
                >
                  <option>主播</option>
                  <option>商品</option>
                  <option>共享画面</option>
                </select>
                <button
                  className={p.protectedAreaEnabled ? "active" : ""}
                  onClick={() => {commit({...p,protectedAreaEnabled:!p.protectedAreaEnabled});setGuides(!p.protectedAreaEnabled);}}
                >
                  保留区
                </button>
                <button onClick={()=>{if(drawingArea)setDrawingArea(false);else setModal("protected");}}>{drawingArea?"完成框选":"保留区设置"}</button>
                <button disabled={liveCapture.pending} className={liveCapture.kind==="screen"?"active":""} onClick={()=>connectCapture("screen")}>共享窗口</button>
                <button disabled={liveCapture.pending} className={liveCapture.kind==="camera"?"active":""} onClick={()=>{setCameraPanel(v=>!v);void liveCapture.refreshCameras();}}>摄像头</button>
                {liveCapture.video&&<button onClick={()=>liveCapture.stop()}>断开画面</button>}
                <button className={editingFootage?"active":""} onClick={()=>{setEditingFootage(p.footageLocked===false);setSelected("__footage");setPreview(true);}}>调整原画</button>
                <button onClick={() => openUpload("preview")}>参考图</button>
                {liveCapture.pending&&<span className="capturestatus" role="status">正在连接…</span>}
                {liveCapture.video&&<span className="capturestatus" role="status"><i/>{liveCapture.kind==="screen"?"窗口已连接":"摄像头已连接"}</span>}
              </>
            )}
          </div>
          {cameraPanel&&<div className="camera-picker"><label>摄像头设备<select aria-label="摄像头设备" disabled={liveCapture.pending} value={chosenCamera} onChange={e=>setChosenCamera(e.target.value)}><option value="">系统默认摄像头</option>{chosenCamera&&!liveCapture.cameras.some(c=>c.deviceId===chosenCamera)&&<option value={chosenCamera}>设备已断开，请重新选择</option>}{liveCapture.cameras.map(c=><option key={c.deviceId} value={c.deviceId}>{c.label}</option>)}</select></label><button disabled={liveCapture.pending} onClick={()=>{setPreview(true);void liveCapture.start('camera',chosenCamera);}}>{liveCapture.pending?'正在连接…':liveCapture.kind==='camera'?'切换摄像头':'连接摄像头'}</button><button disabled={liveCapture.pending} onClick={()=>liveCapture.refreshCameras()}>刷新设备</button>{liveCapture.deviceError&&<small role="status">{liveCapture.deviceError}</small>}</div>}
          {liveCapture.issue&&<div className="capture-help" role="alert">
            <div><strong>{liveCapture.issue.title}</strong><p>{liveCapture.issue.help}</p>
              <details><summary>诊断信息</summary><span>{liveCapture.issue.code}{liveCapture.issue.detail?" · "+liveCapture.issue.detail:""}</span></details>
            </div>
            <div className="capture-help-actions">
              <button disabled={liveCapture.pending} onClick={()=>connectCapture(liveCapture.issue!.source)}>重试连接</button>
              <a href="/" target="_blank" rel="noopener noreferrer">在独立窗口打开 ↗</a>
              <button onClick={()=>{liveCapture.clearIssue();openUpload("preview");}}>使用参考图</button>
              <button aria-label="关闭连接提示" onClick={liveCapture.clearIssue}>×</button>
            </div>
          </div>}
          <div className="stagearea">

            <Canvas
              ref={canvas}
              project={p}
              selected={selected}
              alignmentIds={alignIds}
              select={id=>{setSelected(id);setAlignmentIds([]);setEditingFootage(id==="__footage"&&p.footageLocked===false);}}
              change={canvasChange}
              editingFootage={editingFootage}
              onFootageChange={t=>commit({...latest.current,footageTransform:t})}
              preview={preview}
              guides={guides}
              drawingArea={drawingArea}
              onAreaChange={area=>commit({...latest.current,protectedAreaEnabled:true,protectedArea:clampArea(area,latest.current)})}
              previewKind={previewKind}
              previewSrc={previewSrc||p.previewImage}
              liveVideo={liveCapture.video}
              onEditText={(id) => {
                setSelected(id);
                requestAnimationFrame(() => {
                  const el =
                    document.querySelector<HTMLTextAreaElement>(
                      ".fields textarea",
                    );
                  el?.focus();
                  el?.select();
                });
              }}
            />
            <div className="canvasunder">
              <details className="shortcut-help"><summary>快捷键</summary><div><p>画面：滚轮 / ＋ / − 缩放；0 适合窗口；空格＋拖动 / 鼠标中键拖动 平移</p><p>图层：拖动移动；边框控制点缩放；Shift＋拖动 单轴吸附；方向键移动 1 px；Shift＋方向键移动 10 px</p><p>编辑：Ctrl / ⌘＋Z 撤销；Ctrl / ⌘＋Shift＋Z 或 Ctrl＋Y 重做；Ctrl / ⌘＋D 复制；Delete / Backspace 删除；Esc 取消选择</p><p>保存：Ctrl / ⌘＋S；数值：左右拖动调整，Shift 加速 / Alt 精调；输入：Enter 发送，Shift＋Enter 换行</p></div></details>
              <button
                className="fullscreenbutton"
                onClick={async () => {
                  try {
                    const el =
                      document.querySelector<HTMLElement>(".canvasarea");
                    if (document.fullscreenElement)
                      await document.exitFullscreen();
                    else await el?.requestFullscreen();
                  } catch {
                    setNotice("当前浏览器不支持全屏预览");
                  }
                }}
              >
                全屏预览 <Maximize2 size={13} />
              </button>
            </div>
          </div>
          <div className="quicktools">
            <button onClick={clearPackaging}>清空包装</button>{p.layers.some(l=>l.id===selected&&l.type==='image'&&!l.locked)&&<button onClick={splitSelectedArt}>拆分物件</button>}
            <button onClick={() => add("text")}>
              <Type size={18} />
              文字
            </button>
            <button onClick={() => openUpload("image")}>
              <ImageIcon size={18} />
              图片
            </button>
            <button onClick={() => add("shape")}>
              <Square size={17} />
              形状
            </button>
            <span />
            <button onClick={newWork}>
              <Plus size={17} />
              新建
            </button>
            <button onClick={openWorks}>
              <FolderOpen size={17} />
              作品
            </button>
          </div>
          <div className="layoutcheck">
            <button onClick={() => setChecked(!checked)}>
              <Check size={13} />
              布局检查{" "}
              {inspection(p).length
                ? `· ${inspection(p).length}项提示`
                : "· 正常"}
            </button>
            {checked && (
              <div>
                {inspection(p).length ? (
                  inspection(p).map((s, i) => <p key={i}>{s}</p>)
                ) : (
                  <p>
                    未发现明显越界或遮挡。请结合实际主播画面确认字幕和人脸位置。
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="canvasfoot">
            <span>
              <span className="statusdot" />
              所有设计在当前浏览器中保存
            </span>

          </div>
        </section>
        <aside className="properties">
          <div className="panelheading">
            <Layers size={16} />
            图层<span>{p.layers.length+(p.mode==="overlay"?1:0)}</span>
          </div>
          <div className="layerlist">

            {layerStack(p).reverse().map((item) => !item ? (<div key="__footage" className={"layerrow "+(selected==="__footage"?"chosen":"")}><button className="layerselect" onClick={()=>{setSelected("__footage");setEditingFootage(p.footageLocked===false);setPreview(true);}}><ImageIcon size={15}/><span>原始画面</span></button><button className="icon" title="显示或隐藏原始画面" onClick={()=>setPreview(v=>!v)}>{preview?<Eye size={13}/>:<EyeOff size={13}/>}</button><button className="icon" title={p.footageLocked!==false?"解锁原始画面":"锁定原始画面"} onClick={()=>{const locked=p.footageLocked===false;commit({...p,footageLocked:locked});setEditingFootage(!locked&&selected==="__footage");}}>{p.footageLocked!==false?<Lock size={12}/>:<Unlock size={12}/>}</button></div>) : (
              <div
                key={item.id}
                className={"layerrow " + (selected === item.id ? "chosen" : "")}
              >
                <input type="checkbox" aria-label={'选择对齐图层 '+item.name} disabled={item.locked||!item.visible} checked={alignIds.includes(item.id)} onChange={()=>toggleAlign(item.id)}/>
                <button
                  className="layerselect"
                  onClick={e => {if(e.ctrlKey||e.metaKey){toggleAlign(item.id);}else{setAlignmentIds([]);setSelected(item.id);}setEditingFootage(false);}}
                >
                  {item.type === "text" ? (
                    <Type size={15} />
                  ) : item.type === "shape" ? (
                    <Square size={15} />
                  ) : (
                    <ImageIcon size={15} />
                  )}
                  <span>{item.name}</span>
                </button>
                <button
                  className="icon"
                  title="显示或隐藏"
                  onClick={() => patch(item.id, { visible: !item.visible })}
                >
                  {item.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
                <button
                  className="icon"
                  title="锁定或解锁"
                  onClick={() => patch(item.id, { locked: !item.locked })}
                >
                  {item.locked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>
              </div>
            ))}
          </div>
          <div className="panelheading">
            {selectedComponent && linked
              ? selectedComponent + " · 联动移动"
              : "图层属性"}
            {l && <span>{l.type.toUpperCase()}</span>}
          </div>
          {alignIds.length>0&&<section className="multi-align"><header>对齐 · 已选 {alignIds.length} 层<button onClick={()=>setAlignmentIds([])}>取消</button></header><select aria-label="对齐参照" value={alignmentTarget} onChange={e=>setAlignmentTarget(e.target.value as 'selection'|'canvas')}><option value="selection">所选图层</option><option value="canvas">画布</option></select><div className="alignmenttools">{([['left','左对齐'],['center','水平居中'],['right','右对齐'],['top','顶对齐'],['middle','垂直居中'],['bottom','底对齐'],['distribute-x','横向等间距'],['distribute-y','纵向等间距']] as const).map(([action,label])=><button key={action} disabled={action.startsWith('distribute')?alignIds.length<3:alignmentTarget==='selection'&&alignIds.length<2} onClick={()=>arrange(action)}>{label}</button>)}</div><small>勾选图层或 Ctrl / ⌘ 点击多选。锁定、隐藏图层不参与。</small></section>}
          {selected==="__footage"&&p.mode==="overlay"&&<div className="fields footage-properties"><b>原始画面</b><small>{p.footageLocked!==false?"已锁定，解锁后可调整":""}</small>{(['x','y','scale'] as const).map(key=><label key={key}>{({x:'水平位置',y:'垂直位置',scale:'缩放 %'})[key]}<ScrubNumber disabled={p.footageLocked!==false} type="number" value={Math.round(key==='scale'?(p.footageTransform?.scale||1)*100:(p.footageTransform?.[key]||0)*(key==='x'?p.width:p.height))} min={key==='scale'?10:-2*(key==='x'?p.width:p.height)} max={key==='scale'?400:2*(key==='x'?p.width:p.height)} onChange={e=>{const value=Number(e.target.value)/(key==='scale'?100:key==='x'?p.width:p.height);commit({...p,footageTransform:{x:0,y:0,scale:1,...p.footageTransform,[key]:value}});}}/></label>)}<button disabled={p.footageLocked!==false} onClick={()=>commit({...p,footageTransform:{x:0,y:0,scale:1}})}>复位</button><div className="propertyactions"><button disabled={p.footageLocked!==false} title="上移图层" onClick={()=>reorder(1)}><ChevronUp size={16}/></button><button disabled={p.footageLocked!==false} title="下移图层" onClick={()=>reorder(-1)}><ChevronDown size={16}/></button></div></div>}
          {l ? (
            <div className="fields">
              <label>
                名称
                <input
                  value={l.name}
                  onChange={(e) => patch(l.id, { name: e.target.value })}
                />
              </label>
              {l.type==="image"&&l.src&&<section className="component-revision"><h4>修改这个贴片</h4><textarea aria-label="组件修改要求" placeholder="例如：价格改成 ¥299，保留其余设计" value={componentPrompt} onChange={e=>{setComponentPrompt(e.target.value);setComponentCandidate(undefined);}} maxLength={2500}/><button className="primary wide" disabled={busy||l.locked||!componentPrompt.trim()} onClick={()=>reviseComponent()}>{busy?"正在生成…":"生成修改预览"}</button>{busy&&<small>{workflowSteps.at(-1)} · {elapsed} 秒</small>}{componentCandidate?.id===l.id&&componentCandidate.work===workId&&<div className="component-comparison"><div><small>原组件</small><img src={componentCandidate.original} alt="原组件"/></div><div><small>修改预览</small><img src={componentCandidate.src} alt="修改预览"/></div><button className="primary wide" disabled={busy} onClick={confirmComponent}>确认并原位替换</button><button className="wide" onClick={()=>setComponentCandidate(undefined)}>取消</button></div>}</section>}
              {l.type === "text" && (
                <>
                  <label>
                    文字内容
                    <textarea
                      value={l.text ?? ""}
                      onChange={(e) => patch(l.id, { text: e.target.value })}
                    />
                  </label>
                  <label>
                    字体大小
                    <ScrubNumber
                      type="number"
                      min="8"
                      max="400"
                      value={l.fontSize}
                      onChange={(e) =>
                        patch(l.id, {
                          fontSize: Math.min(400, Math.max(8, +e.target.value)),
                        })
                      }
                    />
                  </label>
                </>
              )}
              <button className="aspect-lock" aria-pressed={!!l.aspectLocked} disabled={l.locked} onClick={()=>patch(l.id,{aspectLocked:!l.aspectLocked})}>{l.aspectLocked?<Lock size={13}/>:<Unlock size={13}/>} {l.aspectLocked?'已锁定宽高比例':'锁定宽高比例'}</button>
              {l.src&&<section className="image-appearance"><h4>图片与蒙版</h4><label>显示方式<select aria-label="图片显示方式" disabled={l.locked} value={l.imageFit||(l.type==='background'?'cover':'stretch')} onChange={e=>patch(l.id,{imageFit:e.target.value as 'cover'|'contain'|'stretch'})}><option value="stretch">适配图层</option><option value="cover">填满裁切</option><option value="contain">完整显示</option></select></label><label>蒙版<select aria-label="图片蒙版" disabled={l.locked} value={l.mask||'none'} onChange={e=>patch(l.id,{mask:e.target.value as 'none'|'rounded'|'ellipse',...(e.target.value==='rounded'&&l.cornerRadius===undefined?{cornerRadius:32}:{})})}><option value="none">无</option><option value="rounded">圆角矩形</option><option value="ellipse">椭圆</option></select></label>{l.mask==='rounded'&&<label>圆角半径<ScrubNumber aria-label="圆角半径" disabled={l.locked} type="number" min={0} max={Math.min(1080,l.width/2,l.height/2)} value={l.cornerRadius??32} onChange={e=>patch(l.id,{cornerRadius:Math.max(0,Math.min(1080,+e.target.value))})}/></label>}<details><summary>裁切范围</summary><div className="fieldpair">{(['x','y','width','height'] as const).map(key=><label key={key}>{({x:'左边界 %',y:'上边界 %',width:'裁切宽 %',height:'裁切高 %'})[key]}<ScrubNumber disabled={l.locked} type="number" min={key==='width'||key==='height'?1:0} max={100} value={Math.round((l.imageCrop?.[key]??(key==='width'||key==='height'?1:0))*100)} onChange={e=>patch(l.id,{imageCrop:updateImageCrop(l,key,+e.target.value/100)})}/></label>)}</div><button disabled={l.locked} onClick={()=>patch(l.id,{imageCrop:undefined})}>重置裁切</button></details><div className="propertyactions"><button aria-pressed={!!l.flipX} disabled={l.locked} onClick={()=>patch(l.id,{flipX:!l.flipX})}>水平翻转</button><button aria-pressed={!!l.flipY} disabled={l.locked} onClick={()=>patch(l.id,{flipY:!l.flipY})}>垂直翻转</button></div><button disabled={l.locked} onClick={()=>patch(l.id,{mask:undefined,cornerRadius:undefined,imageCrop:undefined,imageFit:undefined,flipX:undefined,flipY:undefined})}>还原图片显示</button></section>}
              {l.type==='shape'&&<label>圆角半径<ScrubNumber aria-label="圆角半径" disabled={l.locked} type="number" min={0} max={1080} value={l.cornerRadius||0} onChange={e=>patch(l.id,{cornerRadius:Math.max(0,Math.min(1080,+e.target.value))})}/></label>}
              <label>旋转角度<ScrubNumber aria-label="旋转角度" disabled={l.locked} type="number" min={-360} max={360} value={Math.round(l.rotation)} onChange={e=>patch(l.id,{rotation:Math.max(-360,Math.min(360,+e.target.value))})}/></label>
              <section className="image-appearance"><h4>阴影</h4><label><input type="checkbox" aria-label="启用阴影" checked={!!l.shadowEnabled} disabled={l.locked} onChange={e=>patch(l.id,{shadowEnabled:e.target.checked})}/> 启用阴影</label>{l.shadowEnabled&&<><label>阴影颜色<input type="color" aria-label="阴影颜色" value={l.shadowColor||'#000000'} disabled={l.locked} onChange={e=>patch(l.id,{shadowColor:e.target.value})}/></label><label>阴影不透明度 %<ScrubNumber aria-label="阴影不透明度" type="number" min={0} max={100} value={Math.round((l.shadowOpacity??0.35)*100)} disabled={l.locked} onChange={e=>patch(l.id,{shadowOpacity:Math.max(0,Math.min(100,+e.target.value))/100})}/></label><label>阴影模糊<ScrubNumber aria-label="阴影模糊" type="number" min={0} max={200} value={l.shadowBlur??16} disabled={l.locked} onChange={e=>patch(l.id,{shadowBlur:Math.max(0,Math.min(200,+e.target.value))})}/></label><div className="fieldpair">{(['shadowOffsetX','shadowOffsetY'] as const).map(key=><label key={key}>{key==='shadowOffsetX'?'水平偏移':'垂直偏移'}<ScrubNumber aria-label={key==='shadowOffsetX'?'阴影水平偏移':'阴影垂直偏移'} type="number" min={-500} max={500} value={l[key]??(key==='shadowOffsetY'?8:0)} disabled={l.locked} onChange={e=>patch(l.id,{[key]:Math.max(-500,Math.min(500,+e.target.value))})}/></label>)}</div><button disabled={l.locked} onClick={()=>patch(l.id,{shadowColor:undefined,shadowOpacity:undefined,shadowBlur:undefined,shadowOffsetX:undefined,shadowOffsetY:undefined})}>重置阴影参数</button></>}</section>
              <div className="fieldpair">
                {(["x", "y", "width", "height"] as const).map((k) => (
                  <label key={k}>
                    {
                      {
                        x: "X 坐标",
                        y: "Y 坐标",
                        width: "宽度",
                        height: "高度",
                      }[k]
                    }
                    <ScrubNumber
                      type="number"
                      value={Math.round(l[k])}
                      min={k === "width" || k === "height" ? 1 : undefined}
                      onChange={(e) =>
                        patch(l.id, k==='width'||k==='height'?layerSize(l,k,+e.target.value):{[k]:+e.target.value})
                      }
                    />
                  </label>
                ))}
              </div>
              <label>
                颜色
                <div className="colorfield">
                  <input
                    type="color"
                    value={l.fill}
                    onChange={(e) =>
                      patch(l.id, {
                        fill: e.target.value,
                        src: l.type === "background" ? undefined : l.src,
                      })
                    }
                  />
                  <span>{l.fill.toUpperCase()}</span>
                </div>
              </label>
              <label>
                不透明度 <ScrubNumber aria-label="不透明度" type="number" min={0} max={100} value={Math.round(l.opacity * 100)} onChange={e=>patch(l.id,{opacity:Number(e.target.value)/100})}/>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step=".01"
                  value={l.opacity}
                  onChange={(e) => patch(l.id, { opacity: +e.target.value })}
                />
              </label>
              <label>
                对齐画布
                <div className="alignmenttools">
                  {(
                    [
                      ["left", "左"],
                      ["center", "水平中"],
                      ["right", "右"],
                      ["top", "顶"],
                      ["middle", "垂直中"],
                      ["bottom", "底"],
                    ] as const
                  ).map(([align, label]) => (
                    <button
                      key={align}
                      disabled={l.locked}
                      onClick={() =>
                        commit(
                          linked && selectedComponent
                            ? alignElements(
                                p,
                                groupIds(p, selectedComponent),
                                align,
                              )
                            : alignLayer(p, l.id, align),
                        )
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </label>
              <div className="propertyactions">
                <button title="上移图层" onClick={() => reorder(1)}>
                  <ChevronUp size={16} />
                </button>
                <button title="下移图层" onClick={() => reorder(-1)}>
                  <ChevronDown size={16} />
                </button>
                <button
                  title="复制图层"
                  onClick={() => {
                    const id = newLocalId();
                    commit({
                      ...p,
                      layers: [
                        ...p.layers,
                        {
                          ...l,
                          id,
                          name: l.name + " 副本",
                          groupId: undefined,
                          groupName: undefined,
                          x: l.x + 30,
                          y: l.y + 30,
                        },
                      ],
                    });
                    setSelected(id);
                  }}
                >
                  <Copy size={15} />
                </button>
                <button
                  title="删除图层"
                  disabled={l.type === "background" || l.locked}
                  onClick={() => {
                    commit({
                      ...p,
                      layers: p.layers.filter((x) => x.id !== l.id),
                    });
                    setSelected("");
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ) : selected==="__footage"?null:(
            <p className="emptyhint">
              选择画布或列表中的图层
              <br />
              在这里调整细节
            </p>
          )}
          <div className="rightnote">
            <Check size={15} />
            <span>
              {p.layers.some(l=>l.id === "ai-overlay-art" && l.visible) ? "AI文字已融入完整贴片" : "文字与素材独立编辑"}
              <br />
              <small>{p.layers.some(l=>l.id === "ai-overlay-art" && l.visible) ? "修改文案或字体后重新生成" : "导出不包含选框和辅助线"}</small>
            </span>
          </div>
        </aside>
      </div>
      <input
        hidden
        ref={file}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        hidden
        ref={importer}
        type="file"
        accept=".json"
        onChange={async (e) => {
          try {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 30 * 1024 * 1024) throw Error("项目文件过大");
            const next = projectSchema.parse(JSON.parse(await f.text()));
            if (
              next.layers.some(
                (l) =>
                  l.src && !/^data:image\/(png|jpeg|webp);base64,/.test(l.src),
              )
            )
              throw Error("项目图片必须为内嵌 PNG/JPG/WebP");
            if(chatWorkId===workId)await saveConversation(workId,messages);
      await saveWorkspace(p, workId);
            setWorkId(newLocalId());
            commit(next);
            setSelected("");
            setNotice("项目已作为独立作品打开");
          } catch {
            setNotice("项目文件无效，无法导入");
          }
          e.target.value = "";
        }}
      />
      {notice && (
        <div role="status" className="toast">
          {notice}
        </div>
      )}
      {matchProposal&&<div className="overlay"><section className="modal match-confirm" role="dialog" aria-modal="true" aria-labelledby="match-title"><h2 id="match-title">匹配画面参数？</h2>
        <p>{matchProposal.source}{matchProposal.sourceSize?' · '+matchProposal.sourceSize:''}</p>
        {matchProposal.channel&&<p>直播类型：{matchProposal.channel.liveType} · {matchProposal.channel.ratio?'比例来源：频道模板':'未读取到频道比例，请手动确认'}</p>}
        <p>当前画布：{p.width} × {p.height}</p>
        <label>目标画幅<select value={matchProposal.ratio} onChange={e=>setMatchProposal({...matchProposal,ratio:e.target.value as Ratio})}><option value="landscape">16:9 横屏 · 1920 × 1080</option><option value="portrait">9:16 竖屏 · 1080 × 1920</option></select></label>
        {matchProposal.source==='共享窗口'&&<small>窗口尺寸不一定等于开播画幅，请确认后选择。</small>}
        <div className="match-actions"><button className="primary" onClick={applyMatch}>匹配参数</button><button onClick={()=>setMatchProposal(undefined)}>保持当前设置</button></div>
      </section></div>}
      {modal && (
        <div className={"overlay"+(modal === "protected"?" panel-overlay":"")} onClick={() => setModal("")}>
          <section className={"modal"+(modal === "protected"?" area-panel":"")} onClick={(e) => e.stopPropagation()}>
            <button className="close icon" onClick={() => setModal("")}>
              <X size={20} />
            </button>
            {modal === "assets" ? (<AccountAssets exportImage={exportAccountImage} onUse={useAccountImage} name={p.name||"直播包装"}/>) : modal === "protected" ? (
              <div className="protected-controls"><h2>内容保留区</h2><label><input type="checkbox" checked={!!p.protectedAreaEnabled} onChange={e=>{commit({...p,protectedAreaEnabled:e.target.checked});setGuides(e.target.checked);}}/>启用内容保护区</label><p>为主播和内容留出空间。</p>
            <div>
              <select aria-label="内容保留区比例" defaultValue="" onChange={e=>{
                if(e.target.value==="default")commit({...p,protectedAreaEnabled:true,protectedArea:undefined});
                else if(e.target.value==="free"){setDrawingArea(true);setGuides(true);setModal("");}
                else {const [w,h]=e.target.value.split(":").map(Number);commit({...p,protectedAreaEnabled:true,protectedArea:presetArea(p,w/h)});setGuides(true);}
                e.target.value="";
              }}>
                <option value="" disabled>选择保留区比例</option><option value="default">默认</option>
                {["16:9","9:16","4:3","3:4","1:1"].map(r=><option key={r}>{r}</option>)}<option value="free">自由比例／框选</option>
              </select>
              <button className={drawingArea?"active":""} onClick={()=>{setDrawingArea(!drawingArea);setGuides(true);setModal("");}}>{drawingArea?"完成框选":"自由框选"}</button>
              {(["x","y","width","height"] as const).map(key=><label key={key}>{({x:"左",y:"上",width:"宽",height:"高"})[key]}<ScrubNumber type="number" aria-label={"保留区"+key} value={Math.round(safeArea(p)[key])} min={key==="width"||key==="height"?24:0} onChange={e=>commit({...p,protectedAreaEnabled:true,protectedArea:clampArea({...safeArea(p),[key]:Number(e.target.value)},p)})}/></label>)}
            </div>
            <small>虚线仅作布局参考，不影响图层或导出。</small>

              </div>
            ) : modal === "generated" && generated ? (
              <>
                <h2>{generated.applied ? "已叠加到直播预览" : "生成结果 · 叠加预览"}</h2>
                <p>文字与贴片一体设计，可继续对话修改。</p>
                <div style={{position:"relative",aspectRatio:`${generated.project.width}/${generated.project.height}`,maxHeight:"55vh",margin:"12px auto",width:generated.project.height>generated.project.width?"min(100%,260px)":"100%",background:"repeating-conic-gradient(#e7e9ee 0% 25%,#fff 0% 50%) 50%/16px 16px"}}>
                  {generated.frame && <img src={generated.frame} alt="当前直播预览底图" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"fill"}}/>}
                  <img src={generated.src} alt="AI生成的含文字完整贴片" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"fill"}}/>
                </div>
                {generated.warning && <p role="alert">{generated.warning.replace(/，原设计已保留.*$/,"")}。结果仍可查看和下载。</p>}
                <button className="primary wide" disabled={!generated.canApply} onClick={async()=>{
                  if (latest.current !== generated.project && !generated.applied) {setNotice("设计已变化，请先保存生成结果，避免覆盖新修改");return;}
                  if (!generated.applied) {try{const objects=await splitArtImage(generated.src);if(latest.current!==generated.project)throw Error('设计已变化，请重试');commit(applyGeneratedObjects(generated.project,generated.src,objects));}catch(e){setNotice((e as Error).message);return;}}
                  setPreview(true);setSelected("");setGenerated({...generated,applied:true});setModal("");
                }}>{generated.applied ? "返回画布查看" : generated.canApply ? "应用到直播预览（可撤销）" : "结果不满足透明贴片要求，未应用"}</button>
                <button className="wide" onClick={()=>download("AI完整贴片.png",generated.src)}>下载本次生成结果</button>
              </>
            ) : modal === "export" ? (
              <>
                <span className="aiicon">
                  <Download size={23} />
                </span>
                <h2>让设计，准备上场</h2>
                <p>PNG 保留透明通道，放在开播端视频源上方即可叠加。</p>
                <label>
                  导出内容
                  <select
                    value={exportScope}
                    onChange={(e) => {
                      setExportScope(e.target.value);
                      if (e.target.value !== "all"&&exportType==='jpg') setExportType("png");
                    }}
                  >
                    <option value="all">
                      {p.mode === "overlay"
                        ? "整套透明直播包装"
                        : "完整暖场画面"}
                    </option>
                    <option value="text" disabled={!p.layers.some(l=>l.type === "text" && l.visible && l.opacity>0)}>透明标题贴片（独立文字）</option>
                    <option value="logo">Logo 图层（透明背景）</option>
                    <option value="selected" disabled={!alignIds.length&&!l}>{alignIds.length?'已选 '+alignIds.length+' 个图层（透明背景）':'当前选中图层（透明背景）'}</option>
                    {Object.keys(groups)
                      .filter((name) => groupIds(p, name).length)
                      .map((name) => (
                        <option value={"component:" + name} key={name}>
                          {name}组件（文字与底板合并）
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  文件格式
                  <select
                    value={exportType}
                    onChange={(e) => setExportType(e.target.value)}
                  >
                    <option value="png">PNG · 无损画质 / 支持透明</option>
                    {exportScope==='all'&&p.mode==='warmup'&&<option value="jpg">JPG · 适合完整背景</option>}
                    <option value="zip">{exportScope==='all'?'ZIP · 完整包装 + 组件 + 独立图层 + 项目':'ZIP · 所选内容 + 独立图层 + 项目'}</option>
                  </select>
                </label>
                <div className="exportinfo">
                  {inspection(p).length > 0 && (
                    <div className="exportwarnings">
                      <b>导出前有 {inspection(p).length} 项布局提示</b>
                      {inspection(p)
                        .slice(0, 4)
                        .map((s, i) => (
                          <span key={i}>{s}</span>
                        ))}
                      <small>提示不会阻止导出，可返回画布调整。</small>
                    </div>
                  )}
                  输出尺寸{" "}
                  <b>
                    {p.width} × {p.height}
                  </b>
                  <br />
                  独立图层保留原位，可直接叠加。
                </div>
                {exportReady&&<a className="primary wide export-ready" href={exportReady.url} download={exportReady.name}><Download size={16}/>下载 ZIP</a>}
                {!exportReady&&<button
                  className="primary wide"
                  disabled={exporting}
                  onClick={exportFile}
                >
                  {exporting ? (
                    <Loader2 className="spin" size={16} />
                  ) : (
                    <Download size={16} />
                  )}{" "}
                  {exporting ? "正在打包素材…" : exportType==='zip'?"准备 ZIP 素材包":"下载素材"}
                </button>}
                <button
                  className="wide"
                  onClick={() =>
                    download(
                      p.name + ".livestyler.json",
                      new Blob([JSON.stringify(p)], {
                        type: "application/json",
                      }),
                    )
                  }
                >
                  下载可编辑项目文件
                </button>
              </>
            ) : modal === "works" ? (
              <><h2>我的作品</h2><div className="work-tabs" role="tablist">{([['local','本地作品'],['cloud','云端作品'],['tasks','生成记录']] as const).map(([key,label])=><button key={key} role="tab" aria-selected={workSection===key} onClick={()=>setWorkSection(key)}>{label}</button>)}</div>{workSection!=='local'?<CloudPanel workId={workId} project={p} messages={messages} onOpen={openCloudWork} view={workSection==='cloud'?'projects':'tasks'} onSaved={()=>setSaved('已同步云端')}/>:<WorkLibrary
                works={works}
                active={workId}
                onOpen={openWork}
                onCopy={copyWork}
                onDelete={removeWork}
                onNew={newWork}
                onLink={async(a,b)=>{try{await pairWorks({id:a.id,mode:a.project.mode},{id:b.id,mode:b.project.mode});setWorks(await listWorks());setNotice('已合并为同一作品，画面和历史对话均保留');}catch{setNotice('关联失败，原作品保持不变');}}}
              />}</>
            ) : modal === "settings" ? (
              <>
                <h2>创作设置</h2>
                <p>选择创作方式。</p>
                <div className="statusrow">
                  文字 AI{" "}
                  <b>{status.text ? "已开启" : "未开启"}</b>
                </div>
                <div className="statusrow">
                  图像 AI{" "}
                  <b>{status.image ? "已开启" : "未开启"}</b>
                </div>

                <button
                  className="wide primary"
                  disabled={!status.text}
                  onClick={() => {
                    setReal(true);
                    localStorage.setItem("livestyler-ai-mode", "real");
                    setModal("");
                  }}
                >
                  使用 AI 助手
                </button>
                <button
                  className="wide"
                  onClick={() => {
                    setReal(false);
                    localStorage.setItem("livestyler-ai-mode", "local");
                    setModal("");
                  }}
                >
                  使用本地编辑
                </button>
                <small>
                  本地编辑支持移动、改字和调整图层。
                </small>
              </>
            ) : (
              <>
                <ChannelConnection notify={setNotice} onConnected={matchChannel} mode={p.mode} exportWarmup={exportWarmup} exportOverlay={exportOverlay} exportPackage={exportWholePackage} currentChannel={connectedChannel||p.channelContext?.channelId}/>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
