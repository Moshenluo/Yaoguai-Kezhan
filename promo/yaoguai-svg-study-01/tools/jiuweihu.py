from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
(ROOT/'svg').mkdir(parents=True,exist_ok=True)
# All contours are hand-authored Bézier paths, independent of the reference bitmap.
# Nine tails from left bottom, counterclockwise around the crown, to right bottom.
TAILS=[
('C 168 482 89 542 49 476 C 74 485 78 457 85 437 C 115 388 188 398 270 443 C 291 463 280 493 248 497 Z','M 42 451 C 73 477 105 469 135 449 C 119 488  eighty 514 42 493 Z'.replace('eighty','80'),'M 89 471 C 136 459 164 448 218 455'),
('C 157 443 86 451 44 385 C 65 393 66 365 84 349 C 130 301 210 348 275 410 C 293 434 264 462 237 460 Z','M 36 348 C 67 384 91 401 135 389 C 113 414 84 422 44 406 Z','M 86 386 C 143 379 176 394 226 422'),
('C 162 383 68 346 55 285 C 44 239  sixty 219 84 206 C 66 244 93 253 126 252 C 190 251 237 312 277 377 C 290 404 255 421 229 406 Z'.replace('sixty','60'),'M 46 193 C 82 205 70 245 111 262 C 103 290 87 318 59 316 Z','M 83 273 C 115 314 185 305 231 365'),
('C 174 305 93 253 103 186 C 105 149 131 115 158 103 C 141 136 154 154 187 174 C 235 201 251 257 283 333 C 291 364 265 380 241 355 Z','M 104 90 L 180 97 C 136 146 174 163 197 184 C 161 196 143 203 106 199 Z','M 139 163 C 151 214 215 237 238 291'),
('C 240 294 171 217 188 144 C 197 108 226 58 263 48 C 242 73 247 99 264 126 C 300 179 293 243 307 310 C 307 342 275 351 259 326 Z','M 181 95 L 232 40 L 279 44 C 238 79 255 106 273 133 C 242 128 216 146 195 168 Z','M 225 103 C 215 157 268 199 266 255'),
('C 290 253 288 162 321 112 C 342  eighty 369 64 394 81 C 364 79 366 112 378 139 C 408 206 356 263 350 320 C 347 350 317 349 311 322 Z'.replace('eighty','80'),'M 313 75 L 393 61 L 407 111 C 364 82 367 122 381 148 C 352 132 325 149 310 173 Z','M 352 117 C 370 177 321 210 334 272'),
('C 357 248 366 193 419 170 C 456 154 475 140 464 114 C 515 145 514 200 481 237 C 447 277 395 294 376 340 C 361 363 332 347 339 324 Z','M 451 100 C 509 112 523 189 503 215 C 466 200 445 207 422 216 C 447 183 489 178 451 100 Z','M 480 168 C 467 227 414 238 385 280'),
('C 412 285 449 259 491 263 C 532 266 558 249 560 222 C 588 263 581 315 548 346 C 517 377 450 375 399 410 C 371 427 350 398 368 372 Z','M 533 213 L 581 219 L 599 296 L 560 332 C 541 311 514 301 493 304 C 533 292 555 268 533 213 Z','M 552 272 C 532 328 467 324 426 353'),
('C 456 378 507 375 550 409 C 580 434 581 481 557 502 C 559 467 527 461 501 470 C 468 482 449 526 401 542 C 351 557 314 535 317 506 C 320 484 358 470 391 446 Z','M 535 387 C 579 401 600 463 569 512 L 540 487 C 535 457 510 450 480 462 C 485 432 505 406 535 387 Z','M 548 445 C 495 413 463 478 406 500')]
# Per-pose tail outline edits reshape the fan without rotating the entire character.
MODS={
'01':{},
'02':{0:[('49 476','55 498'),('89 542','88 551'),('74 485','83 505')],1:[('44 385','51 401')],2:[('55 285','45 278'),('84 206','88 190')],3:[('158 103','141 79'),('131 115','112 102')],4:[('263 48','277 39'),('226 58','234 50')],5:[('394 81','409 92'),('369 64','378 75')],6:[('464 114','493 128'),('475 140','495 151')],7:[('560 222','570 244'),('558 249','565 264')],8:[('557 502','548 524'),('550 409','557 423'),('557 502','548 518')]},
'03':{0:[('49 476','48 489'),('89 542','95 543')],1:[('44 385','53 390')],2:[('55 285','63 286'),('84 206','91 219')],3:[('158 103','173 103')],4:[('263 48','262 60')],5:[('394 81','382 70')],6:[('464 114','451 106'),('475 140','459 135')],7:[('560 222','557 209'),('558 249','553 244')],8:[('557 502','566 492'),('550 409','548 392')]}
}


