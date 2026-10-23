import {
  type Project,
  type Layer,
  template,
  applyOps,
  projectSchema,
  styles,
} from "./design";
import {
  groupsForProject,
  groupIds,
  moveLayers,
  toggleComponent,
} from "./editor-actions";
const colors: Record<string, string> = {
  金色: "#dfb778",
  蓝色: "#235ff5",
  白色: "#ffffff",
  黑色: "#111827",
  紫色: "#7c58bb",
  红色: "#d94b4b",
  绿色: "#498c73",
};
function colorOf(q: string) {
  const h = q.match(/#[0-9a-fA-F]{6}/);
  if (h) return h[0];
  return Object.entries(colors).find(([k]) => q.includes(k))?.[1];
}
function target(p: Project, q: string, selected?: string): Layer | undefined {
  if (q.includes("选中")) return p.layers.find((l) => l.id === selected);
  if (/logo/i.test(q)) return p.layers.find((l) => /logo/i.test(l.name));
  const aliases: [string, string][] = [
    ["副标题", "副标题"],
    ["底部信息", "底部信息"],
    ["姓名条", "姓名条"],
    ["品牌", "品牌"],
    ["角标", "直播角标"],
    ["标题", "活动标题"],
    ["背景", "背景"],
  ];
  for (const [word, id] of aliases)
    if (q.includes(word)) return p.layers.find((l) => l.id === id);
  return p.layers.find((l) => q.includes(l.name) && l.type !== "background");
}
function executeOne(p: Project, q: string, selected?: string): Project {
  q = q.trim().replace(/[。！]$/, "");
  if (
    /^(?:请)?(?:帮我)?(?:生成|设计|来|换)(?:一套|一个)?/.test(q) &&
    /包装|直播间|发布会|年会|培训/.test(q)
  ) {
    const scene = /女装|电商|门店|商品|带货/.test(q)
      ? 3
      : /年会/.test(q)
        ? 1
        : /培训|教学|课程/.test(q)
          ? 2
          : 0;
    const ratio = /9[:：]16|竖屏/.test(q)
      ? "portrait"
      : /16[:：]9|横屏/.test(q)
        ? "landscape"
        : p.height > p.width
          ? "portrait"
          : "landscape";
    return template(scene, ratio, p.mode);
  }
  const group =
    Object.entries(groupsForProject(p)).find(([name, ids]) =>
      q.includes("选中")
        ? !!selected && ids.includes(selected)
        : q.includes(name),
    )?.[0] || (q.includes("底部信息") ? "底部信息条" : undefined);
  if (/隐藏|关闭|显示|开启/.test(q)) {
    const show = /显示|开启/.test(q);
    if (group) return toggleComponent(p, group, show);
    const l = target(p, q, selected);
    if (!l) throw Error("没有找到要显示或隐藏的图层");
    return applyOps(p, [{ id: l.id, changes: { visible: show } }]);
  }
  const text = q.match(
    /(?:活动标题|副标题|标题|姓名条|底部信息|品牌名|品牌|角标|选中文字)(?:的文字)?(?:改成|改为|设为)[“「"']?(.+?)[”」"']?$/,
  );
  if (text && !/颜色|字号|不透明度/.test(q.slice(0, q.indexOf(text[1])))) {
    const l = target(p, q, selected);
    if (!l || l.type !== "text") throw Error("没有找到目标文字图层");
    return applyOps(p, [{ id: l.id, changes: { text: text[1] } }]);
  }
  if (/主题色|强调色/.test(q)) {
    const c = colorOf(q);
    if (!c) throw Error("请指定颜色名称或#十六进制颜色");
    const accent =
      p.layers.find((l) => l.id === "顶部强调线")?.fill ||
      styles[p.scene].accent;
    return projectSchema.parse({
      ...p,
      layers: p.layers.map((l) => (l.fill === accent ? { ...l, fill: c } : l)),
    });
  }
  const l = target(p, q, selected);
  if (!l)
    throw Error(
      /logo/i.test(q)
        ? "请先上传 Logo，再调整它的位置"
        : "请写明目标，例如标题、姓名条、底部信息条或选中图层",
    );
  const changes: Record<string, unknown> = {};
  if (/颜色|色调/.test(q)) {
    const c = colorOf(q);
    if (!c) throw Error("请使用颜色名称或#RRGGBB");
    changes.fill = c;
  }
  const size = q.match(/(放大|缩小)\s*(\d+(?:\.\d+)?)\s*%/);
  if (size && l.fontSize)
    changes.fontSize = Math.max(
      8,
      Math.min(
        400,
        l.fontSize * (1 + ((size[1] === "放大" ? 1 : -1) * +size[2]) / 100),
      ),
    );
  const font = q.match(/字号(?:改成|改为|设为|为)?\s*(\d+)/);
  if (font && l.type === "text")
    changes.fontSize = Math.max(8, Math.min(400, +font[1]));
  const opacity = q.match(
    /(?:不透明度|透明度)(?:改成|改为|设为|为)?\s*(\d+)\s*%/,
  );
  if (opacity) changes.opacity = Math.max(0, Math.min(1, +opacity[1] / 100));
  const position = q.match(/左上|右上|左下|右下|水平居中|垂直居中|居中/),
    relative = q.match(
      /(?:向|往)(左|右|上|下)(?:移动|移)?\s*(\d+)(?:像素|px)?/,
    );
  if (position || relative) {
    const ids = group ? groupIds(p, group) : [l.id];
    const layers = p.layers.filter((x) => ids.includes(x.id));
    const box = {
      x: Math.min(...layers.map((x) => x.x)),
      y: Math.min(...layers.map((x) => x.y)),
      right: Math.max(...layers.map((x) => x.x + x.width)),
      bottom: Math.max(...layers.map((x) => x.y + x.height)),
    };
    let dx = 0,
      dy = 0;
    const bw = box.right - box.x,
      bh = box.bottom - box.y;
    if (relative) {
      const n = +relative[2];
      dx = relative[1] === "左" ? -n : relative[1] === "右" ? n : 0;
      dy = relative[1] === "上" ? -n : relative[1] === "下" ? n : 0;
    }
    if (position) {
      const t = position[0];
      if (t.includes("左")) dx = 40 - box.x;
      if (t.includes("右")) dx = p.width - bw - 40 - box.x;
      if (t.includes("上")) dy = 40 - box.y;
      if (t.includes("下")) dy = p.height - bh - 100 - box.y;
      if (t === "水平居中" || t === "居中") dx = (p.width - bw) / 2 - box.x;
      if (t === "垂直居中" || t === "居中") dy = (p.height - bh) / 2 - box.y;
    }
    p = moveLayers(p, ids, dx, dy);
  }
  if (Object.keys(changes).length) return applyOps(p, [{ id: l.id, changes }]);
  if (position || relative) return p;
  throw Error(
    "本地指令暂不支持这句话。可尝试：隐藏姓名条、姓名条移到右下角、标题字号48、底部信息改成…；自由描述需要接通真实 AI。",
  );
}
export function executeCommand(
  p: Project,
  q: string,
  selected?: string,
): Project {
  const commands = q
    .split(/[；;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (!commands.length || commands.length > 10)
    throw Error("每次请提交1～10条指令，用分号分隔");
  let next = p;
  for (const command of commands) next = executeOne(next, command, selected);
  if (
    JSON.stringify(projectSchema.parse(next)) ===
    JSON.stringify(projectSchema.parse(p))
  )
    throw Error("指令没有产生实际变化，画布保持原样");
  return next;
}
