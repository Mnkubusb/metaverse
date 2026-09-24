#!/usr/bin/env python3
"""
Generates the GEC Bilaspur campus map: pixel-art tiles, the map layout and a preview.

Outputs
  apps/web/public/campus/*.png                    tile / building sprites (32px per tile)
  apps/web/public/campus/gec-bilaspur-thumb.png   map thumbnail shown in the space creator
  packages/db/prisma/maps/gec-bilaspur.json       elements + placements consumed by the seed script
  tools/campus-map/preview.png                    full-size render, for eyeballing the layout

Layer rules (mirrored by the web renderer and the ws server):
  floor       drawn first, never blocks movement
  wall        drawn after floor, blocks its whole footprint when static
  objects     y-sorted with players, blocks only its bottom row when static
  topObjects  drawn above players, never blocks

Run: python3 tools/campus-map/generate.py   (needs Pillow)
Edit LAYOUT below to move buildings around, then re-run and `pnpm db:seed`.
"""
import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "apps/web/public"
OUT_DIR = PUBLIC / "campus"
MAP_JSON = ROOT / "packages/db/prisma/maps/gec-bilaspur.json"
PREVIEW = Path(__file__).resolve().parent / "preview.png"

T = 32
MAP_W, MAP_H = 76, 54
MAP_ID = "gec-bilaspur-campus"
MAP_NAME = "GEC Bilaspur Campus"

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

# Palette (grass / water / dirt sampled from the existing BasicTiles set)
GRASS = (179, 227, 99)
GRASS_DARK = (76, 189, 86)
GRASS_LIGHT = (235, 255, 139)
WATER = (102, 143, 175)
WATER_LIGHT = (150, 190, 214)
DIRT = (159, 112, 90)
OUTLINE = (52, 44, 58)
ASPHALT = (92, 96, 106)
ASPHALT_DARK = (78, 82, 92)
CURB = (196, 192, 180)
PAVER = (222, 204, 164)
PAVER_LINE = (190, 170, 130)
BRICK = (184, 98, 74)
BRICK_LINE = (148, 72, 56)
CREAM = (240, 226, 186)
CREAM_SHADE = (214, 196, 150)
MAROON = (140, 52, 48)
ROOF = (206, 206, 200)
ROOF_EDGE = (160, 160, 156)
GLASS = (104, 150, 186)
GLASS_LIGHT = (170, 208, 230)
DOOR = (96, 62, 44)
SIGN_GREEN = (30, 98, 72)
WHITE = (250, 250, 246)

rng = random.Random(42)


def font(size):
    return ImageFont.truetype(FONT_BOLD, size)


def new(w_tiles, h_tiles, fill=(0, 0, 0, 0)):
    im = Image.new("RGBA", (w_tiles * T, h_tiles * T), fill)
    return im, ImageDraw.Draw(im)


def speckle(d, box, base, amount=0.08, spread=8):
    x0, y0, x1, y1 = box
    for _ in range(int((x1 - x0) * (y1 - y0) * amount)):
        x = rng.randrange(x0, x1)
        y = rng.randrange(y0, y1)
        k = rng.randint(-spread, spread)
        d.point((x, y), tuple(max(0, min(255, c + k)) for c in base[:3]))


def text_center(d, cx, cy, s, size, fill=WHITE):
    f = font(size)
    d.fontmode = "1"  # crisp, non-antialiased text to match the pixel art
    x0, y0, x1, y1 = d.textbbox((0, 0), s, font=f)
    d.text((cx - (x1 - x0) / 2 - x0, cy - (y1 - y0) / 2 - y0), s, font=f, fill=fill)


def fit_text(d, s, max_w, start=12, min_size=7):
    size = start
    while size > min_size:
        x0, _, x1, _ = d.textbbox((0, 0), s, font=font(size))
        if x1 - x0 <= max_w:
            break
        size -= 1
    return size


# --------------------------------------------------------------------------- floor tiles

def road(kind):
    im, d = new(2, 2, ASPHALT + (255,))
    speckle(d, (0, 0, 64, 64), ASPHALT, 0.12, 7)
    if kind == "h":
        d.rectangle((0, 0, 63, 2), fill=CURB)
        d.rectangle((0, 61, 63, 63), fill=CURB)
        for x in range(4, 64, 16):
            d.rectangle((x, 31, x + 7, 32), fill=WHITE)
    elif kind == "v":
        d.rectangle((0, 0, 2, 63), fill=CURB)
        d.rectangle((61, 0, 63, 63), fill=CURB)
        for y in range(4, 64, 16):
            d.rectangle((31, y, 32, y + 7), fill=WHITE)
    return im


def paver():
    im, d = new(1, 1, PAVER + (255,))
    for row in range(4):
        y = row * 8
        d.line((0, y, 31, y), fill=PAVER_LINE)
        off = 0 if row % 2 == 0 else 8
        for x in range(off, 32, 16):
            d.line((x, y, x, y + 7), fill=PAVER_LINE)
    speckle(d, (0, 0, 32, 32), PAVER, 0.05, 6)
    return im


