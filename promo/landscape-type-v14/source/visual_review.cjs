// Capture landscape keyframes and motion sequences. Measurements do not grade aesthetics.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {serve,sourceFiles}=require('./render.cjs'),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=__dirname,review=path.join(root,'review'),score=require('./score.json');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const keyTimes=[0,2.5,4.05,5.45,7.1,8.5,9.8,11.75,13.55,15.15,16.8,18.8,20.65,21.55,23.6,25.6];
async function main(){
 fs.mkdirSync(review,{recursive:true});const sourceHashes=Object.fromEntries(sourceFiles.map(f=>[f,sha(f)]));
 const server=serve();await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const errors=[];
 try{
  browser=await pw.chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});
  const page=await browser.newPage({viewport:{width:score.width,height:score.height},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/?export`);await page.evaluate(()=>window.ready);await page.evaluate(()=>document.fonts.ready);
  const timing=await page.evaluate(()=>({bridges:typeof bridges==='undefined'?[]:bridges.map(({k,start,end,type})=>({k,start,end,type})),loopStart:window.reviewTiming?.loopStart??26.68,loopEnd:window.reviewTiming?.loopEnd??26.96}));
  const sampleBridge=(k,phases,fallback)=>{const b=timing.bridges.find(b=>b.k===k);return b?phases.map(p=>b.start+(b.end-b.start)*p):fallback};
  const groups=[
   {id:'ledger',title:'算盘横梁 → 山海伙伴',times:sampleBridge(1,[0,.2,.44,.68,.96,1],[2.68,2.78,2.9,3.02,3.16,3.18])},
   {id:'paper',title:'帮忙纸条 → 掌柜落位',times:sampleBridge(2,[0,.33,.67,1],[5.86,5.999,6.141,6.28])},
   {id:'roles',title:'掌柜落定 / 跑堂错步',times:[6.6,6.82,7.12,7.42,7.8,8.32]},
   {id:'counter',title:'跑堂展开 → 小小客栈',times:sampleBridge(3,[0,.33,.67,1],[8.76,8.905,9.055,9.20])},
   {id:'gate',title:'大字纸角 → 邀请',times:sampleBridge(4,[0,.28,.53,.91,1],[12.35,12.48,12.6,12.78,12.82])},
   {id:'invitation',title:'来 → 坐 / 横向递进',times:[12.8,13.16,13.55,14.24]},
   {id:'table',title:'座位横线 → 一桌烟火',times:[15.4,15.68,16,16.8]},
   {id:'bustle',title:'热热闹闹 / 字牌接力',times:[17.5,17.82,18.15,18.4]},
   {id:'opening',title:'字牌合拢 / 两次开张',times:[19.5,20.1,20.65,21.55]},
   {id:'doors',title:'开张推门 → 品牌横幅',times:sampleBridge(7,[0,.33,.67,1],[21.78,21.978,22.182,22.38])},
   {id:'loop',title:'片尾落款 → 片头',times:[0,.08/.28,.18/.28,1].map(p=>timing.loopStart+(timing.loopEnd-timing.loopStart)*p)}
  ];
  const jobs=keyTimes.map((time,i)=>({kind:'keyframe',time,label:score.phrases[i].text}));
  for(const group of groups)for(const [i,time]of group.times.entries())jobs.push({kind:'motion',group:group.id,time,label:`${i+1} / ${group.times.length}`,group_title:group.title});
  const captures=[];
  for(const [i,job]of jobs.entries()){
   const state=await page.evaluate(t=>renderAt(t),job.time),file=`wide-v14-${String(i+1).padStart(2,'0')}-${job.time.toFixed(3)}.png`;
   const png=Buffer.from(await page.evaluate(()=>document.querySelector('canvas').toDataURL('image/png').split(',')[1]),'base64');
   fs.writeFileSync(path.join(review,file),png);captures.push({...job,file,sha256:crypto.createHash('sha256').update(png).digest('hex'),state});
  }
  const boundaries=[];for(const b of timing.bridges){boundaries.push({kind:'bridge-start',label:`${b.type} start`,time:b.start},{kind:'bridge-end',label:`${b.type} end`,time:b.end})}
  for(const time of score.scene_starts.slice(1))boundaries.push({kind:'scene-cut',label:'scene cut',time});
  boundaries.push({kind:'visual-loop-start',label:'loop start',time:timing.loopStart},{kind:'visual-loop-end',label:'loop end',time:timing.loopEnd});
  boundaries.sort((a,b)=>a.time-b.time);
  const measurements=await page.evaluate(({boundaries,duration})=>{
   const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d');
   function compare(t1,t2){renderAt(t1);const a=ctx.getImageData(0,0,canvas.width,canvas.height).data;renderAt(t2);const b=ctx.getImageData(0,0,canvas.width,canvas.height).data;let changedPixels=0,maxChannelDelta=0,sum=0;
    for(let i=0;i<a.length;i+=4){let changed=false;for(let c=0;c<3;c++){const d=Math.abs(a[i+c]-b[i+c]);changed||=d!==0;maxChannelDelta=Math.max(maxChannelDelta,d);sum+=d}changedPixels+=Number(changed)}
    return {before_seconds:t1,after_seconds:t2,changedPixels,totalPixels:canvas.width*canvas.height,meanRGBDelta:sum/(canvas.width*canvas.height*3),maxChannelDelta};
   }
   const loop=compare(0,duration);return {loop:{...loop,exact:loop.changedPixels===0},epsilon_seconds:.000001,continuity:boundaries.map(b=>({kind:b.kind,label:b.label,boundary_seconds:b.time,...compare(b.time-.000001,b.time+.000001)})),title_hold:compare(25.06,26.66)};
  },{boundaries,duration:score.duration});
  const unchanged=Object.entries(sourceHashes).every(([f,h])=>sha(f)===h);
  const result={version:'wide-v14',viewport:[score.width,score.height],fps:score.fps,source_hashes:sourceHashes,source_unchanged_during_capture:unchanged,timing,captures,groups:groups.map(({id,title,times})=>({id,title,count:times.length})),measurements,errors,review_status:'Frames captured; visual assessment is recorded separately.',measurement_scope:'Deterministic Canvas frames before lossy encoding; epsilon deltas do not measure perceived motion quality.',limitations:'These samples are not a full-video audio-listening review; visual loops do not imply seamless audio.'};
  fs.writeFileSync(path.join(review,'frames.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({frames:captures.length,groups:groups.length,sourceUnchanged:unchanged,measurements,errors},null,2));
  if(errors.length)throw Error(errors.join('\n'));if(!unchanged)throw Error('Source changed during capture.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
}
main().catch(e=>{console.error(e);process.exitCode=1});
