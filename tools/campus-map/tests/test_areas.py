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
    assert [a["id"] for a in defs] == ["in-civil-dept", "in-amarkantak-hostel"]
    civil = defs[0]
    assert (civil["width"], civil["height"]) == areas.SIZES["dept"]
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
