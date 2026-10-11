// V9: a continuous typography performance, keyed to the supplied vocal recording.
const canvas=document.querySelector('canvas');
const c=canvas.getContext('2d'),W=1080,H=1920,D=SCORE.duration;
const P='#f3ead8',I='#24382f',R='#c64c35',G='#e3b55c',DARK='#923923';
const F={heavy:'PVHeavy',song:'PVSong',brush:'PVBrush'};
const phrases=SCORE.phrases,cuts=[...SCORE.scene_starts,D];
const clamp=x=>Math.max(0,Math.min(1,x)),mix=(a,b,p)=>a+(b-a)*p;
const smooth=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10)};
const ease=x=>1-(1-clamp(x))**3;
// One controlled overshoot. Text bodies do not share a perpetual squash/bounce.
const settle=x=>{x=clamp(x);return 1-(1-x)**3*Math.cos(x*Math.PI*1.55)};
const at=(p,i=0)=>phrases[p].chars[i].at;
const prog=(t,a,d=.36)=>clamp((t-a)/d);
let paper;
function rgba(hex,a){const v=parseInt(hex.slice(1),16);return `rgba(${v>>16},${v>>8&255},${v&255},${a})`}
function color(a,b,p){const x=parseInt(a.slice(1),16),y=parseInt(b.slice(1),16);return '#'+[16,8,0].map(s=>Math.round(mix(x>>s&255,y>>s&255,p)).toString(16).padStart(2,'0')).join('')}
function rect(x,y,w,h,col){c.fillStyle=col;c.fillRect(x,y,w,h)}
function line(x,y,x2,y2,col=I,width=2,alpha=1){c.save();c.globalAlpha*=alpha;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.strokeStyle=col;c.lineWidth=width;c.lineCap='butt';c.stroke();c.restore()}
function circle(x,y,r,col,stroke=0,alpha=1){if(r<=0)return;c.save();c.globalAlpha*=alpha;c.beginPath();c.arc(x,y,r,0,Math.PI*2);if(stroke){c.strokeStyle=col;c.lineWidth=stroke;c.stroke()}else{c.fillStyle=col;c.fill()}c.restore()}
function bg(col){rect(0,0,W,H,col);const g=c.createLinearGradient(0,0,W,H);g.addColorStop(0,'#ffffff06');g.addColorStop(1,'#17221c05');c.fillStyle=g;c.fillRect(0,0,W,H);if(paper){c.save();c.globalAlpha=.048;c.fillStyle=paper;c.fillRect(0,0,W,H);c.restore()}}
function text(s,x,y,size,col=I,o={}){if((o.a??1)<=0)return;c.save();c.globalAlpha*=o.a??1;c.translate(x,y);c.rotate(o.r||0);c.scale(o.sx??o.s??1,o.sy??o.s??1);c.textAlign='center';c.textBaseline='middle';c.font=`${size}px ${o.font||F.heavy}`;c.fillStyle=col;if(o.outline){c.strokeStyle=col;c.lineWidth=o.outline;c.strokeText(s,0,0)}else c.fillText(s,0,0);c.restore()}
function maskedText(s,x,y,size,col,p,o={}){if(p<=0)return;c.save();c.translate(x,y);c.rotate(o.r||0);c.beginPath();c.rect(-size*.76,-size*.61,size*1.52,size*1.22);c.clip();text(s,0,(1-ease(p))*size*.52,size,col,{...o,r:0,a:Math.min(1,p*5)});c.restore()}
function glyph(p,i,t,x,y,size,col=I,o={}){const a=at(p,i),v=prog(t,a-(o.lead??.12),o.dur||.36);if(!v)return;const e=o.elastic?settle(v):ease(v);if(o.mask){maskedText(phrases[p].chars[i].text,x,y,size,col,v,o);return}text(phrases[p].chars[i].text,x+(1-e)*(o.dx||0),y+(1-e)*(o.dy??48),size,col,{...o,a:(o.a??1)*Math.min(1,v*5),r:(o.r||0)+(1-e)*(o.turn||0)})}
function word(p,t,x,y,size,col=I,o={}){const n=phrases[p].chars.length,step=o.step??size*1.03;for(let i=0;i<n;i++)glyph(p,i,t,x+(i-(n-1)/2)*step,y,size,Array.isArray(col)?col[i%col.length]:col,o)}
function track(s,x,y,size,gap,col,o={}){const chars=[...s],step=size+gap;chars.forEach((v,i)=>text(v,x+(i-(chars.length-1)/2)*step,y,size,col,o))}
function cornerFrame(x,y,w,h,col,alpha=1,len=26){for(const [a,b,sx,sy] of [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]]){line(a,b,a+sx*len,b,col,2,alpha);line(a,b,a,b+sy*len,col,2,alpha)}}
function diamond(x,y,s,col,r=0,a=1){c.save();c.translate(x,y);c.rotate(Math.PI/4+r);c.globalAlpha*=a;rect(-s/2,-s/2,s,s,col);c.restore()}
function pulse(t,a,d=.46){const u=prog(t,a,d);return t<a||u>=1?0:Math.sin(u*Math.PI)*(1-u)}
function curvedStroke(points,col,width=2,a=1){c.save();c.globalAlpha*=a;c.beginPath();c.moveTo(points[0],points[1]);c.bezierCurveTo(...points.slice(2));c.strokeStyle=col;c.lineWidth=width;c.lineCap='round';c.stroke();c.restore()}