def tails(pre,pose):
    out=[]
    for i,(curve,tip,detail) in enumerate(TAILS):
        # Each base begins behind the hips, with an intentionally different tail spine.
        base=['M 248 497','M 237 460','M 229 406','M 241 355','M 259 326','M 311 322','M 339 324','M 368 372','M 391 446'][i]
        d=base+' '+curve
        for old,new in MODS[pose].get(i,[]): d=d.replace(old,new)
        out.append(f'''<g id="{pre}-tail-{i+1}" class="tail">
<defs><clipPath id="{pre}-tailclip-{i+1}"><path d="{d}"/></clipPath></defs>
<path d="{d}" fill="url(#{pre}-fur)" stroke="#4a4033" stroke-opacity=".66" stroke-width="2.8"/>
<path d="{tip}" fill="url(#{pre}-coral)" clip-path="url(#{pre}-tailclip-{i+1})"/>
<path d="{detail}" fill="none" stroke="#d2b79a" stroke-width="2" stroke-linecap="round"/>
</g>''')
    return '\n'.join(out)

BODY='''<path d="M 283 303 C 254 326 244 353 240 386 C 196 398 170 435 179 477 C 172 481 165 482 158 481 L 172 496 L 159 501 C 181 524 221 530 254 520 C 267 539 287 550 314 545 C 334 550 355 546 362 534 C 389 527 400 506 397 478 C 392 448 370 428 365 399 C 357 363 355 332 334 307 Z" fill="url(#{pre}-fur)" stroke="#4a4033" stroke-width="3"/>
<path d="M 212 419 C 179 441 186 478 209 492 C 224 500 243 497 250 487 C 242 481 241 465 251 454" fill="#fff9eb" stroke="#d4bfa4" stroke-width="2"/>
<path d="M 258 353 L 248 377 L 263 368 L 257 395 L 272 383 L 273 411 L 287 396 L 303 425 L 312 404 L 329 414 L 332 392 L 347 400 L 342 369 L 353 374 L 344 346" fill="#fff9eb" stroke="#d4bfa4" stroke-width="1.8" stroke-linejoin="round"/>
<path d="M 245 396 C 232 393 229 403 225 412 C 229 416 236 413 240 406 C 249 410 251 414 243 422 C 232 434 210 431 204 445 C 219 439 237 448 248 434 C 260 420 259 403 245 396 Z" fill="#c64c35"/>
<path d="M 227 438 C 237 437 240 430 237 425 C 231 421 225 428 227 433 C 216 432 213 425 218 419" fill="none" stroke="#c64c35" stroke-width="3"/>
<path d="M 263 518 C 276 525 277 537 276 542 M 288 532 L 289 544 M 340 532 L 339 544" fill="none" stroke="#c3a78b" stroke-width="2"/>
'''
ARMS={
'01':'''<path d="M 282 395 C 273 423 273 455 276 480 L 276 524 C 277 538 299 541 307 531 L 310 477 L 310 421" fill="url(#{pre}-fur)" stroke="#4a4033" stroke-width="2.8"/><path d="M 326 396 C 335 420 340 447 340 470 L 340 523 C 341 537 360 538 366 528 L 365 472 C 362 442 356 418 351 402" fill="url(#{pre}-fur)" stroke="#4a4033" stroke-width="2.8"/><path d="M 287 528 L 287 535 M 297 530 L 297 537 M 348 527 L 348 535 M 357 527 L 357 534" stroke="#b69a7e" stroke-width="1.8"/>''',
'02':'''<path d="M 286 397 C 277 420 273 457 275 485 L 275 524 C 277 539 298 541 307 531 L 311 479 L 311 421" fill="url(#{pre}-fur)" stroke="#4a4033" stroke-width="2.8"/><path d="M 342 399 C 372 400 390 380 394 352 C 382 343 377 326 381 316 C 383 309 390 310 394 316 C 389 301 394 293 401 294 C 406 295 408 302 410 309 C 409 295 413 290 419 294 C 426 300 425 317 424 327 C 443 317 447 324 441 333 C 437 344 428 350 419 353 C 418 400 392 434 353 429" fill="url(#{pre}-fur)" stroke="#4a4033" stroke-width="2.8"/><path d="M 406 324 C 409 318 420 318 422 327 C 425 335 416 342 410 338 C 405 336 403 329 406 324 Z" fill="#dc8e79"/><path d="M 396 315 L 398 322 M 411 310 L 412 316 M 285 530 L 285 536 M 296 531 L 296 537" fill="none" stroke="#c9aa8e" stroke-width="1.8"/>''',
'03':'''<path d="M 280 399 C 271 419 269 439 278 463 C 286 480 303 489 321 478 L 336 456 C 343 446 332 435 323 442 L 309 454 L 301 416" fill="url(#{pre}-fur)" stroke="#4a4033" stroke-width="2.8"/><path d="M 346 397 C 366 403 379 420 381 442 L 385 453 C 399 449 410 455 407 465 C 403 481 376 487 364 474 C 352 461 346 440 342 425" fill="url(#{pre}-fur)" stroke="#4a4033" stroke-width="2.8"/>'''
}

