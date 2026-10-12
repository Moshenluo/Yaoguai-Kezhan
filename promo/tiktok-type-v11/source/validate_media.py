"""Validate the encoded deliverable, including unchanged audio packet payloads."""
from pathlib import Path
import hashlib,json,struct,subprocess
root=Path(__file__).parent
video=root/'output/yaoguai-type-v11.mp4'
def run(args):
    return subprocess.check_output(args,stderr=subprocess.PIPE).decode().strip()
probe=json.loads(run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(video)]))
v=next(s for s in probe['streams'] if s['codec_type']=='video')
a=next(s for s in probe['streams'] if s['codec_type']=='audio')
assert (v['width'],v['height'],v['avg_frame_rate'],int(v['nb_frames']))==(1080,1920,'60/1',1620)
assert (v['color_space'],v['color_transfer'],v['color_primaries'])==('bt709','bt709','bt709')
assert (v['codec_name'],a['codec_name'],a['sample_rate'],a['channels'])==('h264','aac','48000',2)
assert float(v['start_time'])==float(a['start_time'])==0
assert abs(float(v['duration'])-27)<.001 and abs(float(a['duration'])-27)<.001
assert abs(float(probe['format']['duration'])-27)<.001
def audio_hash(file):
    return run(['ffmpeg','-v','error','-i',str(file),'-map','0:a:0','-c:a','copy','-f','md5','-'])
source_hash=audio_hash(root/'assets/music.m4a');output_hash=audio_hash(video)
assert source_hash==output_hash
subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(video),'-f','null','-'],check=True,capture_output=True)
atoms=[]
with video.open('rb') as f:
    while f.tell()<video.stat().st_size:
        pos=f.tell();head=f.read(8)
        if len(head)<8:break
        size,kind=struct.unpack('>I4s',head)
        if size==1:size=struct.unpack('>Q',f.read(8))[0]
        if size==0:size=video.stat().st_size-pos
        atoms.append(kind.decode('ascii',errors='replace'))
        f.seek(pos+size)
assert atoms.index('moov')<atoms.index('mdat')
result={'duration_seconds':27,'width':1080,'height':1920,'fps':60,'frames':1620,'color_space':'bt709','video_codec':'h264','audio_codec':'aac','audio_sample_rate':48000,'audio_channels':2,'video_start_seconds':0,'audio_start_seconds':0,'audio_packet_payload_matches_excerpt':True,'audio_packet_md5':source_hash,'faststart':True,'full_decode':'passed with -xerror','file_bytes':video.stat().st_size,'file_sha256':hashlib.sha256(video.read_bytes()).hexdigest()}
(root/'output/media-check.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
