"""Embed fonts, the selected audio excerpt, and the deterministic text animation."""
import base64
from pathlib import Path
root=Path(__file__).parent
html=(root/'index.html').read_text(encoding='utf-8')
for name,mime in [('heavy.otf','font/otf'),('serif.otf','font/otf'),('brush.ttf','font/ttf'),('music.m4a','audio/mp4')]:
    uri=f'data:{mime};base64,'+base64.b64encode((root/'assets'/name).read_bytes()).decode()
    html=html.replace('assets/'+name,uri)
for name in ['timeline.js','film.js']:
    html=html.replace(f'<script src="{name}"></script>','<script>\n'+(root/name).read_text(encoding='utf-8')+'\n</script>')
(root/'preview-standalone.html').write_text(html,encoding='utf-8')
print('Offline player:',len(html.encode()),'bytes')
