/** Check the actual decoded pixels before replacing a transparent live overlay. */
export function checkOverlayPixels(
  rgba: Uint8ClampedArray, width: number, height: number,
  _safe: {x:number;y:number;width:number;height:number},
) {
  let transparent = 0, visible = 0;
  for (let y=0;y<height;y+=4) for(let x=0;x<width;x+=4) {
    const alpha=rgba[(y*width+x)*4+3];
    if(alpha<16) transparent++; else visible++;

  }
  const total=transparent+visible;
  if(!total||visible/total<0.005) throw Error('生成贴片没有可见内容，原设计已保留');
  if(transparent/total<0.45) throw Error('生成结果缺少真实透明背景，原设计已保留，请重试或调整描述');
}
