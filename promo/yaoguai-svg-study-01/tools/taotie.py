"""Hand-authored Bézier character studies; no raster tracing or external resources."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
(ROOT/'svg').mkdir(parents=True,exist_ok=True)
INK='#4a4033'; GOLD='#d4a65d'; RED='#c64c35'; SALMON='#dc8e79'; DARK='#47483b'; CREAM='#fff4de'

def path(d,fill='none',stroke=INK,sw=2.8,extra=''):
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" {extra}/>'
def ellipse(cx,cy,rx,ry,fill,extra=''):
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{fill}" {extra}/>'
def g(id,cls,content,transform=''):
    return f'<g id="{id}" class="{cls}"'+(f' transform="{transform}"' if transform else '')+'>'+content+'</g>'
def motif(x,y,s=1,flip=False):
    # Two-color hooked cloud whorl, open inner eye rather than a stroked spiral.
    p=path('M0 15 C-23 3 -30 -13 -20 -25 C-6 -42 16 -30 18 -16 C20 -4 9 1 2 -3 C-5 -7 -2 -17 5 -18 C-3 -23 -12 -16 -11 -8 C-10 5 7 11 18 7 C12 23 -1 29 -14 25 Z',RED,'none')
    p+=path('M-18 -17 C-14 -28 0 -29 8 -22',GOLD,'none')
    return f'<g transform="translate({x} {y}) scale({-s if flip else s} {s})">{p}</g>'
def tail(P,pose):
    if pose==3:
        d='M202 465 C121 526 74 499 76 446 C76 412 47 404 46 434 C42 464 90 464 95 431 C100 398 64 382 46 402 C28 423 38 463 60 467 C53 511 110 550 194 521 Z'
    else:
        d='M197 450 C137 490 86 468 83 423 C82 396 60 393 56 414 C53 433 80 437 91 420 C108 394 92 364 65 363 C28 361 24 412 50 433 C37 483 88 524 161 513 L213 491 Z'
    p=path(d,f'url(#{P}-gold)')
    p+=path('M167 490 C118 499 88 479 76 453',stroke='#a98048',sw=5)
    p+=path('M82 427 C101 408 96 381 77 374 C57 366 43 381 43 396 C50 388 58 386 66 391 C57 398 58 409 65 413 C76 417 78 409 75 403',DARK,sw=2)
    return g(P+'-tail','tail',p)
def body(P,pose):
    d='M203 291 C168 304 140 337 143 377 L130 373 L140 402 L124 412 L142 427 C126 468 158 512 194 532 C234 556 381 559 440 532 C489 511 513 472 501 422 L517 420 L508 399 L515 383 L501 379 C505 338 466 309 435 298 Z'
    p=path(d,f'url(#{P}-gold)')
    # Scalloped dark mane sits behind forelimbs, resembling layered carved fur.
    p+=path('M184 258 C159 272 139 286 139 307 L155 304 L133 334 L151 333 L130 363 L151 359 L138 388 L173 382 L199 330 Z',DARK)
    p+=path('M449 259 C472 270 491 289 493 310 L477 307 L504 337 L486 333 L508 363 L484 357 L497 390 L465 378 L437 323 Z',DARK)
    p+=path('M193 301 C175 324 163 343 159 366 M445 301 C465 322 478 349 480 368',stroke='#847350',sw=5)
    p+=path('M215 328 C226 314 256 312 274 318 C307 304 348 309 367 321 C393 312 414 325 423 348 C444 365 455 391 448 423 L461 419 L451 441 L464 444 C448 465 453 493 425 519 C394 547 254 555 216 525 C182 500 180 467 188 434 L176 438 L190 414 L179 412 C185 381 197 361 215 328 Z',f'url(#{P}-cream)',stroke='#a18b67',sw=2.3)
    p+=path('M223 475 L216 490 L228 488 M410 478 L418 494 L404 488 M267 523 L277 532 L279 521 M351 530 L361 520 L369 529',stroke='#cfbb94',sw=2)
    p+=motif(166,435,.94)+motif(472,451,.9,True)
    p+=path('M182 397 C164 385 161 365 174 357 C185 350 193 359 188 369 C181 364 177 368 180 374 C187 386 199 381 207 374',GOLD,'none')
    p+=path('M454 397 C474 388 481 366 469 358 C457 351 448 360 454 370 C460 363 468 371 460 379 C452 387 443 381 438 376',GOLD,'none')
    return g(P+'-body','body',p)
def feet(P,pose):
    p=''
    for x,flip in [(205,False),(435,True)]:
        tr=f'translate({x} 503) scale({-1 if flip else 1} 1)'
        f=path('M-51 -9 C-58 12 -43 42 -16 48 C4 54 36 49 43 31 C53 5 39 -25 16 -29 C-7 -35 -40 -30 -51 -9 Z',f'url(#{P}-gold)')
        f+=path('M2 -23 C25 -35 42 -17 41 0 C46 17 41 35 27 38 C11 42 -4 29 -1 17 C-11 8 -12 -15 2 -23 Z',DARK)
        f+=path('M10 -14 C22 -23 33 -14 31 -6 C29 3 18 4 15 -2 C16 7 27 11 34 5 C34 19 25 27 16 22 C4 18 2 -3 10 -14 Z',GOLD,'none')
        f+=path('M34 -16 C44 -25 49 -20 49 -9 L39 -5 M39 2 C50 -3 55 3 48 12 L40 12',DARK,sw=2)
        f+=path('M-40 13 C-27 18 -22 29 -23 37',stroke='#aa8150',sw=2)
        p+=f'<g transform="{tr}">{f}</g>'
    return g(P+'-feet','feet',p)
def head(P,pose):
    # Pose-specific head articulation is local, with face distinct from overall body.
    transform={1:'',2:'translate(-4 13) rotate(-4 320 260)',3:'translate(-6 -10) rotate(5 320 260)'}[pose]
    p=''
    # Ears deliberately broad, lifted above mane, with tapered ivory interior notches.
    ear=''
    ear+=path('M192 206 C170 178 123 166 103 179 C95 201 105 246 130 258 C151 266 174 248 191 232 Z',f'url(#{P}-gold)')
    ear+=path('M170 210 C150 189 119 182 114 190 C110 209 119 235 134 242 C148 245 162 230 170 210 Z',SALMON,stroke='#a85c45',sw=1.8)
    ear+=path('M128 228 L126 209 L139 219 L141 202 L154 220 L166 221 L147 237 Z',CREAM,'none')
    ear+=path('M445 205 C463 181 505 170 528 180 C541 207 522 245 501 254 C482 262 461 245 445 230 Z',f'url(#{P}-gold)')
    ear+=path('M467 210 C483 191 511 184 519 192 C520 215 509 234 497 238 C483 242 473 229 467 210 Z',SALMON,stroke='#a85c45',sw=1.8)
    ear+=path('M477 224 L490 217 L492 201 L500 215 L511 208 L505 228 L492 238 Z',CREAM,'none')
    p+=g(P+'-ears','ears',ear)
    # Horns dark articulated curls with ochre collars and sparse incised segments.
    horns=path('M214 190 C214 159 192 127 166 128 C145 128 130 144 134 163 C144 153 155 152 163 157 C153 161 151 173 157 180 C139 184 119 176 116 157 C108 124 131 96 164 96 C207 94 238 133 242 175 Z',f'url(#{P}-horn)')
    horns+=path('M426 188 C425 158 444 127 470 128 C491 128 508 144 503 162 C493 153 482 151 473 157 C485 162 487 173 480 181 C500 185 518 174 522 156 C530 123 507 98 473 98 C431 96 400 133 397 175 Z',f'url(#{P}-horn)')
    horns+=path('M224 163 L230 183 C218 198 198 200 186 189 L196 167 C203 174 216 173 224 163 Z',GOLD)
    horns+=path('M415 164 L409 185 C422 200 443 199 455 188 L445 167 C437 175 423 174 415 164 Z',GOLD)
    horns+=path('M291 145 C315 125 310 102 298 90 C321 91 334 108 330 124 C344 107 335 81 326 67 C354 81 366 111 352 137 L362 151 Z',f'url(#{P}-horn)')
    horns+=path('M298 141 L290 159 C312 174 348 171 362 154 L353 139 C337 151 314 152 298 141 Z',GOLD)
    horns+=path('M145 100 L160 118 M171 98 L183 121 M196 108 L202 137 M215 129 L217 157 M235 149 L225 171 M497 103 L479 119 M470 100 L458 124 M445 111 L439 137 M425 132 L424 157 M333 99 L347 110 M318 128 L335 138',stroke='#998973',sw=2)
    horns+=path('M201 179 L210 188 M215 177 L219 184 M429 177 L424 186 M440 179 L435 189 M311 154 L314 162 M334 154 L335 162',stroke='#a57b41',sw=2)
    p+=g(P+'-horns','horns',horns)
    face=path('M204 183 C231 149 262 151 287 161 L310 153 L321 163 L343 153 L352 164 C387 154 424 166 441 190 C459 210 462 235 461 251 L474 248 L467 267 L482 271 L462 291 L472 297 L449 310 C438 333 407 348 387 346 L376 355 L359 346 C336 355 309 353 291 347 L279 355 L269 346 C240 347 207 333 197 311 L178 304 L189 290 L171 278 L187 266 L180 253 L193 250 C188 225 191 203 204 183 Z',f'url(#{P}-cream)')
    # Natural ochre cap, separated into deliberate fur tufts.
    face+=path('M205 198 C225 167 252 158 282 167 L272 179 L291 177 L283 191 C258 181 235 189 216 207 L220 192 Z',GOLD,'none')
    face+=path('M437 199 C419 173 393 166 371 169 L380 180 L365 177 L373 193 C398 185 418 192 434 211 L429 193 Z',GOLD,'none')
    face+=path('M306 172 C295 177 296 190 309 197 C323 188 321 177 306 172 Z M325 170 C319 178 324 188 334 193 C345 186 339 174 325 170 Z M318 200 L311 209 L322 215 L329 205 Z',RED,'none')
    face+=motif(207,282,.60)+motif(434,283,.62,True)
    face+=ellipse(221,264,31,18,SALMON,'opacity=".46" transform="rotate(-12 221 264)"')+ellipse(418,264,31,18,SALMON,'opacity=".46" transform="rotate(12 418 264)"')
    face+=path('M203 272 l4 -7 M216 277 l4 -8 M427 276 l-3 -8 M439 269 l-3 -7',stroke='#bc715c',sw=1.7)
    face+=path('M231 224 C241 216 254 215 265 219 M371 219 C383 215 395 218 404 225',stroke='#b09369',sw=4)
    p+=g(P+'-head-fur','head-fur',face)
    exp=''
    if pose==1:
        exp+=path('M233 240 C242 227 263 229 272 241 C261 253 244 254 233 240 Z',CREAM,stroke='#403b30',sw=2.1)
        exp+=path('M370 241 C380 228 399 227 410 241 C399 254 382 253 370 241 Z',CREAM,stroke='#403b30',sw=2.1)
        exp+=ellipse(253,242,7.6,9.6,'#6f4e31')+ellipse(389,242,7.6,9.6,'#6f4e31')
        exp+=ellipse(252,243,3.8,6.6,'#24382f')+ellipse(388,243,3.8,6.6,'#24382f')
        exp+=ellipse(250,237,2.8,3.4,'#fff9eb')+ellipse(386,237,2.8,3.4,'#fff9eb')
        exp+=path('M233 240 C243 231 260 234 271 241 M370 241 C382 233 400 231 410 241',stroke='#403b30',sw=3.5)
        exp+=path('M282 296 C302 313 337 314 358 295',stroke='#7e5039',sw=3)
        exp+=path('M306 313 Q321 319 335 312',stroke='#b79166',sw=1.8)
    elif pose==2:
        exp+=path('M233 242 C246 227 260 231 272 242 M370 242 C383 227 399 231 410 242',stroke='#403b30',sw=5.4)
        if pose==2: exp+=path('M234 241 C244 245 261 246 271 241 M371 241 C381 246 399 245 409 241',stroke='#403b30',sw=1.8)
        exp+=path('M266 279 C283 270 298 269 318 271 C339 267 360 271 376 280 C371 316 350 334 322 334 C293 334 271 315 266 279 Z','#794b37',stroke='#794b37',sw=2.4)
        exp+=path('M281 312 C296 293 317 300 322 309 C333 297 352 301 361 314 C351 326 338 332 322 332 C306 332 291 324 281 312 Z','#df967c',stroke='#aa6956',sw=1.8)
        exp+=path('M291 276 L297 288 Q302 291 306 276 M335 276 L341 288 Q346 290 350 277',CREAM,stroke='#96774e',sw=1.5)
    else:
        exp+=ellipse(251,244,15,21,'#433d31')+ellipse(388,244,15,21,'#433d31')
        exp+=ellipse(247,238,5,7,'#fff9eb')+ellipse(384,238,5,7,'#fff9eb')
        exp+=path('M273 299 C286 312 300 316 313 308 C326 318 343 313 355 300',stroke='#7e5039',sw=3)
        exp+=path('M228 283 C218 294 222 308 237 311 M411 283 C423 293 419 309 406 313',stroke='#b79166',sw=2.1)
        exp+=ellipse(280,319,5,3,GOLD)+ellipse(267,317,3,2,RED)
    # Cream muzzle pad overlaps mouth rim; small ochre nostrils.
    exp+=path('M266 272 C279 254 302 256 319 264 C335 255 363 257 376 273 C365 282 342 282 320 277 C299 283 279 282 266 272 Z',CREAM,stroke='#bf9f72',sw=1.5)
    exp+=path('M308 265 l4 2 M330 265 l-4 2',stroke='#95774e',sw=2.5)
    # Tame upward cheek tusks, gilded bases, visible against cream fur.
    exp+=path('M235 279 C214 286 219 307 233 310 C249 314 259 301 253 290 C248 287 243 292 244 298 C232 301 228 287 235 279 Z',GOLD,stroke='#836b43',sw=2)
    exp+=path('M231 295 C224 279 231 265 243 257 C238 272 239 284 242 295 Z','#fff9eb',stroke='#a9966d',sw=1.6)
    exp+=path('M404 279 C425 286 420 308 406 311 C390 315 380 302 386 291 C391 288 396 293 395 299 C407 302 411 288 404 279 Z',GOLD,stroke='#836b43',sw=2)
    exp+=path('M408 296 C415 280 409 266 397 258 C402 273 401 285 399 296 Z','#fff9eb',stroke='#a9966d',sw=1.6)
    p+=g(P+'-face','face',g(P+'-eyes','eyes',exp))
    return g(P+'-head','head',p,transform)
def bowl(P,pose):
    # Semantic bowl group can be translated/rotated independently for animation.
    tr={1:'translate(0 0)',2:'translate(-18 -2) translate(320 399) scale(1.13) translate(-320 -399)',3:'rotate(-10 312 415) translate(-9 -4)'}[pose]
    p=path('M214 369 C235 354 411 354 435 371 L410 443 C395 469 258 470 238 444 Z',f'url(#{P}-bowl)',stroke='#8e7856',sw=2.4)
    p+=path('M262 453 L262 467 C290 477 361 477 389 467 L389 454',CREAM,stroke='#8e7856',sw=2.2)
    p+=path('M272 466 C302 472 348 472 379 466',stroke='#514f40',sw=3)
    p+=ellipse(324,371,111,23,'#647c5e','stroke="#8d7755" stroke-width="2.3"')
    # Greens, bun pleats, glazed roast with facets.
    p+=path('M235 365 C220 356 228 342 238 348 C240 330 254 334 256 347 C268 339 278 350 269 362 M350 352 C344 334 356 322 365 337 C372 320 385 333 378 345 C393 338 399 352 386 360 M405 366 C420 350 430 354 428 369',fill='#7c9276',stroke='#516954',sw=2)
    p+=path('M250 365 C243 342 257 322 276 322 C298 321 311 344 305 365 C294 379 263 378 250 365 Z','#fff1d1',stroke='#ae8954',sw=2)
    p+=path('M276 324 C268 333 265 337 265 347 M278 325 C280 332 284 336 287 343 M283 327 C293 333 296 339 296 346',stroke='#d4a65d',sw=3)
    p+=path('M313 366 C300 352 309 333 322 331 C336 324 354 330 363 343 C374 348 377 363 365 372 C350 380 326 377 313 366 Z','#a85832',stroke='#754d32',sw=2)
    p+=path('M311 350 L325 342 L338 347 L335 363 L318 366 Z M343 338 L356 345 L362 358 L346 361 Z','#c77f45',stroke='#864c2e',sw=1.5)
    p+=path('M322 339 l8 -2 M347 343 l5 3 M319 353 l7 -3 M350 352 l5 5',stroke='#f2cb83',sw=2.6)
    p+=path('M374 366 C370 347 381 330 397 332 C414 334 423 353 417 368 C406 378 385 378 374 366 Z','#fff1d1',stroke='#ae8954',sw=2)
    p+=path('M398 334 L389 349 M399 335 L406 347',stroke='#d4a65d',sw=3)
    p+=path('M213 371 C243 389 406 390 436 372 L432 383 C390 400 251 397 217 382 Z','#fff9eb',stroke='#8e7856',sw=2.3)
    p+=path('M222 388 C262 402 387 405 430 390',stroke=RED,sw=3.3)
    p+=path('M242 421 C258 406 276 418 290 430 C312 448 331 442 344 427 C365 405 390 409 411 420',stroke=GOLD,sw=6)
    p+=motif(365,426,.7)+path('M254 438 C268 449 286 451 298 444',stroke=RED,sw=3)
    return g(P+'-bowl-prop','bowl',p,tr)
def arms(P,pose):
    # Forearm and paw have character-specific structural positions, not global rotations.
    if pose==1:
        left='M188 334 C158 336 153 362 166 389 C176 410 196 424 227 427 L246 399 C215 389 207 380 212 359 C211 344 202 335 188 334 Z'
        right='M457 335 C486 337 491 363 478 390 C468 412 450 427 421 430 L401 400 C428 388 437 381 434 360 C434 345 444 335 457 335 Z'
        lx,ly,rx,ry=229,408,417,410
    elif pose==2:
        left='M188 332 C158 339 151 366 166 397 C178 420 192 438 221 444 L237 413 C214 402 213 384 218 362 C216 341 203 331 188 332 Z'
        right='M459 330 C490 335 501 364 484 394 C472 417 454 435 425 444 L408 410 C432 402 437 382 433 361 C431 340 444 331 459 330 Z'
        lx,ly,rx,ry=212,430,426,429
    else:
        left='M189 330 C158 334 151 365 166 395 C178 418 199 429 227 423 L242 392 C214 386 210 378 212 359 C212 342 201 332 189 330 Z'
        right='M450 352 C472 366 495 349 509 325 C522 304 534 288 522 273 C506 256 489 268 481 289 C475 305 462 313 448 316 C437 324 440 343 450 352 Z'
        lx,ly,rx,ry=222,409,520,274
    p=path(left,f'url(#{P}-gold)')+path(right,f'url(#{P}-gold)')
    p+=path('M177 351 C169 367 176 383 186 388 M187 357 C180 367 184 378 190 383',stroke='#b58b55',sw=2)
    p+=motif(191,365,.47)
    def paw(x,y,flip=False,raised=False):
        s=path('M-19 -27 C-7 -34 4 -27 10 -17 C22 -17 34 -8 31 4 C38 13 30 28 16 29 C4 40 -18 34 -26 22 C-37 14 -37 -4 -27 -11 C-31 -20 -25 -25 -19 -27 Z',DARK)
        s+=path('M7 -16 C22 -25 32 -20 31 -10 L17 -6 M21 2 C36 -3 42 5 34 14 L22 14 M15 21 C28 23 30 32 17 35',DARK,sw=2)
        s+=path('M-17 -12 C-5 -18 3 -6 -3 4 C-9 12 -17 5 -16 -2 C-23 8 -18 24 -7 26',stroke='#9c865c',sw=2.6)
        s+=path('M13 -14 L23 -16 M25 3 L33 5',stroke='#c0aa7a',sw=1.8)
        return f'<g class="paw" transform="translate({x} {y}) rotate({-28 if raised else 12 if flip else -12}) scale({-1 if flip else 1} 1)">{s}</g>'
    p+=paw(lx,ly)+paw(rx,ry,True,pose==3)
    if pose==3:
        p+=path('M503 243 C492 239 493 224 504 222 C516 220 525 229 518 239 Z','#fff1d1',stroke='#ae8954',sw=2)
        p+=path('M503 225 l5 6',stroke=GOLD,sw=2)
    return g(P+'-arms','arms arm',p)

def draw(pose):
    names={1:'抱碗满足',2:'递碗邀客',3:'鼓腮偷吃'}
    P=f'taotie-{pose:02d}'
    defs=f'''<defs>
    <linearGradient id="{P}-cream" x1="0" y1="0" x2=".5" y2="1"><stop stop-color="#fff9eb"/><stop offset="1" stop-color="#f3e4c5"/></linearGradient>
    <linearGradient id="{P}-gold" x1="0" y1="0" x2=".65" y2="1"><stop stop-color="#edcf96"/><stop offset=".65" stop-color="#d4a65d"/><stop offset="1" stop-color="#c09453"/></linearGradient>
    <linearGradient id="{P}-horn" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#696354"/><stop offset="1" stop-color="#3e4037"/></linearGradient>
    <linearGradient id="{P}-bowl" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff9eb"/><stop offset="1" stop-color="#e7d6b7"/></linearGradient>
    </defs>'''
    char=tail(P,pose)+body(P,pose)+feet(P,pose)+head(P,pose)+bowl(P,pose)+arms(P,pose)
    # Munching expression has small restrained flecks beside the lifted snack.
    if pose==3:
        char+=g(P+'-crumbs','crumbs',path('M546 230 l6 -6 M552 247 l8 0',stroke=GOLD,sw=3)+ellipse(535,214,3,3,RED))
    svg=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="640" height="640" role="img" aria-labelledby="{P}-title {P}-desc">
    <title id="{P}-title">饕餮 · {names[pose]}</title>
    <desc id="{P}-desc">参考《妖怪客栈》饕餮原画手工绘制的可编辑矢量差分：盘曲羊角、额心独角、大耳、奶油色肚皮、朱砂云纹、弯尾与盛满包点的纹样食碗。温暖、贪吃、友好。</desc>
    {defs}
    {g(P+'-ground','ground',ellipse(320,552,169,12,'#4a4033','opacity=".10"'))}
    {g(P+'-character','character',char)}
    </svg>'''
    filename=f'{P}.svg'
    (ROOT/'svg'/filename).write_text(svg,encoding='utf-8')
    return {'file':filename,'pose':names[pose]}
poses=[draw(i) for i in (1,2,3)]
(ROOT/'taotie.json').write_text(json.dumps({'character':'饕餮','reference':'reference/game/public/images/yaoguai/taotie.png','poses':poses,'identity_anchors':['盘曲深色羊角与额心独角','杏黄与奶油色圆润体态','朱砂云纹与短玉牙','深色爪掌和卷尾','彩绘大碗与包点、青菜、红烧食物'],'editable_groups':['character','tail','body','feet','head','ears','horns','face','eyes','bowl','arms','ground'],'notes':'手写贝塞尔曲线与几何形，不含位图、自动描摹、脚本、滤镜和外链。相同色板与局部渐变；三份为独立静态差分。'},ensure_ascii=False,indent=2),encoding='utf-8')
print('Created',*[p['file'] for p in poses])
