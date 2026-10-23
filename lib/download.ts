/** Large canvas data URLs exceed browser navigation/download limits. Use an attached Blob link. */
export function downloadFile(name: string, data: Blob | string) {
  let blob: Blob;
  if (typeof data !== 'string') blob=data;
  else {
    const match=/^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(data);
    if(!match) throw Error('下载数据格式无效');
    const raw=match[2]?atob(match[3]):decodeURIComponent(match[3]);
    blob=new Blob([Uint8Array.from(raw,c=>c.charCodeAt(0))],{type:match[1]||'application/octet-stream'});
  }
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=name;a.style.display='none';a.rel='noopener';
  document.body.appendChild(a);
  try {a.click();} finally {
    a.remove();
    // Keep the URL alive long enough for slow browsers and ZIP downloads to start.
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
}
