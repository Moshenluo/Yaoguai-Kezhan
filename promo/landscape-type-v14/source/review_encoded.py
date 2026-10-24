from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageChops,ImageStat
import subprocess,json,hashlib,math
root=Path(__file__).resolve().parent
video=root/'output/yaoguai-type-wide-v14.mp4'
font=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',22,index=2)
board=Image.new('RGB',(1312,860),'#d8d2c5');draw=ImageDraw.Draw(board)
draw.text((16,10),'妖怪客栈 / 最终 MP4 解码抽帧',font=font,fill='#24382f')
records=[]
frames=json.loads((root/'review/frames.json').read_text())['captures']
for i,t in enumerate([0,8.5,18.8,25.6]):
 p=root/f'review/encoded-{i+1}.png'
 subprocess.run(['ffmpeg','-y','-v','error','-ss',str(t),'-i',str(video),'-frames:v','1',str(p)],check=True)
 im=Image.open(p).convert('RGB');assert im.size==(1920,1080)
 ref=next(x for x in frames if x['kind']=='keyframe' and x['time']==t)
 src=Image.open(root/'review'/ref['file']).convert('RGB')
 stat=ImageStat.Stat(ImageChops.difference(im,src));mae=sum(stat.mean)/3
 assert mae<5,(t,mae)
 x=16+(i%2)*648;y=50+(i//2)*400
 board.paste(im.resize((632,356),Image.Resampling.LANCZOS),(x,y));draw.text((x,y+357),f'{t:.1f} s',font=font,fill='#24382f')
 records.append({'seconds':t,'decoded_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'reference_capture':ref['file'],'mean_absolute_rgb_error':mae})
board.save(root/'review/encoded-contact.jpg',quality=94,subsampling=0)
result={'video_sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'dimensions':[1920,1080],'frames':records,'scope':'Decoded MP4 frames compared with matching Canvas captures. JPEG contact sheet for separate visual inspection.'}
(root/'output/encoded-frame-check.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
