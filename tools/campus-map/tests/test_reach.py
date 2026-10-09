import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from campusmap import reach  # noqa: E402
from campusmap.layout import ElementDef, Layout, Placement  # noqa: E402


def lay_with(elements, placements, spawn, doors=()):
    lay = Layout(10, 10)
    lay.elements = {e.key: e for e in elements}
    lay.placements = [Placement(*p) for p in placements]
    lay.spawn = spawn
    lay.doors = list(doors)
    return lay


WALL = ElementDef("wall-a", "/campus/wall-a.png", 1, 1, True, "wall")
TREE = ElementDef("tree-a", "/campus/tree-a.png", 1, 2, True, "objects")
DOOR = ElementDef("door", "/campus/door.png", 2, 2, False, "objects")
GRASS = ElementDef("grass", "/campus/grass.png", 1, 1, False, "floor")


def test_blocked_wall_whole_footprint_objects_bottom_row_only():
    lay = lay_with([WALL, TREE, DOOR, GRASS], [("wall-a", 1, 1), ("tree-a", 3, 3), ("door", 5, 5), ("grass", 0, 0)], (0, 0))
    b = reach.blocked_tiles(lay)
    assert (1, 1) in b and (3, 4) in b and (3, 3) not in b and (5, 5) not in b and (5, 6) not in b


def test_unreachable_door_is_reported():
    ring = [("wall-a", x, y) for x in range(2, 8) for y in range(2, 8) if x in (2, 7) or y in (2, 7)]
    lay = lay_with([WALL, DOOR], ring + [("door", 4, 4)], (0, 0), doors=[("Boxed Hall", 4, 4)])
    assert reach.unreachable_doors(lay) == ["Boxed Hall"]


def test_reachable_door_not_reported():
    lay = lay_with([WALL, DOOR], [("door", 4, 2)], (0, 0), doors=[("Open Hall", 4, 2)])
    assert reach.unreachable_doors(lay) == []
    assert reach.reachable_count(lay) == 100
