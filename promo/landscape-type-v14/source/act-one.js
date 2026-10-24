// Landscape act I: horizontal reading, shared paper objects and finite character motions.
function widePressure(t,start,duration=.30){
 const u=prog(t,start,duration);
 return t<start||u>=1?0:Math.sin(Math.PI*u)**2;
}
function widePaperCorner(x,y,w=54,h=76,alpha=1){
 c.save();c.globalAlpha*=alpha;rect(x,y,w,h,R);
 line(x+7,y+7,x+w-7,y+7,G,1,.58);line(x+w-7,y+7,x+w-7,y+h-10,G,1,.58);c.restore();
}

// The brand holds the right third while the sung beads play across the left two thirds.
// Bridge anchor after 1.67 s: beam (180,470) → (1200,470), 5 px; pins radius 6.
function abacus(t,brandAlpha=1,beamTaken=false){
 bg(P);
 const fold=smooth(prog(t,1.24,.43)),macro=1-smooth(prog(t,.16,.30));
 const rails=ease(prog(t,.43,.24)),top=260,bottom=mix(710,470,fold);
 const cy=mix(470,350,fold),size=mix(260,154,fold);
 c.save();c.globalAlpha*=rails;
 line(180,top,1200,top,I,5);
 if(!beamTaken)line(180,bottom,1200,bottom,I,5);
 line(180,top-12,180,bottom+12,I,3);line(1200,top-12,1200,bottom+12,I,3);
 for(const x of [180,1200])for(const y of (beamTaken?[top]:[top,bottom])){circle(x,y,6,G);circle(x,y,2.3,I)}
 c.restore();
 for(let i=0;i<3;i++){
  const x=350+i*350,v=i===0?1:prog(t,at(0,i)-(i===1?.055:.13),.38),e=settle(v);
  const y=cy-(1-e)*145;
  c.save();c.globalAlpha*=rails;
  if(v<=0)line(x,top+12,x,bottom-12,I,1.5,.46);
  else{
   if(y-size*.60>top+12)line(x,top+12,x,y-size*.60,I,1.5,.46);
   if(y+size*.60<bottom-12)line(x,y+size*.60,x,bottom-12,I,1.5,.46);
  }
  const tap=16*widePressure(t,at(0,i)+.035,.31)*(1-fold);
  for(let j=0;j<2;j++){
   const by=mix(640+j*33,428+j*16,fold)-tap*(j?1:.63);
   c.save();c.translate(x,by);c.scale(mix(43,27,fold),mix(10,5,fold));circle(0,0,1,i===2?R:I);c.restore();
  }
  c.restore();
  if(v>0){
   const px=i===0?mix(x,580,macro):x,py=i===0?mix(y,500,macro):y,sz=i===0?mix(size,540,macro):size;
   text(phrases[0].chars[i].text,px,py,sz,i===2?R:I,{font:F.heavy,a:Math.min(1,v*6),sy:1-.025*widePressure(t,at(0,i)+.09,.24)});
   if(i===2&&t>=at(0,2)){const pp=prog(t,at(0,2),.62);circle(x,y,size*.59+pp*55,R,1.8,(1-pp)*.42)}
  }
 }
 word(1,t,690,720,245,[I,I,R],{font:F.song,mask:true,step:298,dur:.36});
 const echo=prog(t,at(1,2),.70);if(t>=at(1,2))circle(988,722,145+echo*51,R,1.3,(1-echo)*.28);
 c.save();c.globalAlpha*=brandAlpha;
 line(1274,292,1274,786,I,1,.12);
 seal(1737,296,60,101,.9,-.045);
 track('妖怪客栈',1535,475,98,9,I,{font:F.brush});
 line(1354,540,1716,540,R,1.8,.7);diamond(1535,559,7,R);
 ['经营客栈','招募妖怪','夜晚守家'].forEach((s,i)=>track(s,1535,613+i*60,37,6,I,{font:F.song}));
 c.restore();
}

// Mountain/sea lettering leads a single broad reading line; the help strip is a real paper surface.
// Fully opened strip: x=1120, y=740, width=620, height=145; lyric center=(1430,810).
function companions(t){
 bg(R);
 const arrive=smooth(prog(t,2.90,.75)),help=smooth(prog(t,at(3)-.22,.50));
 const drift=mix(16,0,arrive);
 glyph(2,0,t,365-drift,454,346,P,{font:F.brush,dx:-82,dy:32,turn:-.045,dur:.41});
 glyph(2,1,t,760+drift,486,346,G,{font:F.brush,dx:78,dy:-28,turn:.045,dur:.41});
 glyph(2,2,t,1150,478,302,G,{font:F.heavy,mask:true,dur:.34});
 glyph(2,3,t,1550,478,302,P,{font:F.heavy,mask:true,dur:.34});
 const rule=ease(prog(t,at(2),.80));
 line(180,674,180+1560*rule,674,P,1.6,.42);circle(175,674,3.4,G,0,rule);
 for(let n=0;n<3;n++)curvedStroke([190,230+n*11,590,176+n*11,1130,274+n*11,1710,214+n*11],P,1.1,.12*rule);
 const w=620*help,h=145*ease(prog(help,.025,.65)),x=1430-w/2,y=812.5-h/2;
 c.save();c.beginPath();c.rect(x,y,w,h);c.clip();bg(P);c.restore();
 if(w>60&&h>30){line(x+13,y+13,x+w-13,y+13,R,1,.3);line(x+13,y+h-13,x+w-13,y+h-13,R,1,.3)}
 if(help>.05){c.save();c.beginPath();c.rect(x,y,w,h);c.clip();word(3,t,1430,810,112,R,{font:F.heavy,dy:35,step:145,dur:.34});c.restore()}
}

