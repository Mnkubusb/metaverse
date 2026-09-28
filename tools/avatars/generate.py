#!/usr/bin/env python3
"""
Generates avatar variants by recolouring the base walk-cycle sheet (jacket, scarf, hair, skin).

Outputs
  apps/web/public/avatars/<id>.png           sprite sheets in the same 5x5 x 80px layout as the base
  packages/db/prisma/avatars.json            catalogue consumed by `pnpm db:seed`

Run: python3 tools/avatars/generate.py   (needs Pillow)
"""
import colorsys
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "apps/web/public/Characters/WalkAnimations.png"
OUT_DIR = ROOT / "apps/web/public/avatars"
CATALOGUE = ROOT / "packages/db/prisma/avatars.json"

# Palette entries of the base sheet, by body part (found by highlighting each group on the sheet)
JACKET = [(224, 169, 43), (231, 205, 121), (133, 86, 8)]
SCARF = [(56, 114, 106), (78, 145, 136), (36, 82, 76)]
HAIR = [(97, 88, 71), (64, 56, 43)]
SKIN = [(255, 234, 185), (253, 212, 150), (237, 195, 137)]

# Skin tones: replacement for each SKIN entry (highlight, base, shadow)
SKIN_TONES = {
    "light": SKIN,
    "medium": [(236, 196, 150), (214, 166, 118), (190, 142, 98)],
    "deep": [(176, 122, 86), (150, 100, 68), (122, 80, 54)],
}

# id, display name, jacket hue (None = grey), scarf hue, hair colour, skin tone
VARIANTS = [
    ("classic", "Classic", 41, 171, (97, 88, 71), "light"),
    ("cse-blue", "CSE Blue", 215, 28, (38, 34, 36), "medium"),
    ("crimson", "Crimson", 355, 45, (30, 28, 30), "deep"),
    ("forest", "Forest", 130, 25, (74, 50, 34), "medium"),
    ("violet", "Violet", 275, 50, (186, 150, 86), "light"),
    ("rose", "Rose", 330, 225, (128, 58, 38), "deep"),
    ("charcoal", "Charcoal", None, 0, (26, 26, 30), "medium"),
    ("teal", "Teal", 180, 48, (120, 92, 62), "light"),
]


def rehue(rgb, hue):
    h, s, v = colorsys.rgb_to_hsv(*(c / 255 for c in rgb))
    if hue is None:  # desaturate to a charcoal grey, a little darker than the original
        s, v = 0.06, v * 0.62
    else:
        h = hue / 360
        if 90 <= hue <= 200:  # greens and cyans read as neon at the base sheet's saturation
            s, v = s * 0.72, v * 0.85
    return tuple(round(c * 255) for c in colorsys.hsv_to_rgb(h, s, v))


def hair_shade(base, rgb):
    # keep the original light/dark relationship between the two hair shades
    ratio = max(rgb) / max(HAIR[0])
    return tuple(min(255, round(c * ratio)) for c in base)


def build(jacket_hue, scarf_hue, hair, tone):
    mapping = {}
    for c in JACKET:
        mapping[c] = rehue(c, jacket_hue)
    for c in SCARF:
        mapping[c] = rehue(c, scarf_hue)
    for c in HAIR:
        mapping[c] = hair_shade(hair, c)
    for src, dst in zip(SKIN, SKIN_TONES[tone]):
        mapping[src] = dst

    im = Image.open(BASE).convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a and (r, g, b) in mapping:
                px[x, y] = (*mapping[(r, g, b)], a)
    return im


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    catalogue = []
    for vid, name, jacket, scarf, hair, tone in VARIANTS:
        # "classic" is the untouched base sheet
        im = Image.open(BASE).convert("RGBA") if vid == "classic" else build(jacket, scarf, hair, tone)
        im.save(OUT_DIR / f"{vid}.png", optimize=True)
        catalogue.append({"id": f"avatar-{vid}", "name": name, "imageUrl": f"/avatars/{vid}.png"})
    CATALOGUE.write_text(json.dumps(catalogue, indent=1) + "\n")
    print(f"{len(catalogue)} avatars written")


if __name__ == "__main__":
    main()
