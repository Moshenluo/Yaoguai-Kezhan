// Landscape typography PV: deterministic 1920 × 1080 Canvas.
const canvas=document.querySelector('canvas');
const c=canvas.getContext('2d'),W=1920,H=1080,D=SCORE.duration;
const P='#f3ead8',I='#24382f',R='#c64c35',G='#dcb46c',DARK='#923923';
const F={heavy:'PVHeavy',song:'PVSong',brush:'PVBrush'};
const phrases=SCORE.phrases;
const clamp=x=>Math.max(0,Math.min(1,x)),mix=(a,b,p)=>a+(b-a)*p;
const smooth=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10)};
const ease=x=>1-(1-clamp(x))**3;
// One controlled overshoot. Text bodies do not share a perpetual squash/bounce.
const settle=x=>{x=clamp(x);return 1-(1-x)**3*Math.cos(x*Math.PI*1.55)};
const at=(p,i=0)=>phrases[p].chars[i].at;
const prog=(t,a,d=.36)=>clamp((t-a)/d);
let paper,fibers,wash;
function rgba(hex,a){const v=parseInt(hex.slice(1),16);return `rgba(${v>>16},${v>>8&255},${v&255},${a})`}
function color(a,b,p){const x=parseInt(a.slice(1),16),y=parseInt(b.slice(1),16);return '#'+[16,8,0].map(s=>Math.round(mix(x>>s&255,y>>s&255,p)).toString(16).padStart(2,'0')).join('')}
function rect(x,y,w,h,col){c.fillStyle=col;c.fillRect(x,y,w,h)}
function line(x,y,x2,y2,col=I,width=2,alpha=1){c.save();c.globalAlpha*=alpha;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.strokeStyle=col;c.lineWidth=width;c.lineCap='butt';c.stroke();c.restore()}
function circle(x,y,r,col,stroke=0,alpha=1){if(r<=0)return;c.save();c.globalAlpha*=alpha;c.beginPath();c.arc(x,y,r,0,Math.PI*2);if(stroke){c.strokeStyle=col;c.lineWidth=stroke;c.stroke()}else{c.fillStyle=col;c.fill()}c.restore()}
function bg(col){rect(0,0,W,H,col);const dark=col===I;
 if(wash){c.save();c.globalAlpha=dark?.16:.11;c.drawImage(wash,0,0,W,H);c.restore()}
 if(paper){c.save();c.globalAlpha=.070;c.fillStyle=paper;c.fillRect(0,0,W,H);c.restore()}
 if(fibers){c.save();c.globalAlpha=dark?.055:.075;c.fillStyle=fibers;c.fillRect(0,0,W,H);c.restore()}
}
// Fine, imperfect ink edges belong to the paper objects, never to every scene.
function printedBorder(x,y,w,h,col,alpha=1){c.save();c.globalAlpha*=alpha;c.strokeStyle=col;c.lineWidth=1.7;c.beginPath();c.moveTo(x+9,y+1);c.lineTo(x+w*.43,y);c.lineTo(x+w-2,y+1.5);c.lineTo(x+w,y+h*.47);c.lineTo(x+w-1,y+h-1);c.lineTo(x+w*.48,y+h);c.lineTo(x+1,y+h-1.7);c.lineTo(x,y+h*.31);c.closePath();c.stroke();c.restore()}
function seal(x,y,w,h,alpha=1,rotation=-.035){c.save();c.translate(x,y);c.rotate(rotation);c.globalAlpha*=alpha;
 c.fillStyle=R;c.beginPath();c.moveTo(-w/2+1,-h/2+1);c.lineTo(w/2-1,-h/2-1);c.lineTo(w/2+1,h/2-2);c.lineTo(-w/2,h/2+1);c.closePath();c.fill();
 printedBorder(-w/2+6,-h/2+6,w-12,h-12,P,.75);text('开',0,-h*.235,w*.56,P,{font:F.brush});text('张',0,h*.235,w*.56,P,{font:F.brush});
 for(let i=0;i<8;i++)rect(-w*.37+(i*17%Math.floor(w*.7)),i%2?h/2-2:-h/2,1.4,2.4,P);c.restore()
}

function text(s,x,y,size,col=I,o={}){if((o.a??1)<=0)return;c.save();c.globalAlpha*=o.a??1;c.translate(x,y);c.rotate(o.r||0);c.scale(o.sx??o.s??1,o.sy??o.s??1);c.textAlign='center';c.textBaseline='middle';c.font=`${size}px ${o.font||F.heavy}`;c.fillStyle=col;if(o.outline){c.strokeStyle=col;c.lineWidth=o.outline;c.strokeText(s,0,0)}else c.fillText(s,0,0);c.restore()}
function maskedText(s,x,y,size,col,p,o={}){if(p<=0)return;c.save();c.translate(x,y);c.rotate(o.r||0);c.beginPath();c.rect(-size*.76,-size*.61,size*1.52,size*1.22);c.clip();text(s,0,(1-ease(p))*size*.52,size,col,{...o,r:0,a:Math.min(1,p*5)});c.restore()}
function glyph(p,i,t,x,y,size,col=I,o={}){const a=at(p,i),v=prog(t,a-(o.lead??.12),o.dur||.36);if(!v)return;const e=o.elastic?settle(v):ease(v);if(o.mask){maskedText(phrases[p].chars[i].text,x,y,size,col,v,o);return}text(phrases[p].chars[i].text,x+(1-e)*(o.dx||0),y+(1-e)*(o.dy??48),size,col,{...o,a:(o.a??1)*Math.min(1,v*5),r:(o.r||0)+(1-e)*(o.turn||0)})}
function word(p,t,x,y,size,col=I,o={}){const n=phrases[p].chars.length,step=o.step??size*1.03;for(let i=0;i<n;i++)glyph(p,i,t,x+(i-(n-1)/2)*step,y,size,Array.isArray(col)?col[i%col.length]:col,o)}
function track(s,x,y,size,gap,col,o={}){const chars=[...s],step=size+gap;chars.forEach((v,i)=>text(v,x+(i-(chars.length-1)/2)*step,y,size,col,o))}
function cornerFrame(x,y,w,h,col,alpha=1,len=26){for(const [a,b,sx,sy] of [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]]){line(a,b,a+sx*len,b,col,2,alpha);line(a,b,a,b+sy*len,col,2,alpha)}}
function diamond(x,y,s,col,r=0,a=1){c.save();c.translate(x,y);c.rotate(Math.PI/4+r);c.globalAlpha*=a;rect(-s/2,-s/2,s,s,col);c.restore()}
function pulse(t,a,d=.46){const u=prog(t,a,d);return t<a||u>=1?0:Math.sin(u*Math.PI)*(1-u)}
function curvedStroke(points,col,width=2,a=1){c.save();c.globalAlpha*=a;c.beginPath();c.moveTo(points[0],points[1]);c.bezierCurveTo(...points.slice(2));c.strokeStyle=col;c.lineWidth=width;c.lineCap='round';c.stroke();c.restore()}
