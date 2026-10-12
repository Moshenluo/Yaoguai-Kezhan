from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
(ROOT/'svg').mkdir(parents=True,exist_ok=True)
C='#514437'; cream='#fff4de'; rust='#bf7651'; gold='#d8ae55'
def path(d, fill=cream, stroke=C, width=3, extra=''):
 return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round" {extra}/>'
def group(name, content, extra=''):
 return f'<g id="{P}-{name}" class="{name.split("-")[0]}" {extra}>{content}</g>'
def claws(x,y,tilt=0):
 return '<g transform="translate(%s %s) rotate(%s)">'%(x,y,tilt)+''.join(path(f'M {i*11} 0 q -8 8 -5 15 q 12 -6 14 -13', '#75624a',C,1.8) for i in range(3))+'</g>'
def tuft(x,y,color=rust,scale=1):
 return f'<g transform="translate({x} {y}) scale({scale})">'+path('M 0 0 Q 13 -8 22 -3 L 16 1 L 31 0 L 23 6 Q 12 11 2 10 L 7 6 Z',color,'none')+'</g>'
def tail(d,detail):
 return group('tail',path(d,'#a9a06d',C,3)+path(detail,'none','#dac078',5)+path(detail,'none','#7b835e',1.5))
def scales(cx,cy,sx=1,sy=1):
 # Hand-shaped overlapping scales; each row hangs over the seam of the previous one.
 data=''
 for row,cols in enumerate([3,4,4,4,3]):
  for col in range(cols):
   xx=col*33+(12 if row%2 else 0)+(6 if row==4 else 0)
   yy=row*30
   fill=['#929465','#a0a16a','#818f66','#98965c'][(row+col)%4]
   dd=f'M {xx} {yy} C {xx+11} {yy-10} {xx+31} {yy-3} {xx+37} {yy+9} C {xx+43} {yy+27} {xx+33} {yy+43} {xx+20} {yy+47} C {xx+5} {yy+39} {xx-3} {yy+21} {xx} {yy} Z'
   data+=path(dd,fill,'#5f694d',2)
   data+=path(f'M {xx+3} {yy+19} Q {xx+8} {yy+39} {xx+20} {yy+43} Q {xx+35} {yy+38} {xx+36} {yy+23}','none','#e3bf67',3)
   if (row+col)%3==0:
    data+=path(f'M {xx+13} {yy+15} c 15 -9 18 14 4 12 c -8 -2 -2 -10 2 -5','none','#d5b65f',1.8)
 return group('back-scales',data,f'transform="translate({cx} {cy}) scale({sx} {sy})"')
def ears(variant):
 if variant=='sleepy':
  e1='M -59 -69 C -86 -118 -71 -193 -37 -230 C -27 -200 -21 -145 -39 -82 Z'
  i1='M -56 -97 C -67 -135 -56 -190 -39 -217 C -36 -180 -32 -134 -47 -101 Z'
  t1='M -58 -170 C -55 -196 -46 -217 -37 -230 C -29 -208 -28 -190 -31 -172 L -39 -181 L -39 -163 L -47 -175 L -54 -157 Z'
  e2='M 2 -72 C 8 -124 61 -196 112 -213 C 104 -160 67 -102 29 -66 Z'
  i2='M 20 -88 C 29 -132 69 -178 100 -196 C 81 -144 52 -110 29 -92 Z'
  t2='M 65 -177 Q 89 -203 112 -213 Q 108 -180 91 -154 L 87 -169 L 75 -155 L 77 -176 L 65 -166 Z'
 elif variant=='alert':
  e1='M -60 -64 C -94 -119 -91 -186 -66 -224 C -38 -187 -30 -117 -41 -73 Z'
  i1='M -60 -91 Q -90 -151 -66 -209 Q -43 -158 -52 -98 Z'
  t1='M -83 -164 Q -82 -202 -66 -224 Q -48 -201 -42 -172 L -53 -182 L -53 -166 L -64 -180 L -66 -164 L -76 -177 Z'
  e2='M 3 -66 C 5 -124 37 -198 67 -228 C 83 -178 65 -113 31 -62 Z'
  i2='M 18 -89 Q 24 -155 64 -211 Q 70 -150 28 -86 Z'
  t2='M 36 -187 Q 50 -215 67 -228 Q 76 -201 72 -178 L 64 -187 L 57 -170 L 53 -185 L 45 -174 Z'
 else:
  e1='M -47 -64 C -51 -119 -12 -181 30 -201 C 29 -144 8 -99 -24 -62 Z'
  i1='M -35 -88 Q -21 -150 19 -184 Q 19 -136 -29 -86 Z'
  t1='M -5 -177 Q 9 -194 30 -201 Q 29 -173 22 -158 L 16 -172 L 8 -159 L 7 -174 L -2 -164 Z'
  e2='M 7 -62 C 27 -124 98 -155 166 -148 C 129 -99 73 -72 32 -54 Z'
  i2='M 29 -75 Q 81 -128 145 -138 Q 100 -97 37 -67 Z'
  t2='M 118 -147 Q 144 -151 166 -148 Q 149 -124 126 -111 L 131 -129 L 113 -119 L 120 -135 L 105 -131 Z'
 return group('ears',group('ear-left',path(e1)+path(i1,'#e9bf94','none')+path(t1,rust,'none')+path(i1,'none','#d5ae89',1.6))+group('ear-right',path(e2)+path(i2,'#e9bf94','none')+path(t2,rust,'none')+path(i2,'none','#d5ae89',1.6)))
