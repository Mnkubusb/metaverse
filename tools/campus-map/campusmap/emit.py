"""Seed JSON, sign/arch sprites and preview rendering."""
from PIL import Image, ImageDraw, ImageFont

from .reach import blocked_tiles, unreachable_doors

T = 32
ELEMENT_PREFIX = "campus-"
SIGN_BG = (30, 98, 72, 255)
SIGN_EDGE = (18, 60, 44, 255)
ARCH_BG = (140, 52, 48, 255)
WHITE = (250, 250, 246, 255)

FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
]


def _font(size):
    for path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _fit(d, text, max_w, start=14, min_size=7):
    size = start
    while size > min_size:
        x0, _, x1, _ = d.textbbox((0, 0), text, font=_font(size))
        if x1 - x0 <= max_w:
            break
        size -= 1
    return _font(size)


def _board(text, w_tiles, h_tiles, bg, edge):
    im = Image.new("RGBA", (w_tiles * T, h_tiles * T), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 2, im.width - 1, im.height - 3), fill=bg, outline=edge, width=2)
    d.fontmode = "1"
    f = _fit(d, text, im.width - 10)
    x0, y0, x1, y1 = d.textbbox((0, 0), text, font=f)
    d.text(((im.width - (x1 - x0)) / 2 - x0, (im.height - (y1 - y0)) / 2 - y0), text, font=f, fill=WHITE)
    return im


def render_sign(text, w_tiles, h_tiles):
    return _board(text, w_tiles, h_tiles, SIGN_BG, SIGN_EDGE)


def render_arch(text, w_tiles, h_tiles):
    return _board(text, w_tiles, h_tiles, ARCH_BG, SIGN_EDGE)


def element_id(key):
    return ELEMENT_PREFIX + key.replace(":", "-")


def to_json(lay, map_id, name, thumbnail):
    used = {p.key for p in lay.placements}
    elements = [
        {"id": element_id(e.key), "imageUrl": e.image_url, "width": e.width, "height": e.height,
         "static": e.static, "layer": e.layer}
        for e in lay.elements.values() if e.key in used
    ]
    return {
        "map": {"id": map_id, "name": name, "width": lay.width, "height": lay.height,
                "thumbnail": thumbnail, "spawnX": lay.spawn[0], "spawnY": lay.spawn[1]},
        "elements": elements,
        "placements": [{"elementId": element_id(p.key), "x": p.x, "y": p.y} for p in lay.placements],
    }


def sprite_file(e):
    return e.image_url.rsplit("/", 1)[-1]


def validate(lay, public_campus_dir):
    errors = []
    for e in lay.elements.values():
        if not (public_campus_dir / sprite_file(e)).exists():
            errors.append(f"missing sprite {sprite_file(e)}")
    for p in lay.placements:
        e = lay.elements[p.key]
        if p.x < 0 or p.y < 0 or p.x + e.width > lay.width or p.y + e.height > lay.height:
            errors.append(f"{p.key} at {p.x},{p.y} is out of bounds")
    seen = {}
    for p in lay.placements:
        e = lay.elements[p.key]
        if e.layer != "wall":
            continue
        for y in range(p.y, p.y + e.height):
            for x in range(p.x, p.x + e.width):
                if (x, y) in seen:
                    errors.append(f"{p.key} overlaps {seen[(x, y)]} at {x},{y}")
                seen[(x, y)] = p.key
    if lay.spawn in blocked_tiles(lay):
        errors.append("spawn tile is blocked")
    for name in unreachable_doors(lay):
        errors.append(f"door of {name} is unreachable from spawn")
    return errors


def render_preview(lay, public_campus_dir):
    canvas = Image.new("RGBA", (lay.width * T, lay.height * T), (0, 0, 0, 0))
    # grass base with the same deterministic tuft scatter as spaceGrid.tsx renderBackground
    grass = public_campus_dir / "grass.png"
    if grass.exists():
        g = Image.open(grass).convert("RGBA")
        tuft_path = public_campus_dir / "grass-tuft.png"
        tuft = Image.open(tuft_path).convert("RGBA") if tuft_path.exists() else g
        for y in range(lay.height):
            for x in range(lay.width):
                canvas.alpha_composite(tuft if (x * 7919 + y * 104729) % 100 < 12 else g, (x * T, y * T))
    cache = {}
    order = {"floor": 0, "wall": 1, "objects": 2, "topObjects": 3}
    placed = sorted(lay.placements, key=lambda p: (order[lay.elements[p.key].layer], p.y + lay.elements[p.key].height))
    for p in placed:
        e = lay.elements[p.key]
        if p.key not in cache:
            cache[p.key] = Image.open(public_campus_dir / sprite_file(e)).convert("RGBA")
        canvas.alpha_composite(cache[p.key], (p.x * T, p.y * T))
    return canvas


def interior_to_json(m):
    """Same shape as the campus map (map / elements / placements) plus the interior's spawn."""
    used = {p.key for p in m.placements}
    return {
        "map": {"id": m.map_id, "name": m.name, "width": m.width, "height": m.height,
                "thumbnail": "/Office/floor-tile.png", "spawnX": m.spawn[0], "spawnY": m.spawn[1]},
        "elements": [
            {"id": element_id(e.key), "imageUrl": e.image_url, "width": e.width, "height": e.height,
             "static": e.static, "layer": e.layer}
            for e in m.elements.values() if e.key in used
        ],
        "placements": [{"elementId": element_id(p.key), "x": p.x, "y": p.y} for p in m.placements],
    }


def portal_to_json(pt):
    return {"mapId": pt.map_id, "x": pt.x, "y": pt.y, "width": pt.width, "height": pt.height,
            "targetMapId": pt.target_map_id, "targetX": pt.target_x, "targetY": pt.target_y}


FOREST_VARIANTS = ["forest-a", "forest-b", "forest-c"]


def render_forest_blocks(public_campus_dir, rng, trees_per_block=9):
    """3x3-tile canopy sprites composited from the roadside tree sprites; written next to
    the sliced tiles so the map can cover large forest areas with few placements."""
    trees = [Image.open(public_campus_dir / f"{n}.png").convert("RGBA") for n in ("tree-a", "tree-b")]
    names = []
    for name in FOREST_VARIANTS:
        im = Image.new("RGBA", (3 * T, 3 * T), (0, 0, 0, 0))
        spots = [(cx, cy) for cy in range(3) for cx in range(3)]
        rng.shuffle(spots)
        for cx, cy in sorted(spots[:trees_per_block], key=lambda s: s[1]):  # back rows first
            tree = rng.choice(trees)
            x = cx * T + rng.randint(-6, 6)
            y = cy * T - T + rng.randint(-4, 4)  # trees are 2 tall; their bottom row is the cell
            im.alpha_composite(tree, (max(0, min(3 * T - tree.width, x)), max(0, min(3 * T - tree.height, y))))
        im.save(public_campus_dir / f"{name}.png", optimize=True)
        names.append(name)
    return names
