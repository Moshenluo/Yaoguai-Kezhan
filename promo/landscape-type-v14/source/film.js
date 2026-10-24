// Wide composition, with shared paper objects carrying the scene changes.
function finale(t){bg(P);const f=ease(prog(t,21.85,.82));
 printedBorder(220,270,1480,370,R,.24*f);line(232,286,232,624,R,2,.46*f);line(1688,286,1688,624,R,2,.46*f);
 const positions=[435,785,1135,1485];for(let i=0;i<4;i++){const v=prog(t,at(14,i)-.12,.46);if(v<=0)continue;const q=ease(v),x=positions[i],y=465;c.save();c.beginPath();c.rect(x-181,y-209,362*q,418);c.clip();text(phrases[14].chars[i].text,x+(1-q)*24,y,330,i===1?R:I,{font:F.brush,a:Math.min(1,v*7)});c.restore()}
 const lineIn=smooth(prog(t,at(15)-.20,.42));line(660,704,660+600*lineIn,704,R,1.7,.73);word(15,t,960,790,124,[I,R,I,I],{font:F.song,step:150,mask:true,lead:.18,dur:.22});
 const a=prog(t,24.80,.24);if(a>0){const e=settle(a);c.save();c.translate(1690,285-(1-e)*24);c.scale(mix(1.08,1,e),mix(1.08,1,e));seal(0,0,74,124,Math.min(1,a*7),-.035);c.restore()}
 const caption=smooth(prog(t,24.70,.34));['经营客栈','招募妖怪','夜晚守家'].forEach((s,i)=>track(s,670+i*290,932,32,3,I,{font:F.song,a:.77*caption}));for(const x of [815,1105])diamond(x,932,5,R,0,caption);
}
const scenes=[abacus,companions,roles,smallBig,comeSit,warmth,openShop,finale];
const cuts=[...SCORE.scene_starts,D];
function drawScene(k,t){c.save();scenes[k](t);c.restore()}
const bridges=[
 {k:1,start:2.68,end:3.18,type:'ledger'},
 {k:2,start:5.86,end:6.28,type:'paper'},
 {k:3,start:8.76,end:9.20,type:'counter'},
 {k:4,start:12.35,end:12.82,type:'corner'},
 {k:7,start:21.78,end:22.38,type:'doors'}
];
function ledgerRelay(t,p){abacus(t,1,true);const x=mix(180,-2,p),w=mix(1020,W+4,p),cy=mix(470,H/2,p),h=mix(5,H+4,p);
 c.save();c.beginPath();c.rect(x,cy-h/2,w,h);c.clip();drawScene(1,t);c.restore();
 const edge=1-smooth(prog(p,.20,.40)),ink=color(I,R,smooth(prog(p,0,.36)));line(x,cy,x+w,cy,ink,5,edge);const hem=edge*smooth(prog(p,.015,.12));line(x,cy-h/2,x+w,cy-h/2,ink,1.5,hem);line(x,cy+h/2,x+w,cy+h/2,ink,1.5,hem);
 const pin=1-smooth(prog(p,.12,.4));for(const px of [x,x+w]){circle(px,cy,6,G,0,pin);circle(px,cy,2.3,I,0,pin)}
}
function cornerRelay(t,p){smallBig(t,true);const x=mix(856,-2,p),y=mix(170,-2,p),w=mix(54,W+4,p),h=mix(76,H+4,p);
 c.save();c.beginPath();c.rect(x,y,w,h);c.clip();drawScene(4,t);c.restore();
 const edge=1-smooth(prog(p,.65,.35));line(x+7*(1-p),y+7*(1-p),x+w-7*(1-p),y+7*(1-p),G,1,.58*edge);line(x+w-7*(1-p),y+7*(1-p),x+w-7*(1-p),y+h-10*(1-p),G,1,.58*edge);
}
function transition(b,t){const p=smooth(prog(t,b.start,b.end-b.start)),k=b.k;
 if(b.type==='ledger'){ledgerRelay(t,p);return}if(b.type==='corner'){cornerRelay(t,p);return}
 if(b.type==='doors'){drawScene(k,t);for(let i=0;i<2;i++){c.save();c.translate((i?1:-1)*W*.57*p,0);c.beginPath();c.rect(i*W/2,0,W/2,H);c.clip();drawScene(k-1,t);c.restore()}return}
 drawScene(k-1,t);c.save();c.beginPath();if(b.type==='paper')c.rect(mix(1120,0,p),mix(740,0,p),mix(620,W,p),mix(145,H,p));else if(b.type==='counter')c.rect(W*(1-p),0,W,H);c.clip();drawScene(k,t);c.restore();
 if(b.type==='paper'){const x=mix(1120,0,p),y=mix(740,0,p),w=mix(620,W,p),h=mix(145,H,p),a=1-smooth(prog(p,0,.6));line(x+13,y+13,x+w-13,y+13,R,1,.3*a);line(x+13,y+h-13,x+w-13,y+h-13,R,1,.3*a);track('来帮忙',mix(1430,1500,p),mix(810,180,p),mix(112,42,p),mix(33,8,p),R,{a:1-smooth(prog(p,.28,.59)),font:F.heavy})}
 if(b.type==='counter')line(W*(1-p),0,W*(1-p),H,G,1.4,.4*Math.sin(Math.PI*p));
}
function loopBack(t){const p=smooth(prog(t,26.68,.28));if(p>=1){drawScene(0,0);return}drawScene(7,t);if(p<.001)return;
 const x=mix(1690,W/2,p),y=mix(285,H/2,p),w=2600*p,h=1460*p;
 c.save();c.translate(x,y);c.rotate(-.035*(1-p));c.beginPath();c.rect(-w/2,-h/2,w,h);c.clip();c.rotate(.035*(1-p));c.translate(-x,-y);abacus(0,smooth(prog(p,.24,.36)));c.restore();c.save();c.translate(x,y);c.rotate(-.035*(1-p));printedBorder(-w/2,-h/2,w,h,R,.35*(1-p));c.restore();
}
window.reviewTiming={loopStart:26.68,loopEnd:26.96};
window.renderAt=t=>{t=Math.min(D,Math.max(0,t));let k=0;while(k<scenes.length-1&&t>=cuts[k+1])k++;c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;const bridge=bridges.find(b=>t>=b.start&&t<b.end);if(t>=26.68)loopBack(t);else if(bridge)transition(bridge,t);else drawScene(k,t);return {time:t,scene:k,transition:t>=26.68?'seal-loop':bridge?.type||null,lyric:phrases.filter(p=>p.at<=t).slice(-1)[0]?.text||''}};
const audio=document.querySelector('#audio'),seek=document.querySelector('#seek'),button=document.querySelector('#play'),sound=document.querySelector('#sound');let raf=0,playing=false;
function show(t){renderAt(t);seek.value=t;document.querySelector('#clock').textContent=`00:${String(Math.floor(t)).padStart(2,'0')} / 00:27`}
function tick(){show(Math.min(D,audio.currentTime));if(playing)raf=requestAnimationFrame(tick)}
async function toggle(){if(playing){audio.pause();playing=false;cancelAnimationFrame(raf);button.textContent='继续'}else{if(audio.currentTime>=D-.05)audio.currentTime=0;await audio.play();playing=true;button.textContent='暂停';raf=requestAnimationFrame(tick)}}
button.onclick=()=>toggle().catch(e=>{button.textContent='播放';console.error(e)});audio.onended=()=>{playing=false;cancelAnimationFrame(raf);show(D);button.textContent='重播'};seek.oninput=()=>{audio.currentTime=+seek.value;show(+seek.value)};sound.onclick=()=>{audio.muted=!audio.muted;sound.textContent=audio.muted?'静音':'声音开'};document.addEventListener('keydown',e=>{if(e.code==='Space'&&e.target.tagName!=='INPUT'){e.preventDefault();button.click()}});if(new URLSearchParams(location.search).has('export'))document.body.classList.add('export');
window.ready=Promise.all(Object.values(F).map(f=>document.fonts.load('100px '+f))).then(()=>{
 let seed=2479;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
 const p=document.createElement('canvas');p.width=p.height=512;const q=p.getContext('2d'),img=q.createImageData(512,512);for(let i=0;i<img.data.length;i+=4){const v=Math.floor(rnd()*255);img.data[i]=img.data[i+1]=img.data[i+2]=v;img.data[i+3]=96}q.putImageData(img,0,0);paper=c.createPattern(p,'repeat');
 const f=document.createElement('canvas');f.width=768;f.height=1024;const fc=f.getContext('2d');for(let n=0;n<2300;n++){const x=rnd()*768,y=rnd()*1024,len=2+rnd()*15,angle=rnd()*Math.PI;fc.strokeStyle=n%3?'rgba(91,73,43,.34)':'rgba(255,250,224,.54)';fc.lineWidth=.3+rnd()*.5;fc.beginPath();fc.moveTo(x,y);fc.quadraticCurveTo(x+Math.cos(angle)*len*.5,y+Math.sin(angle)*len*.5+1,x+Math.cos(angle)*len,y+Math.sin(angle)*len);fc.stroke()}fibers=c.createPattern(f,'repeat');
 wash=document.createElement('canvas');wash.width=360;wash.height=640;const wc=wash.getContext('2d');for(let i=0;i<7;i++){const x=rnd()*360,y=rnd()*640,r=170+rnd()*250,g=wc.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,i%2?'rgba(255,249,222,.24)':'rgba(83,66,40,.20)');g.addColorStop(1,'rgba(130,108,68,0)');wc.fillStyle=g;wc.fillRect(0,0,360,640)}
 button.disabled=false;show(0)
});
