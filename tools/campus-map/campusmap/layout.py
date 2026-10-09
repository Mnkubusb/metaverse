"""Turn classified features into a cell grid, then into element placements."""
import re
from dataclasses import dataclass, field

from .autotile import ring_variant, road_variant
from .raster import Grid, bbox_of, fill_polygon, stroke_polyline

# w, h in tiles for every sliced sprite (see tools/campus-map/tiles.toml)
SPRITE_SIZES = {
    **{k: (1, 1) for k in (
        "grass", "grass-tuft", "lawn", "flowerbed", "court", "paver", "asphalt",
        "road-h", "road-v", "road-x", "road-plain", "mark-p", "mark-bike",
        "roof-a", "roof-b", "roof-c", "roof-d",
        "wall-a", "wall-b", "wall-c", "wall-d",
        "wallbase-a", "wallbase-b", "wallbase-c", "wallbase-d",
        "window-a", "window-b", "window-c", "window-d",
        "bike", "bin", "cone")},
    "door": (2, 2), "tree-a": (1, 2), "tree-b": (1, 2), "lamp": (1, 2), "bench": (2, 1),
    "car-h-green": (2, 1), "car-h-gray": (2, 1), "car-h-orange": (2, 1),
    "car-v-green": (2, 2), "car-v-gray": (2, 2), "car-v-orange": (2, 2),
    "flag": (1, 2), "gate-pillar": (1, 2), "gate-arch": (5, 2),
}

FLOOR = {"grass", "grass-tuft", "lawn", "flowerbed", "court", "paver", "asphalt",
         "road-h", "road-v", "road-x", "road-plain", "mark-p", "mark-bike"}
TOP = {"gate-arch"}
NON_STATIC_OBJECTS = {"door"}

STYLES = ["a", "b", "c", "d"]
SIGN_W, SIGN_H = 3, 1
TREE_SPACING = 6
DOOR_APPROACH = 3  # tiles in front of a door kept free of props
CAR_KEYS = ["car-h-green", "car-h-gray", "car-h-orange"]
CAR_V_KEYS = ["car-v-green", "car-v-gray", "car-v-orange"]


@dataclass
class Placement:
    key: str
    x: int
    y: int


@dataclass
class ElementDef:
    key: str
    image_url: str
    width: int
    height: int
    static: bool
    layer: str


@dataclass
class Layout:
    width: int
    height: int
    elements: dict = field(default_factory=dict)
    placements: list = field(default_factory=list)
    spawn: tuple = (0, 0)
    doors: list = field(default_factory=list)
    signs: dict = field(default_factory=dict)

    def element(self, key, w=None, h=None, image_url=None):
        if key not in self.elements:
            w, h = (w, h) if w else SPRITE_SIZES[key]
            layer = "floor" if key in FLOOR else "topObjects" if key in TOP else \
                "wall" if key.startswith(("wall-", "wallbase-", "window-", "roof-")) else "objects"
            static = key not in NON_STATIC_OBJECTS and layer not in ("floor", "topObjects")
            self.elements[key] = ElementDef(key, image_url or f"/campus/{key}.png", w, h, static, layer)
        return self.elements[key]

    def put(self, key, x, y, **kw):
        self.element(key, **kw)
        self.placements.append(Placement(key, x, y))


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


# ----------------------------------------------------------------------------- grid painting

def paint(features, width, height):
    """Rasterize features into a Grid. Later kinds win: ground < road < building."""
    grid = Grid(width, height)
    order = {"lawn": 0, "court": 0, "paver": 0, "asphalt": 0, "road": 1, "building": 2}
    for f in sorted(features, key=lambda f: order[f.kind]):
        if f.kind == "road":
            stroke_polyline(grid, f.points, f.width, "road")
        elif f.kind == "building":
            fill_polygon(grid, f.points, f"building:{f.osm_id}")
        else:
            fill_polygon(grid, f.points, f.kind)
    return grid


def building_cells(grid, osm_id):
    return grid.find(f"building:{osm_id}")


# ----------------------------------------------------------------------------- buildings

def nearest_road_side(grid, cells):
    """Which side (N/E/S/W) of the footprint has the closest road cell."""
    xs = [c[0] for c in cells]
    ys = [c[1] for c in cells]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    best, best_d = "S", None
    for (x, y) in grid.find("road"):
        d = (x - cx) ** 2 + (y - cy) ** 2
        if best_d is None or d < best_d:
            best_d = d
            dx, dy = x - cx, y - cy
            best = ("E" if dx > 0 else "W") if abs(dx) > abs(dy) else ("S" if dy > 0 else "N")
    return best