def plaza():
    im, d = new(1, 1, BRICK + (255,))
    for row in range(4):
        y = row * 8
        d.line((0, y, 31, y), fill=BRICK_LINE)
        off = 4 if row % 2 == 0 else 12
        for x in range(off, 32, 16):
            d.line((x, y, x, y + 7), fill=BRICK_LINE)
    speckle(d, (0, 0, 32, 32), BRICK, 0.06, 10)
    return im


def flowerbed():
    im, d = new(1, 1, (118, 84, 66, 255))
    d.rectangle((0, 0, 31, 31), outline=(92, 140, 60))
    colors = [(240, 90, 90), (250, 210, 70), (250, 250, 250), (230, 120, 200), (255, 150, 60)]
    for _ in range(14):
        x, y = rng.randrange(3, 29), rng.randrange(3, 29)
        d.rectangle((x - 1, y, x + 1, y), fill=GRASS_DARK)
        d.rectangle((x, y - 1, x + 1, y), fill=rng.choice(colors))
    return im


def lawn_dark():
    im, d = new(1, 1, (150, 206, 88, 255))
    for _ in range(10):
        x, y = rng.randrange(1, 31), rng.randrange(2, 31)
        d.line((x, y, x, y - 2), fill=GRASS_DARK)
    return im


def parking(w, h):
    im, d = new(w, h, ASPHALT + (255,))
    speckle(d, (0, 0, w * T, h * T), ASPHALT, 0.1, 7)
    d.rectangle((0, 0, w * T - 1, h * T - 1), outline=CURB, width=3)
    bay = T * 3 // 2
    for x in range(bay, w * T - 4, bay):
        d.line((x, 4, x, T + 10), fill=WHITE, width=2)
        d.line((x, h * T - T - 10, x, h * T - 5), fill=WHITE, width=2)
    d.rectangle((6, h * T // 2 - 9, 24, h * T // 2 + 9), fill=(40, 90, 190), outline=WHITE)
    text_center(d, 15, h * T // 2, "P", 13, WHITE)
    return im


def basketball():
    w, h = 8, 5
    im, d = new(w, h, (60, 120, 90, 255))
    d.rectangle((4, 4, w * T - 5, h * T - 5), fill=(196, 110, 64))
    d.rectangle((4, 4, w * T - 5, h * T - 5), outline=WHITE, width=2)
    cx, cy = w * T // 2, h * T // 2
    d.line((cx, 4, cx, h * T - 5), fill=WHITE, width=2)
    d.ellipse((cx - 18, cy - 18, cx + 18, cy + 18), outline=WHITE, width=2)
    for side in (0, 1):
        x0 = 4 if side == 0 else w * T - 5
        s = 1 if side == 0 else -1
        d.rectangle((min(x0, x0 + s * 44), cy - 22, max(x0, x0 + s * 44), cy + 22), outline=WHITE, width=2)
        d.arc((x0 + s * 44 - 22, cy - 22, x0 + s * 44 + 22, cy + 22),
              -90 if side == 0 else 90, 90 if side == 0 else 270, fill=WHITE, width=2)
        d.rectangle((x0 + s * 2 - 2, cy - 8, x0 + s * 2 + 2, cy + 8), fill=WHITE)
        d.ellipse((x0 + s * 10 - 5, cy - 5, x0 + s * 10 + 5, cy + 5), outline=(240, 90, 40), width=2)
    return im


def sports_ground():
    w, h = 20, 10
    im, d = new(w, h, GRASS + (0,))
    W, H = w * T, h * T
    # running track
    d.rounded_rectangle((2, 2, W - 3, H - 3), radius=H // 2 - 2, fill=(196, 96, 72), outline=WHITE, width=2)
    for i in range(1, 4):
        d.rounded_rectangle((2 + i * 9, 2 + i * 9, W - 3 - i * 9, H - 3 - i * 9),
                            radius=H // 2 - 2 - i * 9, outline=(236, 200, 180), width=1)
    inner = 40
    d.rounded_rectangle((inner, inner, W - inner, H - inner), radius=H // 2 - inner, fill=(128, 200, 84),
                        outline=WHITE, width=2)
    # mowing stripes, clipped to the infield
    stripes = Image.new("RGBA", (W, H))
    sd = ImageDraw.Draw(stripes)
    for x in range(inner, W - inner, 32):
        sd.rectangle((x, inner, x + 15, H - inner), fill=(140, 210, 92))
    mask = Image.new("L", (W, H))
    ImageDraw.Draw(mask).rounded_rectangle((inner + 2, inner + 2, W - inner - 2, H - inner - 2),
                                           radius=H // 2 - inner - 2, fill=255)
    im.paste(stripes, (0, 0), Image.composite(stripes, Image.new("RGBA", (W, H)), mask).getchannel("A"))
    d.rounded_rectangle((inner, inner, W - inner, H - inner), radius=H // 2 - inner, outline=WHITE, width=2)
    # cricket pitch + creases
    cx, cy = W // 2, H // 2
    d.rectangle((cx - 60, cy - 10, cx + 60, cy + 10), fill=(214, 190, 140))
    for x in (cx - 50, cx + 50):
        d.line((x, cy - 12, x, cy + 12), fill=WHITE, width=2)
        for dy in (-4, 0, 4):
            d.point((x + (-4 if x < cx else 4), cy + dy), fill=(120, 80, 50))
    text_center(d, cx, inner + 18, "GEC SPORTS GROUND", 14, (250, 250, 240))
    return im


# --------------------------------------------------------------------------- walls / structures

def boundary(kind):
    im, d = new(1, 1)
    if kind == "h":
        d.rectangle((0, 10, 31, 31), fill=CREAM)
        d.rectangle((0, 22, 31, 31), fill=CREAM_SHADE)
        d.rectangle((0, 6, 31, 11), fill=MAROON)
        d.line((0, 6, 31, 6), fill=OUTLINE)
        d.line((0, 31, 31, 31), fill=OUTLINE)
        d.line((31, 10, 31, 31), fill=(200, 184, 140))
    else:
        d.rectangle((10, 0, 21, 31), fill=CREAM_SHADE)
        d.rectangle((12, 0, 19, 31), fill=MAROON)
        d.line((10, 0, 10, 31), fill=OUTLINE)
        d.line((21, 0, 21, 31), fill=OUTLINE)
    return im


def pond():
    w, h = 7, 5
    im, d = new(w, h)
    W, H = w * T, h * T
    d.ellipse((2, 4, W - 3, H - 3), fill=(128, 128, 120), outline=OUTLINE)
    d.ellipse((8, 10, W - 9, H - 9), fill=WATER)
    for _ in range(12):
        x = rng.randrange(40, W - 40)
        y = rng.randrange(30, H - 30)
        d.line((x, y, x + 8, y), fill=WATER_LIGHT)
    for (x, y) in [(60, 50), (150, 90), (110, 120)]:
        d.ellipse((x - 9, y - 6, x + 9, y + 6), fill=(80, 160, 80))
        d.point((x + 2, y - 1), fill=(250, 170, 200))
    return im


def fountain():
    w = h = 3
    im, d = new(w, h)
    d.ellipse((2, 2, 93, 93), fill=(190, 186, 176), outline=OUTLINE)
    d.ellipse((10, 10, 85, 85), fill=WATER)
    d.ellipse((38, 38, 57, 57), fill=(190, 186, 176), outline=OUTLINE)
    d.ellipse((43, 36, 52, 45), fill=WATER_LIGHT)
    for a in range(0, 360, 45):
        import math
        x = 48 + int(26 * math.cos(math.radians(a)))
        y = 48 + int(26 * math.sin(math.radians(a)))
        d.point((x, y), fill=WHITE)
    return im


def building(w, h, label, wall=CREAM, band=MAROON, roof=ROOF, style="block", floors=2):
    """Top-down 3/4 building: flat roof with parapet + front facade in the bottom two tiles."""
    im, d = new(w, h)
    W, H = w * T, h * T
    facade_h = 2 * T if floors >= 2 else T + 12
    roof_bottom = H - facade_h

    # roof
    if style == "tin":
        d.rectangle((0, 4, W - 1, roof_bottom + 4), fill=(170, 60, 50), outline=OUTLINE)
        for x in range(4, W - 2, 6):
            d.line((x, 6, x, roof_bottom + 2), fill=(140, 44, 40))
    elif style == "sawtooth":
        d.rectangle((0, 0, W - 1, roof_bottom + 2), fill=(150, 156, 162), outline=OUTLINE)
        for y in range(4, roof_bottom, 14):
            d.rectangle((2, y, W - 3, y + 5), fill=(176, 206, 222))
            d.line((2, y + 6, W - 3, y + 6), fill=OUTLINE)
    else:
        d.rectangle((0, 0, W - 1, roof_bottom + 2), fill=roof_edge(roof), outline=OUTLINE)
        d.rectangle((5, 5, W - 6, roof_bottom - 3), fill=roof)
        speckle(d, (5, 5, W - 6, roof_bottom - 3), roof, 0.04, 8)
        # Sintex water tanks + solar panels on the roof
        for i, tx in enumerate([14, W - 34]):
            if i == 1 and w < 6:
                break
            d.ellipse((tx, 10, tx + 18, 28), fill=(40, 40, 44), outline=OUTLINE)
            d.ellipse((tx + 5, 15, tx + 12, 22), fill=(70, 70, 76))
        if w >= 7 and roof_bottom > 60:
            for px in range(W // 2 - 44, W // 2 + 40, 22):
                d.rectangle((px, 12, px + 18, 26), fill=(52, 76, 132), outline=(30, 40, 70))
                d.line((px + 9, 12, px + 9, 26), fill=(90, 120, 170))

    # label board on the roof
    if label:
        lines = label.split("\n")
        board_w = min(W - 16, max(64, W - 24))
        size = min(fit_text(d, ln, board_w - 10, 13) for ln in lines)
        line_h = size + 3
        board_h = line_h * len(lines) + 8
        bx0 = (W - board_w) // 2
        by0 = max(8, (roof_bottom - board_h) // 2 + (8 if roof_bottom > 70 else 2))
        d.rectangle((bx0, by0, bx0 + board_w, by0 + board_h), fill=SIGN_GREEN, outline=WHITE)
        for i, ln in enumerate(lines):
            text_center(d, W // 2, by0 + 4 + line_h * i + line_h // 2, ln, size, WHITE)

    # facade
    fy = roof_bottom
    d.rectangle((0, fy, W - 1, H - 1), fill=wall, outline=OUTLINE)
    d.rectangle((1, fy + 1, W - 2, fy + 5), fill=band)
    d.line((1, H - 3, W - 2, H - 3), fill=tuple(c - 30 for c in wall))
    rows = [fy + 10] if floors < 2 else [fy + 10, fy + 36]
    door_x0, door_x1 = W // 2 - 12, W // 2 + 11
    for ry in rows:
        for x in range(8, W - 16, 20):
            if ry == rows[-1] and x + 12 > door_x0 - 2 and x < door_x1 + 2:
                continue
            d.rectangle((x, ry, x + 12, ry + 16), fill=GLASS, outline=OUTLINE)
            d.line((x + 6, ry, x + 6, ry + 16), fill=OUTLINE)
            d.line((x + 2, ry + 2, x + 4, ry + 2), fill=GLASS_LIGHT)
        if floors >= 2 and ry == rows[0]:
            d.line((1, ry + 21, W - 2, ry + 21), fill=band)
    # door + steps
    d.rectangle((door_x0, H - 26, door_x1, H - 4), fill=DOOR, outline=OUTLINE)
    d.line((W // 2, H - 26, W // 2, H - 4), fill=OUTLINE)
    d.rectangle((door_x0 - 4, H - 4, door_x1 + 4, H - 1), fill=(200, 200, 196))
    return im


def roof_edge(c):
    return tuple(max(0, v - 44) for v in c)


def dispensary():
    im = building(5, 4, "DISPENSARY", wall=WHITE, band=(200, 40, 40), floors=1)
    d = ImageDraw.Draw(im)
    cx, cy = 5 * T - 22, 20
    d.rectangle((cx - 9, cy - 3, cx + 9, cy + 3), fill=(220, 40, 40))
    d.rectangle((cx - 3, cy - 9, cx + 3, cy + 9), fill=(220, 40, 40))
    return im


# --------------------------------------------------------------------------- objects

def bench():
    im, d = new(2, 1)
    d.rectangle((3, 10, 60, 16), fill=(150, 96, 56), outline=OUTLINE)
    d.rectangle((3, 18, 60, 24), fill=(170, 112, 66), outline=OUTLINE)
    for x in (6, 55):
        d.rectangle((x, 24, x + 2, 30), fill=(60, 60, 64))
    return im


def lamp():
    im, d = new(1, 2)
    d.ellipse((10, 56, 21, 62), fill=(0, 0, 0, 70))
    d.rectangle((14, 12, 17, 60), fill=(70, 74, 82), outline=OUTLINE)
    d.rectangle((8, 6, 23, 12), fill=(70, 74, 82), outline=OUTLINE)
    d.rectangle((10, 12, 21, 15), fill=(255, 236, 150))
    return im


def flagpole():
    im, d = new(2, 3)
    d.ellipse((10, 86, 30, 94), fill=(0, 0, 0, 70))
    d.rectangle((6, 84, 34, 92), fill=(210, 206, 196), outline=OUTLINE)
    d.rectangle((18, 4, 21, 86), fill=(200, 200, 204), outline=OUTLINE)
    fx, fy = 22, 6
    d.rectangle((fx, fy, fx + 36, fy + 7), fill=(255, 153, 51))
    d.rectangle((fx, fy + 8, fx + 36, fy + 15), fill=WHITE)
    d.rectangle((fx, fy + 16, fx + 36, fy + 23), fill=(19, 136, 8))
    d.ellipse((fx + 14, fy + 8, fx + 21, fy + 15), outline=(0, 0, 128))
    d.rectangle((fx, fy, fx + 36, fy + 23), outline=OUTLINE)
    return im


def car(color):
    im, d = new(2, 1)
    d.ellipse((4, 24, 60, 31), fill=(0, 0, 0, 60))
    d.rounded_rectangle((3, 6, 60, 26), radius=6, fill=color, outline=OUTLINE)
    d.rectangle((18, 9, 42, 23), fill=tuple(max(0, c - 40) for c in color))
    d.rectangle((14, 9, 18, 23), fill=GLASS)
    d.rectangle((42, 9, 46, 23), fill=GLASS)
    for x in (10, 48):
        d.rectangle((x, 4, x + 6, 6), fill=(30, 30, 30))
        d.rectangle((x, 26, x + 6, 28), fill=(30, 30, 30))
    return im


def bikes():
    im, d = new(3, 1)
    d.line((2, 26, 93, 26), fill=(120, 120, 124), width=2)
    for i, c in enumerate([(200, 40, 40), (30, 30, 30), (40, 80, 180), (30, 30, 30), (220, 160, 30)]):
        x = 6 + i * 18
        d.line((x, 4, x, 28), fill=OUTLINE, width=4)
        d.line((x, 8, x, 24), fill=c, width=2)
        d.line((x - 4, 10, x + 4, 10), fill=(60, 60, 60), width=2)
    return im


def dustbin():
    im, d = new(1, 1)
    d.ellipse((8, 26, 24, 31), fill=(0, 0, 0, 60))
    d.rectangle((9, 10, 22, 28), fill=(40, 140, 80), outline=OUTLINE)
    d.rectangle((8, 7, 23, 10), fill=(30, 110, 60), outline=OUTLINE)
    return im


def pillar():
    im, d = new(1, 2)
    d.rectangle((3, 8, 28, 63), fill=CREAM, outline=OUTLINE)
    d.rectangle((3, 8, 28, 16), fill=MAROON, outline=OUTLINE)
    d.rectangle((6, 22, 25, 58), fill=CREAM_SHADE)
    d.rectangle((1, 2, 30, 8), fill=(120, 44, 40), outline=OUTLINE)
    return im


def gate_arch():
    w, h = 10, 2
    im, d = new(w, h)
    W = w * T
    d.rectangle((6, 6, W - 7, 40), fill=MAROON, outline=OUTLINE)
    d.rectangle((12, 11, W - 13, 35), fill=SIGN_GREEN, outline=CREAM)
    text_center(d, W // 2, 18, "GOVERNMENT ENGINEERING COLLEGE", 10, WHITE)
    text_center(d, W // 2, 29, "BILASPUR (C.G.)", 10, (255, 220, 120))
    d.rectangle((0, 2, W - 1, 7), fill=(120, 44, 40), outline=OUTLINE)
    return im


def signboard(lines, w=3, h=2):
    im, d = new(w, h)
    W, H = w * T, h * T
    d.rectangle((10, H - 20, 13, H - 2), fill=(70, 70, 76))
    d.rectangle((W - 14, H - 20, W - 11, H - 2), fill=(70, 70, 76))
    d.rectangle((2, 4, W - 3, H - 18), fill=SIGN_GREEN, outline=WHITE)
    size = min(fit_text(d, ln, W - 12, 10) for ln in lines)
    step = (H - 24) / len(lines)
    for i, ln in enumerate(lines):
        text_center(d, W // 2, 6 + step * i + step / 2, ln, size, WHITE)
    return im


def load_png(rel, w, h):
    src = Image.open(PUBLIC / rel).convert("RGBA")
    return src.resize((w * T, h * T), Image.NEAREST)


# --------------------------------------------------------------------------- catalogue

ELEMENTS = {}
IMAGES = {}


def element(key, img, layer, static, image_url=None):
    w, h = img.size[0] // T, img.size[1] // T
    ELEMENTS[key] = {
        "id": f"campus-{key}",
        "imageUrl": image_url or f"/campus/{key}.png",
        "width": w,
        "height": h,
        "static": static,
        "layer": layer,
    }
    IMAGES[key] = img
    return key


def build_catalogue():
    element("road-h", road("h"), "floor", False)
    element("road-v", road("v"), "floor", False)
    element("road-x", road("x"), "floor", False)
    element("path", paver(), "floor", False)
    element("plaza", plaza(), "floor", False)
    element("flowerbed", flowerbed(), "floor", False)
    element("lawn", lawn_dark(), "floor", False)
    element("parking", parking(8, 4), "floor", False)
    element("basketball-court", basketball(), "floor", False)
    element("sports-ground", sports_ground(), "floor", False)

    element("wall-h", boundary("h"), "wall", True)
    element("wall-v", boundary("v"), "wall", True)
    element("pond", pond(), "wall", True)
    element("fountain", fountain(), "wall", True)

    element("admin-block", building(12, 6, "ADMINISTRATIVE BLOCK\nGEC BILASPUR", floors=2), "wall", True)
    element("central-library", building(9, 5, "CENTRAL LIBRARY", wall=(236, 214, 170)), "wall", True)
    element("auditorium", building(9, 6, "AUDITORIUM", wall=(226, 200, 176), roof=(176, 120, 110)), "wall", True)
    for key, label in [
        ("dept-civil", "CIVIL ENGG."),
        ("dept-mechanical", "MECHANICAL ENGG."),
        ("dept-mining", "MINING ENGG."),
        ("dept-electrical", "ELECTRICAL ENGG."),
        ("dept-cse", "COMPUTER SCI. ENGG."),
        ("dept-it", "INFORMATION TECH."),
        ("dept-etc", "ELECTRONICS & TELECOM"),
    ]:
        element(key, building(8, 5, label), "wall", True)
    element("workshop", building(9, 5, "CENTRAL WORKSHOP", wall=(208, 208, 200), band=(70, 90, 120),
                                  style="sawtooth"), "wall", True)
    element("canteen", building(6, 4, "CANTEEN", wall=(236, 214, 170), style="tin", floors=1), "wall", True)
    element("dispensary", dispensary(), "wall", True)
    for key, label, wall in [
        ("boys-hostel-1", "BOYS HOSTEL 1", CREAM),
        ("boys-hostel-2", "BOYS HOSTEL 2", CREAM),
        ("first-year-hostel", "FIRST YEAR\nHOSTEL", CREAM),
        ("girls-hostel-1", "GIRLS HOSTEL 1", (244, 214, 206)),
        ("girls-hostel-2", "GIRLS HOSTEL 2", (244, 214, 206)),
    ]:
        w = 6 if key == "first-year-hostel" else 8
        element(key, building(w, 5, label, wall=wall, band=(110, 60, 110) if "girls" in key else MAROON),
                "wall", True)

    element("tree-big", load_png("TreesAndBrushes/Tree1a.png", 2, 3), "objects", True,
            "/TreesAndBrushes/Tree1a.png")
    element("tree-big-2", load_png("TreesAndBrushes/Tree1b.png", 2, 3), "objects", True,
            "/TreesAndBrushes/Tree1b.png")
    element("tree-slim", load_png("TreesAndBrushes/Tree2a.png", 1, 2), "objects", True,
            "/TreesAndBrushes/Tree2a.png")
    element("bush", load_png("TreesAndBrushes/Brush1a.png", 1, 1), "objects", True,
            "/TreesAndBrushes/Brush1a.png")
    element("bush-2", load_png("TreesAndBrushes/Brush2a.png", 1, 1), "objects", True,
            "/TreesAndBrushes/Brush2a.png")
    element("bench", bench(), "objects", True)
    element("lamp", lamp(), "objects", True)
    element("flagpole", flagpole(), "objects", True)
    element("car-red", car((196, 52, 52)), "objects", True)
    element("car-white", car((236, 236, 232)), "objects", True)
    element("car-blue", car((56, 96, 180)), "objects", True)
    element("bikes", bikes(), "objects", True)
    element("dustbin", dustbin(), "objects", True)
    element("gate-pillar", pillar(), "objects", True)
    element("sign-welcome", signboard(["WELCOME TO", "GEC BILASPUR", "KONI, BILASPUR"], 3, 2), "objects", True)
    element("sign-hostels", signboard(["HOSTELS", "BOYS <-  -> GIRLS"], 3, 2), "objects", True)

    element("gate-arch", gate_arch(), "topObjects", False)


# --------------------------------------------------------------------------- layout

PLACEMENTS = []


def put(key, x, y):
    PLACEMENTS.append((key, x, y))


def road_h(x0, x1, y):
    for x in range(x0, x1 + 1, 2):
        put("road-h", x, y)


def road_v(x, y0, y1):
    for y in range(y0, y1 + 1, 2):
        put("road-v", x, y)


def area(key, x0, y0, x1, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(key, x, y)


def door_apron(bx, by, bw, bh):
    """Small paved landing in front of a building's door."""
    cx = bx + bw // 2 - 1
    area("path", cx, by + bh, cx + 1, by + bh)


def door_path(bx, by, bw, bh, to_y):
    """2-wide paver path from a building's front door straight down (or up) to row `to_y`."""
    cx = bx + bw // 2 - 1
    y0, y1 = sorted((by + bh, to_y))
    area("path", cx, y0, cx + 1, y1)


def build_layout():
    W, H = MAP_W, MAP_H

    # --- roads -----------------------------------------------------------------
    road_h(0, W - 2, 52)                   # Korba Road, outside the campus wall
    road_h(4, W - 6, 12)                   # hostel road (north)
    road_h(4, W - 6, 30)                   # academic ring road
    road_v(2, 12, 30)                      # west connector
    road_v(W - 4, 12, 30)                  # east connector
    road_v(37, 32, 50)                     # main avenue from the gate
    for (x, y) in [(2, 12), (2, 30), (W - 4, 12), (W - 4, 30), (37, 30), (37, 52)]:
        put("road-x", x, y)

    # --- boundary wall with the main gate --------------------------------------
    gate_x0, gate_x1 = 34, 41
    for x in range(W):
        put("wall-h", x, 0)
        if not (gate_x0 <= x <= gate_x1 or x in (33, 42)):
            put("wall-h", x, 51)
    for y in range(1, 51):
        put("wall-v", 0, y)
        put("wall-v", W - 1, y)
    put("gate-pillar", 33, 50)
    put("gate-pillar", 42, 50)
    put("gate-arch", 33, 49)
    put("sign-welcome", 43, 47)

    # --- central plaza, admin block, fountain, flag ----------------------------
    area("plaza", 31, 23, 44, 29)
    put("admin-block", 32, 17)
    put("fountain", 36, 24)
    put("flagpole", 41, 24)
    for x in (31, 44):
        put("lamp", x, 23)
        put("lamp", x, 27)
    area("flowerbed", 31, 17, 31, 22)
    area("flowerbed", 44, 17, 44, 22)

    # --- academic zone, west: civil / mechanical / mining / workshop -----------
    area("path", 2, 40, 35, 41)            # west walkway between the two rows
    area("path", 39, 40, 73, 41)           # east walkway
    for key, x in [("dept-civil", 4), ("dept-mechanical", 14), ("dept-mining", 24)]:
        put(key, x, 33)
        door_path(x, 33, 8, 5, 39)
    put("workshop", 4, 43)
    door_apron(4, 43, 9, 5)
    put("dispensary", 15, 44)
    door_apron(15, 44, 5, 4)
    put("parking", 23, 44)
    area("path", 23, 42, 30, 43)
    put("car-red", 24, 45)
    put("car-white", 27, 45)
    put("car-blue", 24, 47)
    put("bikes", 27, 47)

    # --- academic zone, east: CSE / IT / ETC / electrical / canteen / auditorium
    for key, x in [("dept-cse", 41), ("dept-it", 51), ("dept-etc", 61)]:
        put(key, x, 33)
        door_path(x, 33, 8, 5, 39)
    put("dept-electrical", 48, 43)
    door_apron(48, 43, 8, 5)
    put("canteen", 58, 44)
    door_apron(58, 44, 6, 4)
    area("path", 57, 48, 64, 48)
    for x in (58, 61):
        put("bench", x, 49)
    put("auditorium", 66, 42)
    door_apron(66, 42, 9, 6)

    # --- middle band: library, pond garden, basketball, garden -----------------
    put("central-library", 18, 16)
    door_path(18, 16, 9, 5, 29)
    put("pond", 6, 17)
    area("path", 5, 23, 13, 23)
    for x in (6, 10):
        put("bench", x, 24)
    put("basketball-court", 50, 17)
    area("path", 50, 22, 57, 22)
    put("bench", 51, 23)
    put("bench", 55, 23)
    area("lawn", 61, 16, 70, 26)
    area("path", 65, 16, 66, 29)
    for y in (18, 22):
        put("bench", 62, y)
        put("bench", 68, y)
    put("sign-hostels", 36, 13)

    # --- north: hostels + sports ground ----------------------------------------
    put("boys-hostel-1", 3, 2)
    put("boys-hostel-2", 12, 2)
    put("first-year-hostel", 21, 2)
    for (x, w) in [(3, 8), (12, 8), (21, 6)]:
        door_path(x, 2, w, 5, 11)
    put("sports-ground", 28, 1)
    put("girls-hostel-1", 55, 2)
    put("girls-hostel-2", 65, 2)
    for x in (55, 65):
        door_path(x, 2, 8, 5, 11)
    for x in (30, 34, 40, 44):
        put("bench", x, 11)  # spectator benches along the ground
    # green buffer between boys' and girls' blocks
    area("lawn", 49, 2, 53, 9)

    # --- trees: avenue rows, road verges and scattered greenery ----------------
    for y in (32, 36, 44):
        put("tree-big", 35, y)
        put("tree-big-2", 39, y)
    for x in range(6, 30, 5):
        put("tree-slim", x, 28)
    for x in range(46, 72, 5):
        put("tree-slim", x, 28)
    for x in range(6, 70, 7):
        if not 27 <= x <= 49:
            put("tree-big", x, 8)
    for (x, y) in [(2, 45), (2, 36), (13, 46), (21, 48), (46, 48), (73, 34), (49, 5),
                   (51, 7), (14, 25), (26, 24), (47, 24), (29, 16), (58, 26), (15, 13)]:
        put("tree-big" if (x + y) % 2 else "tree-big-2", x, y)
    for (x, y) in [(12, 38), (22, 38), (32, 38), (49, 38), (59, 38), (69, 38), (29, 13), (46, 13),
                   (13, 20), (28, 21), (48, 21), (58, 17), (11, 48), (56, 49), (65, 49), (1, 49)]:
        put("bush" if x % 2 else "bush-2", x, y)
    for (x, y) in [(34, 39), (41, 39), (22, 43), (57, 43), (63, 29), (12, 29)]:
        put("dustbin", x, y)
    for x in range(8, 70, 12):
        if not 33 <= x <= 43:
            put("lamp", x, 38)


# --------------------------------------------------------------------------- output

def footprint_blocked():
    """Tiles blocked for movement, using the same rules as the game."""
    blocked = set()
    for key, x, y in PLACEMENTS:
        e = ELEMENTS[key]
        if not e["static"]:
            continue
        if e["layer"] == "wall":
            rows = range(y, y + e["height"])
        elif e["layer"] == "objects":
            rows = range(y + e["height"] - 1, y + e["height"])
        else:
            continue
        for yy in rows:
            for xx in range(x, x + e["width"]):
                blocked.add((xx, yy))
    return blocked


def render_preview():
    W, H = MAP_W * T, MAP_H * T
    canvas = Image.new("RGBA", (W, H))
    grass = Image.open(PUBLIC / "Tiles/BasicTiles8.png").convert("RGBA")
    tuft = Image.open(PUBLIC / "Tiles/BasicTiles22.png").convert("RGBA")
    r = random.Random(7)
    for ty in range(MAP_H):
        for tx in range(MAP_W):
            canvas.alpha_composite(tuft if r.random() < 0.12 else grass, (tx * T, ty * T))
    order = {"floor": 0, "wall": 1, "objects": 2, "topObjects": 3}
    placed = sorted(PLACEMENTS, key=lambda p: (order[ELEMENTS[p[0]]["layer"]],
                                               p[2] + ELEMENTS[p[0]]["height"]))
    for key, x, y in placed:
        canvas.alpha_composite(IMAGES[key], (x * T, y * T))
    return canvas


def validate():
    errors = []
    for key, x, y in PLACEMENTS:
        e = ELEMENTS[key]
        if x < 0 or y < 0 or x + e["width"] > MAP_W or y + e["height"] > MAP_H:
            errors.append(f"{key} at {x},{y} is out of bounds")
    # wall-layer footprints must not overlap each other
    seen = {}
    for key, x, y in PLACEMENTS:
        e = ELEMENTS[key]
        if e["layer"] != "wall":
            continue
        for yy in range(y, y + e["height"]):
            for xx in range(x, x + e["width"]):
                if (xx, yy) in seen and seen[(xx, yy)] != key:
                    errors.append(f"{key} overlaps {seen[(xx, yy)]} at {xx},{yy}")
                seen[(xx, yy)] = key
    blocked = footprint_blocked()
    if SPAWN in blocked:
        errors.append("spawn tile is blocked")
    # every building door must be reachable from the spawn
    reach = {SPAWN}
    stack = [SPAWN]
    while stack:
        cx, cy = stack.pop()
        for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
            if 0 <= nx < MAP_W and 0 <= ny < MAP_H and (nx, ny) not in blocked and (nx, ny) not in reach:
                reach.add((nx, ny))
                stack.append((nx, ny))
    for key, x, y in PLACEMENTS:
        e = ELEMENTS[key]
        if e["layer"] == "wall" and e["height"] >= 3 and not key.startswith(("pond", "fountain")):
            door = (x + e["width"] // 2, y + e["height"])
            if door not in reach:
                errors.append(f"door of {key} at {door} is unreachable from spawn")
    return errors, len(reach)


SPAWN = (37, 48)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    build_catalogue()
    build_layout()
    errors, reachable = validate()
    if errors:
        raise SystemExit("Layout errors:\n  " + "\n  ".join(errors))

    for key, img in IMAGES.items():
        if ELEMENTS[key]["imageUrl"].startswith("/campus/"):
            img.save(OUT_DIR / f"{key}.png", optimize=True)

    preview = render_preview()
    preview.convert("RGB").save(PREVIEW, optimize=True)
    thumb = preview.resize((MAP_W * 8, MAP_H * 8), Image.LANCZOS).convert("RGB")
    thumb.save(OUT_DIR / "gec-bilaspur-thumb.png", optimize=True)

    MAP_JSON.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "map": {
            "id": MAP_ID,
            "name": MAP_NAME,
            "width": MAP_W,
            "height": MAP_H,
            "thumbnail": "/campus/gec-bilaspur-thumb.png",
            "spawnX": SPAWN[0],
            "spawnY": SPAWN[1],
        },
        "elements": list(ELEMENTS.values()),
        "placements": [{"elementId": ELEMENTS[k]["id"], "x": x, "y": y} for k, x, y in PLACEMENTS],
    }
    MAP_JSON.write_text(json.dumps(data, indent=1) + "\n")
    print(f"{len(ELEMENTS)} elements, {len(PLACEMENTS)} placements, {reachable} reachable tiles")


if __name__ == "__main__":
    main()
