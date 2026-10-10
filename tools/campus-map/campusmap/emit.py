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


def to_json(lay, map_id, name, thumbnail, areas=()):
    used = {p.key for p in lay.placements}
    elements = [
        {"id": element_id(e.key), "imageUrl": e.image_url, "width": e.width, "height": e.height,
         "static": e.static, "layer": e.layer}
        for e in lay.elements.values() if e.key in used
    ]

    def placement(p):
        d = {"elementId": element_id(p.key), "x": p.x, "y": p.y, "area": p.area}
        if p.to:
            d["toArea"], d["toX"], d["toY"] = p.to
        return d

    return {
        "map": {"id": map_id, "name": name, "width": lay.width, "height": lay.height,
                "thumbnail": thumbnail, "spawnX": lay.spawn[0], "spawnY": lay.spawn[1], "areas": list(areas)},
        "elements": elements,
        "placements": [placement(p) for p in lay.placements],
    }


def sprite_file(e):
    return e.image_url.rsplit("/", 1)[-1]


def _area_view(lay, area_id, size, spawn):
    """A Layout-like view of one area so the reach helpers work per area."""
    from .layout import Layout
    v = Layout(size[0], size[1])
    v.elements = lay.elements
    v.placements = [p for p in lay.placements if p.area == area_id]
    v.spawn = spawn
    return v


def validate(lay, public_campus_dir, areas=()):
    errors = []
    for e in lay.elements.values():
        if not (public_campus_dir / sprite_file(e)).exists():
            errors.append(f"missing sprite {sprite_file(e)}")
    sizes = {"main": (lay.width, lay.height), **{a["id"]: (a["width"], a["height"]) for a in areas}}
    spawns = {"main": lay.spawn, **{a["id"]: (a["spawnX"], a["spawnY"]) for a in areas}}
    for p in lay.placements:
        e = lay.elements[p.key]
        w, h = sizes.get(p.area, (0, 0))
        if p.x < 0 or p.y < 0 or p.x + e.width > w or p.y + e.height > h:
            errors.append(f"{p.key} at {p.x},{p.y} in {p.area} is out of bounds")
    seen = {}
    for p in lay.placements:
        e = lay.elements[p.key]
        if e.layer != "wall":
            continue
        for y in range(p.y, p.y + e.height):
            for x in range(p.x, p.x + e.width):
                if (p.area, x, y) in seen:
                    errors.append(f"{p.key} overlaps {seen[(p.area, x, y)]} at {x},{y} in {p.area}")
                seen[(p.area, x, y)] = p.key
    # reachability per area, from that area's spawn
    from .reach import _flood
    reach = {}
    for area_id, size in sizes.items():
        view = _area_view(lay, area_id, size, spawns[area_id])
        if spawns[area_id] in blocked_tiles(view, area_id):
            errors.append(f"spawn of {area_id} is blocked")
        reach[area_id] = _flood(view, area_id)
    for name in unreachable_doors(lay):
        errors.append(f"door of {name} is unreachable from spawn")
    doors = {(p.area, p.x, p.y) for p in lay.placements if p.to}
    for p in lay.placements:
        if not p.to:
            continue
        if (p.x, p.y) not in reach.get(p.area, ()):
            errors.append(f"door {p.key} at {p.x},{p.y} in {p.area} is unreachable")
        ta, tx, ty = p.to
        if ta not in sizes:
            errors.append(f"door {p.key} leads to unknown area {ta}")
        elif (tx, ty) not in reach[ta]:
            errors.append(f"door {p.key} leads to blocked/unreachable tile {tx},{ty} in {ta}")
        elif (ta, tx, ty) in doors:
            errors.append(f"door {p.key} leads straight onto another door at {tx},{ty} in {ta}")
    return errors


def ground_tile(tx, ty):
    """Index into the four grass variants; identical to the web renderer's groundTile()."""
    n = (tx * 7919 + ty * 104729) % 100
    return 2 if n < 6 else 1 if n < 24 else 3 if n < 34 else 0


def render_preview(lay, public_campus_dir, area_id="main", size=None):
    size = size or (lay.width, lay.height)
    canvas = Image.new("RGBA", (size[0] * T, size[1] * T), (0, 0, 0, 0) if area_id == "main" else (24, 22, 28, 255))
    # grass base with the same deterministic scatter as spaceGrid.tsx groundTile()
    variants = [public_campus_dir / f"grass-{v}.png" for v in "abcd"]
    if area_id == "main" and all(v.exists() for v in variants):
        tiles = [Image.open(v).convert("RGBA") for v in variants]
        for y in range(size[1]):
            for x in range(size[0]):
                canvas.alpha_composite(tiles[ground_tile(x, y)], (x * T, y * T))
    cache = {}
    order = {"floor": 0, "wall": 1, "objects": 2, "topObjects": 3}
    placed = sorted((p for p in lay.placements if p.area == area_id),
                    key=lambda p: (order[lay.elements[p.key].layer], p.y + lay.elements[p.key].height))
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


def render_interiors_sheet(lay, public_campus_dir, areas, cols=3):
    """Every interior on one image, labelled, for eyeballing room layouts."""
    tiles = [render_preview(lay, public_campus_dir, a["id"], (a["width"], a["height"])) for a in areas]
    cw = max(t.width for t in tiles) + 16
    ch = max(t.height for t in tiles) + 40
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cw, rows * ch), (40, 40, 44))
    d = ImageDraw.Draw(sheet)
    for i, (t, a) in enumerate(zip(tiles, areas)):
        x, y = (i % cols) * cw, (i // cols) * ch
        d.text((x + 8, y + 6), f"{a['name']}  ({a['width']}x{a['height']})", font=_font(14), fill=WHITE)
        sheet.paste(t, (x + 8, y + 28))
    return sheet