def head(x,y,variant):
 s=ears(variant)
 s+=path('M -62 -71 Q -34 -87 -14 -75 L -5 -82 L 0 -72 Q 28 -79 48 -60 L 57 -63 L 54 -50 Q 80 -29 80 -6 L 91 -2 L 79 5 Q 84 29 66 50 L 74 59 L 59 59 Q 39 77 17 78 L 11 91 L 1 83 Q -22 94 -51 73 L -62 77 L -61 64 Q -94 53 -98 27 L -110 24 L -99 15 Q -106 -17 -87 -36 L -94 -41 L -81 -43 Q -77 -62 -62 -71 Z')
 s+=path('M -14 48 Q 16 43 48 26 Q 43 63 16 72 Q -4 80 -25 66 Z','#fff9eb','none')
 s+=tuft(-51,-65, rust,1.3)+tuft(30,-39,rust,.7)+tuft(51,-15,rust,.6)+tuft(25,44,rust,.72)
 s+=path('M -75 -42 Q -63 -46 -50 -40','none','#c79568',2)
 # Golden avian cere and the long, bent hooked upper bill are anatomically central.
 s+=group('beak',path('M -89 -25 Q -67 -42 -52 -13 Q -46 3 -34 13 Q -50 22 -66 18 Q -94 20 -116 57 Q -127 32 -118 5 Q -111 -15 -89 -25 Z','#d6ad4e',C,2.6)+path('M -89 -20 Q -103 -2 -104 23 Q -92 8 -72 6 L -57 10 Q -68 -12 -75 -19 Z','#ebc869','none')+path('M -102 26 Q -71 6 -41 13','none','#987b37',2)+path('M -98 24 Q -73 33 -63 21 Q -72 38 -88 38 Z','#a98438',C,1.6)+path('M -78 -12 q 4 -4 8 0','none','#736034',2))
 eyes=''
 if variant=='sleepy':
  eyes+=path('M -34 -19 Q -6 -7 22 -7 Q 7 18 -16 7 Q -29 1 -34 -19 Z','#fffaf0',C,2)
  eyes+=path('M -21 -10 Q -13 14 -1 4 Q 7 -1 5 -7 Z','#514132','none')
  eyes+=path('M -37 -23 Q -7 -10 27 -8','none','#805b43',4)
  eyes+=path('M -94 -22 Q -85 -17 -77 -22','none','#805b43',3)
  eyes+=path('M -22 -36 Q 1 -33 20 -25','none','#b0906c',2)
 elif variant=='alert':
  eyes+=path('M -32 -17 Q -10 -39 15 -19 Q 25 9 3 16 Q -19 18 -32 -17 Z','#fffaf0',C,2)
  eyes+='<ellipse cx="-3" cy="-3" rx="10" ry="16" fill="#564532"/><circle cx="0" cy="-9" r="4" fill="#fff9eb"/>'
  eyes+=path('M -34 -20 Q -9 -42 19 -18','none','#805b43',3)
  eyes+=path('M -93 -22 Q -84 -33 -76 -22','none','#805b43',2.5)
  eyes+=path('M -22 -40 Q -4 -47 12 -37','none','#b0906c',2)
 else:
  eyes+=path('M -31 -7 Q -10 -34 15 -8','none','#674b36',4)
  eyes+=path('M -28 -2 Q -12 -13 4 -6','none','#a27d55',1.6)
  eyes+=path('M -94 -21 Q -86 -28 -78 -20','none','#674b36',2.5)
  eyes+=path('M -25 -38 Q -8 -43 9 -32','none','#b0906c',2)
 eyes+=path('M -23 27 Q -7 33 7 25','none','#d79278',5)
 s+=group('face',group('eyes',eyes)+path('M 27 10 Q 46 19 54 31','none','#e0c7a2',1.6)+path('M -8 59 l 7 8 M 12 63 l 6 6 M 31 55 l 4 8','none','#d7bf9b',1.6))
 return group('head',s,f'transform="translate({x} {y})"')