def open_cells(grid):
    """Cells reachable from any road without crossing a building (grid-level flood)."""
    seen = set(grid.find("road"))
    stack = list(seen)
    while stack:
        x, y = stack.pop()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            c = grid.get(nx, ny)
            if c is None or c.startswith("building:") or (nx, ny) in seen:
                continue
            seen.add((nx, ny))
            stack.append((nx, ny))
    return seen


def door_position(cells, open_set=None):
    """Door is always on the bottom edge (top-down art), centred on the widest bottom run
    whose approach cell (directly below) is open ground; any bottom run if none is."""
    cellset = set(cells)
    bottom = [(x, y) for (x, y) in cells if (x, y + 1) not in cellset]
    if open_set is not None:
        reachable = [(x, y) for (x, y) in bottom if (x, y + 1) in open_set]
        if reachable:
            bottom = reachable
    # longest horizontal run of bottom cells sharing the same y
    runs = []
    for x, y in sorted(bottom):
        if runs and runs[-1][1] == y and runs[-1][2] == x - 1:
            runs[-1][2] = x
        else:
            runs.append([x, y, x])
    x0, y, x1 = max(runs, key=lambda r: r[2] - r[0])
    dx = x0 + (x1 - x0 + 1 - 2) // 2
    return dx, y - 1  # 2x2 door; its bottom row is the ring's bottom row


