import fs from "node:fs";
import ts from "typescript";
import assert from "node:assert/strict";
import { createCanvas, Image, loadImage, GlobalFonts } from "@napi-rs/canvas";
import Konva from "konva";
import JSZip from "jszip";
if (fs.existsSync("/workspace/scratch/748b24737248/NotoSansCJKsc-Regular.otf"))
  GlobalFonts.registerFromPath(
    "/workspace/scratch/748b24737248/NotoSansCJKsc-Regular.otf",
    "Microsoft YaHei",
  );
// Native Skia canvas backend. No browser, preview server, or fake image generation.
Konva.Util.createCanvasElement = () => {
  const c = createCanvas(300, 300);
  c.style = {};
  return c;
};
Konva.Util.createImageElement = () => new Image();
const files = ["design", "conversation", "work-bundle", "canvas-export", "storage", "export-package"];
for (const file of files) {
  let out = ts.transpileModule(fs.readFileSync("lib/" + file + ".ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  out = out.replace(/from ['"]\.\/design['"]/g, 'from "./.design-test.mjs"');
  out=out.replace(/from [\'"]\.\/conversation[\'"]/g, 'from "./.conversation-test.mjs"');
  out=out.replace(/from [\'"]\.\/work-bundle[\'"]/g, 'from "./.work-bundle-test.mjs"');
  fs.writeFileSync("lib/." + file + "-test.mjs", out);
}
try {
  const { template } = await import("../lib/.design-test.mjs");
  const { exportStage } = await import("../lib/.canvas-export-test.mjs");
  const { buildMaterialPackage } = await import(
    "../lib/.export-package-test.mjs"
  );
  async function pixels(url) {
    const img = await loadImage(url);
    const c = createCanvas(img.width, img.height);
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    return {
      width: img.width,
      height: img.height,
      pixel: (x, y) => [...ctx.getImageData(x, y, 1, 1).data],
    };
  }
  let count = 0;
  for (const ratio of ["landscape", "portrait"])
    for (let i = 0; i < 4; i++) {
      const p = template(i, ratio);
      const material = p.layers.find((l) => l.id === "姓名条底板");
      const sourceImage = await loadImage(material.src);
      assert.ok(
        Math.abs(
          material.width -
            (material.height * sourceImage.width) / sourceImage.height,
        ) < 5,
        "generated graphic must retain intrinsic aspect ratio",
      );
      const stage = new Konva.Stage({
        width: p.width * 0.3,
        height: p.height * 0.3,
        scaleX: 0.3,
        scaleY: 0.3,
      });
      const layer = new Konva.Layer();
      stage.add(layer);
      const preview = new Konva.Group({ name: "preview-only" });
      preview.add(
        new Konva.Rect({ width: p.width, height: p.height, fill: "#ff00ff" }),
      );
      const photograph = await loadImage(
        "public/scenes/" +
          ["launch", "gala", "training", "fashion"][i] +
          "-v1.webp",
      );
      const photoRatio = p.width / p.height,
        source = photograph.width / photograph.height;
      const focus = photoRatio < 1 ? 0.5 : [0.38, 0.35, 0.4, 0.02][i];
      const crop =
        source > photoRatio
          ? {
              x: (photograph.width - photograph.height * photoRatio) / 2,
              y: 0,
              width: photograph.height * photoRatio,
              height: photograph.height,
            }
          : {
              x: 0,
              y: (photograph.height - photograph.width / photoRatio) * focus,
              width: photograph.width,
              height: photograph.width / photoRatio,
            };
      preview.add(
        new Konva.Image({
          image: photograph,
          width: p.width,
          height: p.height,
          crop,
        }),
      );
      layer.add(preview);
      for (const l of p.layers) {
        const attrs = { ...l, name: "art", layerId: l.id };
        layer.add(
          l.type === "text"
            ? new Konva.Text({
                ...attrs,
                text: l.text,
                fontFamily: "Microsoft YaHei",
                fontStyle: l.id === "活动标题" ? "bold" : "normal",
              })
            : l.src
              ? new Konva.Image({
                  ...attrs,
                  fill: undefined,
                  image: await loadImage(l.src),
                })
              : new Konva.Rect(attrs),
        );
      }
      const guides = new Konva.Group({ name: "preview-only" });
      guides.add(
        new Konva.Rect({
          width: p.width,
          height: p.height,
          stroke: "#00ff00",
          strokeWidth: 12,
        }),
      );
      layer.add(guides);
      const tr = new Konva.Transformer({ nodes: [layer.find(".art")[3]] });
      layer.add(tr);
      const original = stage.toJSON();
      const exported = await pixels(exportStage(stage, p));
      assert.equal(exported.width, p.width);
      assert.equal(exported.height, p.height);
      assert.equal(
        exported.pixel(Math.floor(p.width / 2), Math.floor(p.height / 2))[3],
        0,
        "center must be fully transparent",
      );
      const header = p.layers.find((l) => l.id === "顶部品牌底板");
      assert.ok(
        exported.pixel(
          Math.floor(header.x + header.width * 0.5),
          Math.floor(header.y + header.height * 0.5),
        )[3] > 220,
        "generated header remains legible with its original alpha",
      );
      assert.notDeepEqual(
        exported.pixel(10, 10).slice(0, 3),
        [255, 0, 255],
        "preview must not leak",
      );
      const selected = await pixels(
        exportStage(stage, p, "png", ["姓名条底板"]),
      );
      const name = p.layers.find((l) => l.id === "姓名条底板");
      assert.ok(
        selected.pixel(
          Math.floor(name.x + name.width * 0.4),
          Math.floor(name.y + name.height * 0.5),
        )[3] > 240,
      );
      assert.equal(
        selected.pixel(10, 10)[3],
        0,
        "unselected header must not leak",
      );
      assert.equal(
        stage.toJSON(),
        original,
        "export must not mutate preview stage",
      );
      assert.throws(() => exportStage(stage, p, "jpg"), /透明/);
      assert.throws(() => exportStage(stage, p, "png", ["missing"]), /可见/);
      guides.destroy();
      tr.destroy();
      fs.writeFileSync(
        `/workspace/scratch/748b24737248/overlay-${i}-${ratio}.png`,
        Buffer.from(stage.toDataURL({ pixelRatio: 2 }).split(",")[1], "base64"),
      );
      stage.destroy();
      count++;
    }
  const p = template(0, "portrait", "warmup");
  const stage = new Konva.Stage({ width: 1080, height: 1920 });
  const layer = new Konva.Layer();
  stage.add(layer);
  layer.add(
    new Konva.Rect({
      name: "art",
      layerId: "test",
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      fill: "#000",
      opacity: 0.5,
    }),
  );
  const jpg = exportStage(stage, p, "jpg");
  assert(jpg.startsWith("data:image/jpeg"));
  const j = await pixels(jpg);
  assert.equal(j.width, 1080);
  assert.equal(j.height, 1920);
  assert(
    j
      .pixel(1, 1)
      .slice(0, 3)
      .every((x) => x > 250),
    "JPG must have white background",
  );
  stage.destroy();

  // Use real image bytes, preserving transparent edges and original coordinates.
  const lp = template(0);
  const ls = new Konva.Stage({
    width: 576,
    height: 324,
    scaleX: 0.3,
    scaleY: 0.3,
  });
  const ll = new Konva.Layer();
  ls.add(ll);
  const raster = createCanvas(100, 100);
  const rc = raster.getContext("2d");
  rc.fillStyle = "#ff0000";
  rc.fillRect(25, 25, 50, 50);
  const image = await loadImage(raster.toDataURL("image/png"));
  ll.add(
    new Konva.Image({
      name: "art",
      layerId: "logo",
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      image,
    }),
  );
  const logo = await pixels(exportStage(ls, lp, "png", ["logo"]));
  assert.equal(logo.pixel(110, 110)[3], 0);
  assert.equal(logo.pixel(200, 200)[3], 255);
  assert.equal(logo.pixel(10, 10)[3], 0);
  const hidden = new Konva.Rect({
    name: "art",
    layerId: "hidden",
    width: 100,
    height: 100,
    fill: "red",
    visible: false,
  });
  ll.add(hidden);
  assert.throws(() => exportStage(ls, lp, "png", ["hidden"]), /可见/);
  ll.add(
    new Konva.Image({ name: "art", layerId: "pending", width: 50, height: 50 }),
  );
  assert.throws(() => exportStage(ls, lp, "png", ["pending"]), /加载/);
  exportStage(ls, lp, "png", ["logo"]);
  const zipProject = {
    ...lp,
    layers: [
      {
        id: "logo",
        name: "Logo",
        type: "image",
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        fill: "#fff",
        src: raster.toDataURL("image/png"),
        opacity: 1,
        visible: true,
        locked: false,
        rotation: 0,
      },
    ],
  };
  const blob = await buildMaterialPackage(
    zipProject,
    (f, ids) => exportStage(ls, lp, f, ids || ["logo"]),
    { Logo: ["logo"] },
  );
  const pack = await JSZip.loadAsync(await blob.arrayBuffer());
  const manifest = JSON.parse(await pack.file("素材清单.json").async("string"));
  assert.equal(manifest.width, 1920);
  assert.equal(manifest.layers.length, 1);
  assert.equal(manifest.components.length, 1);
  assert(pack.file(manifest.components[0].file));
  const bytes = await pack.file(manifest.layers[0].file).async("base64");
  const zi = await pixels("data:image/png;base64," + bytes);
  assert.equal(zi.pixel(200, 200)[3], 255);
  assert.equal(zi.pixel(110, 110)[3], 0);
  assert.deepEqual(
    JSON.parse(await pack.file("project.livestyler.json").async("string")),
    zipProject,
  );
  const scopedProject={...zipProject,layers:[...zipProject.layers,{...zipProject.layers[0],id:'exclude',name:'Do not export'}]};
  const calls=[];const scopedBlob=await buildMaterialPackage(scopedProject,(f,ids)=>{calls.push(ids);return exportStage(ls,lp,f,ids);},{Logo:['logo'],Other:['exclude']},['logo']);
  const scopedZip=await JSZip.loadAsync(await scopedBlob.arrayBuffer());
  assert(calls.every(ids=>ids.length===1&&ids[0]==='logo'),'Every scoped ZIP render obeys the selected IDs');
  assert.deepEqual(JSON.parse(await scopedZip.file('project.livestyler.json').async('string')).layers.map(l=>l.id),['logo']);
  assert.equal(JSON.parse(await scopedZip.file('素材清单.json').async('string')).components.length,1);
  console.log('PASS: selected-only ZIP excludes unselected images, component groups and editable layers.');
  assert(
    (await pack.file("使用说明.txt").async("string")).includes(
      "放在视频源上方",
    ),
  );
  ls.destroy();
  console.log(
    "PASS: uploaded Logo alpha and placement, hidden layer rejection, unloaded image rejection without blocking unrelated selected exports, ZIP extraction and project/image round-trip.",
  );
  console.log(
    `PASS: ${count} real PNG renders, full dimensions, transparent centers, opaque decorations, isolated layer exports, preview/guide exclusion, stage immutability, overlay JPG rejection; portrait JPG dimensions and white matte.`,
  );
  const { indexedDB } = await import("fake-indexeddb");
  globalThis.indexedDB = indexedDB;
  const { save, load } = await import("../lib/.storage-test.mjs");
  const saved = template(3, "portrait");
  await save(saved);
  assert.deepEqual(await load(), saved);
  await save(template(1, "landscape", "warmup"), "legacy-warmup");
  assert.deepEqual(await load(), saved);
  assert.equal((await load("legacy-warmup")).mode, "warmup");
  console.log("PASS: IndexedDB project restore and independent legacy backup.");
} finally {
  for (const f of files) fs.unlinkSync("lib/." + f + "-test.mjs");
}
