"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { ArrowUpRight, ArrowRight, Check, Layers } from "lucide-react";
import { styles, Ratio } from "../lib/design";
import BrandEyes from "../components/BrandEyes";
import TemplateThumb from "../components/TemplateThumb";
import ProductAnimation from "../components/ProductAnimation";
const Editor = dynamic(() => import("../components/Editor"), {
  ssr: false,
  loading: () => <div className="loading">正在打开直播包装工作台…</div>,
});
const liveScenes = ["科技发布会", "企业年会", "教育培训", "电商直播"];
function SceneTypewriter() {
  const [frame, setFrame] = useState({ index: 0, length: 0, deleting: false });
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    let index = 0, length = 0, deleting = false;
    const tick = () => {
      if (stopped || preference.matches) return;
      const word = liveScenes[index];
      let delay = deleting ? 85 : 160;
      if (!deleting && length === word.length) { deleting = true; delay = 1900; }
      else if (deleting && length === 0) { index = (index + 1) % liveScenes.length; deleting = false; delay = 350; }
      else length += deleting ? -1 : 1;
      setFrame({ index, length, deleting });
      timer = setTimeout(tick, delay);
    };
    const restart = () => {
      clearTimeout(timer);
      index = 0; length = 0; deleting = false;
      if (preference.matches) setFrame({ index: 0, length: liveScenes[0].length, deleting: false });
      else { setFrame({ index, length, deleting }); timer = setTimeout(tick, 300); }
    };
    restart(); preference.addEventListener("change", restart);
    return () => { stopped = true; clearTimeout(timer); preference.removeEventListener("change", restart); };
  }, []);
  return <span className="scene-typewriter" aria-hidden="true"><span>{liveScenes[frame.index].slice(0, frame.length)}</span><i /></span>;
}
export default function Home() {
  const [editing, setEditing] = useState(false),
    [preset, setPreset] = useState<number | undefined>(),
    [ratio, setRatio] = useState<Ratio>("landscape");
  useEffect(() => {
    if (location.hash === "#studio") setEditing(true);
  }, []);
  const start = (i?: number) => {
    setPreset(i);
    setEditing(true);
    location.hash = "studio";
  };
  if (editing)
    return (
      <Editor
        preset={preset}
        initialRatio={ratio}
        home={() => {
          setEditing(false);
          history.replaceState(null, "", location.pathname);
        }}
      />
    );
  return (
    <main className="landing">
      <nav>
        <a className="brand" href="#">
          <img className="brand-mascot" src="/brand/mascot.webp" alt="" /><img className="brand-logo" src="/brand/wordmark.webp" alt="LiveStyler" />
        </a>
        <div className="navlinks">
          <a href="#scenes">直播包装模板</a>
          <button onClick={() => start()}>
            创作工作台 <ArrowUpRight size={15} />
          </button>
        </div>
        <button className="primary" onClick={() => start()}>
          开始包装直播 <ArrowRight size={16} />
        </button>
      </nav>
      <section className="hero">
        <BrandEyes />
        <div className="eyebrow">
          <span /> 让主播与内容，始终站在画面中央
        </div>
        <h1 aria-label="给你的科技发布会、企业年会、教育培训、电商直播，加上品牌包装。">
          <span className="hero-title-line"><span aria-hidden="true">给你的</span><SceneTypewriter /><span aria-hidden="true">，</span></span>
          <em>加上品牌包装。</em>
        </h1>
        <p>
          横屏发布会，竖屏门店直播。
          <br />
          设计品牌贴片、Logo 角标和信息条，导出透明素材直接叠加。
        </p>
        <button className="primary herocta" onClick={() => start()}>
          开始设计直播包装 <ArrowUpRight size={20} />
        </button>
        <div className="benefits">
          <span>
            <Check size={14} /> 16:9 / 9:16 横竖屏
          </span>
          <span>
            <Check size={14} /> 透明 PNG · 独立图层
          </span>
        </div>
        <ProductAnimation />
      </section>
      <section className="scenes" id="scenes">
        <div className="sectionhead">
          <div>
            <span className="eyebrow">DESIGNED AROUND YOUR LIVE</span>
            <h2>先选画幅，再选直播场景</h2>
          </div>
          <div className="ratiobuttons">
            <button
              className={ratio === "landscape" ? "active" : ""}
              onClick={() => setRatio("landscape")}
            >
              16:9 横屏
            </button>
            <button
              className={ratio === "portrait" ? "active" : ""}
              onClick={() => setRatio("portrait")}
            >
              9:16 竖屏
            </button>
          </div>
        </div>
        <div
          className={
            "scenegrid " + (ratio === "portrait" ? "portraitgrid" : "")
          }
        >
          {styles.map((s, i) => (
            <button className="scenecard" key={s.name} onClick={() => start(i)}>
              <TemplateThumb index={i} vertical={ratio === "portrait"} />
              <div className="scenecaption">
                <h3>
                  {s.name} · {ratio === "portrait" ? "竖屏包装" : "横屏包装"}
                </h3>
                <ArrowUpRight size={18} />
              </div>
            </button>
          ))}
        </div>
        <div className="workflowhint">
          <span>① 选择横竖屏与场景</span>
          <ArrowRight size={14} />
          <span>② 对照直播内容编辑贴片</span>
          <ArrowRight size={14} />
          <span>③ 导出透明包装素材</span>
        </div>
        <p className="warmupnote">
          开场海报与暖场背景也可创作，在工作台切换设计用途即可。
        </p>
      </section>
      <section className="brand-story" aria-labelledby="brand-story-title">
        <div className="brand-story-copy">
          <span className="eyebrow">选好场景，一句话开始创作</span>
          <h2 id="brand-story-title">一套包装，贯穿你的直播。</h2>
          <p>从场景模板出发，用文字修改设计，逐层调整画面。<br />统一品牌，适配横竖屏，再将透明包装打包带走。</p>
        </div>
        <ProductAnimation src="/livestyler-animation/film.html" title="LiveStyler 品牌包装创作动画" />
        <button className="primary" onClick={() => start()}>开始我的创作 <ArrowUpRight size={17} /></button>
      </section>
      <footer>
        <span className="brand">
          <Layers size={18} /> LiveStyler
        </span>
        <span>AI 直播间装修师 · Polyv Hackathon 2026</span>
        <span>让内容成为主角。</span>
      </footer>
    </main>
  );
}
