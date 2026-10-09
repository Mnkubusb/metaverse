import sys
import tomllib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import fetch_sprites  # noqa: E402

HERE = Path(__file__).resolve().parents[1]

REQUIRED = {
    "grass", "grass-tuft", "lawn", "flowerbed", "court", "paver", "asphalt",
    "road-h", "road-v", "road-x", "road-plain", "mark-p", "mark-bike",
    "roof-a", "roof-b", "roof-c", "roof-d",
    "wall-a", "wall-b", "wall-c", "wall-d",
    "wallbase-a", "wallbase-b", "wallbase-c", "wallbase-d",
    "window-a", "window-b", "window-c", "window-d",
    "door", "tree-a", "tree-b", "lamp", "bench",
    "car-h-green", "car-h-gray", "car-h-orange", "car-v-green", "car-v-gray", "car-v-orange",
    "bike", "bin", "cone", "flag", "gate-pillar",
}


def test_manifest_has_every_sprite_the_layout_needs():
    m = tomllib.loads((HERE / "tiles.toml").read_text())
    assert REQUIRED <= set(m), REQUIRED - set(m)


def test_manifest_entries_land_on_32px_grid():
    m = tomllib.loads((HERE / "tiles.toml").read_text())
    for name, spec in m.items():
        assert spec["pack"] in fetch_sprites.PACKS, name
        assert spec["tile"] * spec.get("scale", 1) == 32, name


def test_sprite_sizes_match_manifest():
    sys.path.insert(0, str(HERE))
    from campusmap.layout import SPRITE_SIZES
    m = tomllib.loads((HERE / "tiles.toml").read_text())
    for name, (w, h) in SPRITE_SIZES.items():
        if name in m:
            assert (m[name].get("w", 1), m[name].get("h", 1)) == (w, h), name


def test_generated_map_fits_payload_budget():
    import json
    data = json.loads((HERE.parents[1] / "packages/db/prisma/maps/gec-bilaspur.json").read_text())
    assert len(data["placements"]) < 10000
    assert not any(p["elementId"] in ("campus-grass", "campus-grass-tuft") for p in data["placements"])
