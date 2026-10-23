"use client";
import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  Stage,
  Layer as KL,
  Rect,
  Text,
  Image as KI,
  Transformer,
  Group,
} from "react-konva";
import Konva from "konva";
import {clampArea,type ProtectedRect} from "../lib/protected-area";
import { previewPhotos as scenePhotos } from "../lib/scene-assets";
import { exportStage, capturePreviewStage } from "../lib/canvas-export";
import { safeArea, type Layer, type Project } from "../lib/design";
import {imageRenderProps} from '../lib/image-render';
export function shiftPosition(start:{x:number;y:number}, point:{x:number;y:number}, size:{width:number;height:number}, targets:{x:number[];y:number[]}, axis:"x"|"y", threshold:number) {
  const offsets=axis==="x"?[0,size.width/2,size.width]:[0,size.height/2,size.height];
  let value=point[axis],delta=threshold+1;
  for(const line of targets[axis])for(const offset of offsets){const d=line-offset-point[axis];if(Math.abs(d)<=threshold&&Math.abs(d)<Math.abs(delta))delta=d;}
  if(Math.abs(delta)<=threshold)value+=delta;
  return axis==="x"?{x:value,y:start.y}:{x:start.x,y:value};
}
export function fitView(project:{width:number;height:number}, viewport:{width:number;height:number}) {
  const scale=Math.max(.001,Math.min((Math.max(1,viewport.width)-32)/project.width,(Math.max(1,viewport.height)-32)/project.height));
  return {scale,x:(viewport.width-project.width*scale)/2,y:(viewport.height-project.height*scale)/2};
}
export function zoomView(view:{scale:number;x:number;y:number}, value:number, point:{x:number;y:number}) {
  const scale=Math.max(.01,Math.min(4,value)),ratio=scale/view.scale;
  return {scale,x:point.x-(point.x-view.x)*ratio,y:point.y-(point.y-view.y)*ratio};
}
function ArtImage({
  l,
  fitCover = false,
  focus = 0.5,
  ...props
}: {
  l: Layer;
  fitCover?: boolean;
  focus?: number;
  [key: string]: any;
}) {
  const [img, setImg] = useState<HTMLImageElement>();
  useEffect(() => {
    setImg(undefined);
    if (!l.src) return;
    let active = true;
    const i = new Image();
    i.onload = () => active && setImg(i);
    i.onerror = () => active && setImg(undefined);
    i.src = l.src;
    return () => {
      active = false;
    };
  }, [l.src]);
  let crop;
  if (img && (l.type === "background" || fitCover)) {
    const ratio = (props.width || l.width) / (props.height || l.height),
      source = img.width / img.height;
    crop =
      source > ratio
        ? {
            x: (img.width - img.height * ratio) / 2,
            y: 0,
            width: img.height * ratio,
            height: img.height,
          }
        : {
            x: 0,
            y: (img.height - img.width / ratio) * focus,
            width: img.width,
            height: img.width / ratio,
          };
  }
  return <KI {...props} fill={undefined} image={img} crop={crop} {...imageRenderProps(l)} />;
}
export function videoPlacement(source:{videoWidth:number;videoHeight:number},p:{width:number;height:number}){
  const scale=Math.min(p.width/source.videoWidth,p.height/source.videoHeight),width=source.videoWidth*scale,height=source.videoHeight*scale;
  return {x:(p.width-width)/2,y:(p.height-height)/2,width,height};
}
export function captureLiveFrame(video:HTMLVideoElement,p:{width:number;height:number}){
  if(video.readyState<2||!video.videoWidth||!video.videoHeight||(video.srcObject as MediaStream|null)?.getVideoTracks().some(t=>t.readyState!=='live'||t.muted))throw Error("实时画面尚未就绪，请确认共享窗口未最小化，或重新连接。");
  const c=document.createElement('canvas');c.width=p.width;c.height=p.height;const ctx=c.getContext('2d');if(!ctx)throw Error("无法截取画面");
  ctx.fillStyle='#111827';ctx.fillRect(0,0,c.width,c.height);const rect=videoPlacement(video,p);ctx.drawImage(video,rect.x,rect.y,rect.width,rect.height);return c.toDataURL('image/jpeg',.88);
}
function LiveFootage({video,project}:{video:HTMLVideoElement;project:Project}){
  const node=useRef<Konva.Image>(null),[size,setSize]=useState({videoWidth:video.videoWidth,videoHeight:video.videoHeight});
  useEffect(()=>{const resize=()=>setSize({videoWidth:video.videoWidth,videoHeight:video.videoHeight});resize();video.addEventListener('resize',resize);const animation=new Konva.Animation(()=>{},node.current?.getLayer());animation.start();return()=>{video.removeEventListener('resize',resize);animation.stop();};},[video]);
  const placement=size.videoWidth&&size.videoHeight?videoPlacement(size,project):{x:0,y:0,width:project.width,height:project.height};
  return <KI ref={node} name="preview-footage" image={video} {...placement}/>;
}
function Preview({
  project: p,
  kind,
  src,
  liveVideo,
  editingFootage=false,onFootageChange,onSelect,
}: {
  onSelect?:()=>void;editingFootage?:boolean;onFootageChange?:(t:{x:number;y:number;scale:number})=>void;
  project: Project;
  kind: string;
  src?: string;
  liveVideo?: HTMLVideoElement;
}) {
  const w = p.width,
    h = p.height,
    v = h > w;
  const photo = scenePhotos[p.scene];
  const defaults =
    kind === "共享画面"
      ? scenePhotos[2]
      : kind === "商品"
        ? scenePhotos[3]
        : photo;
  const viewport=p.footageViewport,videoWidth=w*(viewport?.width||1),videoHeight=h*(viewport?.height||1);
  return (
    <Group name="preview-only" listening>
      <Rect width={w} height={h} fill="#111827" />
      <Group name="footage-layer" onClick={onSelect} onTap={onSelect} onDragStart={onSelect} onTransformEnd={e=>{const n=e.target;const scale=Math.max(.1,Math.min(4,n.scaleX()));n.scaleX(scale);n.scaleY(scale);onFootageChange?.({x:n.x()/w,y:n.y()/h,scale});}} x={(p.footageTransform?.x||0)*w} y={(p.footageTransform?.y||0)*h} scaleX={p.footageTransform?.scale||1} scaleY={p.footageTransform?.scale||1} draggable={p.footageLocked===false} onDragEnd={e=>onFootageChange?.({x:Math.max(-2,Math.min(2,e.target.x()/w)),y:Math.max(-2,Math.min(2,e.target.y()/h)),scale:p.footageTransform?.scale||1})}>
      <Group x={(viewport?.x||0)*w} y={(viewport?.y||0)*h}>
      {liveVideo ? <LiveFootage video={liveVideo} project={{...p,width:videoWidth,height:videoHeight} as Project}/> : <ArtImage
        name="preview-footage"
        l={{ src: src || (v?defaults.portraitSrc||defaults.src:defaults.src) } as Layer}
        width={videoWidth}
        height={videoHeight}
        fitCover
        focus={v ? defaults.portraitFocus : defaults.landscapeFocus}
      />}
      </Group>
      {editingFootage&&<Rect name="editor-only" width={w} height={h} fill="rgba(0,0,0,0.001)" stroke="#b8a0f5" strokeWidth={3}/>}
      </Group>
    </Group>
  );
}

