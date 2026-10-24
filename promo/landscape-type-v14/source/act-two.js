// Landscape chorus: shared baselines, directional invitation, and four joining prints.
function printFace(x,y,w,h,col){rect(x,y,w,h,col);if(paper){c.save();c.globalAlpha*=.04;c.fillStyle=paper;c.fillRect(x,y,w,h);c.restore()}}

// Three seat rails converge into the one continuous stroke used for 一.
function tableBridge(t,header=0){
 const q=smooth(prog(t,15.40,.60)),fade=1-smooth(prog(t,16.03,.31));
 for(let i=0;i<3;i++){
  const x=500+i*460,seatY=mix(580,245,q),seatSize=mix(280,55,q);
  text('坐',x,seatY,seatSize,I,{font:F.heavy,a:fade});
  const left=mix(x-146,260+i*250/3,q),right=mix(x+146,260+(i+1)*250/3,q),by=mix(740,540,q);
  const lx=mix(left,730+i*76/3,header),rx=mix(right,730+(i+1)*76/3,header),ly=mix(by,201,header);
  line(lx,ly,rx+(i<2?.7*q:0),ly,I,mix(mix(4.3,23,q),5.8,header));
  const legA=(1-q)*(1-header);
  line(x-91,by,x-91,by+47*(1-q),R,2.8,legA);line(x+91,by,x+91,by+47*(1-q),R,2.8,legA);
 }
}

function comeSit(t){
 const paperIn=smooth(prog(t,at(9)-.26,.35)),edge=W*paperIn;
 bg(R);c.save();c.beginPath();c.rect(0,0,edge,H);c.clip();bg(P);c.restore();
 if(t>=15.40){tableBridge(t);return}
 const duet=smooth(prog(t,at(8,1)-.38,.30)),trio=smooth(prog(t,at(8,2)-.36,.28));
 const ringA=1-smooth(prog(t,at(9)-.32,.42));
 if(ringA>0){
  c.save();c.globalAlpha*=ringA;c.beginPath();c.rect(0,0,W,315);c.rect(0,770,W,H-770);c.clip();
  for(let row=0;row<3;row++){
   const count=[15,19,23][row],appear=ease(prog(t,at(8,row)-.10,.42)),rx=815+row*221,ry=326+row*173;
   const drift=(t-12.56)*(.13+row*.027)*(row%2?-1:1);
   for(let n=0;n<count;n++){
    if((n+row*2)%7===0)continue;
    const angle=n*2*Math.PI/count+drift+row*.13;
    text('来',960+Math.cos(angle)*rx,525+Math.sin(angle)*ry,54+row*5,P,{font:F.song,r:Math.sin(angle)*.17,a:(.42-row*.09)*appear});
   }
  }
  c.restore();
 }
 for(let i=0;i<3;i++){
  const x=i===0?mix(mix(960,670,duet),500,trio):i===1?mix(1250,960,trio):1420;
  const sz=i===0?mix(mix(570,410,duet),320,trio):i===1?mix(410,320,trio):320;
  const turn=prog(t,at(9,i)-.15,.30);
  if(turn<.5){
   const paint=col=>glyph(8,i,t,x,520,sz,col,{font:F.heavy,dy:55,dur:.35,sx:Math.max(.015,Math.cos(turn*Math.PI)),elastic:true});
   paint(P);c.save();c.beginPath();c.rect(0,0,edge,H);c.clip();paint(R);c.restore();
  }else{
   const landing=settle(prog(t,at(9,i),.36)),press=widePressure(t,at(9,i)+.15,.24);
   text('坐',x,mix(495,580,landing),280,I,{font:F.heavy,sx:Math.max(.02,-Math.cos(turn*Math.PI))*(1+press*.035),sy:1-press*.035});
   const rail=ease(prog(t,at(9,i)+.07,.25));line(x-146,740,x-146+292*rail,740,I,4.3);line(x-91,740,x-91,787,R,2.8,rail);line(x+91,740,x+91,787,R,2.8,rail);
  }
 }
 const caption=paperIn*(1-smooth(prog(t,15.15,.25)));track('来来来',960,218,65,13,R,{font:F.song,a:caption});
}

function warmHeader(t,pack=1){
 tableBridge(t,pack);
 glyph(10,1,t,mix(820,894,pack),mix(540,200,pack),mix(330,80,pack),I,{font:F.song,mask:true,dur:.36});
 glyph(10,2,t,mix(1190,1024,pack),mix(540,200,pack),mix(310,80,pack),color(R,I,pack),{font:F.song,dx:-38,dy:45,dur:.38});
 glyph(10,3,t,mix(1550,1154,pack),mix(540,200,pack),mix(310,80,pack),color(R,I,pack),{font:F.song,dx:38,dy:45,dur:.38});
}

