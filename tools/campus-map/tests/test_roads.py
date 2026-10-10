import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from campusmap import roads  # noqa: E402
from campusmap.geo import Feature  # noqa: E402
from campusmap.raster import Grid  # noqa: E402


def road(points, width=3, osm_id=1):
    return Feature(kind="road", name=None, points=points, osm_id=osm_id, width=width)


def test_render_draws_asphalt_and_sidewalk_along_a_diagonal():
    im = roads.render([road([(2, 2), (18, 18)])], 20, 20)
    assert im.size == (640, 640)
    assert im.getpixel((10 * 32, 10 * 32))[:3] == roads.ASPHALT[:3]       # on the centre line
    assert im.getpixel((10 * 32 + 45, 10 * 32 - 45))[:3] == roads.SIDEWALK[:3]  # ~2 tiles off, perpendicular
    assert im.getpixel((2 * 32, 17 * 32))[3] == 0                        # far away: transparent


def test_slice_dedupes_identical_tiles_and_skips_empty_ones():
    im = roads.render([road([(0, 5.5), (20, 5.5)])], 20, 12)
    tiles, cells = roads.slice_tiles(im)
    assert len(cells) > 0 and all(0 <= x < 20 and 0 <= y < 12 for x, y in cells)
    assert len(tiles) < len(cells)  # straight road = few distinct tiles
    assert all(Image.open(__import__("io").BytesIO(png)).size == (32, 32) for png in tiles.values())
    assert all(cells[c] in tiles for c in cells)


def test_classify_marks_walkable_road_and_sidewalk_cells():
    im = roads.render([road([(0, 5.5), (20, 5.5)])], 20, 12)
    grid = Grid(20, 12)
    roads.classify(im, grid)
    assert grid.get(10, 5) == "road" and grid.get(10, 4) == "road" and grid.get(10, 6) == "road"
    assert grid.get(10, 3) == "sidewalk" and grid.get(10, 7) == "sidewalk"
    assert grid.get(10, 1) == "grass"


def test_diagonal_road_cells_form_a_connected_walkable_path():
    im = roads.render([road([(2, 2), (18, 18)])], 20, 20)
    grid = Grid(20, 20)
    roads.classify(im, grid)
    cells = set(grid.find("road"))
    assert (2, 2) in cells and (18, 18) in cells
    # 4-connected walk from one end to the other
    seen, stack = {(2, 2)}, [(2, 2)]
    while stack:
        x, y = stack.pop()
        for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if n in cells and n not in seen:
                seen.add(n)
                stack.append(n)
    assert (18, 18) in seen