def tray(x,y):
 s=path('M -102 -9 Q -106 -5 -101 3 L -86 18 Q 0 29 91 14 L 108 -3 Z','#a56842',C,2.6)
 s+=path('M -105 -9 Q -109 -20 -92 -24 Q 7 -41 101 -25 Q 115 -22 112 -12 Q 15 5 -105 -9 Z','#d2a569',C,2.6)
 s+=path('M -85 -14 Q 9 -29 93 -18','none','#ead2a3',2)
 for xx in [-55,40]:
  s+=path(f'M {xx-25} -54 Q {xx} -45 {xx+25} -54 L {xx+20} -26 Q {xx} -15 {xx-18} -26 Z','#f3ead8','#55634e',2)
  s+=f'<ellipse cx="{xx}" cy="-54" rx="25" ry="7" fill="#b8c6a0" stroke="#55634e" stroke-width="2"/><ellipse cx="{xx}" cy="-54" rx="18" ry="3.3" fill="#ae824d"/>'
  s+=path(f'M {xx-9} -68 q -8 -9 0 -18 q 7 -8 1 -15','none','#c3bda4',2)
  s+=path(f'M {xx-10} -39 q 10 9 20 0','none','#c79150',1.5)
 return group('prop-tea-tray',s,f'transform="translate({x} {y})"')

