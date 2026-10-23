import { newLocalId } from "./design";
import {
  type Layer,
  type Project,
  projectSchema,
  safeArea,
  styles,
  template,
  resizeProject,
} from "./design";
export const componentGroups: Record<string, string[]> = {
  顶部品牌: ["顶部品牌底板", "品牌", "活动标题", "顶部强调线"],
  姓名条: ["姓名条底板", "姓名条", "副标题"],
  直播角标: ["直播角标底板", "直播角标"],
  底部信息条: ["底部信息底板", "底部信息"],
};
export function groupsForProject(p: Project): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [name, ids] of Object.entries(componentGroups)) {
    const found = ids.filter((id) => p.layers.some((l) => l.id === id));
    if (found.length) result[name] = found;
  }
  for (const l of p.layers)
    if (l.groupId && l.groupName) {
      const key = l.groupName + " · " + l.groupId.slice(0, 6);
      (result[key] ??= []).push(l.id);
    }
  // Uploaded and generated images are usable components without a manual grouping step.
  for(const l of p.layers)if(l.type==='image'&&l.src&&!Object.values(result).some(ids=>ids.includes(l.id))){result[l.name+' · '+l.id.slice(-6)]=[l.id];}
  return result;
}
export function groupIds(p: Project, name: string) {
  return groupsForProject(p)[name] ?? [];
}
export function toggleComponent(
  p: Project,
  name: string,
  visible: boolean,
): Project {
  const ids = groupIds(p, name);
  if (!ids.length) throw Error("当前设计没有该包装组件");
  return {
    ...p,
    layers: p.layers.map((l) => (ids.includes(l.id) ? { ...l, visible } : l)),
  };
}
export function moveLayers(
  p: Project,
  ids: string[],
  dx: number,
  dy: number,
): Project {
  const chosen = p.layers.filter((l) => ids.includes(l.id) && !l.locked);
  if (!chosen.length) throw Error("目标图层已锁定或不存在");
  const left = Math.min(...chosen.map((l) => l.x)),
    top = Math.min(...chosen.map((l) => l.y)),
    right = Math.max(...chosen.map((l) => l.x + l.width)),
    bottom = Math.max(...chosen.map((l) => l.y + l.height));
  dx = Math.min(p.width - right, Math.max(-left, dx));
  dy = Math.min(p.height - bottom, Math.max(-top, dy));
  return projectSchema.parse({
    ...p,
    layers: p.layers.map((l) =>
      chosen.includes(l) ? { ...l, x: l.x + dx, y: l.y + dy } : l,
    ),
  });
}
export function alignLayer(
  p: Project,
  id: string,
  alignment: "left" | "center" | "right" | "top" | "middle" | "bottom",
): Project {
  const l = p.layers.find((l) => l.id === id);
  if (!l || l.locked) throw Error("请选中一个未锁定的图层");
  const patch: Partial<Layer> = {};
  if (alignment === "left") patch.x = 40;
  if (alignment === "center") patch.x = (p.width - l.width) / 2;
  if (alignment === "right") patch.x = p.width - l.width - 40;
  if (alignment === "top") patch.y = 40;
  if (alignment === "middle") patch.y = (p.height - l.height) / 2;
  if (alignment === "bottom") patch.y = p.height - l.height - 40;
  return {
    ...p,
    layers: p.layers.map((x) => (x.id === id ? { ...x, ...patch } : x)),
  };
}
export function inspection(p: Project): string[] {
  const issues: string[] = [];
  const visible = p.layers.filter((l) => l.visible && l.opacity > 0);
  if (!visible.length) issues.push("当前没有可见的包装图层");
  for (const l of visible) {
    if (
      l.x < 0 ||
      l.y < 0 ||
      l.x + l.width > p.width ||
      l.y + l.height > p.height
    )
      issues.push(l.name + " 超出画布边缘");
  }
  if (p.mode === "overlay") {
    const bg = visible.find((l) => l.type === "background");
    if (bg && bg.opacity > 0.1) issues.push("背景层不透明，会遮挡下方直播画面");
    const a = p.protectedAreaEnabled?safeArea(p):{x:0,y:0,width:0,height:0};
    for (const l of visible.filter((l) => l.type !== "background"))
      if (
        l.x < a.x + a.width &&
        l.x + l.width > a.x &&
        l.y < a.y + a.height &&
        l.y + l.height > a.y
      )
        issues.push(l.name + " 进入直播内容保留区");
  }
  for (const l of visible.filter(
    (l) => l.type === "text" && l.text && l.fontSize,
  )) {
    const lines = (l.text || "").split("\n");
    const width =
      Math.max(
        ...lines.map((t) =>
          Array.from(t).reduce(
            (n, c) => n + (/[\u2e80-\uffff]/.test(c) ? 1 : 0.58),
            0,
          ),
        ),
      ) * (l.fontSize || 24);
    if (width > l.width || lines.length * (l.fontSize || 24) > l.height)
      issues.push(l.name + " 文字可能放不下，请调整字号或文字框");
  }
  return [...new Set(issues)].slice(0, 15);
}
export function addComponent(
  p: Project,
  kind: "name" | "badge" | "notice" | "product",
): Project {
  const s = styles[p.scene],
    v = p.height > p.width,
    w = p.width,
    h = p.height,
    prefix = newLocalId();
  if (kind === "name" || (kind === "product" && p.scene === 3)) {
    const reference = template(p.scene, v ? "portrait" : "landscape");
    const parts = reference.layers
      .filter((l) => ["姓名条底板", "姓名条", "副标题"].includes(l.id))
      .map((l) => ({
        ...l,
        id: prefix + "-" + l.id,
        groupId: prefix,
        groupName: kind === "product" ? "商品信息卡" : "姓名条",
      }));
    if (p.layers.length + parts.length > 100) throw Error("最多支持100个图层");
    return projectSchema.parse({ ...p, layers: [...p.layers, ...parts] });
  }
  const layers: Layer[] = [];
  const make = (
    suffix: string,
    type: Layer["type"],
    x: number,
    y: number,
    width: number,
    height: number,
    fill: string,
    text?: string,
    fontSize?: number,
  ): Layer => ({
    id: prefix + "-" + suffix,
    name: suffix,
    type,
    x,
    y,
    width,
    height,
    fill,
    text,
    fontSize,
    visible: true,
    locked: false,
    rotation: 0,
    opacity: 1,
    groupId: prefix,
    groupName:
      kind === "badge"
        ? "直播角标"
        : kind === "notice"
          ? "底部公告条"
          : "商品信息卡",
  });
  if (kind === "badge") {
    layers.push(
      make("角标底板", "shape", w - 240, 30, 200, 64, s.accent),
      make("角标文字", "text", w - 220, 47, 160, 40, s.bg, "LIVE 直播", 27),
    );
  }
  if (kind === "notice") {
    layers.push(
      make("公告底板", "shape", 0, h - 75, w, 75, s.bg),
      make(
        "公告文字",
        "text",
        40,
        h - 53,
        w - 80,
        40,
        s.fg,
        "欢迎进入直播间",
        27,
      ),
    );
  }
  if (kind === "product") {
    layers.push(
      make(
        "商品卡底板",
        "shape",
        40,
        h - (v ? 430 : 240),
        v ? 740 : 700,
        150,
        s.bg,
      ),
      make(
        "商品名称",
        "text",
        65,
        h - (v ? 405 : 215),
        v ? 650 : 610,
        50,
        s.fg,
        "新品名称 / 商品卖点",
        v ? 35 : 32,
      ),
      make(
        "商品价格",
        "text",
        65,
        h - (v ? 350 : 160),
        v ? 650 : 610,
        45,
        s.accent,
        "限时优惠 ¥199",
        30,
      ),
    );
  }
  if (p.layers.length + layers.length > 100) throw Error("最多支持100个图层");
  return projectSchema.parse({ ...p, layers: [...p.layers, ...layers] });
}

