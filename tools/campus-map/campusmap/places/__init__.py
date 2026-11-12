"""Hand-authored maps of famous Bilaspur places, laid out in tile coordinates from Esri World
Imagery (2025) and OpenStreetMap, then built by the same layout pipeline as the campus.

Each module defines plan() -> Plan. Features use the campus kinds (building, road, lawn, court,
paver, asphalt) plus terrain painted at pixel level: water, sand, dirt, field, platform, rail,
fob (foot over-bridge), fence and trail (footpath; sub="paved" for slabs).
"""
import math
from dataclasses import dataclass, field

from ..geo import Feature


@dataclass
class Plan:
    id: str
    name: str
    width: int
    height: int
    features: list
    spawn: tuple
    filler: str = "houses"           # houses | forest | none
    props: list = field(default_factory=list)   # (key, x, y)
    signs: list = field(default_factory=list)   # (key, text, x, y, width)
    gate: tuple | None = None        # (key, x, y, width, text)
    seed: int = 1


class Builder:
    """Collects features with unique ids."""

    def __init__(self):
        self.features = []
        self._id = 1

    def add(self, kind, points, **kw):
        self.features.append(Feature(kind=kind, name=kw.pop("name", None), points=list(points), osm_id=self._id, **kw))
        self._id += 1
        return self.features[-1]

    def rect(self, kind, x0, y0, x1, y1, **kw):
        return self.add(kind, rect(x0, y0, x1, y1), **kw)

    def line(self, kind, *pts, width=2, **kw):
        return self.add(kind, pts, width=width, **kw)

    def fence_rect(self, x0, y0, x1, y1, gaps=()):
        """A fence around a rectangle, with gaps given as (side, from, to) e.g. ("s", 10, 13)."""
        sides = {"n": ((x0, y0), (x1, y0)), "e": ((x1, y0), (x1, y1)), "s": ((x0, y1), (x1, y1)), "w": ((x0, y0), (x0, y1))}
        for side, (a, b) in sides.items():
            cuts = sorted((g[1], g[2]) for g in gaps if g[0] == side)
            horizontal = a[1] == b[1]
            lo, hi = (a[0], b[0]) if horizontal else (a[1], b[1])
            start = lo
            for c0, c1 in cuts + [(hi, hi)]:
                if c0 > start:
                    p = ((start, a[1]), (c0, a[1])) if horizontal else ((a[0], start), (a[0], c0))
                    self.add("fence", p)
                start = c1


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)]


def circle(cx, cy, r, n=28):
    pts = [(cx + r * math.cos(2 * math.pi * k / n), cy + r * math.sin(2 * math.pi * k / n)) for k in range(n)]
    return pts + [pts[0]]


def all_plans():
    from . import arpa, junction, magneto, ratanpur, zoo
    return [m.plan() for m in (arpa, junction, zoo, ratanpur, magneto)]
