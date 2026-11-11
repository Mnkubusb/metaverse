"""Hand-painted ground tiles and the large-scale tint that breaks up tiling.

The Tiny Town grass tiles are a single flat green (two of the four variants were
the same tile), so a field of them reads as a texture swatch, not ground. These
are painted at the packs' 16 px resolution and doubled, so they sit in the same
pixel grid as the rest of the art:

  grass-a  plain grass with a few lighter/darker blades
  grass-b  grass tufts
  grass-c  wildflowers
  grass-d  a darker clover patch
  flowerbed  the lawn tile with a cluster of flowers

Every mark stays one logical pixel clear of the tile edge, so neighbours never
show a seam whichever variant lands next to them.

`ground_tint` is the low-frequency light/shade wash laid over outdoor grass;
spaceGrid.tsx groundTint() draws the same field in the browser.
"""
import math
import random

from PIL import Image

T = 32
S = 16  # logical pixels per tile; doubled to 32 on save

BASE = (132, 198, 105, 255)
LIGHT = (146, 210, 115, 255)
DARK = (118, 183, 95, 255)
BLADE = (98, 160, 84, 255)
BLADE_HI = (160, 222, 128, 255)
CLOVER = (121, 188, 99, 255)
CLOVER_DARK = (108, 174, 91, 255)

PETALS = [
    ((250, 246, 236, 255), (246, 196, 72, 255)),   # daisy: white petals, yellow eye
    ((248, 190, 76, 255), (226, 128, 40, 255)),    # marigold
    ((236, 150, 180, 255), (250, 232, 160, 255)),  # pink
    ((170, 156, 232, 255), (250, 240, 200, 255)),  # lilac
]


def _canvas(fill):
    return Image.new("RGBA", (S, S), fill)


def _inner(rng, margin=1):
    return rng.randint(margin, S - 1 - margin), rng.randint(margin, S - 1 - margin)


def _specks(px, rng, n, colours):
    for _ in range(n):
        x, y = _inner(rng)
        px[x, y] = rng.choice(colours)


def _tuft(px, x, y):
    """A three-blade tuft: a dark V with a light tip on the middle blade."""
    for dx, dy in ((-1, 0), (1, 0), (0, 0), (-1, -1), (1, -1), (0, -2)):
        if 1 <= x + dx < S - 1 and 1 <= y + dy < S - 1:
            px[x + dx, y + dy] = BLADE
    if 1 <= y - 2 < S - 1:
        px[x, y - 2] = BLADE_HI


def _flower(px, x, y, petals):
    petal, eye = petals
    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        px[x + dx, y + dy] = petal
    px[x, y] = eye
    if y + 2 < S - 1:
        px[x, y + 2] = BLADE  # stem shadow


def _save(im):
    return im.resize((T, T), Image.NEAREST)


def grass_plain(seed=11):
    rng = random.Random(seed)
    im = _canvas(BASE)
    px = im.load()
    _specks(px, rng, 9, [LIGHT, LIGHT, DARK])
    return _save(im)


def grass_tufts(seed=12):
    rng = random.Random(seed)
    im = _canvas(BASE)
    px = im.load()
    _specks(px, rng, 5, [LIGHT, DARK])
    for x, y in ((4, 6), (11, 4), (8, 12)):
        _tuft(px, x + rng.randint(-1, 1), y + rng.randint(-1, 1))
    return _save(im)


def grass_flowers(seed=13):
    rng = random.Random(seed)
    im = _canvas(BASE)
    px = im.load()
    _specks(px, rng, 5, [LIGHT, DARK])
    _flower(px, 4, 4, PETALS[0])
    _flower(px, 11, 9, rng.choice(PETALS[1:]))
    _tuft(px, 5, 13)
    return _save(im)


def grass_clover(seed=14):
    """A soft-edged darker patch: solid core, dithered rim, so it fades into the base."""
    rng = random.Random(seed)
    im = _canvas(BASE)
    px = im.load()
    cx, cy, r = 7.5, 7.5, 5.6
    for y in range(1, S - 1):
        for x in range(1, S - 1):
            d = math.hypot(x - cx, (y - cy) * 1.15)
            if d < r - 1.6:
                px[x, y] = CLOVER
            elif d < r and (x + y) % 2 == 0:
                px[x, y] = CLOVER
    for _ in range(6):  # leaf shadows inside the patch
        x, y = rng.randint(4, 11), rng.randint(4, 11)
        px[x, y] = CLOVER_DARK
    _specks(px, rng, 3, [LIGHT])
    return _save(im)


def flowerbed(lawn_tile, seed=15):
    """The lawn tile (already 32 px) with a small cluster of flowers."""
    rng = random.Random(seed)
    im = lawn_tile.convert("RGBA").resize((S, S), Image.NEAREST)
    px = im.load()
    for x, y in ((4, 4), (11, 6), (6, 11)):
        _flower(px, x, y, rng.choice(PETALS))
    return _save(im)


def paint_ground(public_campus_dir):
    """Overwrite the sliced grass/flowerbed tiles with the painted ones."""
    tiles = {
        "grass-a": grass_plain(),
        "grass-b": grass_tufts(),
        "grass-c": grass_flowers(),
        "grass-d": grass_clover(),
    }
    lawn = public_campus_dir / "lawn.png"
    if lawn.exists():
        tiles["flowerbed"] = flowerbed(Image.open(lawn))
    for name, im in tiles.items():
        im.save(public_campus_dir / f"{name}.png", optimize=True)
    return sorted(tiles)


# ----------------------------------------------------------------------------- large-scale tint

TINT_CELL = 6  # tiles between noise lattice points


def _hash(ix, iy):
    """Deterministic 0..1 per lattice point; same integer math as spaceGrid.tsx tintHash()."""
    n = (ix * 374761393 + iy * 668265263) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 0xFFFF


def tint_lattice(width, height):
    """Noise values on a coarse lattice covering the map: (cols, rows, values row-major)."""
    cols = width // TINT_CELL + 2
    rows = height // TINT_CELL + 2
    return cols, rows, [_hash(x, y) for y in range(rows) for x in range(cols)]


def ground_tint(width, height):
    """RGBA wash, (width*T) x (height*T): darker, cooler green where the noise is low,
    warm sunlit green where it is high, clear in between. Smoothly interpolated."""
    cols, rows, vals = tint_lattice(width, height)
    small = Image.new("RGBA", (cols, rows))
    px = small.load()
    for y in range(rows):
        for x in range(cols):
            v = vals[y * cols + x]
            if v < 0.5:
                a = round((0.5 - v) * 2 * 46)
                px[x, y] = (34, 74, 40, a)
            else:
                a = round((v - 0.5) * 2 * 34)
                px[x, y] = (226, 236, 140, a)
    # lattice point i sits at tile i*TINT_CELL; scale so the interpolation lines up
    big = small.resize((cols * TINT_CELL * T, rows * TINT_CELL * T), Image.BILINEAR)
    return big.crop((0, 0, width * T, height * T))