// 01 — short, weighted bead travel; rails compact instead of the whole poster jumping.
function abacus(t){bg(P);const fold=smooth(prog(t,at(1)-.18,.47));const top=mix(508,405,fold),bottom=mix(1136,654,fold),cy=mix(824,531,fold),size=mix(254,140,fold);
 line(138,top,902,top,I,5);line(138,bottom,902,bottom,I,5);line(138,top-12,138,bottom+12,I,3);line(902,top-12,902,bottom+12,I,3);
 for(let i=0;i<3;i++){const x=262+i*258;const v=prog(t,at(0,i)-.13,.40),e=settle(v),y=cy-(1-e)*192;
  if(v<=0)line(x,top+12,x,bottom-12,I,1.5,.48);else{if(y-size*.61>top+12)line(x,top+12,x,y-size*.61,I,1.5,.48);if(y+size*.61<bottom-12)line(x,y+size*.61,x,bottom-12,I,1.5,.48)}
  if(v>0){text(phrases[0].chars[i].text,x,y,size,i===2?R:I,{font:F.heavy,a:Math.min(1,v*6),sy:1-.035*pulse(t,at(0,i)+.09,.3)});const pp=prog(t,at(0,i),.6);circle(x,y,size*.58+pp*38,R,1.5,(1-pp)*.30)}
  for(let j=0;j<2;j++){const by=mix(1016+j*39,603+j*16,fold);c.save();c.translate(x,by);c.scale(mix(39,23,fold),mix(9,4,fold));circle(0,0,1,i===2?R:I);c.restore()}
 }
 word(1,t,520,1065,245,[I,I,R],{font:F.song,mask:true,step:272,dur:.39});const ring=prog(t,at(1,2),.75);if(t>=at(1,2))circle(792,1074,153+ring*60,R,1.4,(1-ring)*.36);
 const rule=ease(prog(t,at(1),.58));line(225,1320,225+590*rule,1320,R,2.4);diamond(520,1406,11,R);track('妖怪客栈',520,1480,34,8,I,{font:F.song,a:.76});
}
// 02 — two type families have defined roles: brush landscape, solid companions.
function companions(t){bg(R);const arrive=smooth(prog(t,2.88,.85)),help=smooth(prog(t,at(3)-.22,.5));c.save();c.translate(520,890);c.scale(mix(1.035,1,arrive),mix(1.035,1,arrive));c.translate(-520,-890);
 glyph(2,0,t,306,674,370,P,{font:F.brush,dx:-112,dy:40,turn:-.08,dur:.43});glyph(2,1,t,734,674,370,G,{font:F.brush,dx:112,dy:-35,turn:.08,dur:.43});
 glyph(2,2,t,307,mix(1080,1049,help),300,G,{font:F.heavy,mask:true,dur:.36});glyph(2,3,t,735,mix(1080,1049,help),300,P,{font:F.heavy,mask:true,dur:.36});
 const r=ease(prog(t,at(2),.8));line(169,859,169+701*r,859,P,2,.50);cornerFrame(149,425,742,810,P,.36,25);c.restore();
 const w=650*help;rect(520-w/2,1328,w,176,P);if(help>.05){c.save();c.beginPath();c.rect(520-w/2,1328,w,176);c.clip();word(3,t,520,1410,130,R,{font:F.heavy,dy:42,step:166,dur:.36});c.restore()}
 line(225,1540,815,1540,P,1,.35);
}
// 03 — a single reading baseline for each role. The second role makes room first.
function roles(t){bg(P);const lower=smooth(prog(t,at(5)-.24,.50)),topY=mix(870,691,lower),split=mix(1920,956,lower);rect(0,split,W,H,I);line(124,split,916,split,G,3);
 glyph(4,0,t,240,topY-12,320,R,{font:F.brush,dx:-85,dy:20,dur:.39});for(let i=1;i<4;i++)glyph(4,i,t,490+(i-1)*170,topY+12,160,I,{font:F.song,mask:true,dur:.32});
 for(let i=0;i<4;i++)glyph(5,i,t,i===0?240:490+(i-1)*170,i===0?1232:1256,i===0?320:160,i===0?G:P,{font:i===0?F.brush:F.song,dx:i===0?85:0,dy:i===0?20:45,mask:i>0,dur:.38});
 const lineAt=topY+215;line(150,lineAt,890,lineAt,R,1,.35);if(lower>.1){line(150,1471,890,1471,G,1,.32);diamond(520,1552,10,G,0,lower)}
}
// 04 — one compact square actually unfolds into an oversized 大.
function smallBig(t){bg(I);const grow=smooth(prog(t,at(7)-.16,.60));const smallPos=[[458,782],[582,782],[458,926],[582,926]];
 for(let i=0;i<4;i++){const [x,y]=smallPos[i];glyph(6,i,t,mix(x,405+i*77,grow),mix(y,369,grow),mix(103,61,grow),P,{font:F.song,mask:true,dur:.31})}
 const x=mix(382,132,grow),y=mix(673,459,grow),w=mix(276,776,grow),h=mix(344,815,grow);cornerFrame(x,y,w,h,G,.68,27);if(grow<.99){line(x,y,x+w,y,G,1,.3*(1-grow));line(x,y+h,x+w,y+h,G,1,.3*(1-grow))}
 const v=prog(t,at(7)-.12,.58),e=settle(v);if(v>0){text('大',520,824,775,G,{font:F.brush,s:mix(.11,1,e),a:Math.min(1,v*5),r:(1-e)*-.055});circle(520,830,mix(144,462,e),G,1.5,(1-v)*.38)}
 for(let i=1;i<4;i++)glyph(7,i,t,284+(i-1)*236,1379,193,P,{font:F.song,mask:true,dur:.38});
}
// A shared object between two scenes: three seat rails become the single stroke 一.
function tableBridge(t,header=0){const q=smooth(prog(t,15.40,.60)),fade=1-smooth(prog(t,16.03,.34));for(let i=0;i<3;i++){
 const x=248+i*272,gy=mix(1010,338,q),sz=mix(244,60,q);text('坐',x,gy,sz,I,{font:F.heavy,a:fade});
 const left=mix(x-116,170+i*700/3,q),right=mix(x+116,170+(i+1)*700/3,q),by=mix(1180,560,q);
 line(mix(left,355+i*54/3,header),mix(by,373,header),mix(right,355+(i+1)*54/3,header),mix(by,373,header),I,mix(mix(4,24,q),5.5,header));
 line(x-75,by,x-75,by+52*(1-q),R,3,1-q);line(x+75,by,x+75,by+52*(1-q),R,3,1-q);
 }}
