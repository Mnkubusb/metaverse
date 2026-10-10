"""OSM JSON -> tile-space features for the GEC Bilaspur campus."""
import math
from dataclasses import dataclass

BBOX = (82.1280, 22.1340, 82.1330, 22.1385)  # W, S, E, N
METERS_PER_TILE = 3.0
MARGIN = 2  # grass tiles around the bbox
M_PER_DEG = 111320.0

# OSM names are long; signs are short.
ALIASES = {
    "GEC Bilaspur CS/IT/ET&T Building": "CS/IT Block",
    "Government Engineering College Bilaspur": "Main Building",
    "M. Visvesvaraya Hall": "Visvesvaraya Hall",
    "Electrical Eng. Department": "Electrical Dept",
    "Civil Eng. Department": "Civil Dept",
    "Electronics Eng. Dept.": "Electronics Dept",
    "CS/IT Temporary Building": "CS/IT Annexe",
    "Mechanical Eng. Dept": "Mechanical Dept",
    "Workshop Building GEC": "Workshop",
    "Mining Eng. Dept": "Mining Dept",
    "Canteen GEC Bilaspur": "Canteen",
    "Amarkantak Boys Hostel GEC": "Amarkantak Hostel",
    "Shaheed Veer Narayan Singh Boys Hostel": "SVNS Hostel",
    "Panchsheel Boys Hostel GEC": "Panchsheel Hostel",
    "Royal Shubhash Garden": "Shubhash Garden",
    "Badminton Court GEC": "Badminton Court",
    "College Outdoor Fitness Gym": "Outdoor Gym",
    "Civil Department Ground": "Civil Ground",
    "Electrical Quadrangle": "Electrical Quad",
}


def display_name(name):
    if name is None:
        return None
    return ALIASES.get(name, name)


class Projector:
    """Equirectangular projection; origin = bbox NW corner + MARGIN tiles.
    `angle` (degrees, counter-clockwise on screen) rotates the whole map about the bbox
    centre, e.g. 45 turns a NE-SW road into a vertical one; the map grows to fit."""

    def __init__(self, bbox=BBOX, angle=0.0):
        self.w, self.s, self.e, self.n = bbox
        self.cos = math.cos(math.radians((self.s + self.n) / 2))
        inner_w = (self.e - self.w) * M_PER_DEG * self.cos / METERS_PER_TILE
        inner_h = (self.n - self.s) * M_PER_DEG / METERS_PER_TILE
        self.angle = math.radians(angle)
        self.cx, self.cy = inner_w / 2, inner_h / 2
        corners = [self._rotate(x, y) for x in (0, inner_w) for y in (0, inner_h)]
        self.x0 = min(c[0] for c in corners)
        self.y0 = min(c[1] for c in corners)
        self.width = math.ceil(max(c[0] for c in corners) - self.x0) + 2 * MARGIN
        self.height = math.ceil(max(c[1] for c in corners) - self.y0) + 2 * MARGIN

    def _rotate(self, x, y):
        if not self.angle:
            return x, y
        dx, dy = x - self.cx, y - self.cy
        c, s = math.cos(self.angle), math.sin(self.angle)
        return self.cx + dx * c + dy * s, self.cy - dx * s + dy * c

    def to_tile(self, lat, lon):
        x = (lon - self.w) * M_PER_DEG * self.cos / METERS_PER_TILE
        y = (self.n - lat) * M_PER_DEG / METERS_PER_TILE
        rx, ry = self._rotate(x, y)
        return rx - self.x0 + MARGIN, ry - self.y0 + MARGIN


@dataclass
class Feature:
    kind: str                 # building | road | lawn | court | asphalt | paver
    name: str | None
    points: list              # [(x, y), ...] tile coords; polygons repeat first point last
    osm_id: int
    width: int = 0            # roads: tiles
    sub: str | None = None    # asphalt: parking | motorcycle_parking


ROAD_WIDTH = {"service": 2, "residential": 3, "tertiary": 3}


def classify(tags):
    """Return (kind, width, sub) or None for ways we don't draw."""
    if "building" in tags:
        return "building", 0, None
    hw = tags.get("highway")
    if hw in ROAD_WIDTH:
        return "road", ROAD_WIDTH[hw], None
    leisure = tags.get("leisure")
    if leisure == "garden":
        return "lawn", 0, None
    if leisure == "pitch":
        return "court", 0, None
    amenity = tags.get("amenity")
    if amenity in ("parking", "motorcycle_parking"):
        return "asphalt", 0, amenity
    if amenity == "college" and tags.get("name"):
        return "paver", 0, None
    return None


def load_features(osm_json, proj):
    nodes = {e["id"]: (e["lat"], e["lon"]) for e in osm_json["elements"] if e["type"] == "node"}
    feats = []
    for e in osm_json["elements"]:
        if e["type"] != "way":
            continue
        tags = e.get("tags", {})
        c = classify(tags)
        if c is None:
            continue
        kind, width, sub = c
        pts = [proj.to_tile(*nodes[n]) for n in e["nodes"] if n in nodes]
        if len(pts) < (2 if kind == "road" else 4):
            continue
        feats.append(Feature(kind=kind, name=display_name(tags.get("name")), points=pts,
                             osm_id=e["id"], width=width, sub=sub))
    return feats
