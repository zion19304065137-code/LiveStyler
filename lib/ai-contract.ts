import { z } from "zod";
import {
  layerSchema,
  patchSchema,
  projectSchema,
  type Project,
} from "./design";
const addition = layerSchema
  .omit({ type: true, src: true })
  .extend({ type: z.enum(["text", "shape"]) })
  .strict();
export const aiResultSchema = z
  .object({
    operations: z.array(patchSchema).max(30).default([]),
    additions: z.array(addition).max(10).default([]),
    removals: z.array(z.string().min(1).max(100)).max(20).default([]),
  })
  .strict()
  .refine(
    (x) => x.operations.length + x.additions.length + x.removals.length > 0,
    "没有实际操作",
  );
export function applyAiResult(project: Project, result: unknown): Project {
  const r = aiResultSchema.parse(result);
  const existing = new Set(project.layers.map((l) => l.id));
  for (const op of r.operations)
    if (!existing.has(op.id)) throw Error("AI引用了不存在的图层");
  for (const id of r.removals) {
    const l = project.layers.find((l) => l.id === id);
    if (!l || l.type === "background" || l.locked)
      throw Error("AI无法移除不存在、背景或锁定图层");
  }
  for (const l of r.additions)
    if (existing.has(l.id)) throw Error("AI新图层ID与现有图层重复");
  const p = projectSchema.parse({
    ...project,
    layers: [
      ...project.layers
        .filter((l) => !r.removals.includes(l.id))
        .map((l) => ({
          ...l,
          ...r.operations
            .filter((o) => o.id === l.id)
            .reduce((acc, o) => ({ ...acc, ...o.changes }), {}),
        })),
      ...r.additions,
    ],
  });
  for (const l of p.layers) {
    if (l.type === "background") {
      if (project.mode === "overlay" && l.visible && l.opacity > 0.01)
        throw Error("直播包装背景必须保持透明，请切换暖场用途后生成整版背景");
      continue;
    }
    if (
      l.x < 0 ||
      l.y < 0 ||
      l.x + l.width > p.width + 1 ||
      l.y + l.height > p.height + 1
    )
      throw Error("AI操作使图层超出画布，已保留原设计");
  }
  if (JSON.stringify(p) === JSON.stringify(projectSchema.parse(project)))
    throw Error("AI没有实际修改画布，请换一种描述");
  return p;
}