/** Rebuild edge layout for the new ratio while retaining content and custom components. */
export function reflowOverlay(
  p: Project,
  ratio: "landscape" | "portrait",
): Project {
  if (p.width > p.height === (ratio === "landscape")) return p;
  const oldDefaults = template(
    p.scene,
    p.width > p.height ? "landscape" : "portrait",
    "overlay",
  );
  const next = template(p.scene, ratio, "overlay");
  const current = new Map(p.layers.map((l) => [l.id, l]));
  next.layers = next.layers.map((l) => {
    const old = current.get(l.id),
      base = oldDefaults.layers.find((x) => x.id === l.id);
    if (!old) return l;
    return {
      ...l,
      fill: old.fill,
      opacity: old.opacity,
      visible: old.visible,
      locked: old.locked,
      ...(l.type === "text"
        ? {
            text: old.text,
            fontSize:
              l.fontSize && old.fontSize && base?.fontSize
                ? Math.max(
                    8,
                    Math.min(400, (l.fontSize * old.fontSize) / base.fontSize),
                  )
                : l.fontSize,
          }
        : {}),
    };
  });
  const builtin = new Set(oldDefaults.layers.map((l) => l.id));
  next.layers.push(
    ...resizeProject(p, ratio).layers.filter((l) => !builtin.has(l.id)),
  );
  if (next.layers.some((l) => l.type === "image" && /logo/i.test(l.name)))
    next.layers = next.layers.map((l) =>
      l.id === "品牌"
        ? {
            ...l,
            x: 210,
            width: next.width > next.height ? 280 : next.width - 250,
          }
        : l,
    );
  if (p.protectedArea) next.protectedArea=resizeProject(p,ratio).protectedArea;
  next.name = p.name === oldDefaults.name ? next.name : p.name;
  return projectSchema.parse(next);
}

