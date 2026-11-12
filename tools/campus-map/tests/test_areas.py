import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from campusmap import areas, emit, layout  # noqa: E402
from campusmap.geo import Feature  # noqa: E402


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)]


def campus():
    feats = [
        Feature(kind="building", name="Civil Dept", points=rect(5, 5, 15, 12), osm_id=1),
        Feature(kind="building", name="Amarkantak Hostel", points=rect(20, 5, 30, 12), osm_id=2),
        Feature(kind="road", name=None, points=[(-2, 20.5), (42, 20.5)], osm_id=50, width=3),
    ]
    return layout.build(feats, 40, 30, random.Random(1))


def test_template_for_names():
    assert areas.template_for("Main Building") == "admin"
    assert areas.template_for("Visvesvaraya Hall") == "auditorium"
    assert areas.template_for("CS/IT Annexe") == "lab"
    assert areas.template_for("SVNS Hostel") == "hostel"
    assert areas.template_for("Mining Dept") == "dept"


def test_rooms_and_door_mats_both_ways():
    lay = campus()
    rb = areas.RoomBuilder(lay)
    defs = rb.build()
    assert [a["id"] for a in defs] == ["in-civil-dept", "in-civil-dept-1f", "in-civil-dept-2f",
                                       "in-amarkantak-hostel", "in-amarkantak-hostel-1f", "in-amarkantak-hostel-2f"]
    civil = defs[0]
    w, h = areas.SIZES["dept"]
    assert (civil["width"], civil["height"]) == (w + areas.STAIR_W, h)
    name, dx, dy = next(d for d in lay.doors if d[0] == "Civil Dept")
    mats = [p for p in lay.placements if p.key == "door-in" and p.area == "main" and p.to and p.to[0] == "in-civil-dept"]
    assert sorted((p.x, p.y) for p in mats) == [(dx, dy + 2), (dx + 1, dy + 2)]
    assert mats[0].to == ("in-civil-dept", civil["spawnX"], civil["spawnY"])
    exits = [p for p in lay.placements if p.key == "door-out" and p.area == "in-civil-dept"]
    assert len(exits) == 2 and all(p.to == ("main", dx, dy + 3) for p in exits)
    assert any(p.area == "in-civil-dept" and p.key.startswith("floor-tile") for p in lay.placements)
    assert any(p.area == "in-amarkantak-hostel" and p.key == "bed" for p in lay.placements)


def test_interior_elements_are_registered_with_images():
    lay = campus()
    rb = areas.RoomBuilder(lay)
    rb.build()
    assert "door-in" in rb.images and lay.elements["door-in"].layer == "floor"
    assert lay.elements["in-wall-front"].static and lay.elements["in-wall-front"].layer == "wall"


def test_json_carries_areas_and_door_targets():
    lay = campus()
    defs = areas.RoomBuilder(lay).build()
    data = emit.to_json(lay, "gec-bilaspur-campus", "GEC Bilaspur Campus", "/campus/thumb.png", defs)
    assert data["map"]["areas"] == defs
    door = next(p for p in data["placements"] if p["elementId"] == "campus-door-in")
    assert door["area"] == "main" and door["toArea"] == "in-civil-dept"
    assert isinstance(door["toX"], int) and isinstance(door["toY"], int)
    inside = next(p for p in data["placements"] if p["area"] == "in-civil-dept")
    assert "toArea" not in inside or inside["toArea"] is None


def test_validate_checks_every_area_and_door(tmp_path):
    lay = campus()
    defs = areas.RoomBuilder(lay).build()
    for e in lay.elements.values():
        (tmp_path / e.image_url.rsplit("/", 1)[-1]).write_bytes(b"")
    assert emit.validate(lay, tmp_path, defs) == []
    # block the civil room's spawn: reported
    lay.placements.append(layout.Placement("in-wall-side", defs[0]["spawnX"], defs[0]["spawnY"], "in-civil-dept"))
    errs = emit.validate(lay, tmp_path, defs)
    assert any("in-civil-dept" in e for e in errs)


def test_stairs_join_the_floors_both_ways():
    lay = campus()
    defs = areas.RoomBuilder(lay).build()
    def stairs(key, area):
        return [p for p in lay.placements if p.key == key and p.area == area]
    assert all(p.to[0] == "in-civil-dept-1f" for p in stairs("stairs-up", "in-civil-dept"))
    assert all(p.to[0] == "in-civil-dept" for p in stairs("stairs-down", "in-civil-dept-1f"))
    # the middle floor has both ways, on different tiles
    up1, down1 = stairs("stairs-up", "in-civil-dept-1f"), stairs("stairs-down", "in-civil-dept-1f")
    assert len(up1) == 4 and len(down1) == 4
    assert not {(p.x, p.y) for p in up1} & {(p.x, p.y) for p in down1}
    assert all(p.to[0] == "in-civil-dept-2f" for p in up1)
    assert not stairs("stairs-up", "in-civil-dept-2f")
    assert "Second floor" in next(a for a in defs if a["id"] == "in-civil-dept-2f")["name"]
    # upper floors have no way outside
    assert not any(p.key == "door-out" and p.area in ("in-civil-dept-1f", "in-civil-dept-2f") for p in lay.placements)


def test_ring_buildings_get_an_open_courtyard():
    lay = layout.build([Feature(kind="building", name="Amarkantak Hostel", points=rect(2, 2, 22, 18), osm_id=2, yard=3),
                        Feature(kind="road", name=None, points=[(-2, 22.5), (32, 22.5)], osm_id=50, width=3)],
                       30, 26, random.Random(1))
    roofs = {(p.x, p.y) for p in lay.placements if p.key.startswith("roof-")}
    assert (12, 10) not in roofs and (5, 3) in roofs