def ears(pre,pose):
    left='M 265 245 C 231 232 209 198 204 144 C 245 146 277 168 292 209 L 285 238 Z'
    right='M 330 211 C 325 169 337 116 359 96 C 368 136 391 173 374 213 L 351 239 Z'
    if pose=='02':
        left='M 262 245 C 224 230 208 198 197 154 C 244 148 271 174 288 208 L 285 239 Z'
        right='M 330 211 C 324 165 338 114 355 102 C 379 143 391 178 374 216 L 350 241 Z'
    if pose=='03':
        left='M 265 245 C 230 225 214 194 206 145 C 249 144 281 178 292 211 L 285 238 Z'
        right='M 330 211 C 326 170 338 130 362 106 C 369 143 389 172 373 214 L 351 239 Z'
    return f'''<g id="{pre}-ears" class="ears"><g id="{pre}-ear-left" class="ear"><path d="{left}" fill="#4a4033"/><path d="M 218 157 C 248 163 269 185 282 218 L 261 230 C 239 212 226 190 218 157 Z" fill="#dc8e79"/><path d="M 227 178 L 249 187 L 243 178 L 267 203 L 252 198 L 270 219 L 252 211 L 259 229 L 238 217 L 242 225 C 229 213 224 199 227 178 Z" fill="#fff4de"/></g><g id="{pre}-ear-right" class="ear"><path d="{right}" fill="#4a4033"/><path d="M 355 116 C 360 143 377 173 366 202 L 345 218 C 335 188 343 143 355 116 Z" fill="#dc8e79"/><path d="M 352 151 L 348 174 L 357 165 L 351 188 L 363 181 L 352 206 L 361 201 L 348 226 L 337 218 L 335 193 L 342 201 L 342 176 Z" fill="#fff9eb"/></g></g>'''