export type CanvasHandle = {
  capturePreview: () => string;
  captureComposition: () => string;
  export: (format?: string, ids?: string[]) => string;
};
export default forwardRef<
  CanvasHandle,
  {
    project: Project;
    selected: string;
    alignmentIds?:string[];
    select: (id: string) => void;
    change: (id: string, patch: Partial<Layer>) => void;
    preview: boolean;
    guides: boolean;
    editingFootage?:boolean;onFootageChange?:(t:{x:number;y:number;scale:number})=>void;
    previewKind: string;
    previewSrc?: string;
    liveVideo?: HTMLVideoElement;
    onEditText?: (id: string) => void;
    drawingArea?: boolean;
    onAreaChange?: (area:ProtectedRect)=>void;
  }
>(function Canvas(
  {
    project,
    selected,
    alignmentIds=[],
    select,
    change,
    preview,
    guides,
    editingFootage=false,onFootageChange,
    previewKind,
    previewSrc,
    liveVideo,
    onEditText,
    drawingArea = false,
    onAreaChange,
  },
  ref,
) {
  const host = useRef<HTMLDivElement>(null),
    stage = useRef<Konva.Stage>(null),
    tr = useRef<Konva.Transformer>(null);
  const [view,setView]=useState({scale:.3,x:0,y:0});
  const {scale}=view;
  const [viewport,setViewport]=useState({width:1,height:1});
  const fitMode=useRef(true),viewRef=useRef(view),sizeRef=useRef(viewport);
  viewRef.current=view;sizeRef.current=viewport;
  const [hand,setHand]=useState(false),[space,setSpace]=useState(false),[panning,setPanning]=useState(false);
  const hovered=useRef(false),spaceRef=useRef(false);
  const pan=useRef<{x:number;y:number;vx:number;vy:number;pointer:number}|undefined>(undefined);
  const fit=()=>{fitMode.current=true;setView(fitView(project,sizeRef.current));};
  const zoom=(value:number,point={x:sizeRef.current.width/2,y:sizeRef.current.height/2})=>{
    fitMode.current=false;setView(v=>zoomView(v,value,point));
  };
  const canvasPoint=(node:Konva.Node)=>{const st=node.getStage();const point=st?.getPointerPosition();return point&&st?st.getAbsoluteTransform().copy().invert().point(point):undefined;};
  const [areaDraft,setAreaDraft] = useState<ProtectedRect>();
  const areaStart = useRef<{x:number;y:number}|undefined>(undefined);
  const areaNode = useRef<Konva.Rect>(null), areaTransformer=useRef<Konva.Transformer>(null);
  useEffect(()=>{
    areaTransformer.current?.nodes(drawingArea && areaNode.current ? [areaNode.current] : []);
    areaTransformer.current?.getLayer()?.batchDraw();
  },[drawingArea,project.protectedArea,areaDraft]);
  useEffect(() => {
    const el=host.current;if(!el)return;
    fitMode.current=true;
    const resize=()=>{const next={width:Math.max(1,el.clientWidth),height:Math.max(1,el.clientHeight)},old=sizeRef.current;
      sizeRef.current=next;setViewport(next);setView(v=>fitMode.current?fitView(project,next):{...v,x:v.x+(next.width-old.width)/2,y:v.y+(next.height-old.height)/2});};
    const ro=new ResizeObserver(resize);ro.observe(el);resize();return()=>ro.disconnect();
  },[project.width,project.height]);
  useEffect(()=>{
    const el=host.current;if(!el)return;
    const wheel=(e:WheelEvent)=>{e.preventDefault();
      if(e.altKey){fitMode.current=false;setView(v=>({...v,x:v.x-e.deltaX,y:v.y-e.deltaY}));return;}
      const rect=el.getBoundingClientRect(),point={x:e.clientX-rect.left,y:e.clientY-rect.top};
      const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?el.clientHeight:1);
      zoom(viewRef.current.scale*Math.exp(-Math.max(-200,Math.min(200,delta))*.002),point);
    };
    el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);
  },[]);
  useEffect(()=>{
    const typing=(e:KeyboardEvent)=>(e.target as HTMLElement)?.closest?.('input,textarea,select,[contenteditable="true"]');
    const down=(e:KeyboardEvent)=>{if(typing(e)||(!hovered.current&&!host.current?.contains(document.activeElement)))return;
      if(e.code==='Space'){e.preventDefault();spaceRef.current=true;setSpace(true);}
      if(!e.ctrlKey&&!e.metaKey&&(e.key==='+'||e.key==='='||e.key==='-')){e.preventDefault();zoom(viewRef.current.scale*(e.key==='-'?1/1.2:1.2));}
      if(!e.ctrlKey&&!e.metaKey&&e.key==='0'){e.preventDefault();fit();}
    };
    const up=(e:KeyboardEvent)=>{if(e.code==='Space'){spaceRef.current=false;setSpace(false);}};
    const blur=()=>{spaceRef.current=false;setSpace(false);setPanning(false);pan.current=undefined;};
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);
    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);};
  },[project.width,project.height]);
  useEffect(() => {
    const n = !drawingArea && selected
      ? selected==="__footage"?stage.current?.findOne(".footage-layer"):stage.current?.findOne(
          "#" +
            Array.from(selected)
              .map((c) => c.codePointAt(0)!.toString(16))
              .join("_"),
        )
      : undefined;
    tr.current?.nodes(
      n && (selected==="__footage"?project.footageLocked===false:!project.layers.find((l) => l.id === selected)?.locked) ? [n] : [],
    );
    tr.current?.getLayer()?.batchDraw();
  }, [selected, project,drawingArea,preview]);
  useImperativeHandle(ref, () => ({
    capturePreview: () => {if(liveVideo)captureLiveFrame(liveVideo,project);return capturePreviewStage(stage.current!, project);},
    captureComposition: () => capturePreviewStage(stage.current!,project,true),
    export: (format = "png", ids) =>
      exportStage(stage.current!, project, format, ids),
  }));
  const safe = safeArea(project);
  return (
    <div className="canvasviewer">
      <div className={"canvaswrap"+(hand||space?" handmode":"")+(panning?" panning":"")} ref={host} tabIndex={0} aria-label="设计画布预览"
        onMouseEnter={()=>hovered.current=true} onMouseLeave={()=>hovered.current=false}
        onContextMenu={e=>e.preventDefault()}
        onPointerDownCapture={e=>{if(e.button!==1&&!(e.button===0&&(hand||spaceRef.current)))return;e.preventDefault();e.stopPropagation();fitMode.current=false;pan.current={x:e.clientX,y:e.clientY,vx:view.x,vy:view.y,pointer:e.pointerId};e.currentTarget.setPointerCapture(e.pointerId);setPanning(true);}}
        onPointerMoveCapture={e=>{const start=pan.current;if(!start)return;e.preventDefault();e.stopPropagation();setView(v=>({...v,x:start.vx+e.clientX-start.x,y:start.vy+e.clientY-start.y}));}}
        onPointerUpCapture={e=>{if(!pan.current)return;e.preventDefault();e.stopPropagation();e.currentTarget.releasePointerCapture(e.pointerId);pan.current=undefined;setPanning(false);}}
        onPointerCancel={()=>{pan.current=undefined;setPanning(false);}}
        onLostPointerCapture={()=>{pan.current=undefined;setPanning(false);}}
      >
      <div className="canvaspaper" style={{left:view.x,top:view.y,width:project.width*scale,height:project.height*scale}}/>
      <Stage
        ref={stage}
        width={viewport.width}
        height={viewport.height}
        x={view.x}
        y={view.y}
        listening={!hand && !space && !panning}
        scaleX={scale}
        scaleY={scale}
        onMouseMove={(e:any)=>{const start=areaStart.current,pos=canvasPoint(e.target);if(start&&pos)setAreaDraft(clampArea({x:Math.min(start.x,pos.x),y:Math.min(start.y,pos.y),width:Math.abs(start.x-pos.x),height:Math.abs(start.y-pos.y)},project));}}
        onMouseUp={()=>{if(areaStart.current&&areaDraft)onAreaChange?.(areaDraft);areaStart.current=undefined;setAreaDraft(undefined);}}
        onTouchMove={(e:any)=>{const start=areaStart.current,pos=canvasPoint(e.target);if(start&&pos){e.evt.preventDefault();setAreaDraft(clampArea({x:Math.min(start.x,pos.x),y:Math.min(start.y,pos.y),width:Math.abs(start.x-pos.x),height:Math.abs(start.y-pos.y)},project));}}}
        onTouchEnd={()=>{if(areaStart.current&&areaDraft)onAreaChange?.(areaDraft);areaStart.current=undefined;setAreaDraft(undefined);}}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) select("");
        }}
      >
        <KL>
          <Group clipX={0} clipY={0} clipWidth={project.width} clipHeight={project.height}>
          {[...project.layers.slice(0,project.footageIndex??0),null,...project.layers.slice(project.footageIndex??0)].map((l) => {
            if(!l)return project.mode==="overlay"&&preview?<Preview key="__footage" project={project} kind={previewKind} src={previewSrc} liveVideo={liveVideo} editingFootage={editingFootage&&project.footageLocked===false} onFootageChange={onFootageChange} onSelect={()=>select("__footage")} />:null;
            const props = {listening:true,
              id: Array.from(l.id)
                .map((c) => c.codePointAt(0)!.toString(16))
                .join("_"),
              name: "art",
              layerId: l.id,
              x: l.x,
              y: l.y,
              width: l.width,
              height: l.height,
              rotation: l.rotation,
              opacity: l.opacity,
              shadowEnabled:!!l.shadowEnabled,
              shadowColor:l.shadowColor||'#000000',
              shadowOpacity:l.shadowOpacity??0.35,
              shadowBlur:l.shadowBlur??16,
              shadowOffsetX:l.shadowOffsetX??0,
              shadowOffsetY:l.shadowOffsetY??8,
              visible: l.visible,
              draggable: !l.locked,
              onClick: () => select(l.id),
              onTap: () => select(l.id),
              onDblClick: () => l.type === "text" && onEditText?.(l.id),
              onDblTap: () => l.type === "text" && onEditText?.(l.id),
              onDragStart: (e:any) => {select(l.id);e.target.setAttr("dragOrigin",{x:e.target.x(),y:e.target.y()});e.target.setAttr("dragAxis",null);},
              onDragMove: (e:any) => {
                const n=e.target,start=n.getAttr("dragOrigin")||{x:l.x,y:l.y};
                if(!e.evt.shiftKey){n.setAttr("dragAxis",null);return;}
                const dx=n.x()-start.x,dy=n.y()-start.y;
                if(!n.getAttr("dragAxis")&&Math.max(Math.abs(dx),Math.abs(dy))*scale<4){n.position(start);return;}
                const axis=n.getAttr("dragAxis")||(Math.abs(dx)>=Math.abs(dy)?"x":"y");n.setAttr("dragAxis",axis);
                const others=project.layers.filter(o=>o.visible&&o.id!==l.id&&!(l.groupId&&l.groupId===o.groupId));
                const targets={x:[0,project.width/2,project.width,...others.flatMap(o=>[o.x,o.x+o.width/2,o.x+o.width])],y:[0,project.height/2,project.height,...others.flatMap(o=>[o.y,o.y+o.height/2,o.y+o.height])]};
                n.position(shiftPosition(start,{x:n.x(),y:n.y()},l,targets,axis,6/scale));
              },
              onDragEnd: (e: any) => {e.target.setAttr("dragOrigin",null);e.target.setAttr("dragAxis",null);change(l.id, { x: e.target.x(), y: e.target.y() });},
              onTransformEnd: (e: any) => {
                const n = e.target;
                change(l.id, {
                  x: n.x(),
                  y: n.y(),
                  width: Math.max(10, n.width() * n.scaleX()),
                  height: Math.max(10, n.height() * n.scaleY()),
                  rotation: n.rotation(),
                  ...(l.type === "text" && l.fontSize
                    ? {
                        fontSize: Math.max(
                          8,
                          Math.min(
                            400,
                            l.fontSize *
                              Math.min(
                                Math.abs(n.scaleX()),
                                Math.abs(n.scaleY()),
                              ),
                          ),
                        ),
                      }
                    : {}),
                });
                n.scaleX(1);
                n.scaleY(1);
              },
            };
            if (l.type === "text")
              return (
                <Text
                  key={l.id}
                  {...props}
                  fill={l.fill}
                  text={l.text}
                  fontSize={l.fontSize}
                  fontFamily="Arial, Microsoft YaHei, sans-serif"
                  fontStyle={l.id === "活动标题" ? "bold" : "normal"}
                />
              );
            if (l.src) return <ArtImage key={l.id} {...props} l={l} />;
            return <Rect key={l.id} {...props} fill={l.fill} cornerRadius={l.cornerRadius||0} />;
          })}
          {project.mode === "overlay" && ((project.protectedAreaEnabled && guides) || drawingArea) && (
            <Group name="preview-only">
              {drawingArea && <Rect width={project.width} height={project.height} fill="rgba(0,0,0,0.001)"
                onMouseDown={(e:any)=>{const pos=canvasPoint(e.target);if(!pos)return;areaStart.current={x:pos.x,y:pos.y};setAreaDraft(undefined);}}
                onTouchStart={(e:any)=>{e.evt.preventDefault();const pos=canvasPoint(e.target);if(pos)areaStart.current={x:pos.x,y:pos.y};}}
              />}
              <Rect ref={areaNode} {...(areaDraft||safe)} stroke="#35b999" strokeWidth={3} dash={[15,12]}  listening={drawingArea} draggable={drawingArea}
                onDragEnd={(e:any)=>onAreaChange?.(clampArea({...safe,x:e.target.x(),y:e.target.y()},project))}
                onTransformEnd={(e:any)=>{const n=e.target;onAreaChange?.(clampArea({x:n.x(),y:n.y(),width:n.width()*n.scaleX(),height:n.height()*n.scaleY()},project));n.scaleX(1);n.scaleY(1);}}
              />
              {drawingArea && <Transformer ref={areaTransformer} rotateEnabled={false} keepRatio={false} flipEnabled={false} borderStroke="#35b999" anchorStroke="#35b999" anchorSize={10} boundBoxFunc={(old,b)=>b.width<24||b.height<24?old:b}/>}
            </Group>
          )}
          </Group>
          {project.layers.filter(l=>alignmentIds.includes(l.id)&&l.visible&&!l.locked).map(l=><Rect key={'align-'+l.id} name="editor-guide" x={l.x} y={l.y} width={l.width} height={l.height} rotation={l.rotation} stroke="#bca0f2" strokeWidth={1.5/scale} dash={[6/scale,4/scale]} listening={false}/>)}
          <Transformer
            ref={tr}
            keepRatio={!!project.layers.find(l=>l.id===selected)?.aspectLocked}
            enabledAnchors={project.layers.find(l=>l.id===selected)?.aspectLocked?['top-left','top-right','bottom-left','bottom-right']:undefined}
            rotateEnabled={selected!=="__footage"}
            flipEnabled={false}
            borderStroke="#235ff5"
            anchorStroke="#235ff5"
            anchorSize={8}
            boundBoxFunc={(old, b) => (b.width < 10 || b.height < 10 ? old : b)}
          />
        </KL>
      </Stage>
      </div>
    </div>
  );
});
