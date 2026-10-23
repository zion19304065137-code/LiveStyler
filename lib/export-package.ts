import JSZip from "jszip";
import type { Project } from "./design";
export async function buildMaterialPackage(
  project: Project,
  render: (format?: string, ids?: string[]) => string,
  groups: Record<string, string[]> = {},
  selectedIds?:string[],
): Promise<Blob> {
  const scoped=selectedIds?{...project,layers:project.layers.filter(l=>selectedIds.includes(l.id))}:project;
  if(!scoped.layers.some(l=>l.visible&&l.opacity>0))throw Error('没有可导出的目标图层');
  const zip = new JSZip();
  zip.file("完整设计.png", render("png",selectedIds).split(",")[1], { base64: true });
  const manifest: { file: string; layerId: string; name: string }[] = [];
  for (const [index, layer] of scoped.layers
    .filter((l) => l.visible && l.opacity > 0 && l.type !== "background")
    .entries()) {
    const clean =
      layer.name.replace(/[^\w\u4e00-\u9fa5-]/g, "_").slice(0, 60) || "图层";
    const filename = String(index + 1).padStart(3, "0") + "_" + clean + ".png";
    zip.file(filename, render("png", [layer.id]).split(",")[1], {
      base64: true,
    });
    manifest.push({ file: filename, layerId: layer.id, name: layer.name });
  }
  const grouped: { name: string; file: string; layerIds: string[] }[] = [];
  for (const [index, [name, ids]] of Object.entries(groups).entries()) {
    const visible = ids.filter((id) =>
      scoped.layers.some((l) => l.id === id && l.visible && l.opacity > 0),
    );
    if (!visible.length) continue;
    const file =
      "组件_" +
      String(index + 1).padStart(2, "0") +
      "_" +
      name.replace(/[^\w\u4e00-\u9fa5-]/g, "_") +
      ".png";
    zip.file(file, render("png", visible).split(",")[1], { base64: true });
    grouped.push({ name, file, layerIds: visible });
  }
  zip.file("project.livestyler.json", JSON.stringify(scoped, null, 2));
  zip.file(
    "素材清单.json",
    JSON.stringify(
      {
        width: project.width,
        height: project.height,
        mode: project.mode,
        layers: manifest,
        components: grouped,
      },
      null,
      2,
    ),
  );
  zip.file(
    "使用说明.txt",
    `LiveStyler 直播素材包\n画幅：${project.width} × ${project.height}\n用途：${project.mode === "overlay" ? "透明直播包装" : "开场／暖场"}\n\n把完整设计.png作为图片素材添加到保利威开播端或OBS，放在视频源上方。画布尺寸保持一致，图片适配画布即可。\n组件PNG已合并文字与底板，可单独叠加使用。\n独立图层PNG保留原始画布坐标，请勿裁去透明边缘。\n主播参考图、内容保留区和编辑选框不在素材中。\nproject.livestyler.json可在LiveStyler重新打开编辑。`,
  );
  return zip.generateAsync({ type: "blob" });
}
