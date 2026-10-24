"""Package a completed landscape PV and its reproducible source."""
from pathlib import Path
import argparse,hashlib,json,shutil,zipfile
ROOT=Path(__file__).resolve().parent
SOURCE_FILES=['index.html','core.js','act-one.js','act-two.js','film.js','timeline.js','score.json','render.cjs','verify.cjs','build_preview.py','package.json','font-text.txt','validate_media.py','visual_review.cjs','make_contact.py','package_delivery.py','review_encoded.py']
ROOT_FILES=['README.md','provenance.json','font-check.json','preview-standalone.html']
OUTPUT_FILES=['yaoguai-type-wide-v14.mp4','storyboard.jpg','cover.jpg','validation.json']
CHECK_FILES=['render-check.json','media-check.json','integration-check.json','preview-build.json','contact-check.json','encoded-frame-check.json']

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def current_sources(report,label):
    for name,expected in report.get('source_hashes',{}).items():
        if sha(ROOT/name)!=expected:raise RuntimeError(f'Stale {label}: {name}')

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--dest',type=Path,default=ROOT/'delivery');dest=parser.parse_args().dest.resolve()
    root_inputs={name:ROOT/name if (ROOT/name).is_file() else ROOT.parent/name for name in ROOT_FILES}
    required=[ROOT/name for name in SOURCE_FILES]+list(root_inputs.values())+[ROOT/'output'/name for name in OUTPUT_FILES]+[ROOT/'assets/music.m4a',ROOT/'review/frames.json']+[ROOT/'output'/name for name in CHECK_FILES]
    missing=[str(p) for p in required if not p.is_file()]
    if missing:raise FileNotFoundError('Finish the release before packaging: '+', '.join(missing))
    score=json.loads((ROOT/'score.json').read_text(encoding='utf-8'))
    review_file=ROOT/'review/frames.json'
    review=json.loads(review_file.read_text(encoding='utf-8'))
    current_sources(review,'visual capture')
    if review['errors'] or not review['source_unchanged_during_capture']:raise RuntimeError('Visual capture has errors.')
    reports={name:json.loads((ROOT/'output'/name).read_text(encoding='utf-8')) for name in CHECK_FILES}
    render=reports['render-check.json'];current_sources(render,'video render')
    if render['browser_errors'] or not render['source_unchanged_during_render']:raise RuntimeError('Render check has errors.')
    if (render['width'],render['height'],render['fps'],render['duration'])!=(score['width'],score['height'],score['fps'],score['duration']):raise RuntimeError('Render geometry/timing differs from score.')
    preview=reports['preview-build.json'];current_sources(preview,'offline player')
    if sha(root_inputs['preview-standalone.html'])!=preview['standalone_sha256']:raise RuntimeError('Standalone HTML changed after build.')
    media=reports['media-check.json'];integration=reports['integration-check.json']
    movie_hash=sha(ROOT/'output/yaoguai-type-wide-v14.mp4')
    if media['file_sha256']!=movie_hash or integration['video_sha256']!=movie_hash or reports['encoded-frame-check.json']['video_sha256']!=movie_hash:raise RuntimeError('Movie changed after validation.')
    if integration['standalone_sha256']!=preview['standalone_sha256'] or integration['errors']:raise RuntimeError('Player integration evidence is stale or contains errors.')
    current_sources(integration,'player integration')
    if not media['audio_packet_payload_matches_excerpt'] or not media['faststart']:raise RuntimeError('Media validation did not pass.')
    source=dest/'source';source.mkdir(parents=True,exist_ok=True)
    for name in SOURCE_FILES:shutil.copy2(ROOT/name,source/name)
    shutil.copytree(ROOT/'assets',source/'assets',dirs_exist_ok=True)
    for name,path in root_inputs.items():shutil.copy2(path,dest/name)
    for name in OUTPUT_FILES:shutil.copy2(ROOT/'output'/name,dest/name)
    shutil.copy2(ROOT/'assets/music.m4a',dest/'music-excerpt.m4a')
    (dest/'review/checks').mkdir(parents=True,exist_ok=True)
    for name in CHECK_FILES:shutil.copy2(ROOT/'output'/name,dest/'review/checks'/name)
    for name in ['REFERENCES.md','references.md']:
        candidate=ROOT/name if (ROOT/name).is_file() else ROOT.parent/name
        if candidate.is_file():shutil.copy2(candidate,dest/name)
    if review_file.is_file():
        (dest/'review').mkdir(exist_ok=True);shutil.copy2(review_file,dest/'review/frames.json')
        for pattern in ['motion-*.jpg','encoded-contact.jpg','visual-review.md']:
            for p in sorted((ROOT/'review').glob(pattern)):shutil.copy2(p,dest/'review'/p.name)
    files=sorted(p for p in dest.rglob('*') if p.is_file() and p.name not in ['SHA256SUMS','manifest.json'] and p.suffix!='.zip')
    manifest={'title':'妖怪客栈 · 等你当家｜16:9 横版文字 PV','version':'wide-v14','duration_seconds':score['duration'],'width':score['width'],'height':score['height'],'fps':score['fps'],'aspect_ratio':'16:9','files':[]}
    for p in files:manifest['files'].append({'path':str(p.relative_to(dest)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
    (dest/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    archive=dest/'yaoguai-type-wide-v14-delivery.zip'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as packed:
        for p in files+[dest/'manifest.json']:packed.write(p,arcname='yaoguai-type-wide-v14/'+str(p.relative_to(dest)))
    with zipfile.ZipFile(archive) as packed:
        assert packed.testzip() is None
        for record in manifest['files']:
            assert hashlib.sha256(packed.read('yaoguai-type-wide-v14/'+record['path'])).hexdigest()==record['sha256'],record['path']
    checks=sorted(p for p in dest.iterdir() if p.is_file() and p.name!='SHA256SUMS')
    (dest/'SHA256SUMS').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.name+'\n' for p in checks),encoding='utf-8')
    assert all(p.stat().st_size<100*1024**2 for p in dest.rglob('*') if p.is_file())
    print(json.dumps({'directory':str(dest),'zip_bytes':archive.stat().st_size,'film_bytes':(dest/'yaoguai-type-wide-v14.mp4').stat().st_size,'files':len(files),'zip_crc_and_payload_hashes':'passed'},ensure_ascii=False))
if __name__=='__main__':main()
