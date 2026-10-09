import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from campusmap import interiors  # noqa: E402
from campusmap.layout import Layout  # noqa: E402


def door(name, x, y, w=20, h=14):
    """A campus building door (top-left of the 2x2 door) with a footprint w x h above it."""
    return name, x, y, w, h


def test_size_is_clamped_from_footprint():
    assert interiors.interior_size(4, 3) == (12, 10)
    assert interiors.interior_size(80, 60) == (40, 30)
    assert interiors.interior_size(20, 14) == (20, 14)


def test_interior_has_floor_wall_ring_and_exit_door():
    m = interiors.build_interior("CS/IT Block", "cs-it-block", 20, 14, random.Random(1))
    keys = {p.key for p in m.placements}
    assert {"int-floor", "int-wall-h", "int-wall-v", "int-wall-corner", "door"} <= keys
    floors = [p for p in m.placements if p.key == "int-floor"]
    assert len(floors) == (20 - 2) * (14 - 2)
    doors = [p for p in m.placements if p.key == "door"]
    assert len(doors) == 1 and doors[0].y == 14 - 2 and 8 <= doors[0].x <= 10
    assert m.spawn == (doors[0].x, doors[0].y - 1)
    assert m.exit == (doors[0].x, doors[0].y)


def test_department_gets_desks_hostel_gets_couches():
    dept = interiors.build_interior("Civil Dept", "civil-dept", 24, 16, random.Random(1))
    hostel = interiors.build_interior("Amarkantak Hostel", "amarkantak-hostel", 24, 16, random.Random(1))
    assert any(p.key == "int-desk" for p in dept.placements) and any(p.key == "int-whiteboard" for p in dept.placements)
    assert any(p.key == "int-couch" for p in hostel.placements) and not any(p.key == "int-desk" for p in hostel.placements)


def test_furniture_never_blocks_the_door_column_or_walls():
    m = interiors.build_interior("Civil Dept", "civil-dept", 24, 16, random.Random(1))
    ex, ey = m.exit
    for p in m.placements:
        e = m.elements[p.key]
        if e.layer == "floor" or p.key in ("door",) or p.key.startswith("int-wall"):
            continue
        for dx in range(e.width):
            for dy in range(e.height):
                assert 1 <= p.x + dx <= 24 - 2 and 1 <= p.y + dy <= 16 - 2, p
                assert not (p.x + dx in (ex, ex + 1) and p.y + dy >= ey - 3), p  # keep the way to the exit clear


def test_portal_pairs_are_consistent():
    campus = Layout(50, 50)
    campus.doors = [("CS/IT Block", 10, 20), ("Canteen", 30, 40)]
    result = interiors.build_all(campus, {"CS/IT Block": (20, 14), "Canteen": (6, 4)}, random.Random(1))
    assert [m.map_id for m in result.maps] == ["gec-bilaspur-cs-it-block", "gec-bilaspur-canteen"]
    outgoing = [p for p in result.portals if p.map_id == "gec-bilaspur-campus"]
    assert len(outgoing) == 2
    cs = next(p for p in outgoing if p.target_map_id == "gec-bilaspur-cs-it-block")
    assert (cs.x, cs.y, cs.width, cs.height) == (10, 20, 2, 2)
    inner = next(m for m in result.maps if m.map_id == "gec-bilaspur-cs-it-block")
    assert (cs.target_x, cs.target_y) == inner.spawn
    back = next(p for p in result.portals if p.map_id == "gec-bilaspur-cs-it-block")
    assert back.target_map_id == "gec-bilaspur-campus" and (back.target_x, back.target_y) == (10, 22)
    assert (back.x, back.y, back.width, back.height) == (inner.exit[0], inner.exit[1], 2, 1)