export function alignElements(
  p: Project,
  ids: string[],
  alignment: "left" | "center" | "right" | "top" | "middle" | "bottom",
): Project {
  const layers = p.layers.filter((l) => ids.includes(l.id) && !l.locked);
  if (!layers.length) throw Error("没有可移动的图层");
  const x = Math.min(...layers.map((l) => l.x)),
    y = Math.min(...layers.map((l) => l.y)),
    w = Math.max(...layers.map((l) => l.x + l.width)) - x,
    h = Math.max(...layers.map((l) => l.y + l.height)) - y;
  let dx = 0,
    dy = 0;
  if (alignment === "left") dx = 40 - x;
  if (alignment === "center") dx = (p.width - w) / 2 - x;
  if (alignment === "right") dx = p.width - w - 40 - x;
  if (alignment === "top") dy = 40 - y;
  if (alignment === "middle") dy = (p.height - h) / 2 - y;
  if (alignment === "bottom") dy = p.height - h - 40 - y;
  return moveLayers(p, ids, dx, dy);
}
export function arrangeLayers(p:Project,ids:string[],action:'left'|'center'|'right'|'top'|'middle'|'bottom'|'distribute-x'|'distribute-y',target:'selection'|'canvas'='selection'):Project{
 const layers=p.layers.filter(l=>ids.includes(l.id)&&!l.locked&&l.visible);
 const bounds=(l:Layer)=>{const a=l.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);const points=[[0,0],[l.width,0],[0,l.height],[l.width,l.height]].map(([x,y])=>({x:l.x+x*c-y*s,y:l.y+x*s+y*c}));const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));return {x,y,w:Math.max(...points.map(p=>p.x))-x,h:Math.max(...points.map(p=>p.y))-y};};
 if(!layers.length)throw Error('请选择可见且未锁定的图层');
 const boxes=layers.map(l=>({l,...bounds(l)})),patches=new Map<string,{x:number;y:number}>();
 if(action.startsWith('distribute')){
  if(layers.length<3)throw Error('等间距分布需要至少三个图层');
  const horizontal=action==='distribute-x',pos=horizontal?'x':'y',size=horizontal?'w':'h';
  const sorted=[...boxes].sort((a,b)=>a[pos]-b[pos]),first=sorted[0],last=sorted.at(-1)!;
  const gap=(last[pos]+last[size]-first[pos]-sorted.reduce((n,b)=>n+b[size],0))/(sorted.length-1);
  if(gap<0)throw Error('空间不足，请先拉开首尾图层');
  let cursor=first[pos];sorted.forEach((b,i)=>{if(i>0&&i<sorted.length-1)patches.set(b.l.id,{x:b.l.x+(horizontal?cursor-b.x:0),y:b.l.y+(!horizontal?cursor-b.y:0)});cursor+=b[size]+gap;});
 }else{
  const x=target==='canvas'?0:Math.min(...boxes.map(b=>b.x)),y=target==='canvas'?0:Math.min(...boxes.map(b=>b.y));
  const right=target==='canvas'?p.width:Math.max(...boxes.map(b=>b.x+b.w)),bottom=target==='canvas'?p.height:Math.max(...boxes.map(b=>b.y+b.h));
  for(const b of boxes){let dx=0,dy=0;if(action==='left')dx=x-b.x;if(action==='center')dx=(x+right-b.w)/2-b.x;if(action==='right')dx=right-b.w-b.x;if(action==='top')dy=y-b.y;if(action==='middle')dy=(y+bottom-b.h)/2-b.y;if(action==='bottom')dy=bottom-b.h-b.y;patches.set(b.l.id,{x:b.l.x+dx,y:b.l.y+dy});}
 }
 return projectSchema.parse({...p,layers:p.layers.map(l=>patches.has(l.id)?{...l,...patches.get(l.id)}:l)});
}
export function duplicateComponent(p: Project, name: string): Project {
  const ids = groupIds(p, name),
    groupId = newLocalId();
  if (!ids.length) throw Error("没有找到该组件");
  const copies = p.layers
    .filter((l) => ids.includes(l.id))
    .map((l, index) => ({
      ...l,
      id: groupId + "-" + index,
      groupId,
      groupName: name.split(" · ")[0] + " 副本",
      locked: false,
    }));
  if (p.layers.length + copies.length > 100)
    throw Error("复制后将超过100个图层，请先精简设计");
  return projectSchema.parse({ ...p, layers: [...p.layers, ...copies] });
}
