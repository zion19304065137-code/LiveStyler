import Konva from "konva";
import type { Project } from "./design";
/** Shared by the editor and native-canvas regression tests. Preview nodes never export. */
export function exportStage(
  stage: Konva.Stage,
  project: Pick<Project, "width" | "height" | "mode">,
  format = "png",
  ids?: string[],
): string {
  if (!["png", "jpg"].includes(format)) throw Error("不支持的导出格式");
  if (format === "jpg" && project.mode === "overlay")
    throw Error("直播包装需要透明通道，请使用 PNG 或 ZIP");
  const targets = stage
    .find(".art")
    .filter(
      (n) =>
        n.visible() &&
        n.opacity() > 0 &&
        (!ids || ids.includes(n.getAttr("layerId"))),
    );
  if (!targets.length)
    throw Error("没有可导出的可见图层，请检查显示开关和不透明度");
  if (
    targets.some(
      (n) => n.getClassName() === "Image" && !(n as Konva.Image).image(),
    )
  )
    throw Error("图片仍在加载或加载失败，请重新上传后再导出");
  const clone = stage.clone({
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    width: project.width,
    height: project.height,
  }) as Konva.Stage;
  try {
    clone.find("Transformer").forEach((n) => n.destroy());
    clone.find('.editor-guide').forEach(n=>n.destroy());
    clone.find(".preview-only").forEach((n) => n.destroy());
    clone.find(".art").forEach((n) => {
      if (ids && !ids.includes(n.getAttr("layerId"))) n.visible(false);
    });
    if (format === "jpg") {
      const white = new Konva.Rect({
        width: project.width,
        height: project.height,
        fill: "#ffffff",
        listening: false,
      });
      clone.getLayers()[0].add(white);
      white.moveToBottom();
    }
    return clone.toDataURL({
      pixelRatio: 1,
      mimeType: format === "jpg" ? "image/jpeg" : "image/png",
      quality: 0.95,
    });
  } finally {
    clone.destroy();
  }
}

/** Snapshot only the currently displayed footage crop, excluding all decoration. */
export function capturePreviewStage(stage: Konva.Stage, project: Pick<Project,"width"|"height">,composition=false): string {
  const node=stage.findOne('.preview-footage') as Konva.Image|undefined;
  if(!composition&&!node?.image())throw Error('预览画面尚未加载完成');
  const clone=stage.clone({x:0,y:0,scaleX:1,scaleY:1,width:project.width,height:project.height}) as Konva.Stage;
  try {
    clone.find('Transformer').forEach(n=>n.destroy());
    clone.find('.editor-guide').forEach(n=>n.destroy());
    clone.find('.editor-only').forEach(n=>n.destroy());
    if(!composition)clone.find('.art').forEach(n=>n.destroy());
    if(!composition)clone.getLayers().forEach(layer=>layer.getChildren().slice().forEach(n=>{if(!(n instanceof Konva.Container)||!n.findOne('.preview-footage'))n.destroy();}));
    clone.find('.preview-only').forEach(n=>{if(!(n as Konva.Container).findOne('.preview-footage'))n.destroy();});
    return clone.toDataURL({x:0,y:0,width:project.width,height:project.height,pixelRatio:1,mimeType:'image/jpeg',quality:.88});
  }finally{clone.destroy();}
}
