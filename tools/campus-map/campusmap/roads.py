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

from PIL import Image, ImageDraw

from .raster import snap45

T = 32
ASPHALT = (74, 76, 82, 255)
ASPHALT_EDGE = (58, 60, 66, 255)
SIDEWALK = (176, 178, 172, 255)
SIDEWALK_EDGE = (150, 152, 146, 255)
DASH = (236, 236, 228, 255)
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


def render(features, width, height):
    """RGBA image of every road feature, (width*T) x (height*T). Transparent off-road."""
    im = Image.new("RGBA", (width * T, height * T), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
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
    return im


def slice_tiles(im):
    """-> (tiles: hash -> PNG bytes, cells: (x, y) -> hash) for every non-empty tile."""
    tiles, cells = {}, {}
    w, h = im.width // T, im.height // T
    for y in range(h):
        for x in range(w):
            tile = im.crop((x * T, y * T, (x + 1) * T, (y + 1) * T))
            if not tile.getbbox():
                continue
            raw = tile.tobytes()
            key = hashlib.sha1(raw).hexdigest()[:10]
            if key not in tiles:
                buf = io.BytesIO()
                tile.save(buf, "PNG", optimize=True)
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
