import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from campusmap import layout  # noqa: E402
from campusmap.geo import Feature  # noqa: E402


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)]


def building(name, x0, y0, x1, y1, osm_id=1):
    return Feature(kind="building", name=name, points=rect(x0, y0, x1, y1), osm_id=osm_id)


def road_h(y, x0, x1, width=2, osm_id=50):
    return Feature(kind="road", name=None, points=[(x0, y), (x1, y)], osm_id=osm_id, width=width)


def placed(lay, key):
    return [(p.x, p.y) for p in lay.placements if p.key == key]


def test_building_ring_and_roof():
    lay = layout.build([building("CS/IT Block", 5, 5, 11, 11)], 20, 20, random.Random(1))
    # footprint 6x6 at 5..10: 20 ring cells + 16 roof cells
    ring = [p for p in lay.placements if p.key.startswith(("wall-", "wallbase-", "window-"))]
    roof = [p for p in lay.placements if p.key.startswith("roof-")]
    assert len(ring) + 2 == 20  # two bottom-edge cells are covered by the door instead
    assert len(roof) == 16
    assert all(lay.elements[p.key].layer == "wall" and lay.elements[p.key].static for p in ring)


def test_door_faces_nearest_road_and_sign_above():
    feats = [building("Canteen", 5, 5, 11, 11), road_h(13.0, 0, 20)]
    lay = layout.build(feats, 20, 20, random.Random(1))
    assert lay.doors == [("Canteen", 7, 9)]  # bottom edge y=10, door is 2 tall → top-left at y=9
    d = lay.elements["door"]
    assert d.layer == "objects" and d.static is False and d.image_url.endswith("door.png")
    assert (7, 9) in placed(lay, "door")
    sign = [p for p in lay.placements if p.key.startswith("sign:")]
    assert len(sign) == 1 and sign[0].y == 8 and lay.signs[sign[0].key] == "Canteen"


def test_door_on_north_edge_when_road_is_north():
    feats = [building("Canteen", 5, 8, 11, 14), road_h(3.0, 0, 20)]
    lay = layout.build(feats, 20, 20, random.Random(1))
    # north-facing doors are drawn on the bottom edge anyway (top-down art has no back doors);
    # the approach path becomes a paver strip around the building to the road.
    assert lay.doors[0][0] == "Canteen"
    assert len(placed(lay, "paver")) > 0


def test_building_without_road_still_gets_door():
    lay = layout.build([building("Lonely Hall", 5, 5, 11, 11)], 20, 20, random.Random(1))
    assert len(lay.doors) == 1 and lay.doors[0][2] == 9


def test_touching_buildings_do_not_overlap_walls():
    feats = [building("A", 2, 2, 8, 8, osm_id=1), building("B", 8, 2, 14, 8, osm_id=2)]
    lay = layout.build(feats, 20, 20, random.Random(1))
    seen = set()
    for p in lay.placements:
        e = lay.elements[p.key]
        if e.layer != "wall":
            continue
        for dx in range(e.width):
            for dy in range(e.height):
                assert (p.x + dx, p.y + dy) not in seen
                seen.add((p.x + dx, p.y + dy))


def test_trees_skip_door_approach():
    feats = [building("Canteen", 5, 5, 11, 11), road_h(13.0, 0, 20)]
    lay = layout.build(feats, 20, 20, random.Random(1))
    approach = {(x, y) for x in (7, 8) for y in (11, 12)}
    for key in ("tree-a", "tree-b", "lamp", "bin"):
        for (x, y) in placed(lay, key):
            h = layout.SPRITE_SIZES[key][1]
            assert (x, y + h - 1) not in approach, key


def test_unnamed_building_has_no_sign_or_door():
    lay = layout.build([building(None, 5, 5, 11, 11)], 20, 20, random.Random(1))
    assert lay.doors == [] and not any(p.key.startswith("sign:") for p in lay.placements)


def test_road_cells_become_floor_and_spawn_is_on_road():
    feats = [road_h(10.5, 0, 20, width=3)]  # centred on a tile centre so width 3 covers rows 9..11
    lay = layout.build(feats, 20, 20, random.Random(1))
    roads = placed(lay, "road-h") + placed(lay, "road-plain") + placed(lay, "road-v") + placed(lay, "road-x")
    assert len(roads) == 60
    assert lay.spawn in set(roads)
    assert lay.elements["road-plain"].layer == "floor"


def test_parking_gets_cars_and_bikes():
    car_park = Feature(kind="asphalt", name=None, points=rect(2, 2, 10, 6), osm_id=3, sub="parking")
    bike_park = Feature(kind="asphalt", name=None, points=rect(2, 10, 10, 14), osm_id=4, sub="motorcycle_parking")
    lay = layout.build([car_park, bike_park], 20, 20, random.Random(1))
    cars = [p for p in lay.placements if p.key.startswith("car-")]
    assert cars and placed(lay, "bike")
    assert all(2 <= p.x < 10 and 2 <= p.y < 6 for p in cars)


