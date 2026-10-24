"""Embed fonts, the selected audio excerpt, and the deterministic text animation."""
import base64,hashlib,json
from pathlib import Path
root=Path(__file__).parent
source_files=['index.html','timeline.js','core.js','act-one.js','act-two.js','film.js','assets/heavy.otf','assets/serif.otf','assets/brush.ttf','assets/music.m4a']
source_hashes={name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in source_files}
html=(root/'index.html').read_text(encoding='utf-8')
for name,mime in [('heavy.otf','font/otf'),('serif.otf','font/otf'),('brush.ttf','font/ttf'),('music.m4a','audio/mp4')]:
    uri=f'data:{mime};base64,'+base64.b64encode((root/'assets'/name).read_bytes()).decode()
    html=html.replace('assets/'+name,uri)
for name in ['timeline.js','core.js','act-one.js','act-two.js','film.js']:
    tag=f'<script src="{name}"></script>'
    if tag not in html: raise RuntimeError(f'Missing source script tag: {name}')
    html=html.replace(tag,'<script>\n'+(root/name).read_text(encoding='utf-8')+'\n</script>')
(root/'preview-standalone.html').write_text(html,encoding='utf-8')
(root/'output').mkdir(exist_ok=True)
(root/'output/preview-build.json').write_text(json.dumps({'source_hashes':source_hashes,'standalone_sha256':hashlib.sha256((root/'preview-standalone.html').read_bytes()).hexdigest(),'script_order':['timeline.js','core.js','act-one.js','act-two.js','film.js']},indent=2)+'\n',encoding='utf-8')
print('Offline player:',len(html.encode()),'bytes')