def head(pre,pose):
    eyes='''<path d="M 257 277 C 267 258 290 255 299 275 C 291 295 269 296 257 277 Z" fill="#fff9eb" stroke="#4a4033" stroke-width="2"/><path d="M 337 266 C 342 249 356 246 362 258 C 364 274 351 283 337 277 Z" fill="#fff9eb" stroke="#4a4033" stroke-width="2"/><ellipse cx="280" cy="276" rx="10.8" ry="15.3" fill="url(#{pre}-eye)"/><ellipse cx="350" cy="263" rx="8" ry="13.3" fill="url(#{pre}-eye)"/><ellipse cx="282" cy="277" rx="4.8" ry="11" fill="#24382f"/><ellipse cx="351" cy="264" rx="3.8" ry="10" fill="#24382f"/><circle cx="276" cy="268" r="4.1" fill="#fff9eb"/><circle cx="348" cy="256" r="3.3" fill="#fff9eb"/><circle cx="285" cy="282" r="1.7" fill="#fff4de"/>'''
    if pose=='02':
        eyes='''<path d="M 259 277 C 270 259 290 260 299 274 C 285 272 274 274 267 282" fill="none" stroke="#4a4033" stroke-width="3.4"/><path d="M 337 266 C 342 249 356 246 362 258 C 364 274 351 283 337 277 Z" fill="#fff9eb" stroke="#4a4033" stroke-width="2"/><ellipse cx="350" cy="263" rx="8" ry="13.3" fill="url(#{pre}-eye)"/><ellipse cx="351" cy="264" rx="3.8" ry="10" fill="#24382f"/><circle cx="348" cy="256" r="3.3" fill="#fff9eb"/>'''
    if pose=='03':
        eyes='''<path d="M 259 276 C 270 259 291 260 300 275 M 337 266 C 342 251 357 248 363 260" fill="none" stroke="#4a4033" stroke-width="3.6"/><path d="M 264 276 C 274 278 285 278 294 275 M 343 267 C 349 269 355 267 359 264" fill="none" stroke="#dc8e79" stroke-width="2"/>'''
    smile='M 322 317 Q 334 328 345 313'
    mouth=f'<path d="{smile}" fill="none" stroke="#4a4033" stroke-width="2.3"/>'
    if pose in ('02','03'):
        mouth='<path d="M 320 316 Q 334 323 348 310 Q 344 335 332 333 Q 325 331 320 316 Z" fill="#794638" stroke="#4a4033" stroke-width="1.8"/><path d="M 330 328 Q 337 324 343 324 Q 338 333 332 331 Z" fill="#dc8e79"/>'
    angle={'01':0,'02':-5,'03':3}[pose]
    return f'''<g id="{pre}-head" class="head" transform="rotate({angle} 315 291)">
{ears(pre,pose)}
<path d="M 257 216 C 276 201 301 197 323 207 L 329 199 L 333 210 L 343 204 L 345 215 C 366 220 378 241 377 259 L 391 270 L 380 272 L 394 280 L 379 285 L 385 294 L 369 298 C 356 322 342 333 321 341 C 300 347 273 338 257 329 L 242 333 L 248 322 L 229 321 L 239 311 L 223 304 L 238 297 L 226 284 L 241 284 L 235 270 L 248 274 C 239 251 244 232 257 216 Z" fill="url(#{pre}-facefur)" stroke="#4a4033" stroke-width="2.8"/>
<path d="M 249 298 C 260 295 272 301 283 311 C 299 303 316 299 328 305 C 340 291 355 287 373 289 C 362 311 344 330 323 336 C 295 343 269 326 249 313 L 256 309 Z" fill="#fff9eb"/>
<path d="M 297 215 C 299 227 307 229 309 240 C 299 238 293 230 297 215 Z M 311 222 C 321 227 325 234 323 244 C 315 241 312 233 311 222 Z M 300 241 C 308 241 316 244 319 252 C 308 253 303 249 300 241 Z" fill="#c64c35"/>
<g id="{pre}-face" class="face"><g id="{pre}-eyes" class="eyes">{eyes}<path d="M 254 275 L 248 269 M 257 271 L 252 265 M 339 255 L 334 251 M 360 255 L 365 249" fill="none" stroke="#4a4033" stroke-width="2.4" stroke-linecap="round"/></g>
<path d="M 262 253 Q 272 247 282 250 M 340 240 Q 348 235 354 237" fill="none" stroke="#b78264" stroke-width="2"/>
<path d="M 329 300 Q 336 296 342 299 Q 339 307 334 308 Z" fill="#4a4033"/><path d="M 335 307 L 335 316" stroke="#4a4033" stroke-width="1.8"/>{mouth}
<path d="M 257 297 L 268 300 M 252 303 L 263 306 M 359 286 L 366 283" stroke="#dc8e79" stroke-width="2.5" stroke-linecap="round"/><path d="M 287 325 Q 297 330 305 327" fill="none" stroke="#d4b79a" stroke-width="1.8"/>
</g></g>'''.replace('{pre}',pre)

