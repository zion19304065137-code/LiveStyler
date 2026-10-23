import { newLocalId } from "./design";
import { z } from "zod";
import { projectSchema, styles, type Project, type Layer } from "./design";
export const brandSchema = z.object({
  name: z.string().min(1).max(80),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  logo: z
    .object({
      src: z
        .string()
        .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
        .max(16000000),
      ratio: z.number().min(0.05).max(30),
    })
    .optional(),
});
export type BrandKit = z.infer<typeof brandSchema>;
export function applyBrand(p: Project, raw: unknown): Project {
  const b = brandSchema.parse(raw),
    accent =
      p.layers.find((l) => l.id === "顶部强调线")?.fill ||
      styles[p.scene].accent;
  let layers = p.layers.map((l) => ({
    ...l,
    ...(l.id === "品牌" ? { text: b.name } : {}),
    ...(l.fill === accent ? { fill: b.accent } : {}),
  }));
  if (b.logo) {
    const width = Math.min(150, b.logo.ratio * 50),
      height = width / b.logo.ratio;
    const existing = layers.find(
      (l) => /logo/i.test(l.name) && l.type === "image",
    );
    if (existing) {
      layers = layers.map((l) =>
        l.id === existing.id
          ? { ...l, src: b.logo!.src, width, height, visible: true }
          : l,
      );
    } else {
      if (layers.length >= 100)
        throw Error("图层数量已达上限，请先删除不需要的图层");
      layers.push({
        id: newLocalId(),
        name: "品牌 Logo",
        type: "image",
        x: 40,
        y: 26,
        width,
        height,
        src: b.logo.src,
        fill: "#ffffff",
        opacity: 1,
        visible: true,
        locked: false,
        rotation: 0,
      });
    }
    if (p.mode === "overlay")
      layers = layers.map((l) =>
        l.id === "品牌"
          ? {
              ...l,
              x: 210,
              width: p.width > p.height ? 280 : Math.min(750, p.width - 250),
            }
          : l,
      );
  }
  return projectSchema.parse({ ...p, layers });
}
export function brandFromProject(p: Project): BrandKit {
  const logo = p.layers.find(
    (l) => /logo/i.test(l.name) && l.type === "image" && l.src,
  );
  return {
    name: p.layers.find((l) => l.id === "品牌")?.text || "YOUR BRAND",
    accent:
      p.layers.find((l) => l.id === "顶部强调线")?.fill ||
      styles[p.scene].accent,
    ...(logo
      ? { logo: { src: logo.src!, ratio: logo.width / logo.height } }
      : {}),
  };
}