// 05 — the same three glyph positions turn from 来 into 坐, then retain their rails.
function comeSit(t){const paperIn=smooth(prog(t,at(9)-.26,.35));bg(R);const edge=H*(1-paperIn);c.save();c.beginPath();c.rect(0,edge,W,H);c.clip();bg(P);c.restore();
 if(t>=15.40){tableBridge(t);return}
 const layout=smooth(prog(t,at(8,1)-.40,.32));const ringA=1-smooth(prog(t,at(9)-.32,.42));
 if(ringA>0){c.save();c.globalAlpha=ringA;c.translate(520,918);for(let row=0;row<3;row++){const radius=535+row*206,motion=(t-12.56)*(.13+row*.018)*(row%2?-1:1);for(let n=0;n<16;n++){const angle=n*Math.PI/8+motion+row*.065;text('来',Math.cos(angle)*radius,Math.sin(angle)*radius,51+row*7,P,{font:F.song,r:angle+Math.PI/2,a:.45-row*.08})}circle(0,0,radius-50,P,1,.12)}c.restore()}
 for(let i=0;i<3;i++){const x=i===0?mix(520,248,layout):520+(i-1)*272,sz=i===0?mix(510,244,layout):244;const turn=prog(t,at(9,i)-.15,.30),before=turn<.5;
  if(before){const scale=Math.max(.015,Math.cos(turn*Math.PI));const paint=col=>glyph(8,i,t,x,930,sz,col,{font:F.heavy,dy:70,dur:.39,sx:scale,elastic:true});paint(P);c.save();c.beginPath();c.rect(0,edge,W,H);c.clip();paint(R);c.restore()}
  else {const v=prog(t,at(9,i),.38),land=settle(v),y=mix(898,1010,land),press=pulse(t,at(9,i)+.18,.24);text('坐',x,y,244,I,{font:F.heavy,sx:Math.max(.02,-Math.cos(turn*Math.PI))*(1+press*.07),sy:1-press*.065});const rail=ease(prog(t,at(9,i)+.07,.28));line(x-116,1180,x-116+232*rail,1180,I,4);line(x-75,1180,x-75,1232,R,3,rail);line(x+75,1180,x+75,1232,R,3,rail)}
 }
 const caption=paperIn*(1-smooth(prog(t,15.15,.25)));track('来来来',520,395,59,11,R,{font:F.song,a:caption});
}
// 06 — the desktop stroke is retained; the sentence compacts above four folded prints.
function warmth(t){bg(P);const pack=smooth(prog(t,at(11)-.20,.57));tableBridge(t,pack);
 glyph(10,1,t,mix(520,474,pack),mix(856,374,pack),mix(411,78,pack),I,{font:F.song,mask:true,dur:.41});
 glyph(10,2,t,mix(327,566,pack),mix(1255,374,pack),mix(262,78,pack),color(R,I,pack),{font:F.song,dx:-54,dy:85,dur:.44});
 glyph(10,3,t,mix(711,658,pack),mix(1255,374,pack),mix(262,78,pack),color(R,I,pack),{font:F.song,dx:54,dy:85,dur:.44});
 const steam=ease(prog(t,at(10,2)-.1,.6))*(1-pack);if(steam>0){for(let i=0;i<2;i++){const x=i===0?159:884,sgn=i?1:-1;curvedStroke([x,1270,x-sgn*51,1180,x+sgn*45,1130,x,1034],R,2.4,steam*.46);curvedStroke([x+sgn*25,1240,x-sgn*12,1160,x+sgn*70,1100,x+sgn*17,1000],G,1.4,steam*.52)}}
 const centers=[[317,793],[729,793],[317,1221],[729,1221]],colors=[R,G,G,I];
 for(let i=0;i<4;i++){const v=prog(t,at(11,i)-.12,.43),e=settle(v);if(v<=0)continue;const [x,y]=centers[i],col=colors[i],ink=i===1||i===2?I:P;
  c.save();c.translate(x+(1-e)*(i%2?82:-82),y+(1-e)*46);c.rotate((1-e)*(i%2?.075:-.075));c.scale(Math.max(.02,e),1);c.globalAlpha=Math.min(1,v*5);rect(-198,-204,396,408,col);cornerFrame(-181,-187,362,374,ink,.28,18);text(phrases[11].chars[i].text,0,-3,292,ink,{font:F.heavy});c.restore();
 }
 const end=ease(prog(t,at(11,3)+.32,.6));line(234,1555,234+580*end,1555,R,1.5,.48);diamond(520,1608,10,R,0,end);
}
// 07 — two measured door actions; the repeat unfolds the light face of the print.
function openPair(p,t,col){for(let i=0;i<2;i++){const v=prog(t,at(p,i)-.13,.42),e=settle(v);if(v>0)text(phrases[p].chars[i].text,302+i*435,933,418,col,{font:F.heavy,sx:mix(.18,1,e),a:Math.min(1,v*6),r:(1-e)*(i?.055:-.055)})}}
function openShop(t){bg(R);cornerFrame(113,511,814,832,P,.60,41);line(177,541,863,541,G,1.7,.75);line(177,1311,863,1311,G,1.7,.75);openPair(12,t,P);
 const p=smooth(prog(t,at(13)-.16,.38));if(p>0){const w=W*p;c.save();c.beginPath();c.rect((W-w)/2,0,w,H);c.clip();bg(P);cornerFrame(113,511,814,832,R,.60,41);line(177,541,863,541,R,1.7,.65);line(177,1311,863,1311,R,1.7,.65);openPair(13,t,R);c.restore()}
 const mark=ease(prog(t,at(12,1)+.12,.48));line(306,1481,734,1481,color(P,R,p),1,.50*mark);for(let i=0;i<3;i++)circle(456+i*64,1481,7,color(G,R,p),0,mark);
}
// 08 — the opened panels reveal the brand; only the seal lands, then everything rests.
function finale(t){bg(P);const frame=ease(prog(t,21.85,.82));cornerFrame(130,475,784,819,R,.7*frame,46);line(146,491,898,491,G,1.4,.5*frame);line(146,1278,898,1278,G,1.4,.5*frame);
 const xy=[[311,719],[733,719],[311,1106],[733,1106]];for(let i=0;i<4;i++){const [x,y]=xy[i],v=prog(t,at(14,i)-.12,.46);if(v>0){c.save();c.beginPath();const reveal=ease(v);c.rect(x-200,y-219,400*reveal,440);c.clip();text(phrases[14].chars[i].text,x+(1-reveal)*28,y+(1-reveal)*18,365,i===1?R:I,{font:F.brush,a:Math.min(1,v*7)});c.restore()}}
 const lineIn=smooth(prog(t,at(15)-.12,.53));line(248,1389,248+548*lineIn,1389,R,2);word(15,t,520,1501,125,[I,R,I,I],{font:F.song,step:145,mask:true,dur:.39});
 const a=prog(t,25.33,.41);if(a>0){const e=settle(a);c.save();c.translate(899,1219-(1-e)*37);c.rotate(-.045);c.globalAlpha=Math.min(1,a*7);c.scale(mix(1.13,1,e),mix(1.13,1,e));rect(-39,-66,78,132,R);text('开',0,-31,48,P,{font:F.brush});text('张',0,29,48,P,{font:F.brush});c.restore()}
}
const scenes=[abacus,companions,roles,smallBig,comeSit,warmth,openShop,finale];
function drawScene(k,t){c.save();scenes[k](t);c.restore()}
const bridges=[
 {k:1,start:2.72,end:3.16,type:'ring',x:792,y:1074},
 {k:2,start:5.86,end:6.28,type:'paper'},
 {k:3,start:8.76,end:9.20,type:'counter'},
 {k:4,start:12.35,end:12.78,type:'ring',x:520,y:824},
 {k:6,start:19.76,end:20.24,type:'fold'},
 {k:7,start:21.78,end:22.38,type:'doors'}
];
function transition(b,t){const p=smooth(prog(t,b.start,b.end-b.start)),k=b.k;
 if(b.type==='fold'||b.type==='doors'){
  drawScene(k,t);for(let i=0;i<2;i++){c.save();if(b.type==='doors')c.translate((i?1:-1)*W*.58*p,0);else{const anchor=i?W:0;c.translate(anchor,0);c.scale(Math.max(.0001,1-p),1);c.translate(-anchor,0)}c.beginPath();c.rect(i*W/2,0,W/2,H);c.clip();drawScene(k-1,t);c.restore()}return;
 }
 drawScene(k-1,t);c.save();c.beginPath();if(b.type==='ring'){c.arc(b.x,b.y,2200*p,0,Math.PI*2)}else if(b.type==='paper'){c.rect(mix(195,0,p),mix(1328,0,p),mix(650,W,p),mix(176,H,p))}else if(b.type==='counter'){c.rect(0,H*(1-p),W,H)}c.clip();drawScene(k,t);c.restore();
 if(b.type==='paper'){track('来帮忙',520,mix(1410,430,p),mix(130,45,p),mix(36,7,p),R,{a:1-smooth(prog(p,.28,.59)),font:F.heavy})}
 if(b.type==='counter')line(0,H*(1-p),W,H*(1-p),G,1.4,.40);
 if(b.type==='ring'&&p>.02&&p<.9)circle(b.x,b.y,2200*p,G,3,(1-p)*.5);
}
window.renderAt=t=>{t=Math.min(D,Math.max(0,t));let k=0;while(k<scenes.length-1&&t>=cuts[k+1])k++;c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;const bridge=bridges.find(b=>t>=b.start&&t<b.end);if(bridge)transition(bridge,t);else drawScene(k,t);return {time:t,scene:k,transition:bridge?.type||null,lyric:phrases.filter(p=>p.at<=t).slice(-1)[0]?.text||''}};
const audio=document.querySelector('#audio'),seek=document.querySelector('#seek'),button=document.querySelector('#play'),sound=document.querySelector('#sound');let raf=0,playing=false;
function show(t){renderAt(t);seek.value=t;document.querySelector('#clock').textContent=`00:${String(Math.floor(t)).padStart(2,'0')} / 00:27`}
function tick(){show(Math.min(D,audio.currentTime));if(playing)raf=requestAnimationFrame(tick)}
async function toggle(){if(playing){audio.pause();playing=false;cancelAnimationFrame(raf);button.textContent='继续'}else{if(audio.currentTime>=D-.05)audio.currentTime=0;await audio.play();playing=true;button.textContent='暂停';raf=requestAnimationFrame(tick)}}
button.onclick=()=>toggle().catch(e=>{button.textContent='播放';console.error(e)});audio.onended=()=>{playing=false;cancelAnimationFrame(raf);show(D);button.textContent='重播'};seek.oninput=()=>{audio.currentTime=+seek.value;show(+seek.value)};sound.onclick=()=>{audio.muted=!audio.muted;sound.textContent=audio.muted?'静音':'声音开'};document.addEventListener('keydown',e=>{if(e.code==='Space'&&e.target.tagName!=='INPUT'){e.preventDefault();button.click()}});if(new URLSearchParams(location.search).has('export'))document.body.classList.add('export');
window.ready=Promise.all(Object.values(F).map(f=>document.fonts.load('100px '+f))).then(()=>{const p=document.createElement('canvas');p.width=p.height=256;const q=p.getContext('2d'),img=q.createImageData(256,256);let seed=2479;for(let i=0;i<img.data.length;i+=4){seed=(1664525*seed+1013904223)>>>0;const v=seed>>>24;img.data[i]=img.data[i+1]=img.data[i+2]=v;img.data[i+3]=96}q.putImageData(img,0,0);paper=c.createPattern(p,'repeat');button.disabled=false;show(0)});
