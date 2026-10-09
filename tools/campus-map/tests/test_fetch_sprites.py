import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import fetch_sprites  # noqa: E402


def make_sheet(path, tile, cols, rows):
    im = Image.new("RGBA", (cols * tile, rows * tile), (0, 0, 0, 0))
    for r in range(rows):
        for c in range(cols):
            colour = (c * 40 % 256, r * 40 % 256, 100, 255)
            for y in range(tile):
                for x in range(tile):
                    im.putpixel((c * tile + x, r * tile + y), colour)
    im.save(path)


def test_slice_single_tile_upscaled(tmp_path):
    pack = tmp_path / "packs" / "demo"
    pack.mkdir(parents=True)
    make_sheet(pack / "sheet.png", 16, 4, 4)
    manifest = {
        "road-h": {"pack": "demo", "sheet": "sheet.png", "tile": 16, "x": 2, "y": 1, "w": 1, "h": 1, "scale": 2}
    }
    out = tmp_path / "out"
    names = fetch_sprites.slice_manifest(manifest, {"demo": pack}, out)
    assert names == ["road-h"]
    im = Image.open(out / "road-h.png")
    assert im.size == (32, 32)
    assert im.getpixel((0, 0)) == (80, 40, 100, 255)


def test_slice_composites_layers(tmp_path):
    pack = tmp_path / "packs" / "demo"
    pack.mkdir(parents=True)
    make_sheet(pack / "sheet.png", 32, 2, 2)
    overlay = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    overlay.putpixel((5, 5), (255, 255, 255, 255))
    overlay.save(pack / "overlay.png")
    manifest = {
        "wall-window": {
            "pack": "demo", "sheet": "sheet.png", "tile": 32, "x": 0, "y": 0, "w": 1, "h": 1, "scale": 1,
            "over": [{"sheet": "overlay.png", "tile": 32, "x": 0, "y": 0}],
        }
    }
    out = tmp_path / "out"
    fetch_sprites.slice_manifest(manifest, {"demo": pack}, out)
    im = Image.open(out / "wall-window.png")
    assert im.getpixel((5, 5)) == (255, 255, 255, 255)
    assert im.getpixel((0, 0)) == (0, 0, 100, 255)


def test_slice_removes_stale_files(tmp_path):
    pack = tmp_path / "packs" / "demo"
    pack.mkdir(parents=True)
    make_sheet(pack / "sheet.png", 16, 2, 2)
    out = tmp_path / "out"
    out.mkdir()
    (out / "old.png").write_bytes(b"x")
    (out / "CREDITS.md").write_text("keep")
    (out / "notice-board.png").write_bytes(b"x")
    manifest = {"a": {"pack": "demo", "sheet": "sheet.png", "tile": 16, "x": 0, "y": 0, "w": 1, "h": 1, "scale": 2}}
    fetch_sprites.slice_manifest(manifest, {"demo": pack}, out)
    assert not (out / "old.png").exists()
    assert (out / "CREDITS.md").exists()
    assert (out / "notice-board.png").exists()  # hand-made board art is not in the manifest
