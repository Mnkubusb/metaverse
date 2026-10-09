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
