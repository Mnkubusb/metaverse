"""Roads drawn at pixel level along the real OSM lines, then cut into tiles.

Autotiling 32 px tiles can only follow the grid, which turns a 45° road into a
staircase. Instead the whole road network is painted once as an image (sidewalk
band, asphalt, lane dashes), sliced into 32 px tiles, and identical tiles are
deduplicated into elements named by their pixel hash. Cells get their walkable
class from how much asphalt / sidewalk covers them.
"""
import hashlib
import io
import math
import random

from PIL import Image, ImageChops, ImageDraw

from .raster import snap45

T = 32
ASPHALT = (74, 76, 82, 255)
ASPHALT_EDGE = (58, 60, 66, 255)
SIDEWALK = (176, 178, 172, 255)
SIDEWALK_EDGE = (150, 152, 146, 255)
DASH = (236, 236, 228, 255)
# surface texture laid over the flat colours by texture()
ASPHALT_GRIT = [(84, 86, 92, 255), (84, 86, 92, 255), (66, 68, 74, 255), (98, 99, 104, 255)]
SLAB_JOINT = (158, 160, 154, 255)
SLAB_LIGHT = (188, 190, 184, 255)
SLAB_SPECKS = [(168, 170, 164, 255), (184, 186, 180, 255)]

# Terrain painted on the same image (the Bilaspur place maps): water, sand banks, fields,
# dirt grounds, railway tracks, station platforms, foot over-bridges and fences. Every colour
# is unique so classify_terrain() can read the cell kind back from the pixels.
WATER = (64, 122, 160, 255)
WATER_EDGE = (46, 96, 130, 255)
SHORE = (206, 188, 142, 255)
SAND = (222, 204, 160, 255)
DIRT = (190, 152, 104, 255)
FIELD = (118, 170, 72, 255)
FIELD_ROW = (98, 150, 60, 255)
BALLAST = (124, 116, 108, 255)
SLEEPER = (98, 74, 54, 255)
RAIL = (186, 190, 196, 255)
PLATFORM = (200, 196, 186, 255)
PLATFORM_EDGE = (232, 196, 64, 255)
DECK = (76, 112, 168, 255)
DECK_EDGE = (52, 80, 124, 255)
FENCE = (88, 66, 46, 255)
TERRAIN_KINDS = ("field", "sand", "dirt", "water", "platform", "rail", "fob", "fence", "trail")
SIDEWALK_TILES = 1.0   # sidewalk band on each side, in tiles
DASH_LEN, DASH_GAP = 16, 16


def _segments(points):
    for (ax, ay), (bx, by) in zip(points, points[1:]):
        yield ax * T, ay * T, bx * T, by * T


def _stroke(draw, points, width_px, fill):
    pts = [(x * T, y * T) for x, y in points]
    draw.line(pts, fill=fill, width=int(width_px), joint="curve")
    r = width_px / 2
    for x, y in pts:  # round caps + joints
        draw.ellipse((x - r, y - r, x + r, y + r), fill=fill)


