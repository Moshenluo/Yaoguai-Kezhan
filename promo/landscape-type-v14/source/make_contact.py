"""Compose 16:9 keyframes and motion contact sheets from verified captures."""
from pathlib import Path
import hashlib,json,math,os
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parent
REVIEW=ROOT/'review';OUTPUT=ROOT/'output'
FONT=os.environ.get('CONTACT_FONT','/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc')
INDEX=2 if FONT.endswith('.ttc') else 0
LABEL=ImageFont.truetype(FONT,17,index=INDEX);TITLE=ImageFont.truetype(FONT,26,index=INDEX)
WIDTH,HEIGHT,GAP,TOP,FOOT,COLS=480,270,16,66,48,3

def compose(items,destination,title):
    if not items:return
    board=Image.new('RGB',(GAP+COLS*(WIDTH+GAP),TOP+math.ceil(len(items)/COLS)*(HEIGHT+FOOT+GAP)),'#d8d2c5')
    draw=ImageDraw.Draw(board);draw.text((GAP,18),title,font=TITLE,fill='#24382f')
    for i,item in enumerate(items):
        x=GAP+(i%COLS)*(WIDTH+GAP);y=TOP+(i//COLS)*(HEIGHT+FOOT+GAP)
        with Image.open(item['path']) as src:
            if src.width*9!=src.height*16:raise ValueError(f'Not 16:9: {item["path"]}')
            board.paste(src.convert('RGB').resize((WIDTH,HEIGHT),Image.Resampling.LANCZOS),(x,y))
        draw.text((x,y+HEIGHT+5),item['label'],font=LABEL,fill='#24382f')
        draw.text((x+WIDTH-95,y+HEIGHT+5),f'{item["time"]:.3f}s',font=LABEL,fill='#635e50')
    board.save(destination,quality=94,subsampling=0);print(destination)

def main():
    OUTPUT.mkdir(exist_ok=True)
    source=REVIEW/'frames.json'
    if source.exists():
        data=json.loads(source.read_text(encoding='utf-8'))
        for name,expected in data['source_hashes'].items():
            if hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=expected:raise RuntimeError(f'Stale source: {name}; recapture first.')
        frames=[]
        for frame in data['captures']:
            path=REVIEW/frame['file']
            if hashlib.sha256(path.read_bytes()).hexdigest()!=frame['sha256']:raise RuntimeError(f'Capture changed: {path}')
            frames.append({**frame,'path':path})
        keys=[f for f in frames if f['kind']=='keyframe']
        groups=data['groups']
    else:
        times=json.loads((OUTPUT/'still-times.json').read_text());score=json.loads((ROOT/'score.json').read_text())
        keys=[{'path':OUTPUT/f'shot-{i+1:02}.png','time':t,'label':score['phrases'][i]['text']} for i,t in enumerate(times)]
        frames=[];groups=[]
    if len(keys)!=16:raise RuntimeError('Expected 16 keyframes.')
    compose(keys,OUTPUT/'storyboard.jpg','妖怪客栈 · 等你当家 / 16:9 横版关键画面')
    cover=min(keys,key=lambda f:abs(f['time']-25.6))
    with Image.open(cover['path']) as src:src.convert('RGB').save(OUTPUT/'cover.jpg',quality=96,subsampling=0)
    print(OUTPUT/'cover.jpg')
    for group in groups:
        compose([f for f in frames if f.get('group')==group['id']],REVIEW/f'motion-{group["id"]}.jpg',f'16:9 / {group["title"]}')
    (OUTPUT/'contact-check.json').write_text(json.dumps({'aspect_ratio':'16:9','storyboard_frames':len(keys),'cover_seconds':cover['time'],'motion_groups':len(groups),'motion_frames':len(frames)-len(keys) if frames else 0,'scope':'Screenshot composition; aesthetic review is separate.'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
if __name__=='__main__':main()
