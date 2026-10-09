"""Generated building interiors and the portals that connect them to the campus.

Each named campus building gets one interior map built from the existing office
art (apps/web/public/Office). The campus door (2x2) is a portal into the interior;
the interior's exit door is a portal back to the tile in front of the campus door.
"""
from dataclasses import dataclass, field

from .layout import ElementDef, Placement

CAMPUS_MAP_ID = "gec-bilaspur-campus"
OFFICE = "/Office"
MIN_W, MIN_H, MAX_W, MAX_H = 12, 10, 40, 30

# key -> (imageUrl, w, h, static, layer); ids are "campus-" + key like the campus elements
INTERIOR_ELEMENTS = {
    "int-floor": (f"{OFFICE}/floor-tile.png", 1, 1, False, "floor"),
    "int-rug": (f"{OFFICE}/rug.png", 2, 2, False, "floor"),
    "int-wall-h": (f"{OFFICE}/wall-h.png", 1, 1, True, "wall"),
    "int-wall-v": (f"{OFFICE}/wall-v.png", 1, 1, True, "wall"),
    "int-wall-corner": (f"{OFFICE}/wall-corner.png", 1, 1, True, "wall"),
    "door": ("/campus/door.png", 2, 2, False, "objects"),
    "int-desk": (f"{OFFICE}/desk.png", 2, 1, True, "objects"),
    "int-chair": (f"{OFFICE}/chair.png", 1, 1, False, "objects"),
    "int-monitor": (f"{OFFICE}/monitor.png", 1, 1, True, "objects"),
    "int-whiteboard": (f"{OFFICE}/whiteboard.png", 2, 1, True, "objects"),
    "int-bookshelf": (f"{OFFICE}/bookshelf.png", 1, 1, True, "objects"),
    "int-couch": (f"{OFFICE}/couch.png", 2, 1, False, "objects"),
    "int-conf-table": (f"{OFFICE}/conf-table.png", 3, 2, True, "objects"),
    "int-plant": (f"{OFFICE}/plant.png", 1, 1, True, "objects"),
    "int-coffee": (f"{OFFICE}/coffee.png", 1, 1, True, "objects"),
}


@dataclass
class Interior:
    map_id: str
    name: str
    width: int
    height: int
    elements: dict = field(default_factory=dict)
    placements: list = field(default_factory=list)
    spawn: tuple = (0, 0)
    exit: tuple = (0, 0)  # top-left of the 2x1 exit footprint (the door's top row)

    def put(self, key, x, y):
        if key not in self.elements:
            url, w, h, static, layer = INTERIOR_ELEMENTS[key]
            self.elements[key] = ElementDef(key, url, w, h, static, layer)
        self.placements.append(Placement(key, x, y))


@dataclass
class Portal:
    map_id: str
    x: int
    y: int
    width: int
    height: int
    target_map_id: str
    target_x: int
    target_y: int


@dataclass
class InteriorSet:
    maps: list = field(default_factory=list)
    portals: list = field(default_factory=list)


def interior_size(footprint_w, footprint_h):
    return (max(MIN_W, min(MAX_W, footprint_w)), max(MIN_H, min(MAX_H, footprint_h)))


def kind_of(name):
    n = name.lower()
    if "hostel" in n:
        return "hostel"
    if "canteen" in n:
        return "canteen"
    if "workshop" in n:
        return "workshop"
    if "hall" in n or "main building" in n:
        return "hall"
    return "department"


def _furnish(m, kind, exit_x, rng):
    """Furniture inside the ring (1..w-2, 1..h-2), keeping the two door columns clear
    for the three rows above the exit."""
    w, h = m.width, m.height
    keep = {(x, y) for x in (exit_x, exit_x + 1) for y in range(h - 5, h - 1)}

    def free(x, y, ew, eh):
        return all(1 <= x + dx <= w - 2 and 1 <= y + dy <= h - 2 and (x + dx, y + dy) not in keep
                   for dx in range(ew) for dy in range(eh))

    def put(key, x, y):
        ew, eh = INTERIOR_ELEMENTS[key][1], INTERIOR_ELEMENTS[key][2]
        if free(x, y, ew, eh):
            m.put(key, x, y)
            return True
        return False

    if kind in ("department", "hall", "workshop"):
        put("int-whiteboard", w // 2 - 1, 1)
        for y in range(3, h - 5, 3):
            for x in range(2, w - 3, 4):
                if kind == "workshop" or put("int-desk", x, y):
                    if kind == "workshop":
                        put("int-desk", x, y)
                    put("int-chair", x, y + 1)
                    if kind != "workshop" and rng.random() < 0.6:
                        put("int-monitor", x + 1, y - 1) if y - 1 > 1 else None
        put("int-plant", 1, 1)
        put("int-plant", w - 2, 1)
    elif kind == "hostel":
        for y in range(2, h - 5, 4):
            for x in range(2, w - 3, 6):
                put("int-couch", x, y)
                put("int-bookshelf", x + 3, y) if x + 3 < w - 2 else None
        put("int-rug", w // 2 - 1, h // 2 - 1)
    elif kind == "canteen":
        put("int-coffee", 1, 1)
        put("int-coffee", 2, 1)
        for y in range(3, h - 6, 4):
            for x in range(2, w - 4, 5):
                if put("int-conf-table", x, y):
                    put("int-chair", x + 1, y + 2)
                    put("int-chair", x + 1, y - 1) if y - 1 > 1 else None


def build_interior(name, slug, width, height, rng):
    m = Interior(f"gec-bilaspur-{slug}", name, width, height)
    w, h = width, height
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            m.put("int-floor", x, y)
    for x in range(w):
        for y in (0, h - 1):
            m.put("int-wall-corner" if x in (0, w - 1) else "int-wall-h", x, y)
    for y in range(1, h - 1):
        m.put("int-wall-v", 0, y)
        m.put("int-wall-v", w - 1, y)
    door_x = w // 2 - 1
    # the door replaces two bottom-wall tiles; non-static so the player can step onto it
    m.placements = [p for p in m.placements if not (p.key == "int-wall-h" and p.y == h - 1 and p.x in (door_x, door_x + 1))]
    m.put("door", door_x, h - 2)
    m.exit = (door_x, h - 2)   # stepping onto the door's top row leaves the building
    m.spawn = (door_x, h - 3)  # just inside the door, off the exit portal
    _furnish(m, kind_of(name), door_x, rng)
    return m


def slug_of(name):
    import re
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def build_all(campus, footprints, rng):
    """campus: layout.Layout with .doors [(name, dx, dy)]; footprints: name -> (w, h) tiles."""
    out = InteriorSet()
    for name, dx, dy in campus.doors:
        fw, fh = footprints.get(name, (MIN_W, MIN_H))
        w, h = interior_size(fw, fh)
        m = build_interior(name, slug_of(name), w, h, rng)
        out.maps.append(m)
        out.portals.append(Portal(CAMPUS_MAP_ID, dx, dy, 2, 2, m.map_id, m.spawn[0], m.spawn[1]))
        out.portals.append(Portal(m.map_id, m.exit[0], m.exit[1], 2, 1, CAMPUS_MAP_ID, dx, dy + 2))
    return out
