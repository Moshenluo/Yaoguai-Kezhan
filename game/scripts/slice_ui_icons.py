"""Slice soft-clay UI icon sheets into public/images/ui/*.png"""
from pathlib import Path
from PIL import Image

ASSETS = Path(r"C:\Users\Administrator\.cursor\projects\d-minigame-yaoguaikezhan\assets")
OUT = Path(r"D:\minigame\yaoguaikezhan\Yaoguai-Kezhan\game\public\images\ui")
OUT.mkdir(parents=True, exist_ok=True)

CREAM = (0xF5, 0xEF, 0xE3)


def is_cream(px, tol=28):
    r, g, b = px[:3]
    return abs(r - CREAM[0]) <= tol and abs(g - CREAM[1]) <= tol and abs(b - CREAM[2]) <= tol


def trim_cream(im, pad=8, tol=28):
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    minx, miny, maxx, maxy = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            if not is_cream(px[x, y], tol):
                found = True
                if x < minx:
                    minx = x
                if y < miny:
                    miny = y
                if x > maxx:
                    maxx = x
                if y > maxy:
                    maxy = y
    if not found:
        return im.resize((512, 512), Image.Resampling.LANCZOS)
    minx = max(0, minx - pad)
    miny = max(0, miny - pad)
    maxx = min(w - 1, maxx + pad)
    maxy = min(h - 1, maxy + pad)
    cropped = im.crop((minx, miny, maxx + 1, maxy + 1))
    side = max(cropped.size)
    canvas = Image.new("RGBA", (side, side), (*CREAM, 255))
    ox = (side - cropped.size[0]) // 2
    oy = (side - cropped.size[1]) // 2
    canvas.paste(cropped, (ox, oy), cropped)
    return canvas.resize((512, 512), Image.Resampling.LANCZOS)


def slice_grid(path, cols, rows, names):
    im = Image.open(path).convert("RGBA")
    W, H = im.size
    cw, ch = W // cols, H // rows
    assert len(names) == cols * rows, (path, len(names), cols * rows)
    for i, name in enumerate(names):
        if not name:
            continue
        c, r = i % cols, i // cols
        cell = im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
        out = trim_cream(cell)
        dest = OUT / name
        out.convert("RGB").save(dest, "PNG", optimize=True)
        print("wrote", dest.name, out.size)


slice_grid(
    ASSETS / "sheet-a-regions-potions-skins.png",
    3,
    3,
    [
        "region-1.png",
        "region-2.png",
        "region-3.png",
        "potion-exp-small.png",
        "potion-exp-medium.png",
        "potion-exp-large.png",
        "skin-default.png",
        "skin-lantern.png",
        "skin-frost.png",
    ],
)

slice_grid(
    ASSETS / "sheet-b-skins-festivals.png",
    3,
    3,
    [
        "skin-gilt.png",
        "skin-bloodmoon.png",
        "festival-laba.png",
        "festival-newyear.png",
        "festival-lantern.png",
        "festival-huazhao.png",
        "festival-dragon.png",
        "festival-qixi.png",
        "festival-midautumn.png",
    ],
)

slice_grid(
    ASSETS / "sheet-c-stamina.png",
    3,
    3,
    [
        "stamina-full.png",
        "stamina-normal.png",
        "stamina-tired.png",
        "stamina-exhausted.png",
        "stamina-collapse.png",
        "potion-stamina-small.png",
        "potion-stamina-medium.png",
        "potion-stamina-large.png",
        "festival-dongzhi.png",
    ],
)

slice_grid(
    ASSETS / "sheet-d-gather-props.png",
    3,
    3,
    [
        "gather-hunt.png",
        "gather-farm.png",
        "gather-lumber.png",
        "gather-saltwell.png",
        "gather-quarry.png",
        "gather-brewery.png",
        "gather-mine.png",
        "prop-boss-lure.png",
        "prop-capture-net.png",
    ],
)

slice_grid(
    ASSETS / "sheet-e-cats-dishes-stats.png",
    4,
    3,
    [
        "prop-haste-talisman.png",
        "cat-food.png",
        "cat-build.png",
        "cat-growth.png",
        "cat-prop.png",
        "dish-plain.png",
        "dish-signature.png",
        "dish-banquet.png",
        "stat-atk.png",
        "stat-hp.png",
        "stat-as.png",
        "stat-range.png",
    ],
)

slice_grid(
    ASSETS / "sheet-f-bag-gift.png",
    2,
    1,
    [
        "prop-stone-bag.png",
        "gift.png",
    ],
)

print("DONE")
