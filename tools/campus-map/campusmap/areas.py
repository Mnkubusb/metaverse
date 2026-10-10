"""Building interiors as extra *areas* of the campus map.

The room art and layouts live in tools/campus-map/interiors.py (hand-tuned classroom,
lab, hostel, canteen … templates). This module adapts them to the OSM layout: every
named building gets a room sized from its template, the two paver tiles in front of
its door become "door-in" mats leading to the room's spawn, and the room's exit mats
lead back to the tile below the mats.
"""
import importlib

from PIL import Image

from .layout import ElementDef, Placement, SPRITE_SIZES

T = 32
MAIN = "main"

# template, room size and floor/wall per kind of building (same tables as the previous generator)
SIZES = {"admin": (20, 13), "library": (20, 13), "auditorium": (20, 13), "dept": (22, 13), "lab": (18, 12),
         "workshop": (18, 12), "canteen": (16, 11), "dispensary": (14, 10), "hostel": (18, 12)}
FLOORS = {"admin": "floor-carpet", "library": "floor-wood", "auditorium": "floor-carpet", "dept": "floor-tile",
          "lab": "floor-tile-blue", "workshop": "floor-concrete", "canteen": "floor-tile",
          "dispensary": "floor-tile-blue", "hostel": "floor-tile"}
WALLS = {"library": "in-wall-back-blue", "dispensary": "in-wall-back-blue", "workshop": "in-wall-back-grey",
         "lab": "in-wall-back-blue"}


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
        """One room per named building; door mats in front of the door both ways."""
        for name, dx, dy in self.lay.doors:
            template = template_for(name)
            area_id = f"in-{slug_of(name)}"
            w, h = SIZES[template]
            wall = WALLS.get(template, "in-wall-back")
            room = self.interiors.Room(area_id, name, w, h, FLOORS[template], wall, self.put, self.tiled)
            self.interiors.TEMPLATES[template](room)
            # the two paver tiles just below the 2x2 door lead inside; the exit leads to the tile below them
            for x in (dx, dx + 1):
                self.put("door-in", x, dy + 2, MAIN, (area_id, *room.spawn))
            room.exits(MAIN, dx, dy + 3)
            self.areas.append(room.area_def())
        return self.areas
