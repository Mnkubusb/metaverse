"""Building interiors as extra *areas* of the campus map.

The room art and layouts live in tools/campus-map/interiors.py (hand-tuned classroom,
lab, hostel, canteen … templates). This module adapts them to the OSM layout: every
named building gets a room sized from its template, the two paver tiles in front of
its door become "door-in" mats leading to the room's spawn, and the room's exit mats
lead back to the tile below the mats.
"""
import importlib

from PIL import Image

from .corrections import FLOORS as STOREYS
from .layout import ElementDef, Placement, SPRITE_SIZES

T = 32
MAIN = "main"

# template, room size and floor/wall per kind of building (same tables as the previous generator)
# room sizes in tiles; big enough to fill a laptop screen at 1:1 so rooms feel like real halls
SIZES = {"admin": (30, 17), "library": (30, 17), "auditorium": (32, 20), "dept": (32, 17), "lab": (28, 16),
         "workshop": (28, 16), "canteen": (26, 15), "dispensary": (22, 14), "hostel": (28, 16), "classroom": (32, 17),
         "cinema": (36, 24), "mall": (34, 18), "station": (32, 17), "temple": (24, 16)}
FLOORS = {"admin": "floor-carpet", "library": "floor-wood", "auditorium": "floor-carpet", "dept": "floor-tile",
          "lab": "floor-tile-blue", "workshop": "floor-concrete", "canteen": "floor-tile",
          "dispensary": "floor-tile-blue", "hostel": "floor-tile", "cinema": "floor-cinema", "mall": "floor-tile",
          "station": "floor-tile", "temple": "floor-tile"}
# what the first floor of each kind of building holds
UPSTAIRS = {"dept": "classroom", "admin": "library", "auditorium": "classroom", "lab": "lab", "hostel": "hostel",
            "library": "classroom", "workshop": "lab", "canteen": "canteen", "dispensary": "dispensary",
            "cinema": "cinema", "mall": "cinema", "station": "station", "temple": "temple"}
STAIR_W = 3  # extra columns on the right of a multi-storey building's rooms: the stairwell
UP_ROWS, DOWN_ROWS = (6, 7), (2, 3)
DOWN_ARRIVE = lambda w: (w, 4)  # noqa: E731  arriving upstairs: just below the stairs down
UP_ARRIVE = lambda w: (w, 5)    # noqa: E731  arriving downstairs: just above the stairs up
WALLS = {"library": "in-wall-back-blue", "dispensary": "in-wall-back-blue", "workshop": "in-wall-back-grey",
         "lab": "in-wall-back-blue", "cinema": "in-wall-back-grey", "temple": "in-wall-back-pink"}


def template_for(name):
    n = name.lower()
    if "hostel" in n:
        return "hostel"
    if "canteen" in n:
        return "canteen"
    if "workshop" in n:
        return "workshop"
    if "annexe" in n:
        return "lab"
    if "hall" in n:
        return "auditorium"
    if "main building" in n:
        return "admin"
    if "library" in n:
        return "library"
    return "dept"


def slug_of(name):
    import re
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


class RoomBuilder:
    """Adapts interiors.Room's callbacks (element / put / tiled) to a Layout."""

    def __init__(self, lay):
        self.lay = lay
        self.images = {}   # key -> PIL image of interior sprites, written by generate.py
        self.areas = []    # area defs, in the order rooms were built
        self.interiors = importlib.import_module("interiors")
        self.interiors.catalogue(self.element)

    def element(self, key, img, layer, static, image_url=None):
        w, h = img.width // T, img.height // T
        self.lay.elements[key] = ElementDef(key, image_url or f"/campus/{key}.png", w, h, static, layer)
        self.images[key] = img
        return key

    def tiled(self, key, w, h):
        """An element made by repeating `key`'s sprite w x h times (same layer and blocking)."""
        base = self.lay.elements[key]
        if (w, h) == (base.width, base.height):
            return key
        name = f"{key}-{w}x{h}"
        if name not in self.lay.elements:
            im = Image.new("RGBA", (w * T, h * T))
            for y in range(0, h, base.height):
                for x in range(0, w, base.width):
                    im.alpha_composite(self.images[key], (x * T, y * T))
            self.element(name, im, base.layer, base.static)
        return name

    def put(self, key, x, y, area, to=None):
        if key not in self.lay.elements:
            if key not in SPRITE_SIZES:
                raise KeyError(f"room template uses unknown element {key!r}")
            self.lay.element(key)
        self.lay.placements.append(Placement(key, x, y, area, to))

    def build(self):
        """One room per floor of every named building; door mats in front of the door both ways,
        and a stairwell on the right of each floor joining it to the next."""
        for name, dx, dy in self.lay.doors:
            meta_template, meta_storeys = self.lay.building_meta.get(name, (None, 0))
            template, _, upstairs = (meta_template or template_for(name)).partition(">")
            area_id = f"in-{slug_of(name)}"
            w, h = SIZES[template]
            storeys = meta_storeys or STOREYS.get(name, 1)
            stairs = STAIR_W if storeys > 1 else 0
            wall = WALLS.get(template, "in-wall-back")
            ground = self._room(area_id, name, w + stairs, w, h, FLOORS[template], wall, template, exit=True)
            # the two paver tiles just below the 2x2 door lead inside; the exit leads to the tile below them
            for x in (dx, dx + 1):
                self.put("door-in", x, dy + 2, MAIN, (area_id, *ground.spawn))
            ground.exits(MAIN, dx, dy + 3)
            self.areas.append(ground.area_def())
            below, below_w = ground, w
            for level in range(1, storeys):
                upper_id = f"{area_id}-{level}f"
                label = {1: "First floor", 2: "Second floor", 3: "Third floor"}.get(level, f"Floor {level}")
                up_template = upstairs or UPSTAIRS[template]
                uw, uh = SIZES.get(up_template, (w, h)) if upstairs else (w, h)
                upper = self._room(upper_id, f"{name} · {label}", uw + STAIR_W, uw, uh,
                                   FLOORS.get(up_template, FLOORS[template]), WALLS.get(up_template, wall), up_template, exit=False)
                upper.spawn = DOWN_ARRIVE(uw)
                # stairwell on the right of every floor: the way up at rows 6-7, the way down at rows 2-3
                for k in (0, 1):
                    for y in UP_ROWS:
                        below.put("stairs-up", below_w + k, y, (upper_id, *DOWN_ARRIVE(uw)))
                    for y in DOWN_ROWS:
                        upper.put("stairs-down", uw + k, y, (below.id, *UP_ARRIVE(below_w)))
                self.areas.append(upper.area_def())
                below, below_w = upper, uw
        return self.areas

    def _room(self, area_id, name, full_w, w, h, floor, wall, template, exit):
        """A room full_w wide whose template only furnishes the left w columns (the rest is stairwell)."""
        room = self.interiors.Room(area_id, name, full_w, h, floor, wall, self.put, self.tiled, exit=exit)
        room.w = w
        self.interiors.TEMPLATES[template](room)
        room.w = full_w
        return room
