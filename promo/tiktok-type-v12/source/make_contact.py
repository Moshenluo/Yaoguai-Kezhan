"""Build V12 storyboard/cover and optional transition contact sheets.

Run after `node visual_review.cjs` (preferred) or `node render.cjs --stills`.
This script composes existing screenshots; it does not judge their design.
"""
from pathlib import Path
import hashlib
import json
import math
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
REVIEW = ROOT / 'review'
OUTPUT = ROOT / 'output'
FONT = os.environ.get('CONTACT_FONT', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc')
FONT_INDEX = 2 if FONT.endswith('.ttc') else 0
LABEL = ImageFont.truetype(FONT, 16, index=FONT_INDEX)
TITLE = ImageFont.truetype(FONT, 25, index=FONT_INDEX)
WIDTH, HEIGHT, GAP, TOP, FOOT, COLS = 250, 444, 14, 68, 44, 4


def compose(items, destination, title):
    if not items:
        return
    rows = math.ceil(len(items) / COLS)
    canvas = Image.new('RGB', (GAP + COLS * (WIDTH + GAP), TOP + rows * (HEIGHT + FOOT + GAP)), '#d8d2c5')
    draw = ImageDraw.Draw(canvas)
    draw.text((GAP, 17), title, font=TITLE, fill='#222b27')
    for i, item in enumerate(items):
        x = GAP + (i % COLS) * (WIDTH + GAP)
        y = TOP + (i // COLS) * (HEIGHT + FOOT + GAP)
        with Image.open(item['path']) as source:
            thumb = source.convert('RGB').resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
        canvas.paste(thumb, (x, y))
        draw.text((x, y + HEIGHT + 4), item['label'], font=LABEL, fill='#222b27')
        draw.text((x, y + HEIGHT + 23), f"{item['time']:.3f}s", font=LABEL, fill='#515954')
    canvas.save(destination, quality=94, subsampling=0)
    print(destination)


def main():
    OUTPUT.mkdir(exist_ok=True)
    review_manifest = REVIEW / 'frames.json'
    if review_manifest.exists():
        manifest = json.loads(review_manifest.read_text(encoding='utf-8'))
        current_sha = hashlib.sha256((ROOT / 'film.js').read_bytes()).hexdigest()
        if manifest['film_sha256'] != current_sha:
            raise RuntimeError('Review frames are stale; rerun node visual_review.cjs after the film edit.')
        frames = [{**f, 'path': REVIEW / f['file']} for f in manifest['captures']]
        keyframes = [f for f in frames if f['kind'] == 'keyframe']
        boundaries = [f for f in frames if f['kind'] == 'boundary']
    else:
        times = json.loads((OUTPUT / 'still-times.json').read_text(encoding='utf-8'))
        score = json.loads((ROOT / 'score.json').read_text(encoding='utf-8'))
        keyframes = [{'path': OUTPUT / f'shot-{i + 1:02}.png', 'time': t,
                      'label': score['phrases'][i]['text'] if i < len(score['phrases']) else f'Frame {i + 1}'}
                     for i, t in enumerate(times)]
        boundaries = []
    if len(keyframes) != 16:
        raise RuntimeError(f'Expected 16 keyframes, found {len(keyframes)}.')
    compose(keyframes, OUTPUT / 'storyboard.jpg', '妖怪客栈 · 等你当家 / V12 关键画面')
    cover = min(keyframes, key=lambda item: abs(item['time'] - 25.6))
    with Image.open(cover['path']) as source:
        source.convert('RGB').save(OUTPUT / 'cover.jpg', quality=96, subsampling=0)
    print(OUTPUT / 'cover.jpg')
    for start in range(0, len(boundaries), 12):
        compose(boundaries[start:start + 12], REVIEW / f'boundary-contact-{start // 12 + 1:02}.jpg',
                'V12 / 转场前后采样（需人工观察）')
    (OUTPUT / 'contact-check.json').write_text(json.dumps({
        'storyboard_frames': len(keyframes),
        'cover_seconds': cover['time'],
        'cover_source': str(cover['path'].relative_to(ROOT)),
        'boundary_frames': len(boundaries),
        'scope': 'Screenshot composition only; no automated aesthetic verdict.'
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
