# 交给网页 AI 的接入说明

请把这个包接入现有网页。使用最新的 Opus 修订版，48秒、16:9 Canvas 动画、配套新音乐音效。动画为可编辑的 HTML/JavaScript Canvas 源码，不是 MP4 播放器。

## 文件

- public/livestyler-animation/index.html：播放器入口，播放/暂停/重播/拖动时间轴，按音频时间同步画面。
- public/livestyler-animation/film.html：完整动画源代码，含绘图、文案、时间轴、缓动、UI状态及素材加载。
- public/livestyler-animation/assets/：动画实际引用的品牌、场景与透明包装素材，已按原相对路径保留。
- public/livestyler-animation/mix.wav：最终配乐与音效，48秒立体声。

## 推荐接入方式

1. 将包内 public/livestyler-animation 整个文件夹放到现有项目的静态资源目录。React/Vite/Next 常用项目可直接合并到项目 public/ 下。
2. 在需要的位置嵌入 /livestyler-animation/index.html。若网站部署在子路径，按站点 base path 修改 iframe 地址；动画文件夹内部的相对路径不要改。
3. 使用 iframe 隔离现有网页样式和动画全局变量，不要直接把两份HTML的script粘进React组件。外层网页负责容器宽度与高度；动画本身以1920×1080绘制并等比缩放。
4. 可使用同包 embed-example.html 的容器写法，ResizeObserver会按实际容器宽度设置 iframe 高度，保留16:9画面及70px控制栏。
5. 声音通过用户点击播放启动，遵循浏览器有声播放限制。不要默认强制有声自动播放。原播放器已有音频不可用时的无声时钟回退。
6. 保留播放、暂停、重播和拖动功能；默认不自动循环。若只展示无控制栏背景动画，请单独实现宿主驱动，明确静音/可见性/离屏暂停规则。

## 动画接口

film.html 资源加载完成后 window.ready=true，window.DURATION=48。调用 window.seek(秒数) 绘制指定时刻，绘制确定，不依赖前一帧。iframe也接收 postMessage({t:秒数}, targetOrigin)；加载完向父窗口发送 {ready:1}。

播放器index.html用requestAnimationFrame调度，音频currentTime作为主时钟。网页实时播放帧率取决于设备与浏览器；60fps是交付MP4的导出规格，不保证每台设备的网页都能跑满60fps。

## 修改须知

- 修改文案、颜色、时间轴与UI绘制，请编辑film.html里的JavaScript；修改播放控制或尺寸适配，编辑index.html。
- 图片、音频全部随包提供，无CDN，无React/npm依赖，无API密钥，也不需要调用付费模型才能播放。
- 入口需作为静态页面提供。建议在站点同源部署，保留所有目录；以HTTP服务验收，不要只检查file://。
- 若站点有严格CSP，HTML包含内联脚本和样式，需由接入AI拆分为本地.js/.css再配置script-src/style-src，或采用站点已有nonce/hash策略。
- 若将消息接口扩展给其它来源控制，须检查event.source与event.origin；不要把来自任意窗口的消息当作应用指令。现有消息只负责seek，没有后端操作。
- 这是基于项目源码重建的产品演示UI，不是真实AI编辑器。不要把片中的点击、导出成功展示当作实际产品接口行为。
- 素材来源为用户提供的项目交接包；沿用原素材授权范围，不额外推定商用授权。

## 验收

请验证桌面与手机宽度、所有图片和音频无404、播放暂停拖动重播、音画同步、容器缩放、页面滚动不受影响。接入时不修改现有业务接口，不将原有其它旧版动画混入本版。
