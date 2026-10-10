import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from campusmap.autotile import ring_variant, road_variant  # noqa: E402


def region(cells):
    s = set(cells)
    return lambda x, y: (x, y) in s


def test_road_straight_h():
    same = region([(x, 0) for x in range(5)])
    assert road_variant(same, 2, 0) == "road-h"


def test_road_straight_v():
    same = region([(0, y) for y in range(5)])
    assert road_variant(same, 0, 2) == "road-v"


def test_road_cross():
    same = region([(x, 2) for x in range(5)] + [(2, y) for y in range(5)])
    assert road_variant(same, 2, 2) == "road-x"


def test_road_corner_and_t_fall_back_to_plain():
    same = region([(0, 0), (1, 0), (1, 1)])
    assert road_variant(same, 1, 0) == "road-plain"
    same = region([(0, 1), (1, 1), (2, 1), (1, 2)])
    assert road_variant(same, 1, 1) == "road-plain"


def test_road_wide_interior_is_plain():
    same = region([(x, y) for x in range(5) for y in range(3)])
    assert road_variant(same, 2, 1) == "road-plain"


def test_ring_variants_on_3x3_block():
    same = region([(x, y) for x in range(3) for y in range(3)])
    assert ring_variant(same, 0, 0) == "corner-tl"
    assert ring_variant(same, 2, 0) == "corner-tr"
    assert ring_variant(same, 0, 2) == "corner-bl"
    assert ring_variant(same, 2, 2) == "corner-br"
    assert ring_variant(same, 1, 0) == "top"
    assert ring_variant(same, 1, 2) == "bottom"
    assert ring_variant(same, 0, 1) == "left"
    assert ring_variant(same, 2, 1) == "right"
    assert ring_variant(same, 1, 1) == "inner"


def test_ring_single_width_strip_prefers_bottom():
    same = region([(x, 0) for x in range(3)])
    assert ring_variant(same, 1, 0) == "bottom"