def place_building(lay, grid, feat, style, rng, open_set=None):
    cells = building_cells(grid, feat.osm_id)
    if not cells:
        return
    cellset = set(cells)
    same = lambda x, y: (x, y) in cellset  # noqa: E731
    door = door_position(cells, open_set) if feat.name else None
    door_cells = set()
    if door:
        dx, dy = door
        door_cells = {(dx, dy + 1), (dx + 1, dy + 1)}
    for (x, y) in sorted(cells):
        v = ring_variant(same, x, y)
        if v == "inner":
            lay.put(f"roof-{style}", x, y)
        elif v in ("bottom", "corner-bl", "corner-br"):
            if (x, y) in door_cells:
                continue
            key = f"window-{style}" if (x % 3 == 1 and v == "bottom") else f"wallbase-{style}"
            lay.put(key, x, y)
        else:
            lay.put(f"wall-{style}", x, y)
    if door:
        dx, dy = door
        lay.put("door", dx, dy)
        lay.doors.append((feat.name, dx, dy))
        key = f"sign:{slug(feat.name)}"
        lay.signs[key] = feat.name
        lay.put(key, dx - (SIGN_W - 2) // 2, dy - 1, w=SIGN_W, h=SIGN_H, image_url=f"/campus/sign-{slug(feat.name)}.png")
        # approach: paver strip from the door down to the nearest road row (or 3 tiles)
        for y in range(dy + 2, min(dy + 2 + DOOR_APPROACH, grid.height)):
            for x in (dx, dx + 1):
                if grid.get(x, y) == "grass":
                    grid.set(x, y, "paver")
        side = nearest_road_side(grid, cells)
        if side == "N":
            # road is behind: pave a path around the building's nearest vertical edge
            xs = [c[0] for c in cells]
            ex = min(xs) - 1 if dx - min(xs) < max(xs) - dx else max(xs) + 1
            for y in range(min(c[1] for c in cells) - 1, dy + 2 + DOOR_APPROACH):
                if grid.get(ex, y) == "grass":
                    grid.set(ex, y, "paver")


# ----------------------------------------------------------------------------- ground + props

def approach_cells(lay):
    cells = set()
    for (_, dx, dy) in lay.doors:
        for x in (dx, dx + 1):
            for y in range(dy + 2, dy + 2 + DOOR_APPROACH):
                cells.add((x, y))
    return cells


def free(grid, lay, x, y, w, h, keep_clear):
    """True when a w x h prop anchored at (x, y) sits fully on grass/lawn and off approaches."""
    for dx in range(w):
        for dy in range(h):
            c = grid.get(x + dx, y + dy)
            if c not in ("grass", "lawn") or (x + dx, y + dy) in keep_clear:
                return False
    return True


def place_ground(lay, grid, rng):
    same_road = lambda a, b: grid.get(a, b) == "road"  # noqa: E731
    for y in range(grid.height):
        for x in range(grid.width):
            c = grid.cells[y][x]
            if c == "grass":
                lay.put("grass-tuft" if rng.random() < 0.12 else "grass", x, y)
            elif c == "road":
                lay.put(road_variant(same_road, x, y), x, y)
            elif c == "lawn":
                lay.put("flowerbed" if rng.random() < 0.08 else "lawn", x, y)
            elif c in ("court", "paver", "asphalt"):
                lay.put(c, x, y)
            # building cells get no floor: the wall/roof covers them


def place_props(lay, grid, features, rng):
    keep_clear = approach_cells(lay)
    occupied = set()

    def take(key, x, y):
        w, h = SPRITE_SIZES[key]
        for dx in range(w):
            for dy in range(h):
                occupied.add((x + dx, y + dy))
        lay.put(key, x, y)

    def can(key, x, y):
        w, h = SPRITE_SIZES[key]
        return free(grid, lay, x, y, w, h, keep_clear | occupied)

    # trees + lamps along road edges
    roads = set(grid.find("road"))
    for (x, y) in sorted(roads):
        if (x, y - 1) not in roads and (x + y) % TREE_SPACING == 0:
            key = "tree-a" if rng.random() < 0.5 else "tree-b"
            if can(key, x, y - 3):
                take(key, x, y - 3)
        if (x, y + 1) not in roads and (x + y) % TREE_SPACING == 3:
            key = "tree-a" if rng.random() < 0.5 else "tree-b"
            if can(key, x, y + 1):
                take(key, x, y + 1)
        if (x - 1, y) not in roads and (x, y - 1) not in roads and can("lamp", x - 1, y - 2):
            take("lamp", x - 1, y - 2)

    # benches in lawns
    for (x, y) in sorted(grid.find("lawn")):
        if (x * 7 + y * 3) % 23 == 0 and can("bench", x, y):
            take("bench", x, y)

    # cars / bikes in parking
    for f in features:
        if f.kind != "asphalt":
            continue
        x0, y0, x1, y1 = bbox_of(f.points)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if grid.get(x, y) != "asphalt":
                    continue
                if f.sub == "parking":
                    if (x - x0) % 3 == 0 and (y - y0) % 2 == 0 and rng.random() < 0.7:
                        key = rng.choice(CAR_KEYS)
                        if all(grid.get(x + dx, y) == "asphalt" and (x + dx, y) not in occupied for dx in (0, 1)):
                            take(key, x, y)
                elif f.sub == "motorcycle_parking":
                    if (x - x0) % 2 == 0 and (y - y0) % 2 == 0 and rng.random() < 0.6 and (x, y) not in occupied:
                        take("bike", x, y)
        mark = "mark-p" if f.sub == "parking" else "mark-bike"
        if grid.get(x0, y0) == "asphalt":
            lay.placements = [p for p in lay.placements if not (p.key == "asphalt" and (p.x, p.y) == (x0, y0))]
            lay.put(mark, x0, y0)

    # bins next to doors
    for (_, dx, dy) in lay.doors:
        if can("bin", dx + 2, dy + 1):
            take("bin", dx + 2, dy + 1)


# ----------------------------------------------------------------------------- gate + spawn

def main_gate(lay, grid):
    """The southernmost road run nearest the map's centre column is the gate:
    pillars, flag, arch, and the spawn one tile inside it."""
    roads = grid.find("road")
    y = max(cy for _, cy in roads)
    xs = sorted(x for x, cy in roads if cy == y)
    runs = []
    for x in xs:
        if runs and runs[-1][1] == x - 1:
            runs[-1][1] = x
        else:
            runs.append([x, x])
    x0, x1 = min(runs, key=lambda r: abs((r[0] + r[1]) / 2 - grid.width / 2))
    w = x1 - x0 + 3

    def put_if_inside(key, x, py, **kw):
        kw_w, kw_h = (kw["w"], kw["h"]) if "w" in kw else SPRITE_SIZES[key]
        if 0 <= x and x + kw_w <= grid.width and 0 <= py and py + kw_h <= grid.height:
            lay.put(key, x, py, **kw)

    put_if_inside("gate-pillar", x0 - 1, y - 2)
    put_if_inside("gate-pillar", x1 + 1, y - 2)
    put_if_inside("flag", x0 - 2, y - 2)
    put_if_inside("gate-arch", x0 - 1, y - 4, w=w, h=2, image_url="/campus/gate-arch.png")
    if "gate-arch" in lay.elements:
        lay.signs["gate-arch"] = "GEC BILASPUR"
    lay.spawn = ((x0 + x1) // 2, y - 1)


def spawn_fallback(lay, grid):
    roads = grid.find("road")
    if roads:
        return roads[len(roads) // 2]
    return (grid.width // 2, grid.height // 2)


# ----------------------------------------------------------------------------- entry point

def build(features, width, height, rng):
    lay = Layout(width, height)
    grid = paint(features, width, height)
    buildings = [f for f in features if f.kind == "building"]
    open_set = open_cells(grid) if grid.find("road") else None
    for i, f in enumerate(sorted(buildings, key=lambda f: f.osm_id)):
        place_building(lay, grid, f, STYLES[i % len(STYLES)], rng, open_set)
    place_ground(lay, grid, rng)
    place_props(lay, grid, features, rng)
    if grid.find("road"):
        main_gate(lay, grid)
    else:
        lay.spawn = spawn_fallback(lay, grid)
    return lay
