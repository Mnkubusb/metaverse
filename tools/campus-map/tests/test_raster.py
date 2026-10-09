import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from campusmap.raster import Grid, bbox_of, fill_polygon, stroke_polyline  # noqa: E402


def test_grid_bounds():
    g = Grid(3, 2)
    assert g.get(2, 1) == "grass" and g.get(3, 0) is None and g.get(-1, 0) is None
    g.set(5, 5, "road")  # outside: ignored
    assert g.find("road") == []


def test_fill_square_exact_cells():
    g = Grid(10, 10)
    fill_polygon(g, [(2, 2), (6, 2), (6, 6), (2, 6), (2, 2)], "building:1")
    cells = set(g.find("building:1"))
    assert cells == {(x, y) for x in range(2, 6) for y in range(2, 6)}


def test_fill_concave_l_shape():
    g = Grid(10, 10)
    pts = [(0, 0), (4, 0), (4, 2), (2, 2), (2, 4), (0, 4), (0, 0)]
    fill_polygon(g, pts, "b")
    cells = set(g.find("b"))
    assert (3, 3) not in cells and (1, 3) in cells and (3, 1) in cells
    assert len(cells) == 12


def test_fill_clips_outside_grid():
    g = Grid(4, 4)
    fill_polygon(g, [(-3, -3), (2, -3), (2, 2), (-3, 2), (-3, -3)], "b")
    assert set(g.find("b")) == {(x, y) for x in range(0, 2) for y in range(0, 2)}


def test_stroke_horizontal_width_2():
    g = Grid(10, 10)
    stroke_polyline(g, [(0, 5), (10, 5)], 2, "road")
    cells = set(g.find("road"))
    assert cells == {(x, y) for x in range(10) for y in (4, 5)}


def test_stroke_width_3_is_centred():
    g = Grid(10, 10)
    stroke_polyline(g, [(0, 5.5), (10, 5.5)], 3, "road")
    ys = {y for _, y in g.find("road")}
    assert ys == {4, 5, 6}


def test_bbox_of():
    assert bbox_of([(1.2, 3.9), (4.7, 0.1)]) == (1, 0, 4, 3)


def test_orthogonalize_turns_diagonal_into_l_legs():
    from campusmap.raster import orthogonalize
    pts = orthogonalize([(0, 0), (10, 10)])
    assert pts == [(0, 0), (10, 0), (10, 10)]


def test_orthogonalize_vertical_first_when_steeper():
    from campusmap.raster import orthogonalize
    assert orthogonalize([(0, 0), (3, 10)]) == [(0, 0), (0, 10), (3, 10)]


def test_orthogonalize_simplifies_jitter_first():
    from campusmap.raster import orthogonalize
    # tiny wobble along a straight line collapses to a single leg
    assert orthogonalize([(0, 0), (5, 0.4), (10, 0)]) == [(0, 0), (10, 0)]


def test_orthogonalize_keeps_endpoints():
    from campusmap.raster import orthogonalize
    pts = orthogonalize([(1.2, 3.4), (7.7, 2.1), (9.9, 8.8)])
    assert pts[0] == (1.2, 3.4) and pts[-1] == (9.9, 8.8)
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        assert ax == bx or ay == by


def test_orthogonalize_bounds_deviation_on_long_diagonals():
    from campusmap.raster import _dist_to_segment, orthogonalize
    pts = orthogonalize([(0, 0), (48, 48)])
    assert len(pts) > 3
    for (x, y) in pts:
        assert _dist_to_segment(x, y, 0, 0, 48, 48) <= 12
