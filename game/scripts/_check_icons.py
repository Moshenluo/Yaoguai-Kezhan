import re
from pathlib import Path

p = Path(r"D:\minigame\yaoguaikezhan\Yaoguai-Kezhan\game\src\game\config.ts")
t = p.read_text(encoding="utf-8")
for m in re.finditer(r"icon:\s*'([^']+)'", t):
    v = m.group(1)
    if not v.startswith("/"):
        print(m.start(), v)
print("---")
# also double-quoted
for m in re.finditer(r'icon:\s*"([^"]+)"', t):
    v = m.group(1)
    if not v.startswith("/"):
        print("dq", m.start(), v)
print("done")
