import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
let source=ts.transpileModule(fs.readFileSync('hooks/useLiveCapture.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
source=source.replace(/import .* from ["']react["'];/,'const {useState,useRef,useEffect}=globalThis.captureHooks;');
const state=[],cleanups=[];let index=0;
globalThis.captureHooks={useState:v=>{const i=index++;state[i]=v;return[v,n=>state[i]=n]},useRef:v=>({current:v}),useEffect:f=>cleanups.push(f())};
const {useLiveCapture,captureIssue}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const oldDoc=globalThis.document,oldMedia=Object.getOwnPropertyDescriptor(navigator,'mediaDevices');
class Track extends EventTarget{readyState='live';stop(){this.readyState='ended';this.stopped=true}}
const makeStream=()=>{const track=new Track();return {track,getTracks:()=>[track],getVideoTracks:()=>[track]}};
class Video extends EventTarget{readyState=2;muted=false;play(){return Promise.resolve()}pause(){this.paused=true}}
try{
 globalThis.document={createElement:()=>new Video()};
 let calls=0,last,deny=false,deferred,cameraOptions;
 Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{enumerateDevices:async()=>[{kind:'videoinput',deviceId:'obs',label:'OBS Virtual Camera'},{kind:'audioinput',deviceId:'mic',label:'Microphone'}],getDisplayMedia:async o=>{calls++;assert.equal(o.audio,false);if(deny)throw Object.assign(new Error(),{name:'NotAllowedError'});return last=makeStream()},getUserMedia:async o=>{cameraOptions=o;calls++;assert.equal(o.audio,false);if(deferred)return deferred;return last=makeStream()}}});
 const messages=[],capture=useLiveCapture(m=>messages.push(m));assert.equal(calls,0,'Never request permission on mount');
 await capture.start('screen');const first=last;assert(state[0]);assert.equal(state[1],'screen');assert.equal(state[0].muted,true);assert.equal(state[2],false);
 deny=true;await capture.start('screen');assert(!first.track.stopped,'Canceled picker preserves previous stream');assert(messages.at(-1).includes('授权'));assert.equal(state[3].code,'NotAllowedError');deny=false;
 await capture.refreshCameras();assert.deepEqual(state[4],[{deviceId:'obs',label:'OBS Virtual Camera'}]);assert.equal(calls,2,'Device refresh never opens a camera');
 await capture.start('camera','obs');assert.equal(cameraOptions.video.deviceId.exact,'obs');assert.equal(cameraOptions.audio,false);assert(!('facingMode' in cameraOptions.video));assert(first.track.stopped,'Switching sources releases previous source');const camera=last;assert.equal(state[1],'camera');
 camera.track.dispatchEvent(new Event('ended'));assert(camera.track.stopped);assert.equal(state[0],undefined);assert.equal(state[1],undefined);
 let resolve;deferred=new Promise(r=>resolve=r);const pending=capture.start('camera');capture.stop();const canceled=makeStream();resolve(canceled);await pending;assert(canceled.track.stopped,'Late permission result must be released after stop');assert.equal(state[0],undefined);deferred=undefined;
 const callsBeforePolicy=calls;document.permissionsPolicy={features:()=>['display-capture'],allowsFeature:()=>false};await capture.start('screen');assert.equal(calls,callsBeforePolicy,'Known policy denial must be explained before requesting capture');assert.equal(state[3].code,'SecurityError');delete document.permissionsPolicy;
 await capture.start('screen');const active=last;cleanups.forEach(f=>f?.());assert(active.track.stopped,'Unmount releases device');
 assert(captureIssue({name:'SecurityError'},'screen',{policyBlocked:true,embedded:true}).help.includes('独立窗口'));
 assert(captureIssue({name:'NotFoundError'},'camera').title.includes('摄像头'));
 assert(captureIssue({name:'NotAllowedError'},'screen',{embedded:false}).help.includes('分享'));
 assert(captureIssue({name:'InvalidStateError'},'screen').help.includes('前台'));
 assert(captureIssue({name:'NotReadableError'},'camera').help.includes('权限'));
 console.log('PASS: live capture requires click, requests video only, handles canceled permission, source replacement, browser stop, stale result and unmount cleanup.');
}finally{globalThis.document=oldDoc;if(oldMedia)Object.defineProperty(navigator,'mediaDevices',oldMedia);else delete navigator.mediaDevices;delete globalThis.captureHooks;}
