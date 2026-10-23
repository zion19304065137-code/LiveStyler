/** User-provided packaged livestream references. Each orientation has its own image. */
export const scenePhotos = [
 {src:"/scenes/launch-landscape-v2.webp",portraitSrc:"/scenes/launch-portrait-v2.webp",alt:"科技新品发布会，演讲嘉宾与AI主题舞台",landscapeFocus:.5,portraitFocus:.5},
 {src:"/scenes/gala-landscape-v2.webp",portraitSrc:"/scenes/gala-portrait-v2.webp",alt:"企业年度盛典，蓝金舞台与礼服主持人",landscapeFocus:.5,portraitFocus:.5},
 {src:"/scenes/training-landscape-v2.webp",portraitSrc:"/scenes/training-portrait-v2.webp",alt:"企业教育培训，女讲师与AI办公课程课件",landscapeFocus:.5,portraitFocus:.5},
 {src:"/scenes/commerce-landscape-v2.webp",portraitSrc:"/scenes/commerce-portrait-v2.webp",alt:"品牌美妆电商直播，主播与护肤商品展示",landscapeFocus:.5,portraitFocus:.5},
];

/** ImageGen-created demo footage, kept separate from editable/exportable design layers. */
export const previewPhotos:Array<{src:string;portraitSrc?:string;alt:string;landscapeFocus:number;portraitFocus:number}> = [
  {
    src: "/scenes/launch-live-v2.webp",
    alt: "蓝色发布会舞台上的演讲嘉宾，AI生成演示图",
    landscapeFocus: 0.38,
    portraitFocus: 0.5,
  },
  {
    src: "/scenes/gala-live-landscape-v3.webp",
    portraitSrc: "/scenes/gala-live-v2.webp",
    alt: "年会舞台上的主持人，AI生成演示图",
    landscapeFocus: 0.35,
    portraitFocus: 0.5,
  },
  {
    src: "/scenes/training-v1.webp",
    alt: "培训直播间中的讲师，AI生成演示图",
    landscapeFocus: 0.4,
    portraitFocus: 0.5,
  },
  {
    src: "/scenes/commerce-live-landscape-v4.webp",
    portraitSrc: "/scenes/commerce-live-portrait-v3.webp",
    alt: "美妆直播间中的主播与护肤品",
    landscapeFocus: 0.5,
    portraitFocus: 0.5,
  },
];