def _dashes(draw, points, width_px):
    """Lane dashes on axis-aligned legs only, phased to the tile grid (period = one tile)
    so every dashed tile is the same tile; diagonal legs stay plain."""
    for ax, ay, bx, by in _segments(points):
        if ax != bx and ay != by:
            continue
        if ay == by:
            lo, hi = sorted((ax, bx))
            start = math.floor(lo / T) * T
            for d in range(int(start), int(hi), T):
                x0, x1 = max(d + DASH_GAP // 2, lo), min(d + DASH_GAP // 2 + DASH_LEN, hi)
                if x1 > x0:
                    draw.line((x0, ay, x1, ay), fill=DASH, width=width_px)
        else:
            lo, hi = sorted((ay, by))
            start = math.floor(lo / T) * T
            for d in range(int(start), int(hi), T):
                y0, y1 = max(d + DASH_GAP // 2, lo), min(d + DASH_GAP // 2 + DASH_LEN, hi)
                if y1 > y0:
                    draw.line((ax, y0, ax, y1), fill=DASH, width=width_px)


class _Snapped:
    """A road feature with its centreline snapped to 45°/90° legs through tile centres."""

    def __init__(self, f):
        self.width = f.width
        self.points = snap45(f.points)


def _px(points):
    return [(x * T, y * T) for x, y in points]


def _rail(draw, points):
    """One track along the polyline: ballast bed, sleepers every 8 px, two steel rails."""
    pts = _px(points)
    draw.line(pts, fill=BALLAST, width=28, joint="curve")
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        length = math.hypot(bx - ax, by - ay)
        if not length:
            continue
        ux, uy = (bx - ax) / length, (by - ay) / length
        nx, ny = -uy, ux
        for k in range(0, int(length) + 1, 8):
            cx, cy = ax + ux * k, ay + uy * k
            draw.line((cx - nx * 11, cy - ny * 11, cx + nx * 11, cy + ny * 11), fill=SLEEPER, width=3)
        for off in (-7, 7):
            draw.line((ax + nx * off, ay + ny * off, bx + nx * off, by + ny * off), fill=RAIL, width=2)


def _fence(draw, points):
    pts = _px(points)
    draw.line(pts, fill=FENCE, width=3)
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        length = math.hypot(bx - ax, by - ay)
        for k in range(0, int(length) + 1, 16):
            t = k / length if length else 0
            x, y = ax + (bx - ax) * t, ay + (by - ay) * t
            draw.rectangle((x - 2, y - 2, x + 2, y + 2), fill=FENCE)


def render_terrain(d, features):
    """Terrain under the roads, in painting order."""
    for kind, fill in (("field", FIELD), ("sand", SAND), ("dirt", DIRT)):
        for f in features:
            if f.kind == kind:
                d.polygon(_px(f.points), fill=fill)
    for f in features:
        if f.kind == "trail":  # footpaths: dirt, or paving slabs when sub == "paved"
            fill = SIDEWALK if f.sub == "paved" else DIRT
            pts = _px(f.points)
            r = f.width * T / 2
            d.line(pts, fill=fill, width=int(f.width * T), joint="curve")
            for x, y in pts:
                d.ellipse((x - r, y - r, x + r, y + r), fill=fill)
    for f in features:
        if f.kind == "water":
            d.line(_px(f.points), fill=SHORE, width=16, joint="curve")
    for f in features:
        if f.kind == "water":
            d.polygon(_px(f.points), fill=WATER)
            d.line(_px(f.points), fill=WATER_EDGE, width=4, joint="curve")
    for f in features:
        if f.kind == "platform":
            d.polygon(_px(f.points), fill=PLATFORM)
            d.line(_px(f.points), fill=PLATFORM_EDGE, width=4)
    for f in features:
        if f.kind == "rail":
            _rail(d, f.points)


def render_overlays(d, features):
    """Drawn over the roads: foot over-bridges (walkable decks across the tracks) and fences."""
    for f in features:
        if f.kind == "fob":
            pts = _px(f.points)
            d.line(pts, fill=DECK_EDGE, width=30)
            d.line(pts, fill=DECK, width=24)
    for f in features:
        if f.kind == "fence":
            _fence(d, f.points)


def render(features, width, height):
    """RGBA image of every road feature, (width*T) x (height*T). Transparent off-road."""
    im = Image.new("RGBA", (width * T, height * T), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    render_terrain(d, features)
    roads = [_Snapped(f) for f in features if f.kind == "road"]
    for f in roads:  # sidewalks first so asphalt covers their inner edge
        _stroke(d, f.points, (f.width + 2 * SIDEWALK_TILES) * T + 4, SIDEWALK_EDGE)
    for f in roads:
        _stroke(d, f.points, (f.width + 2 * SIDEWALK_TILES) * T, SIDEWALK)
    for f in roads:
        _stroke(d, f.points, f.width * T + 4, ASPHALT_EDGE)
    for f in roads:
        _stroke(d, f.points, f.width * T, ASPHALT)
    for f in roads:
        if f.width >= 3:
            _dashes(d, f.points, 3)
    render_overlays(d, features)
    return im


def _pattern(fill, paint):
    """One 32 px tile of surface texture; paint(px, rng) marks it up."""
    tile = Image.new("RGBA", (T, T), fill)
    paint(tile.load(), random.Random(7))
    return tile


def _asphalt_grit(px, rng):
    for _ in range(70):
        px[rng.randrange(T), rng.randrange(T)] = rng.choice(ASPHALT_GRIT)


def _paving_slabs(px, rng):
    for y in range(T):
        for x in range(T):
            if x % 16 == 0 or y % 16 == 0:
                px[x, y] = SLAB_JOINT
            elif x % 16 == 1 or y % 16 == 1:
                px[x, y] = SLAB_LIGHT
    for _ in range(14):
        x, y = rng.randrange(T), rng.randrange(T)
        if x % 16 > 1 and y % 16 > 1:
            px[x, y] = rng.choice(SLAB_SPECKS)


def _ripples(px, rng):
    for _ in range(5):
        x, y = rng.randrange(2, T - 8), rng.randrange(2, T - 2)
        for k in range(rng.randint(3, 6)):
            px[x + k, y] = (96, 150, 186, 255)
    for _ in range(18):
        px[rng.randrange(T), rng.randrange(T)] = rng.choice([(58, 114, 152, 255), (72, 132, 170, 255)])


def _grains(colours):
    def paint(px, rng):
        for _ in range(60):
            px[rng.randrange(T), rng.randrange(T)] = rng.choice(colours)
    return paint


def _furrows(px, rng):
    for y in range(T):
        if y % 6 in (0, 1):
            for x in range(T):
                px[x, y] = FIELD_ROW
    for _ in range(30):
        px[rng.randrange(T), rng.randrange(T)] = (136, 186, 84, 255)


def _slabs_light(px, rng):
    for y in range(T):
        for x in range(T):
            if x % 16 == 0 or y % 16 == 0:
                px[x, y] = (178, 174, 166, 255)


def _ballast(px, rng):
    for _ in range(90):
        px[rng.randrange(T), rng.randrange(T)] = rng.choice([(110, 102, 96, 255), (140, 132, 122, 255)])


def _mask(im, colour):
    """L mask: 255 where im is exactly `colour` (RGB), else 0."""
    solid = Image.new("RGB", im.size, colour[:3])
    diff = ImageChops.difference(im.convert("RGB"), solid).convert("L")
    return diff.point(lambda v: 255 if v == 0 else 0)


def texture(im):
    """Grit on the asphalt and slab joints on the sidewalk. Run after classify(), which
    needs the flat colours. The patterns repeat every tile and line up with the tile grid,
    so identical tiles stay identical and slice_tiles() still deduplicates them."""
    out = im.copy()
    patterns = [(ASPHALT, _pattern(ASPHALT, _asphalt_grit)), (SIDEWALK, _pattern(SIDEWALK, _paving_slabs)),
                (WATER, _pattern(WATER, _ripples)),
                (SAND, _pattern(SAND, _grains([(210, 192, 148, 255), (232, 216, 176, 255)]))),
                (SHORE, _pattern(SHORE, _grains([(194, 176, 130, 255), (216, 198, 154, 255)]))),
                (DIRT, _pattern(DIRT, _grains([(176, 138, 92, 255), (204, 168, 120, 255)]))),
                (FIELD, _pattern(FIELD, _furrows)),
                (PLATFORM, _pattern(PLATFORM, _slabs_light)),
                (BALLAST, _pattern(BALLAST, _ballast))]
    colours = im.getcolors(1 << 16)
    present = {c[:3] for _, c in colours} if colours else None
    for colour, pattern in patterns:
        if present is not None and colour[:3] not in present:
            continue
        layer = Image.new("RGBA", im.size)
        for y in range(0, im.height, T):
            for x in range(0, im.width, T):
                layer.paste(pattern, (x, y))
        out.paste(layer, (0, 0), _mask(im, colour))
    return out


def slice_tiles(im, art=None):
    """-> (tiles: hash -> PNG bytes, cells: (x, y) -> hash) for every non-empty tile.
    Tiles are keyed by the flat image `im` but written from `art` (the textured image,
    default im). Texture is a pure function of the flat tile, so keys, element ids and the
    map JSON stay the same when only the surface art changes, and spaces aren't rebuilt."""
    art = art or im
    tiles, cells = {}, {}
    w, h = im.width // T, im.height // T
    for y in range(h):
        for x in range(w):
            box = (x * T, y * T, (x + 1) * T, (y + 1) * T)
            tile = im.crop(box)
            if not tile.getbbox():
                continue
            raw = tile.tobytes()
            key = hashlib.sha1(raw).hexdigest()[:10]
            if key not in tiles:
                buf = io.BytesIO()
                art.crop(box).save(buf, "PNG", optimize=True)
                tiles[key] = buf.getvalue()
            cells[(x, y)] = key
    return tiles, cells


def _coverage(tile, colours):
    px = tile.load()
    n = 0
    for y in range(T):
        for x in range(T):
            p = px[x, y]
            if p[3] > 0 and p[:3] in colours:
                n += 1
    return n / (T * T)


def _coverage_grid(im, colours):
    """Fraction (0..255) of each tile covered by any of `colours`, as an L image one pixel per tile."""
    union = Image.new("L", im.size, 0)
    for c in colours:
        union = ImageChops.lighter(union, _mask(im, c))
    return union.reduce(T)


def classify_terrain(im, grid):
    """Mark terrain cells from the painted image (run after classify(), which does roads).
    Water, tracks and fences block movement; the rest are walkable ground."""
    present = {c[:3] for _, c in (im.getcolors(1 << 16) or [])}
    if not present & {WATER[:3], SAND[:3], DIRT[:3], FIELD[:3], BALLAST[:3], PLATFORM[:3], DECK[:3], FENCE[:3]}:
        return
    cov = {
        "water": _coverage_grid(im, [WATER, WATER_EDGE]),
        "fob": _coverage_grid(im, [DECK, DECK_EDGE]),
        "rail": _coverage_grid(im, [BALLAST, SLEEPER, RAIL]),
        "fence": _coverage_grid(im, [FENCE]),
        "platform": _coverage_grid(im, [PLATFORM, PLATFORM_EDGE]),
        "sand": _coverage_grid(im, [SAND, SHORE]),
        "dirt": _coverage_grid(im, [DIRT]),
        "field": _coverage_grid(im, [FIELD]),
    }
    rules = (("fob", 70), ("water", 128), ("rail", 100), ("fence", 1), ("platform", 128), ("dirt", 128), ("sand", 128), ("field", 128))
    for y in range(grid.height):
        for x in range(grid.width):
            if grid.get(x, y) not in ("grass",):
                continue
            for kind, threshold in rules:
                if cov[kind].getpixel((x, y)) >= threshold:
                    grid.set(x, y, kind)
                    break


def classify(im, grid):
    """Mark grid cells: >= half asphalt -> road; else >= half paved -> sidewalk."""
    asphalt = {ASPHALT[:3], ASPHALT_EDGE[:3], DASH[:3]}
    paved = asphalt | {SIDEWALK[:3], SIDEWALK_EDGE[:3]}
    for y in range(grid.height):
        for x in range(grid.width):
            tile = im.crop((x * T, y * T, (x + 1) * T, (y + 1) * T))
            if not tile.getbbox():
                continue
            if _coverage(tile, asphalt) >= 0.5:
                grid.set(x, y, "road")
            elif _coverage(tile, paved) >= 0.5 and grid.get(x, y) == "grass":
                grid.set(x, y, "sidewalk")
