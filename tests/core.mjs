import fs from "node:fs";
import ts from "typescript";
import assert from "node:assert/strict";
fs.writeFileSync(
  "lib/.design-test.mjs",
  ts.transpileModule(fs.readFileSync("lib/design.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
);
try {
  const {
    template,
    applyBroadcastMaterials,
    projectSchema,
    demoCommand,
    applyOps,
    safeArea,
    resizeProject,
  } = await import("../lib/.design-test.mjs");
  const prior = template(2);
  delete prior.packagingVersion;
  prior.layers = prior.layers.map(({ src, ...l }) => ({
    ...l,
    fill: l.type === "text" ? "#123456" : l.fill,
  }));
  const restored = applyBroadcastMaterials(prior);
  assert.equal(restored.layers.find((l) => l.id === "姓名条").fill, "#123456");
  assert.equal(restored.layers.filter((l) => l.src).length, 1);
  assert.deepEqual(applyBroadcastMaterials(restored), restored);
  assert.equal(
    projectSchema
      .parse(JSON.parse(JSON.stringify(restored)))
      .layers.filter((l) => l.src).length,
    1,
  );
  const seenAssets = new Set();
  const seenLayouts = new Set();
  for (let scene = 0; scene < 4; scene++)
    for (const ratio of ["landscape", "portrait"]) {
      const current = template(scene, ratio);
      const art = current.layers.find((l) => l.id === "姓名条底板");
      seenAssets.add(art.src);
      seenLayouts.add(
        JSON.stringify(
          current.layers.map(({ x, y, width, height }) => ({
            x,
            y,
            width,
            height,
          })),
        ),
      );
    }
  assert.equal(
    seenAssets.size,
    8,
    "each scene/orientation has independently generated artwork",
  );
  assert.equal(
    seenLayouts.size,
    8,
    "all scene/orientation layouts are distinct",
  );
  let templates = 0;
  for (let i = 0; i < 4; i++)
    for (const ratio of ["landscape", "portrait"])
      for (const mode of ["overlay", "warmup"]) {
        const p = projectSchema.parse(template(i, ratio, mode));
        templates++;
        assert.equal(new Set(p.layers.map((x) => x.id)).size, p.layers.length);
        assert.equal(
          p.width / p.height,
          ratio === "landscape" ? 16 / 9 : 9 / 16,
        );
        assert.equal(p.mode, mode);
        if (mode === "overlay") {
          assert.equal(
            p.layers.find((l) => l.type === "background").opacity,
            0,
          );
          const a = safeArea(p);
          for (const l of p.layers.filter((l) => l.type !== "background")) {
            const intersection =
              Math.min(l.x + l.width, a.x + a.width) > Math.max(l.x, a.x) &&
              Math.min(l.y + l.height, a.y + a.height) > Math.max(l.y, a.y);
            assert.equal(
              intersection,
              false,
              `${ratio} ${l.name} covers live content`,
            );
            assert(
              l.x >= 0 &&
                l.y >= 0 &&
                l.x + l.width <= p.width &&
                l.y + l.height <= p.height,
              `${ratio} ${l.name} out of canvas`,
            );
          }
        }
        assert.deepEqual(projectSchema.parse(JSON.parse(JSON.stringify(p))), p);
      }
  const p = template();
  const renamed = demoCommand(p, "标题改成2027 AI创新大会");
  assert.equal(
    renamed.layers.find((x) => x.id === "活动标题").text,
    "2027 AI创新大会",
  );
  assert.deepEqual(
    renamed.layers.filter((x) => x.id !== "活动标题"),
    p.layers.filter((x) => x.id !== "活动标题"),
  );
  assert.equal(
    demoCommand(p, "标题放大20%").layers.find((x) => x.id === "活动标题")
      .fontSize,
    48,
  );
  assert.equal(
    demoCommand(p, "标题颜色改成金色").layers.find((x) => x.id === "活动标题")
      .fill,
    "#dfb778",
  );
  assert.equal(
    demoCommand(p, "姓名条改成张老师 / 产品专家").layers.find(
      (x) => x.id === "姓名条",
    ).text,
    "张老师 / 产品专家",
  );
  assert.throws(() => demoCommand(p, "把Logo移动到右上角"), /上传/);
  for (const ratio of ["landscape", "portrait"]) {
    const d = template(0, ratio);
    d.layers.push({
      id: "logo",
      name: "Logo",
      type: "image",
      x: 0,
      y: 0,
      width: 140,
      height: 50,
      fill: "#fff",
      opacity: 1,
      visible: true,
      locked: false,
      rotation: 0,
    });
    const logo = demoCommand(d, "把Logo移动到右上角").layers.find(
      (l) => l.id === "logo",
    );
    assert.equal(logo.x, d.width - 200);
    assert.equal(logo.y, 80);
  }
  assert.throws(() =>
    applyOps(p, [{ id: "活动标题", changes: { fontSize: 99999 } }]),
  );
  assert.throws(() =>
    applyOps(p, [{ id: "missing", changes: { text: "oops" } }]),
  );
  assert.throws(() =>
    applyOps(p, [{ id: "活动标题", changes: { src: "https://evil.test" } }]),
  );
  assert.throws(() =>
    projectSchema.parse({
      ...p,
      layers: [{ ...p.layers[0], src: "https://evil.test" }],
    }),
  );
  assert.throws(() => projectSchema.parse({ ...p, width: 1920, height: 1920 }));
  assert.throws(() =>
    projectSchema.parse({ ...p, layers: [p.layers[0], p.layers[0]] }),
  );
  assert.throws(() => demoCommand(p, "随便做个特效"));
  const old = { ...template(0, "landscape", "warmup") };
  delete old.mode;
  delete old.scene;
  assert.equal(projectSchema.parse(old).mode, "warmup");
  const scaled = resizeProject(template(1, "landscape", "warmup"), "portrait");
  assert.equal(scaled.width, 1080);
  assert.equal(scaled.height, 1920);
  projectSchema.parse(scaled);
  console.log(
    `PASS: ${templates} scene/ratio/purpose combinations; transparent overlays, content safe areas, bounds, exact-target edits, portrait Logo placement, legacy migration, JSON round trips, invalid command and schema rejection.`,
  );
} finally {
  fs.unlinkSync("lib/.design-test.mjs");
}