def necklace(pre,pose):
    return f'''<g id="{pre}-necklace" class="accessory"><path d="M 275 337 Q 305 362 347 329" fill="none" stroke="#98713f" stroke-width="7"/><path d="M 275 336 Q 306 359 347 328" fill="none" stroke="#d4a65d" stroke-width="4"/>
<path d="M 281 341 l 3 7 l 7 -4 M 296 347 l 2 6 l 7 -3 M 328 341 l 4 5 l 6 -6 M 338 334 l 5 3 l 4 -7" fill="none" stroke="#fff4de" stroke-width="1.4"/>
<circle cx="316" cy="351" r="8.5" fill="#d4a65d" stroke="#98713f" stroke-width="1.7"/><circle cx="316" cy="351" r="3.5" fill="#fff4de"/><path d="M 316 360 L 316 367" stroke="#98713f" stroke-width="2.5"/>
<ellipse cx="316" cy="374" rx="7" ry="9" fill="#7c9276" stroke="#98713f" stroke-width="2.2"/><path d="M 313 370 Q 314 367 317 369" fill="none" stroke="#fff4de" stroke-width="1.7"/><circle cx="316" cy="387" r="3.8" fill="#d4a65d" stroke="#98713f" stroke-width="1.5"/>
<path d="M 312 392 C 309 401 312 415 306 429 L 313 425 L 316 434 L 320 424 L 325 427 C 319 413 321 400 320 392 Z" fill="#c64c35"/><path d="M 316 397 L 316 425 M 313 400 L 311 421 M 319 401 L 321 421" stroke="#e6966d" stroke-width="1.3"/></g>'''

def abacus(pre):
    rows=[]
    for i in range(6):
        x=287+i*18
        rows.append(f'<path d="M {x} 437 L {x} 491" stroke="#87613c" stroke-width="2"/>')
        ys=[447,471,479,487] if i%2==0 else [444,466,475,485]
        for y in ys:
            rows.append(f'<ellipse cx="{x}" cy="{y}" rx="6.8" ry="4.1" fill="#d4a65d" stroke="#795d39" stroke-width="1.2"/><path d="M {x-3} {y-1.3} L {x+2} {y-1.3}" stroke="#f3ead8" stroke-width="1"/>')
    return f'''<g id="{pre}-abacus" class="prop" transform="rotate(-9 334 463)"><rect x="273" y="428" width="117" height="75" rx="6" fill="#b9824d" stroke="#4a4033" stroke-width="2.6"/><rect x="280" y="435" width="103" height="61" rx="2" fill="#ecd5a9" stroke="#795d39" stroke-width="1.5"/>{''.join(rows)}<path d="M 278 457 L 385 457" stroke="#8a623e" stroke-width="4"/><path d="M 278 455 L 385 455" stroke="#d4a65d" stroke-width="1.2"/><path d="M 277 431 L 386 431 M 277 499 L 386 499" stroke="#e7bd7e" stroke-width="1.5"/><path d="M 274 438 L 279 438 M 384 494 L 389 494" stroke="#4a4033" stroke-width="2"/></g>
<g id="{pre}-hands" class="arm"><path d="M 281 446 C 291 441 300 446 300 453 C 299 459 286 464 279 460 C 274 458 275 450 281 446 Z" fill="#fff4de" stroke="#4a4033" stroke-width="2.5"/><path d="M 380 471 C 386 463 399 461 403 468 C 408 478 394 486 384 484 C 378 483 376 477 380 471 Z" fill="#fff4de" stroke="#4a4033" stroke-width="2.5"/><path d="M 286 448 L 289 456 M 293 448 L 295 453 M 390 474 L 393 482 M 397 470 L 400 476" stroke="#c9aa8e" stroke-width="1.6"/></g>'''

