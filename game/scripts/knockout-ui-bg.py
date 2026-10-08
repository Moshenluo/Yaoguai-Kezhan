"""Knock out solid studio backgrounds (cream / black) to true alpha."""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(r"D:\minigame\yaoguaikezhan\Yaoguai-Kezhan\game\public\images\ui")


def corner_color(rgb: np.ndarray) -> np.ndarray:
    h, w = rgb.shape[:2]
    patches = [
        rgb[:12, :12],
        rgb[:12, w - 12 :],
        rgb[h - 12 :, :12],
        rgb[h - 12 :, w - 12 :],
    ]
    samples = np.concatenate([p.reshape(-1, 3) for p in patches], axis=0)
    return np.median(samples, axis=0)


def knock_out(path):
    im = Image.open(path).convert("RGBA")
    arr = np.array(im)
    rgb = arr[:, :, :3].astype(np.float32)
    h, w = rgb.shape[:2]
    bg = corner_color(rgb)
    bg_lum = float(bg.mean())

    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    # Cream paper vs near-black studio
    if bg_lum > 160:
        seed = dist < 28
        grow = dist < 48
    else:
        seed = dist < 18
        grow = dist < 36

    # Must be connected to the image border, so holes in the icon stay opaque.
    seed_u8 = (seed.astype(np.uint8) * 255)
    # Force border seeds
    seed_u8[0, :] = np.where(grow[0, :], 255, seed_u8[0, :])
    seed_u8[-1, :] = np.where(grow[-1, :], 255, seed_u8[-1, :])
    seed_u8[:, 0] = np.where(grow[:, 0], 255, seed_u8[:, 0])
    seed_u8[:, -1] = np.where(grow[:, -1], 255, seed_u8[:, -1])

    num, labels = cv2.connectedComponents((grow.astype(np.uint8)), connectivity=8)
    border_labels = set(labels[0, :].tolist())
    border_labels.update(labels[-1, :].tolist())
    border_labels.update(labels[:, 0].tolist())
    border_labels.update(labels[:, -1].tolist())
    border_labels.discard(0)

    bg_mask = np.isin(labels, list(border_labels)) if border_labels else np.zeros((h, w), dtype=bool)
    bg_mask &= grow

    opaque_ratio = 1.0 - bg_mask.mean()
    if opaque_ratio < 0.08 or opaque_ratio > 0.92:
        return False, "skip(ratio=%.2f lum=%.0f)" % (opaque_ratio, bg_lum)

    alpha = np.where(bg_mask, 0, 255).astype(np.uint8)
    # Soft edge: blur then keep subject core
    alpha = cv2.GaussianBlur(alpha, (0, 0), 1.2)
    kernel = np.ones((3, 3), np.uint8)
    core = cv2.erode((~bg_mask).astype(np.uint8) * 255, kernel, iterations=1)
    alpha = np.maximum(alpha, core)

    out = arr.copy()
    out[:, :, 3] = alpha
    Image.fromarray(out).save(path, "PNG")
    return True, "ok opaque=%.0f%% lum=%.0f" % (opaque_ratio * 100, bg_lum)


def main() -> None:
    files = sorted(ROOT.glob("*.png"))
    ok = skip = fail = 0
    for p in files:
        try:
            changed, msg = knock_out(p)
        except Exception as e:
            fail += 1
            print("FAIL", p.name, e)
            continue
        if changed:
            ok += 1
            print("KO  ", p.name, msg)
        else:
            skip += 1
            print("SKIP", p.name, msg)
    print("done knockout=%d skip=%d fail=%d total=%d" % (ok, skip, fail, len(files)))


if __name__ == "__main__":
    main()