def test_door_avoids_bottom_edge_blocked_by_another_building():
    # A's widest bottom run (x 2..7) sits on top of B; only x 8..11 opens onto ground
    feats = [building("A", 2, 2, 12, 8, osm_id=1), building(None, 2, 8, 8, 12, osm_id=2), road_h(14.5, 0, 20)]
    lay = layout.build(feats, 20, 20, random.Random(1))
    assert lay.doors == [("A", 9, 6)]


def test_gate_gets_notice_board_and_welcome_sign():
    lay = layout.build([road_h(15.5, 8, 22, width=3)], 30, 20, random.Random(1))
    assert placed(lay, "notice-board") and placed(lay, "sign-welcome")
    assert lay.elements["notice-board"].layer == "objects" and lay.elements["notice-board"].static
    assert (lay.elements["notice-board"].width, lay.elements["notice-board"].height) == (2, 2)
    assert (lay.elements["sign-welcome"].width, lay.elements["sign-welcome"].height) == (3, 2)


def test_first_hostel_gets_hostels_sign():
    feats = [building("Amarkantak Hostel", 5, 5, 11, 11), road_h(13.0, 0, 20)]
    lay = layout.build(feats, 20, 20, random.Random(1))
    assert len(placed(lay, "sign-hostels")) == 1


def test_roads_are_axis_aligned_after_paint():
    feats = [Feature(kind="road", name=None, points=[(2, 2), (18, 18)], osm_id=7, width=2)]
    grid = layout.paint(feats, 20, 20)
    cells = set(grid.find("road"))
    # an L: a horizontal run along y≈2 and a vertical run along x≈18, no diagonal stair cells
    assert (10, 1) in cells or (10, 2) in cells
    assert (17, 10) in cells or (18, 10) in cells
    assert (10, 10) not in cells


def test_three_wide_road_dashes_only_on_centre_row():
    lay = layout.build([road_h(10.5, 2, 18, width=3)], 20, 20, random.Random(1))
    assert {y for _, y in placed(lay, "road-h")} == {10}
    assert {y for _, y in placed(lay, "road-plain")} >= {9, 11}


def test_two_wide_road_has_no_dashes():
    lay = layout.build([road_h(10.0, 2, 18, width=2)], 20, 20, random.Random(1))
    assert placed(lay, "road-h") == [] and len(placed(lay, "road-plain")) > 0


def test_sidewalk_borders_roads():
    lay = layout.build([road_h(10.5, 2, 18, width=3)], 20, 20, random.Random(1))
    sw = set(placed(lay, "sidewalk"))
    assert (10, 8) in sw and (10, 12) in sw and (10, 7) not in sw
    assert lay.elements["sidewalk"].layer == "floor"


def test_lamps_are_sparse():
    lay = layout.build([road_h(10.5, 0, 60, width=3)], 60, 20, random.Random(1))
    assert 0 < len(placed(lay, "lamp")) <= 12


def test_roof_uses_edge_and_corner_tiles():
    lay = layout.build([building("Hall", 2, 2, 10, 10)], 20, 20, random.Random(1))
    keys = {p.key for p in lay.placements if p.key.startswith("roof-")}
    assert {"roof-a-tl", "roof-a-t", "roof-a-tr", "roof-a-l", "roof-a-r", "roof-a-bl", "roof-a-b", "roof-a-br", "roof-a"} <= keys
    assert (3, 3) in placed(lay, "roof-a-tl") and (8, 8) in placed(lay, "roof-a-br") and (5, 5) in placed(lay, "roof-a")


def test_no_grass_placements_renderer_paints_the_base():
    lay = layout.build([road_h(10.5, 2, 18, width=3)], 20, 20, random.Random(1))
    assert placed(lay, "grass") == [] and placed(lay, "grass-tuft") == []


def test_gate_pillars_never_block_road():
    # a 3-wide road whose lowest row is narrower than the rows above it
    feats = [road_h(15.5, 4, 16, width=3), Feature(kind="road", name=None, points=[(10, 15.5), (10, 19)], osm_id=8, width=2)]
    lay = layout.build(feats, 20, 20, random.Random(1))
    grid = layout.paint(feats, 20, 20)
    roads = set(grid.find("road"))
    for (x, y) in placed(lay, "gate-pillar"):
        assert (x, y + 1) not in roads


def test_touching_buildings_pass_validate(tmp_path):
    from campusmap import emit
    feats = [building("A", 2, 2, 8, 8, osm_id=1), building("B", 8, 2, 14, 8, osm_id=2), road_h(12.0, 0, 20)]
    lay = layout.build(feats, 20, 20, random.Random(1))
    for e in lay.elements.values():
        (tmp_path / e.image_url.rsplit("/", 1)[-1]).write_bytes(b"")
    assert emit.validate(lay, tmp_path) == []