POSES=[('01','端坐待客','九尾狐端坐，九条流云状尾巴展开，神情温柔专注。'),('02','眨眼招手','九尾狐俏皮眨眼，举起前爪招呼来客，九尾扇面随姿态展开。'),('03','开心算账','九尾狐笑着捧一把六档木算盘，表现客栈账房身份。')]
for pose,name,desc in POSES:
    pre='jiuweihu-'+pose
    defs=f'''<defs><linearGradient id="{pre}-fur" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#fff9eb"/><stop offset=".58" stop-color="#fff4de"/><stop offset="1" stop-color="#e8c9ac"/></linearGradient><linearGradient id="{pre}-facefur" x1="0" y1="0" x2=".4" y2="1"><stop stop-color="#fff9eb"/><stop offset="1" stop-color="#fff4de"/></linearGradient><linearGradient id="{pre}-coral" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#c96f56"/><stop offset="1" stop-color="#dc8e79"/></linearGradient><linearGradient id="{pre}-eye" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#6b3829"/><stop offset="1" stop-color="#ce7250"/></linearGradient></defs>'''
    body=BODY.format(pre=pre)
    arms=ARMS[pose].format(pre=pre)
    if pose=='03':
        body=body.replace('M 263 518','M 263 518')
        body+='''<path d="M 274 513 C 281 522 280 537 275 541 M 332 516 C 338 524 340 536 338 543" fill="none" stroke="#bba084" stroke-width="2"/>'''
    svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640" role="img" aria-labelledby="{pre}-title {pre}-desc"><title id="{pre}-title">九尾狐 · {name}</title><desc id="{pre}-desc">{desc} 手绘矢量路径，参考妖怪客栈原始角色资源。奶油色毛发、珊瑚尾尖、深色耳缘、朱红花纹、金链玉坠与红穗。</desc>{defs}<g id="{pre}-character" class="character" stroke-linecap="round" stroke-linejoin="round"><g id="{pre}-tails" class="tails">{tails(pre,pose)}</g><g id="{pre}-body" class="body">{body}</g><g id="{pre}-arms" class="arms">{arms}</g>{head(pre,pose)}{necklace(pre,pose)}{abacus(pre) if pose=='03' else ''}</g></svg>'''
    (ROOT/'svg'/f'{pre}.svg').write_text(svg,encoding='utf-8')
(ROOT/'jiuweihu.json').write_text(json.dumps({'character':'九尾狐','reference':'game/public/images/yaoguai/jiuweihu.png','poses':[{'file':f'svg/jiuweihu-{p}.svg','name':n,'description':d} for p,n,d in POSES],'identity_anchors':['九条独立尾巴与珊瑚尾尖','深色尖耳外缘','奶油色毛发、额间和侧身朱红花纹','金链、玉坠与红流苏','温柔妩媚的狐狸面相'],'grouping_notes':'每个 SVG 有独立角色、尾巴 1–9、身体、手臂、头、双耳、五官、眼睛、项链分组；算盘与扶算盘双爪独立分组。02 的前爪路径、尾扇及耳朵重新绘制，03 的拥物手臂、笑眼和算盘独立绘制。','method':'人工设计 Bézier 路径，可编辑；无图片嵌入、无自动描摹、无脚本。'},ensure_ascii=False,indent=2),encoding='utf-8')
print('Wrote 3 SVG poses and jiuweihu.json')