// Accelerating short downstroke, one impression, then complete stillness.
function wideKeeperGlyph(i,t,x,y,size){
 const v=prog(t,at(4,i)-.16,.18);if(v<=0)return;
 const down=v*v*(.45+.55*v),press=widePressure(t,at(4,i)+.015,.22);
 text(phrases[4].chars[i].text,x,y-39*(1-down),size,I,{font:F.song,a:smooth(prog(t,at(4,i)-.16,.075)),sx:1+.014*press,sy:1-.023*press});
}
// One purposeful step per syllable. All coordinates and lean settle to the reading baseline.
function wideRunnerGlyph(i,t){
 const v=prog(t,at(5,i)-.12,.43);if(v<=0)return;
 const e=ease(v),step=Math.sin(Math.PI*v)**1.4;
 const x=i===0?1120:1370+(i-1)*165,y=i===0?510:535,size=i===0?290:140;
 text(phrases[5].chars[i].text,x+(1-e)*(i===0?53:39),y-step*(i===0?19:25),size,i===0?G:P,{
  font:i===0?F.brush:F.song,a:smooth(prog(v,0,.25)),r:step*(i===0?-.021:(i%2?.040:-.040))
 });
}
function roles(t){
 bg(P);
 const splitIn=smooth(prog(t,at(5)-.48,.40)),edge=mix(W,960,splitIn);
 c.save();c.beginPath();c.rect(edge,0,W-edge,H);c.clip();bg(I);c.restore();
 line(edge,180,edge,900,G,2.2,.75*splitIn);
 const youX=mix(490,260,splitIn),youY=mix(500,510,splitIn),youSize=mix(440,300,splitIn);
 glyph(4,0,t,youX,youY,youSize,R,{font:F.brush,dx:-74,dy:20,dur:.38});
 for(let i=1;i<4;i++){
  const x=mix(900+(i-1)*265,490+(i-1)*160,splitIn),size=mix(220,145,splitIn);
  if(i===1)glyph(4,i,t,x,535,size,I,{font:F.song,mask:true,dur:.29});
  else wideKeeperGlyph(i,t,x,535,size);
 }
 for(let i=0;i<4;i++)wideRunnerGlyph(i,t);
 const underline=ease(prog(t,at(4,3),.40)),left=mix(350,180,splitIn);
 line(left,738,left+160,738,R,2.1,.54*underline);
 line(1574,738,1738,738,G,2.1,.5*splitIn);circle(1749,738,3,G,0,.55*splitIn);
}

// Compact seal → wide calligraphic payoff. Frame and paper corner share the same geometry.
// Fully unfolded frame=(170,170,740,730), movable red corner=(856,170,54,76).
function smallBig(t,cornerTaken=false){
 bg(I);
 const grow=smooth(prog(t,at(7)-.16,.60));
 const smallPos=[[885,470],[1015,470],[885,600],[1015,600]];
 const stamp=ease(prog(t,8.88,.38))*(1-smooth(prog(grow,0,.72)));
 c.save();c.globalAlpha*=stamp;rect(813,390,274,290,R);printedBorder(823,400,254,270,P,.48);c.restore();
 for(let i=0;i<4;i++){
  const [x,y]=smallPos[i];glyph(6,i,t,mix(x,1260+i*73,grow),mix(y,255,grow),mix(106,66,grow),P,{font:F.song,mask:true,dur:.31});
 }
 const fx=mix(813,170,grow),fy=mix(390,170,grow),fw=mix(274,740,grow),fh=mix(290,730,grow);
 cornerFrame(fx,fy,fw,fh,G,.62,28);
 if(grow<.99){line(fx,fy,fx+fw,fy,G,1,.24*(1-grow));line(fx,fy+fh,fx+fw,fy+fh,G,1,.24*(1-grow))}
 const v=prog(t,at(7)-.12,.50);
 if(v>0){
  const x=mix(950,540,grow),y=mix(540,550,grow),scale=mix(.13,1,Math.sqrt(grow));
  text('大',x,y,720,G,{font:F.brush,s:scale*(1+.014*widePressure(t,at(7)+.13,.28)),a:Math.min(1,v*5),r:-.035*(1-grow)});
 }
 for(let i=1;i<4;i++)glyph(7,i,t,[1110,1380,1640][i-1],590,210,P,{font:F.song,mask:true,dur:.35});
 if(!cornerTaken&&grow>0)widePaperCorner(fx+fw-54,fy,54,76,grow);
}

window.wideActOneGeometry={
 abacusBeam:{x:180,y:470,width:1020,stroke:5,pinRadius:6,readyAt:1.67},
 companionPaper:{x:1120,y:740,width:620,height:145,textX:1430,textY:810,fontSize:112,step:145},
 greatFrame:{x:170,y:170,width:740,height:730},
 paperCorner:{x:856,y:170,width:54,height:76},
 roleSplit:{start:6.94,end:7.34,x:960}
};
