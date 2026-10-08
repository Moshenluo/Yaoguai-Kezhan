"""Slice generated UI icon sheets into individual PNG assets."""
from pathlib import Path

from PIL import Image

SRC = Path(r"C:\Users\Administrator\.cursor\projects\d-minigame-yaoguaikezhan\assets")
DST = Path(r"D:\minigame\yaoguaikezhan\Yaoguai-Kezhan\game\public\images\ui")
DST.mkdir(parents=True, exist_ok=True)

COPIES = {
    "ui-gold.png": "gold.png",
    "ui-gem.png": "gem.png",
    "ui-ticket.png": "ticket.png",
    "ui-settings.png": "settings.png",
    "ui-pause.png": "pause.png",
    "ui-play.png": "play.png",
}

for src_name, dst_name in COPIES.items():
    im = Image.open(SRC / src_name).convert("RGBA")
    im.save(DST / dst_name, "PNG")
    print("copied", dst_name, im.size)


def crop_grid(sheet_name, rows, cols, names, margin_ratio=0.05):
    im = Image.open(SRC / sheet_name).convert("RGBA")
    w, h = im.size
    cw, ch = w / cols, h / rows
    mx, my = cw * margin_ratio, ch * margin_ratio
    for i, name in enumerate(names):
        if not name:
            continue
        r, c = divmod(i, cols)
        box = (
            int(c * cw + mx),
            int(r * ch + my),
            int((c + 1) * cw - mx),
            int((r + 1) * ch - my),
        )
        cell = im.crop(box)
        cell.save(DST / f"{name}.png", "PNG")
        print("sliced", name, cell.size)


facilities = [
    "facility-kitchen",
    "facility-guestRoom",
    "facility-hall",
    "facility-warehouse",
    "facility-powerPool",
    "facility-smithy",
    "facility-pharmacy",
    "facility-wishAltar",
    "facility-hotSpring",
]
elements = [
    "el-metal",
    "el-wood",
    "el-water",
    "el-fire",
    "el-earth",
    "el-light",
    "el-dark",
    None,
]

crop_grid("ui-facilities-sheet.png", 3, 3, facilities, 0.04)
crop_grid("ui-elements-sheet.png", 2, 4, elements, 0.04)
print("done", sorted(p.name for p in DST.glob("*.png")))
