import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from campusmap import textures  # noqa: E402


def test_grass_variants_are_distinct_and_seamless():
    tiles = [textures.grass_plain(), textures.grass_tufts(), textures.grass_flowers(), textures.grass_clover()]
    assert len({t.tobytes() for t in tiles}) == 4
    for t in tiles:
        assert t.size == (32, 32)
        # the outer 2 px ring (one logical pixel) is plain base grass, so any two variants tile cleanly
        edge = [t.getpixel((x, y)) for x in range(32) for y in range(32) if min(x, y, 31 - x, 31 - y) < 2]
        assert set(edge) == {textures.BASE}


def test_ground_tint_covers_the_map_and_is_deterministic():
    a, b = textures.ground_tint(10, 7), textures.ground_tint(10, 7)
    assert a.size == (320, 224) and a.tobytes() == b.tobytes()
