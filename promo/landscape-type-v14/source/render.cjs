// Deterministic Canvas frames -> FFmpeg, with the unchanged selected audio excerpt.
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const root=__dirname,out=path.join(root,'output'),score=require('./score.json');
const movie='yaoguai-type-wide-v14.mp4';
const sourceFiles=['core.js','act-one.js','act-two.js','film.js','timeline.js','index.html','score.json'];
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
function serve(){return http.createServer((req,res)=>{
 let file;try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return}
 if(file===root)file=path.join(root,'index.html');
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
 fs.stat(file,(err,st)=>{if(err||!st.isFile()){res.writeHead(404).end();return}
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.otf':'font/otf','.ttf':'font/ttf','.m4a':'audio/mp4','.mp4':'video/mp4','.png':'image/png','.jpg':'image/jpeg'};
  const headers={'Content-Type':mime[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes'};
  const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);let start=0,end=st.size-1;
  if(range){start=Number(range[1]);if(range[2])end=Math.min(end,Number(range[2]));if(start>end||start>=st.size){res.writeHead(416,{'Content-Range':`bytes */${st.size}`}).end();return}headers['Content-Range']=`bytes ${start}-${end}/${st.size}`}
  headers['Content-Length']=end-start+1;res.writeHead(range?206:200,headers);fs.createReadStream(file,{start,end}).pipe(res);
 });
})}
async function main(){
 fs.mkdirSync(out,{recursive:true});const server=serve();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser,ff;const errors=[];try{
  browser=await pw.chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true});
  const page=await browser.newPage({viewport:{width:score.width,height:score.height},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));const url=`http://127.0.0.1:${server.address().port}`;
  await page.goto(url+'/?export');await page.evaluate(()=>window.ready);
  const actual=await page.evaluate(()=>{const el=document.querySelector('canvas'),r=el.getBoundingClientRect();return {width:el.width,height:el.height,displayWidth:r.width,displayHeight:r.height}});
  if(actual.width!==score.width||actual.height!==score.height||actual.displayWidth!==score.width||actual.displayHeight!==score.height)throw Error('Canvas/export dimensions do not match score: '+JSON.stringify(actual));
  if(process.argv.includes('--stills')){
   const times=[0,2.5,4.05,5.45,7.1,8.5,9.8,11.75,13.55,15.15,16.8,18.8,20.65,21.55,23.6,25.6];
   for(const [i,t] of times.entries()){await page.evaluate(t=>renderAt(t),t);await page.screenshot({path:path.join(out,`shot-${String(i+1).padStart(2,'0')}.png`)})}
   fs.writeFileSync(path.join(out,'still-times.json'),JSON.stringify(times));
   await page.setViewportSize({width:390,height:900});await page.goto(url);await page.evaluate(()=>window.ready);await page.waitForFunction(()=>document.querySelector('audio').readyState>=2);
   await page.evaluate(()=>renderAt(25.6));await page.screenshot({path:path.join(out,'phone-preview.png')});
   const before=await page.evaluate(()=>{const box=document.querySelector('canvas').getBoundingClientRect();return {fonts:['PVHeavy','PVSong','PVBrush'].map(f=>document.fonts.check('100px '+f)),overflow:document.documentElement.scrollWidth>innerWidth,audio:document.querySelector('audio').readyState,displayAspect:box.width/box.height}});
   await page.click('#play');await page.waitForTimeout(300);const playing=await page.evaluate(()=>document.querySelector('#play').textContent==='暂停'&&Number(document.querySelector('#seek').value)>.1);await page.click('#play');
   await page.locator('#seek').fill('22.6');await page.locator('#seek').dispatchEvent('input');await page.click('#sound');const after=await page.evaluate(()=>({paused:document.querySelector('#play').textContent==='继续',seek:Number(document.querySelector('#seek').value),muted:document.querySelector('audio').muted}));
   for(const t of [0,...score.scene_starts.flatMap(t=>[Math.max(0,t-1/score.fps),t,t+1/score.fps]),score.duration])await page.evaluate(t=>renderAt(t),t);
   const result={canvas:actual,before,playing,after,errors};fs.writeFileSync(path.join(out,'browser-check.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
   if(errors.length||before.overflow||Math.abs(before.displayAspect-16/9)>.01||!before.fonts.every(Boolean)||!playing||!after.paused||after.seek!==22.6||!after.muted)throw Error('Browser check failed');return;
  }
  const {fps,duration}=score,totalFrames=Math.round(fps*duration),sourceHashes=Object.fromEntries(sourceFiles.map(f=>[f,hash(f)]));let renderError;
  ff=spawn('ffmpeg',['-y','-hide_banner','-loglevel','warning','-f','image2pipe','-vcodec','png','-framerate',String(fps),'-i','pipe:0','-i',path.join(root,'assets/music.m4a'),'-map','0:v','-map','1:a','-vf','scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-c:v','libx264','-preset','medium','-crf','19','-maxrate','12M','-bufsize','24M','-threads','4','-bsf:v','h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0','-c:a','copy','-t',String(duration),'-movflags','+faststart',path.join(out,movie)],{stdio:['pipe','inherit','inherit']});
  ff.on('error',e=>renderError=e);ff.stdin.on('error',e=>renderError=e);const finished=once(ff,'close');
  for(let n=0;n<totalFrames;n++){
   if(renderError)throw renderError;if(errors.length)throw Error(errors.join('\n'));
   await page.evaluate(t=>renderAt(t),n/fps);const shot=Buffer.from(await page.evaluate(()=>document.querySelector('canvas').toDataURL('image/png').split(',')[1]),'base64');
   if(!ff.stdin.write(shot))await once(ff.stdin,'drain');if(n%120===0)console.log(`Rendered ${n}/${totalFrames} frames`);
  }
  ff.stdin.end();const [code]=await finished;if(code!==0)throw Error('ffmpeg exited '+code);
  if(Object.entries(sourceHashes).some(([file,expected])=>hash(file)!==expected))throw Error('Source changed during export; completed file is not validated.');
  fs.writeFileSync(path.join(out,'render-check.json'),JSON.stringify({frames:totalFrames,fps,width:score.width,height:score.height,duration,source_hashes:sourceHashes,source_unchanged_during_render:true,browser_errors:errors},null,2)+'\n');console.log('Export complete');
 }finally{if(ff&&ff.exitCode===null)ff.kill();if(browser)await browser.close();server.close()}
}
if(require.main===module)main().catch(e=>{console.error(e);process.exit(1)});
module.exports={serve,movie,sourceFiles};