function widePrintContact(i,t){
 const reaction={x:0,y:0,r:0};
 if(i<3){const n=widePressure(t,at(11,i+1)+.025,.42);reaction.x=-11*n;reaction.y=-3*n;reaction.r=-.010*n;}
 return reaction;
}
function printGrid(t,join=0){
 const colors=[R,G,G,I],free=1-smooth(prog(join,0,.45));
 const lift=widePressure(t,at(11,3)+.15,.55)*free;
 c.save();c.translate(960,600-lift*5);c.scale(1+lift*.010,1+lift*.010);c.translate(-960,-600);
 for(let i=0;i<4;i++){
  const v=prog(t,at(11,i)-.12,.39);if(v<=0)continue;
  const e=settle(v),contact=widePrintContact(i,t),press=widePressure(t,at(11,i)+.02,.29)*free;
  const x=mix(345+i*410,570+i*260,join),y=mix(600,550,join),w=mix(370,260,join),h=mix(410,400,join);
  const ink=i===1||i===2?I:P,col=color(colors[i],P,join);
  c.save();c.translate(x+((1-e)*84+contact.x)*free,y+((1-e)*34+contact.y)*free);
  c.rotate(((1-e)*.055+contact.r)*free+[.006,-.007,.005,-.006][i]*(1-join));
  c.scale(mix(1,Math.min(1.035,Math.max(.02,e)),free)*(1+.006*press),1-.010*press);
  c.globalAlpha*=Math.min(1,v*5)*(1-smooth(prog(join,.70,.30)));
  printFace(-w/2,-h/2,w,h,col);printedBorder(-w/2+12,-h/2+12,w-24,h-24,ink,.24*(1-join));
  text(phrases[11].chars[i].text,0,-3,285,color(ink,P,join),{font:F.heavy,sx:Math.max(.03,Math.cos(join*Math.PI/2)),a:1-smooth(prog(join,.04,.64))});
  c.restore();
 }
 c.restore();
}
function wideWarmDecor(t,alpha=1){
 const done=ease(prog(t,at(11,3)+.25,.45));line(650,897,650+620*done,897,R,1.4,.34*alpha);diamond(960,926,8,R,0,done*alpha);
}
function warmth(t){
 if(t>=19.4){festivalDoors(t);return}
 bg(P);const pack=smooth(prog(t,16.84,.33));warmHeader(t,pack);
 const steam=ease(prog(t,at(10,2)-.08,.42))*(1-pack);
 if(steam>0){for(let i=0;i<2;i++){const x=i?1720:1112;curvedStroke([x,750,x-24,698,x+30,661,x+3,605],R,2,steam*.31);curvedStroke([x+20,742,x-4,689,x+46,651,x+22,600],G,1.3,steam*.4)}}
 printGrid(t);wideWarmDecor(t);
}

function shopExpansion(t){return smooth(prog(t,at(13)-.17,.48))}
function shopPaper(t,alpha=1){
 const q=shopExpansion(t),x=mix(440,0,q),y=mix(350,0,q),w=mix(1040,W,q),h=mix(400,H,q);
 c.save();c.globalAlpha*=alpha;c.beginPath();c.rect(x,y,w,h);c.clip();bg(P);c.restore();
}
function openPair(t){
 for(let i=0;i<2;i++){
  const second=settle(prog(t,at(13,i)-.08,.34));
  glyph(12,i,t,mix(700+i*520,650+i*620,second),550,mix(330,490,second),R,{font:F.heavy,mask:true,dur:.29,lead:.10});
 }
}
function shopFrame(t,alpha=1){
 const q=shopExpansion(t),x=mix(456,310,q),y=mix(366,230,q),w=mix(1008,1300,q),h=mix(368,620,q),ink=color(G,R,q);
 printedBorder(x,y,w,h,ink,.60*alpha);printedBorder(x+12,y+12,w-24,h-24,ink,.21*alpha);
 for(const [px,py,sx,sy] of [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]]){
  line(px+sx*11,py+sy*24,px+sx*24,py+sy*24,ink,2,.7*alpha);line(px+sx*24,py+sy*24,px+sx*24,py+sy*11,ink,2,.7*alpha);
 }
 for(const px of [590,1330]){line(px,280,px,350,G,2,(1-q)*alpha*.65);circle(px,294,4,G,0,(1-q)*alpha*.8)}
}
function doorMark(t){
 const mark=ease(prog(t,at(13,1)+.10,.28));line(680,927,1240,927,R,1,.4*mark);for(let i=0;i<3;i++)circle(900+i*60,927,5.5,R,0,mark);
}
function festivalDoors(t){
 const join=smooth(prog(t,19.46,.76));bg(color(P,R,join));
 c.save();c.globalAlpha*=1-smooth(prog(join,0,.65));c.translate(0,-join*48);warmHeader(t);c.restore();
 shopPaper(t,join);printGrid(t,join);wideWarmDecor(t,1-join);shopFrame(t,join);openPair(t);
}
function openShop(t){
 if(t<20.22){festivalDoors(t);return}
 bg(R);shopPaper(t);shopFrame(t);openPair(t);doorMark(t);
}
