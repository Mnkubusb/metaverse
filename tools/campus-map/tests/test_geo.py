import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from campusmap import geo  # noqa: E402


def test_projector_origin_and_scale():
    p = geo.Projector((82.0, 22.0, 82.01, 22.01))
    x, y = p.to_tile(22.01, 82.0)  # NW corner
    assert (round(x), round(y)) == (geo.MARGIN, geo.MARGIN)
    # 3 m east ≈ one tile
    dlon = 3.0 / (111320 * math.cos(math.radians(22.005)))
    x2, _ = p.to_tile(22.01, 82.0 + dlon)
    assert abs((x2 - x) - 1.0) < 0.01
    # 3 m south ≈ one tile, y grows downward
    dlat = 3.0 / 111320
    _, y2 = p.to_tile(22.01 - dlat, 82.0)
    assert abs((y2 - y) - 1.0) < 0.01


def test_projector_size_includes_margin():
    p = geo.Projector((82.0, 22.0, 82.001, 22.001))
    inner_h = 0.001 * 111320 / 3
    assert p.height == math.ceil(inner_h) + 2 * geo.MARGIN


def square(nid0, lat, lon, d=0.0001):
    nodes = [
        {"type": "node", "id": nid0, "lat": lat, "lon": lon},
        {"type": "node", "id": nid0 + 1, "lat": lat, "lon": lon + d},
        {"type": "node", "id": nid0 + 2, "lat": lat - d, "lon": lon + d},
        {"type": "node", "id": nid0 + 3, "lat": lat - d, "lon": lon},
    ]
    return nodes, [nid0, nid0 + 1, nid0 + 2, nid0 + 3, nid0]


def test_load_features_classifies_tags():
    nodes, ring = square(1, 22.001, 82.0)
    osm = {"elements": nodes + [
        {"type": "way", "id": 10, "nodes": ring, "tags": {"building": "college", "name": "GEC Bilaspur CS/IT/ET&T Building"}},
        {"type": "way", "id": 11, "nodes": ring[:2], "tags": {"highway": "service"}},
        {"type": "way", "id": 12, "nodes": ring[:2], "tags": {"highway": "residential"}},
        {"type": "way", "id": 13, "nodes": ring, "tags": {"leisure": "garden"}},
        {"type": "way", "id": 14, "nodes": ring, "tags": {"leisure": "pitch"}},
        {"type": "way", "id": 15, "nodes": ring, "tags": {"amenity": "parking"}},
        {"type": "way", "id": 16, "nodes": ring, "tags": {"amenity": "motorcycle_parking"}},
        {"type": "way", "id": 17, "nodes": ring, "tags": {"amenity": "college", "name": "Electrical Quadrangle"}},
        {"type": "way", "id": 18, "nodes": ring, "tags": {"amenity": "college"}},
        {"type": "way", "id": 19, "nodes": ring, "tags": {"amenity": "university", "name": "Guru Ghasidas"}},
    ]}
    feats = geo.load_features(osm, geo.Projector((82.0, 22.0, 82.001, 22.001)))
    by_id = {f.osm_id: f for f in feats}
    assert by_id[10].kind == "building" and by_id[10].name == "CS/IT Block"
    assert by_id[11].kind == "road" and by_id[11].width == 2
    assert by_id[12].kind == "road" and by_id[12].width == 3
    assert by_id[13].kind == "lawn"
    assert by_id[14].kind == "court"
    assert by_id[15].kind == "asphalt" and by_id[15].sub == "parking"
    assert by_id[16].kind == "asphalt" and by_id[16].sub == "motorcycle_parking"
    assert by_id[17].kind == "paver"
    assert 18 not in by_id and 19 not in by_id


def test_load_features_skips_missing_nodes():
    nodes, ring = square(1, 22.001, 82.0)
    ring_with_gap = ring[:2] + [999] + ring[2:]
    osm = {"elements": nodes + [{"type": "way", "id": 10, "nodes": ring_with_gap, "tags": {"building": "yes"}}]}
    feats = geo.load_features(osm, geo.Projector((82.0, 22.0, 82.001, 22.001)))
    assert len(feats) == 1 and len(feats[0].points) == 5


def test_load_features_drops_degenerate_ways():
    nodes, ring = square(1, 22.001, 82.0)
    osm = {"elements": nodes + [{"type": "way", "id": 10, "nodes": [1, 999, 998], "tags": {"building": "yes"}}]}
    assert geo.load_features(osm, geo.Projector((82.0, 22.0, 82.001, 22.001))) == []


def test_display_name_alias_and_passthrough():
    assert geo.display_name("Amarkantak Boys Hostel GEC") == "Amarkantak Hostel"
    assert geo.display_name("Unknown Hall") == "Unknown Hall"
    assert geo.display_name(None) is None
