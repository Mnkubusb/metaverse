import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from campusmap import emit  # noqa: E402
from campusmap.layout import ElementDef, Layout, Placement  # noqa: E402

WALL = ElementDef("wall-a", "/campus/wall-a.png", 1, 1, True, "wall")
GRASS = ElementDef("grass", "/campus/grass.png", 1, 1, False, "floor")


def test_to_json_schema():
    lay = Layout(4, 3)
    lay.elements = {"wall-a": WALL, "grass": GRASS}
    lay.placements = [Placement("grass", 0, 0), Placement("wall-a", 1, 1)]
    lay.spawn = (0, 0)
    data = emit.to_json(lay, "gec-bilaspur-campus", "GEC Bilaspur Campus", "/campus/gec-bilaspur-thumb.png")
    assert data["map"] == {"id": "gec-bilaspur-campus", "name": "GEC Bilaspur Campus", "width": 4, "height": 3,
                           "thumbnail": "/campus/gec-bilaspur-thumb.png", "spawnX": 0, "spawnY": 0}
    assert {"id": "campus-wall-a", "imageUrl": "/campus/wall-a.png", "width": 1, "height": 1, "static": True, "layer": "wall"} in data["elements"]
    assert data["placements"] == [{"elementId": "campus-grass", "x": 0, "y": 0}, {"elementId": "campus-wall-a", "x": 1, "y": 1}]


def test_validate_reports_out_of_bounds_and_overlap_and_blocked_spawn(tmp_path):
    lay = Layout(4, 4)
    lay.elements = {"wall-a": WALL}
    lay.placements = [Placement("wall-a", 3, 3), Placement("wall-a", 5, 0), Placement("wall-a", 3, 3)]
    lay.spawn = (3, 3)
    (tmp_path / "wall-a.png").write_bytes(b"")
    errs = emit.validate(lay, tmp_path)
    assert any("out of bounds" in e for e in errs)
    assert any("overlaps" in e for e in errs)
    assert any("spawn" in e for e in errs)


def test_validate_reports_missing_sprite(tmp_path):
    lay = Layout(4, 4)
    lay.elements = {"wall-a": WALL}
    lay.placements = [Placement("wall-a", 0, 0)]
    lay.spawn = (2, 2)
    assert emit.validate(lay, tmp_path) == ["missing sprite wall-a.png"]


def test_render_sign_size_and_opaque_centre():
    im = emit.render_sign("Canteen", 3, 1)
    assert im.size == (96, 32)
    assert im.getpixel((48, 16))[3] == 255


def test_render_preview_composites_layers(tmp_path):
    Image.new("RGBA", (32, 32), (0, 255, 0, 255)).save(tmp_path / "grass.png")
    Image.new("RGBA", (32, 32), (255, 0, 0, 255)).save(tmp_path / "wall-a.png")
    lay = Layout(2, 1)
    lay.elements = {"wall-a": WALL, "grass": GRASS}
    lay.placements = [Placement("grass", 0, 0), Placement("grass", 1, 0), Placement("wall-a", 1, 0)]
    im = emit.render_preview(lay, tmp_path)
    assert im.size == (64, 32)
    assert im.getpixel((5, 5)) == (0, 255, 0, 255) and im.getpixel((40, 5)) == (255, 0, 0, 255)