def make(variant):
 global P
 poses={'sleepy':'01-sleepy','alert':'02-tea','running':'03-delivery'}
 P='qiuyu-'+poses[variant]
 title={'sleepy':'犰狳 · 困困掌柜','alert':'犰狳 · 双盏奉茶','running':'犰狳 · 轻快跑堂'}[variant]
 s='<g class="ground"><ellipse cx="338" cy="558" rx="158" ry="12" fill="#64735a" opacity=".10"/></g>'
 if variant=='sleepy':
  s+=tail('M 463 502 C 525 525 563 482 547 437 C 537 407 499 389 512 358 C 522 334 554 326 573 344 C 559 312 521 319 503 340 C 476 375 507 408 521 436 C 538 470 511 489 470 474 Z','M 484 491 C 526 502 549 475 535 440 C 520 407 492 388 507 355 Q 532 322 558 335')
  s+=group('body',path('M 283 315 C 337 289 411 310 455 365 C 487 404 501 478 469 515 Q 439 544 391 527 Q 340 551 286 526 Q 231 490 228 429 Q 221 362 283 315 Z')+path('M 412 468 Q 462 466 462 507 L 435 538 Q 406 547 382 530 Q 371 518 387 501 Z')+claws(399,531)+tuft(396,480,rust,1.5))
  s+=scales(355,329,.87,1.03)
  s+=group('body-chest',path('M 256 327 Q 299 314 333 351 Q 350 380 348 427 L 339 420 L 344 442 L 334 436 Q 337 480 306 506 L 288 531 L 281 516 L 264 527 L 260 511 L 244 514 Q 219 476 211 431 L 203 437 L 209 413 L 199 417 Q 204 354 239 328 Z')+path('M 234 359 Q 214 401 226 447 L 236 436 L 229 460 Q 249 497 275 510 Q 292 459 283 412 Q 274 360 252 346 Z','#fff9eb','none')+tuft(306,352,rust,.8)+tuft(321,391,rust,.7)+tuft(302,431,rust,.8)+path('M 224 401 l 3 17 M 244 456 l 6 14 M 262 475 l 3 12','none','#d8c09b',1.8))
  s+=group('arm-left',path('M 230 424 Q 245 414 255 432 L 248 490 Q 237 505 222 510 Q 201 506 200 496 Q 213 479 216 459 Z')+tuft(212,475,rust,.9)+claws(204,506,-9))
  s+=group('arm-right',path('M 323 414 Q 345 424 346 452 Q 342 490 319 528 Q 312 545 280 546 Q 267 540 275 526 Q 294 505 296 474 Q 292 438 307 420 Z')+path('M 320 441 Q 332 469 316 494 L 307 484 L 311 470 L 304 461 Z',rust,'none')+tuft(285,515,rust,.8)+claws(279,542,-4))
  s+=head(285,277,variant)
 elif variant=='alert':
  s+=tail('M 456 505 C 514 524 562 496 556 456 C 553 430 521 407 526 382 C 528 360 550 350 573 361 C 564 339 538 340 523 355 C 492 382 516 414 531 441 C 552 475 527 497 466 477 Z','M 481 493 Q 548 511 543 460 C 539 431 506 405 517 375 Q 531 346 558 352')
  s+=group('body',path('M 287 309 Q 382 277 445 349 Q 489 396 479 483 Q 477 520 437 530 Q 378 546 316 525 Q 255 501 250 429 Q 239 345 287 309 Z')+path('M 416 473 Q 445 466 459 488 L 447 529 Q 434 548 402 542 Q 379 539 388 523 Z')+claws(401,540)+tuft(414,497,rust,1.1))
  s+=scales(360,316,.80,1.02)
  s+=group('body-chest',path('M 271 324 Q 316 312 341 352 Q 357 383 347 423 L 337 422 L 342 440 L 332 437 Q 338 481 314 519 L 300 521 L 295 532 L 280 525 Q 244 489 236 447 Q 220 375 253 334 Z')+path('M 256 350 Q 237 400 254 452 Q 264 481 283 490 Q 298 451 291 407 Q 283 365 271 346 Z','#fff9eb','none')+tuft(322,363,rust,.75))
  s+=group('leg-left',path('M 276 464 Q 294 461 303 476 L 299 520 Q 289 542 262 545 Q 240 544 241 532 Q 255 516 254 494 Z')+tuft(257,516,rust,.8)+claws(245,544))
  s+=group('leg-right',path('M 331 463 Q 351 465 356 487 L 344 532 Q 335 551 306 548 Q 291 542 302 529 Q 316 510 316 487 Z')+tuft(325,497,rust,.8)+claws(305,547))
  s+=group('arm-left',path('M 249 363 Q 230 359 223 387 Q 216 410 193 412 Q 181 417 190 434 Q 225 452 252 420 L 270 389 Z')+tuft(234,383,rust,.7))
  s+=tray(220,425)
  s+=group('arm-right',path('M 319 357 Q 340 366 337 397 Q 331 423 286 441 Q 261 448 246 435 Q 242 425 254 421 Q 272 420 286 409 L 295 381 Z')+tuft(302,379,rust,.75)+path('M 250 432 q 9 3 18 0 M 259 438 q 9 2 15 -2','none','#aa8d68',1.7))
  s+=head(286,258,variant)
 else:
  s='<g class="ground"><ellipse cx="330" cy="558" rx="165" ry="10" fill="#64735a" opacity=".08"/></g>'
  s+=tail('M 467 448 C 527 476 576 453 570 408 C 565 377 535 362 541 336 C 547 314 572 310 587 327 C 584 301 556 296 539 315 C 514 344 534 370 548 394 C 571 432 533 449 478 423 Z','M 483 437 Q 554 466 558 420 C 564 382 521 360 534 332 Q 550 302 574 313')
  s+=group('leg-rear-far',path('M 423 427 Q 443 417 461 434 L 483 480 Q 499 490 513 502 Q 516 516 500 518 L 466 510 Q 449 498 441 479 L 415 453 Z')+tuft(474,482,rust,.8)+claws(503,506,-45))
  s+=group('body',path('M 274 322 Q 337 290 412 324 Q 478 351 479 413 Q 481 460 420 477 Q 372 494 306 461 Q 241 425 233 373 Q 232 344 274 322 Z')+path('M 407 417 Q 440 407 453 432 Q 461 461 424 478 Q 404 481 391 461 Z','#ebdcc1','none'))
  s+=scales(352,319,.78,.87)
  s+=group('body-chest',path('M 235 324 Q 275 309 313 348 Q 340 378 331 417 L 323 414 L 329 432 L 317 429 Q 308 457 280 457 L 273 468 L 265 457 L 251 460 L 250 449 Q 212 426 207 382 Q 204 347 235 324 Z')+path('M 230 343 Q 214 383 236 418 Q 247 438 264 444 Q 278 411 268 376 Q 257 350 246 341 Z','#fff9eb','none')+tuft(299,365,rust,.7)+tuft(303,405,rust,.55))
  s+=group('leg-rear-near',path('M 414 446 Q 433 453 426 474 Q 414 498 386 518 Q 377 536 362 548 Q 344 550 340 535 Q 339 520 359 503 L 377 466 Z')+tuft(363,505,rust,.8)+claws(341,541,18))
  s+=group('leg-front',path('M 276 420 Q 291 424 286 446 Q 272 470 242 491 L 196 519 Q 181 526 169 514 Q 163 502 182 493 L 217 469 Q 237 446 244 425 Z')+tuft(223,465,rust,.9)+claws(173,515,37))
  s+=group('arm-left',path('M 228 344 Q 211 339 202 360 Q 195 381 166 389 Q 147 397 159 412 Q 180 423 206 407 L 236 377 Z')+tuft(206,366,rust,.7))
  s+=tray(193,405)
  s+=group('arm-right',path('M 293 343 Q 316 353 310 377 Q 303 401 270 419 Q 247 430 224 417 Q 215 408 228 402 Q 246 402 263 386 L 272 355 Z')+tuft(283,365,rust,.75)+path('M 226 412 q 10 4 21 0 M 237 419 l 15 -4','none','#aa8d68',1.7))
  s+=head(250,252,variant)
 content=f'''<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640" role="img" aria-labelledby="{P}-title {P}-desc"><title id="{P}-title">{title}</title><desc id="{P}-desc">参考游戏原画重新绘制的可编辑矢量角色：长兔耳、金色钩形鸟喙、奶油毛与赭色斑、橄榄鳞背、蛇形长尾和小爪。分层路径支持后续表情与动作制作。</desc><g id="{P}-character" class="character">{s}</g></svg>'''
 (ROOT/'svg'/f'{P}.svg').write_text(content,encoding='utf-8')
 return {'file':f'svg/{P}.svg','pose':title}
files=[make(v) for v in ['sleepy','alert','running']]
(ROOT/'qiuyu.json').write_text(json.dumps({'character':'犰狳','reference':'reference/game/public/images/yaoguai/qiuyu.png','files':files,'identity_anchors':['超长兔耳与赭色耳尖','下弯金色鸟喙','半垂眼的懒散神态','奶油色长毛与赭色斑块','橄榄金色层叠背鳞','S形蛇尾','深色小爪'],'groups':['head','ears','ear-left','ear-right','face','eyes','beak','body','body-chest','back-scales','tail','arm-left','arm-right','prop-tea-tray'],'notes':'三个姿态独立绘制腿、前肢、尾巴、耳形和眼神；茶盘单独分组。无嵌入位图、滤镜或脚本。所有绘图元素均为可编辑矢量路径。'},ensure_ascii=False,indent=2),encoding='utf-8')
