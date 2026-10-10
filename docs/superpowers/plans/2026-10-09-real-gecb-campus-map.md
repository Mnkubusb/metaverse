# Real GEC Bilaspur Campus Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Regenerate the seeded "GEC Bilaspur Campus" map from real OpenStreetMap geometry, drawn with downloaded Kenney/LPC tiles instead of procedurally drawn pixel art.

**Architecture:** A small Python package `tools/campus-map/campusmap/` replaces the monolithic `generate.py`: `geo` (OSM → tile coords + feature classification), `raster` (polygon/line → cell grid), `autotile` (neighbour bitmask → tile variant), `layout` (buildings, doors, signs, props, spawn), `reach` (blocking + BFS), `emit` (JSON + PNG). Two fetch scripts pull OSM data and sprite packs; the committed OSM JSON and `tiles.toml` manifest make regeneration offline and reproducible. Output schema (`gec-bilaspur.json`) and the seed script are unchanged.

**Tech Stack:** Python 3.12+ (uses `tomllib`), Pillow, pytest, run through `uv run`. No JS changes except constants in `CampusMap.tsx`.

**Spec:** `docs/superpowers/specs/2026-10-09-real-gecb-campus-map-design.md`

## Global Constraints

- Tile size 32 px; 1 tile = 3 m; map origin = OSM bbox NW corner + 2-tile grass margin.
- OSM bbox (W,S,E,N): `82.1280,22.1340,82.1330,22.1385`.
- Output JSON schema unchanged: `{map:{id,name,width,height,thumbnail,spawnX,spawnY}, elements:[{id,imageUrl,width,height,static,layer}], placements:[{elementId,x,y}]}`; `layer ∈ floor|wall|objects|topObjects`; `map.id = "gec-bilaspur-campus"`.
- Blocking rules identical to `apps/ws/src/SpaceGrid.ts`: `wall`+static → whole footprint; `objects`+static → bottom row; `floor`/`topObjects` never.
- Door elements: `layer: objects`, `static: false`, imageUrl ends with `door.png`.
- Sprite licences: CC0 (Kenney), CC-BY-SA 3.0 / GPL 3.0 (LPC City Outside). `apps/web/public/campus/CREDITS.md` required.
- Generator never touches the network. Determinism: `random.Random(42)`.
- Python commands run as `uv run --with pillow --with pytest python …` / `uv run --with pillow --with pytest pytest …` from repo root (no venv to maintain). Python ≥ 3.11 for `tomllib`; the machine has 3.14.
- Commits: no `Co-Authored-By` trailers (user rule).

## Review Focus

1. OSM way whose node refs are missing from the bbox response (way crosses the bbox edge) — generator must skip the missing points, not crash. (Test in Task 2.)
2. Building polygon partially outside the map after margin — cells outside the grid must be clipped, not raise IndexError. (Test in Task 3.)
3. Two buildings whose footprints touch — both rings drawn, no wall placement overlaps another building's footprint; `validate` must still pass. (Test in Task 6.)
4. Building with no road within range — door must still be placed (on the south edge) rather than the building silently having no door. (Test in Task 6.)
5. Props placed on the door approach would trap the door — tree placement must skip the 3 tiles in front of a door. (Test in Task 6.)

---

### Task 1: Python tooling, gitignore, pack download script

**Files:**
- Create: `tools/campus-map/requirements.txt`
- Create: `tools/campus-map/fetch_sprites.py`
- Create: `tools/campus-map/tests/__init__.py` (empty)
- Create: `tools/campus-map/tests/test_fetch_sprites.py`
- Modify: `.gitignore` (append)

**Interfaces:**
- Produces: `fetch_sprites.download_packs(dest: Path) -> dict[str, Path]` (pack name → extracted dir), `fetch_sprites.slice_manifest(manifest: dict, packs: dict[str, Path], out_dir: Path) -> list[str]` (names written). Manifest format defined here, used by Task 5's `tiles.toml`.

- [ ] **Step 1: Add gitignore + requirements**

Append to `.gitignore`:

```
# campus map sprite packs (downloaded by tools/campus-map/fetch_sprites.py)
tools/campus-map/packs/
# python
__pycache__/
.pytest_cache/
```

`tools/campus-map/requirements.txt`:

```
pillow>=10
pytest>=8
```

- [ ] **Step 2: Write failing test for manifest slicing**

`tools/campus-map/tests/test_fetch_sprites.py`:

```python
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
    manifest = {"a": {"pack": "demo", "sheet": "sheet.png", "tile": 16, "x": 0, "y": 0, "w": 1, "h": 1, "scale": 2}}
    fetch_sprites.slice_manifest(manifest, {"demo": pack}, out)
    assert not (out / "old.png").exists()
    assert (out / "CREDITS.md").exists()
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `uv run --with pillow --with pytest pytest tools/campus-map/tests/test_fetch_sprites.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'fetch_sprites'`

- [ ] **Step 4: Implement `fetch_sprites.py`**

```python
#!/usr/bin/env python3
"""
Downloads the sprite packs used by the campus map and slices the tiles named in
tiles.toml into apps/web/public/campus/.

Packs (see apps/web/public/campus/CREDITS.md for attribution):
  roguelike-modern-city  Kenney, CC0
  tiny-town              Kenney, CC0
  lpc-city-outside       OpenGameArt, CC-BY-SA 3.0 / GPL 3.0

Manifest entry (tiles.toml):
  [road-h]
  pack = "roguelike-modern-city"   # key of PACKS
  sheet = "Tilemap/tilemap_packed.png"  # path inside the extracted pack
  tile = 16                        # source tile size in px
  x = 9        # column in the sheet
  y = 19       # row in the sheet
  w = 1        # tiles wide (optional, default 1)
  h = 1        # tiles tall (optional, default 1)
  scale = 2    # nearest-neighbour upscale so 16 px packs land on the 32 px grid
  over = [{ sheet = "...", tile = 32, x = 0, y = 0 }]  # optional overlays, same size

Run: uv run --with pillow python tools/campus-map/fetch_sprites.py
"""
import io
import shutil
import sys
import tomllib
import urllib.request
import zipfile
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PACKS_DIR = HERE / "packs"
MANIFEST = HERE / "tiles.toml"
OUT_DIR = ROOT / "apps/web/public/campus"
KEEP = {"CREDITS.md"}

PACKS = {
    "roguelike-modern-city": "https://kenney.nl/media/pages/assets/roguelike-modern-city/0ff3dfff2b-1677694743/kenney_roguelike-modern-city.zip",
    "tiny-town": "https://kenney.nl/media/pages/assets/tiny-town/a415fbeb49-1735736916/kenney_tiny-town.zip",
    "lpc-city-outside": "https://opengameart.org/sites/default/files/LPC_city_outside_1.zip",
}


def download_packs(dest: Path) -> dict[str, Path]:
    """Download + extract every pack not already present. Returns name -> dir."""
    dest.mkdir(parents=True, exist_ok=True)
    dirs = {}
    for name, url in PACKS.items():
        target = dest / name
        if not target.exists():
            req = urllib.request.Request(url, headers={"User-Agent": "metaverse-campus-map"})
            with urllib.request.urlopen(req, timeout=120) as resp:
                if resp.status != 200:
                    sys.exit(f"{url}: HTTP {resp.status}")
                data = resp.read()
            tmp = dest / (name + ".tmp")
            shutil.rmtree(tmp, ignore_errors=True)
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                zf.extractall(tmp)
            tmp.rename(target)
        dirs[name] = target
    return dirs


def _crop(pack_dir: Path, sheet: str, tile: int, x: int, y: int, w: int, h: int) -> Image.Image:
    path = pack_dir / sheet
    if not path.exists():
        sys.exit(f"missing sheet {path}")
    im = Image.open(path).convert("RGBA")
    box = (x * tile, y * tile, (x + w) * tile, (y + h) * tile)
    if box[2] > im.width or box[3] > im.height:
        sys.exit(f"{sheet}: tile ({x},{y}) {w}x{h} is outside the sheet")
    return im.crop(box)


def slice_manifest(manifest: dict, packs: dict[str, Path], out_dir: Path) -> list[str]:
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.iterdir():
        if old.name not in KEEP and old.is_file():
            old.unlink()
    names = []
    for name, spec in manifest.items():
        pack_dir = packs[spec["pack"]]
        w, h = spec.get("w", 1), spec.get("h", 1)
        im = _crop(pack_dir, spec["sheet"], spec["tile"], spec["x"], spec["y"], w, h)
        for layer in spec.get("over", []):
            ov = _crop(pack_dir, layer["sheet"], layer["tile"], layer["x"], layer["y"], w, h)
            im.alpha_composite(ov)
        scale = spec.get("scale", 1)
        if scale != 1:
            im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
        im.save(out_dir / f"{name}.png", optimize=True)
        names.append(name)
    return names


def main():
    manifest = tomllib.loads(MANIFEST.read_text())
    packs = download_packs(PACKS_DIR)
    names = slice_manifest(manifest, packs, OUT_DIR)
    print(f"wrote {len(names)} sprites to {OUT_DIR}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `uv run --with pillow --with pytest pytest tools/campus-map/tests/test_fetch_sprites.py -v`
Expected: 3 PASS

- [ ] **Step 6: Commit**

```bash
git add .gitignore tools/campus-map/requirements.txt tools/campus-map/fetch_sprites.py tools/campus-map/tests/
git commit -m "campus-map: sprite pack downloader and manifest slicer"
```

---

### Task 2: OSM fetch + geo module (load, project, classify)

**Files:**
- Create: `tools/campus-map/fetch_osm.py`
- Create: `tools/campus-map/osm/gec-bilaspur.osm.json` (fetched)
- Create: `tools/campus-map/osm/LICENSE`
- Create: `tools/campus-map/campusmap/__init__.py` (empty)
- Create: `tools/campus-map/campusmap/geo.py`
- Create: `tools/campus-map/tests/test_geo.py`

**Interfaces:**
- Produces:
  - `geo.BBOX = (82.1280, 22.1340, 82.1330, 22.1385)` (W,S,E,N), `geo.METERS_PER_TILE = 3.0`, `geo.MARGIN = 2`
  - `geo.Projector(bbox) ` with `.to_tile(lat, lon) -> tuple[float, float]`, `.width: int`, `.height: int`
  - `geo.Feature` dataclass: `kind: str` (`building|road|lawn|court|asphalt|paver`), `name: str | None`, `points: list[tuple[float,float]]` (tile coords, polygon closed or polyline), `width: int` (roads only), `osm_id: int`, `sub: str | None` (`parking|motorcycle_parking` for asphalt)
  - `geo.load_features(osm_json: dict, proj: Projector) -> list[Feature]`
  - `geo.ALIASES: dict[str, str]`, `geo.display_name(name: str | None) -> str | None`

- [ ] **Step 1: Write `fetch_osm.py` and fetch the data**

```python
#!/usr/bin/env python3
"""
Fetches the OSM features inside the GEC Bilaspur campus core and caches them in
osm/gec-bilaspur.osm.json. The generator reads only this file; run this script
when the campus data on OpenStreetMap has improved.

Run: python3 tools/campus-map/fetch_osm.py
"""
import json
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "osm" / "gec-bilaspur.osm.json"
BBOX = "82.1280,22.1340,82.1330,22.1385"  # W,S,E,N
URL = f"https://api.openstreetmap.org/api/0.6/map.json?bbox={BBOX}"


def main():
    req = urllib.request.Request(URL, headers={"User-Agent": "metaverse-campus-map"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        if resp.status != 200:
            sys.exit(f"{URL}: HTTP {resp.status}")
        data = json.load(resp)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=1) + "\n")
    tmp.rename(OUT)
    ways = sum(1 for e in data["elements"] if e["type"] == "way")
    print(f"wrote {OUT} ({ways} ways)")


if __name__ == "__main__":
    main()
```

`tools/campus-map/osm/LICENSE`:

```
The file gec-bilaspur.osm.json contains data from OpenStreetMap.
© OpenStreetMap contributors. Licensed under the Open Database License (ODbL) 1.0.
https://www.openstreetmap.org/copyright
```

Run: `python3 tools/campus-map/fetch_osm.py`
Expected: `wrote .../osm/gec-bilaspur.osm.json (N ways)` with N ≥ 30. Check that `grep -c '"CS/IT' tools/campus-map/osm/gec-bilaspur.osm.json` prints ≥ 1.

- [ ] **Step 2: Write failing geo tests**

`tools/campus-map/tests/test_geo.py`:

```python
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `uv run --with pillow --with pytest pytest tools/campus-map/tests/test_geo.py -v`
Expected: FAIL with `ImportError: cannot import name 'geo'` (or module not found)

- [ ] **Step 4: Implement `campusmap/geo.py`**

```python
"""OSM JSON -> tile-space features for the GEC Bilaspur campus."""
import math
from dataclasses import dataclass

BBOX = (82.1280, 22.1340, 82.1330, 22.1385)  # W, S, E, N
METERS_PER_TILE = 3.0
MARGIN = 2  # grass tiles around the bbox
M_PER_DEG = 111320.0

# OSM names are long; signs are short.
ALIASES = {
    "GEC Bilaspur CS/IT/ET&T Building": "CS/IT Block",
    "Government Engineering College Bilaspur": "Main Building",
    "M. Visvesvaraya Hall": "Visvesvaraya Hall",
    "Electrical Eng. Department": "Electrical Dept",
    "Civil Eng. Department": "Civil Dept",
    "Electronics Eng. Dept.": "Electronics Dept",
    "CS/IT Temporary Building": "CS/IT Annexe",
    "Mechanical Eng. Dept": "Mechanical Dept",
    "Workshop Building GEC": "Workshop",
    "Mining Eng. Dept": "Mining Dept",
    "Canteen GEC Bilaspur": "Canteen",
    "Amarkantak Boys Hostel GEC": "Amarkantak Hostel",
    "Shaheed Veer Narayan Singh Boys Hostel": "SVNS Hostel",
    "Panchsheel Boys Hostel GEC": "Panchsheel Hostel",
    "Royal Shubhash Garden": "Shubhash Garden",
    "Badminton Court GEC": "Badminton Court",
    "College Outdoor Fitness Gym": "Outdoor Gym",
    "Civil Department Ground": "Civil Ground",
    "Electrical Quadrangle": "Electrical Quad",
}


def display_name(name):
    if name is None:
        return None
    return ALIASES.get(name, name)


class Projector:
    """Equirectangular projection; origin = bbox NW corner + MARGIN tiles."""

    def __init__(self, bbox=BBOX):
        self.w, self.s, self.e, self.n = bbox
        self.cos = math.cos(math.radians((self.s + self.n) / 2))
        inner_w = (self.e - self.w) * M_PER_DEG * self.cos / METERS_PER_TILE
        inner_h = (self.n - self.s) * M_PER_DEG / METERS_PER_TILE
        self.width = math.ceil(inner_w) + 2 * MARGIN
        self.height = math.ceil(inner_h) + 2 * MARGIN

    def to_tile(self, lat, lon):
        x = (lon - self.w) * M_PER_DEG * self.cos / METERS_PER_TILE + MARGIN
        y = (self.n - lat) * M_PER_DEG / METERS_PER_TILE + MARGIN
        return x, y


@dataclass
class Feature:
    kind: str                 # building | road | lawn | court | asphalt | paver
    name: str | None
    points: list              # [(x, y), ...] tile coords; polygons repeat first point last
    osm_id: int
    width: int = 0            # roads: tiles
    sub: str | None = None    # asphalt: parking | motorcycle_parking


ROAD_WIDTH = {"service": 2, "residential": 3, "tertiary": 3}


def classify(tags):
    """Return (kind, width, sub) or None for ways we don't draw."""
    if "building" in tags:
        return "building", 0, None
    hw = tags.get("highway")
    if hw in ROAD_WIDTH:
        return "road", ROAD_WIDTH[hw], None
    leisure = tags.get("leisure")
    if leisure == "garden":
        return "lawn", 0, None
    if leisure == "pitch":
        return "court", 0, None
    amenity = tags.get("amenity")
    if amenity in ("parking", "motorcycle_parking"):
        return "asphalt", 0, amenity
    if amenity == "college" and tags.get("name"):
        return "paver", 0, None
    return None


def load_features(osm_json, proj):
    nodes = {e["id"]: (e["lat"], e["lon"]) for e in osm_json["elements"] if e["type"] == "node"}
    feats = []
    for e in osm_json["elements"]:
        if e["type"] != "way":
            continue
        tags = e.get("tags", {})
        c = classify(tags)
        if c is None:
            continue
        kind, width, sub = c
        pts = [proj.to_tile(*nodes[n]) for n in e["nodes"] if n in nodes]
        if len(pts) < (2 if kind == "road" else 4):
            continue
        feats.append(Feature(kind=kind, name=display_name(tags.get("name")), points=pts,
                             osm_id=e["id"], width=width, sub=sub))
    return feats
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `uv run --with pillow --with pytest pytest tools/campus-map/tests/test_geo.py -v`
Expected: 6 PASS

- [ ] **Step 6: Sanity-check against real data**

Run:
```bash
uv run --with pillow python -c "
import json,sys; sys.path.insert(0,'tools/campus-map')
from campusmap import geo
osm=json.load(open('tools/campus-map/osm/gec-bilaspur.osm.json'))
p=geo.Projector(); f=geo.load_features(osm,p)
print(p.width,p.height); import collections; print(collections.Counter(x.kind for x in f))
print([x.name for x in f if x.kind=='building'])"
```
Expected: size about `176 x 171` (bbox is 0.005° × 0.0045° ≈ 515 m × 500 m → ≈172 × 167 + margin); counter shows ≥ 15 buildings, ≥ 10 roads; names list includes `CS/IT Block`, `Canteen`, `Amarkantak Hostel`.

- [ ] **Step 7: Commit**

```bash
git add tools/campus-map/fetch_osm.py tools/campus-map/osm/ tools/campus-map/campusmap/ tools/campus-map/tests/test_geo.py
git commit -m "campus-map: fetch OSM campus data and project it to tiles"
```

---

### Task 3: Raster module (cell grid, polygon fill, polyline stroke)

**Files:**
- Create: `tools/campus-map/campusmap/raster.py`
- Create: `tools/campus-map/tests/test_raster.py`

**Interfaces:**
- Produces:
  - `raster.Grid(width, height, fill="grass")` with `.cells: list[list[str]]`, `.get(x, y) -> str | None` (None outside), `.set(x, y, v)` (no-op outside), `.find(kind) -> list[tuple[int,int]]`
  - `raster.fill_polygon(grid, points, value)` — even-odd scanline, cell counted when its centre is inside
  - `raster.stroke_polyline(grid, points, width, value)` — every cell whose centre is within `width/2` of the polyline
  - `raster.bbox_of(points) -> (x0, y0, x1, y1)` integer, inclusive

- [ ] **Step 1: Write failing tests**

`tools/campus-map/tests/test_raster.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run --with pillow --with pytest pytest tools/campus-map/tests/test_raster.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'campusmap.raster'`

- [ ] **Step 3: Implement `campusmap/raster.py`**

```python
"""Cell grid and rasterization of tile-space polygons / polylines."""
import math


class Grid:
    def __init__(self, width, height, fill="grass"):
        self.width, self.height = width, height
        self.cells = [[fill] * width for _ in range(height)]

    def inside(self, x, y):
        return 0 <= x < self.width and 0 <= y < self.height

    def get(self, x, y):
        return self.cells[y][x] if self.inside(x, y) else None

    def set(self, x, y, v):
        if self.inside(x, y):
            self.cells[y][x] = v

    def find(self, kind):
        return [(x, y) for y in range(self.height) for x in range(self.width) if self.cells[y][x] == kind]


def bbox_of(points):
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return math.floor(min(xs)), math.floor(min(ys)), math.floor(max(xs)), math.floor(max(ys))


def _inside(px, py, points):
    """Even-odd rule for point (px, py) against a closed polygon."""
    inside = False
    n = len(points)
    for i in range(n - 1):
        (x0, y0), (x1, y1) = points[i], points[i + 1]
        if (y0 > py) != (y1 > py):
            xi = x0 + (py - y0) * (x1 - x0) / (y1 - y0)
            if px < xi:
                inside = not inside
    return inside


def fill_polygon(grid, points, value):
    if points[0] != points[-1]:
        points = list(points) + [points[0]]
    x0, y0, x1, y1 = bbox_of(points)
    for y in range(max(y0, 0), min(y1, grid.height - 1) + 1):
        for x in range(max(x0, 0), min(x1, grid.width - 1) + 1):
            if _inside(x + 0.5, y + 0.5, points):
                grid.set(x, y, value)


def _dist_to_segment(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    if dx == dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def stroke_polyline(grid, points, width, value):
    r = width / 2
    for i in range(len(points) - 1):
        (ax, ay), (bx, by) = points[i], points[i + 1]
        x0, y0, x1, y1 = bbox_of([(ax - r, ay - r), (bx + r, by + r)])
        for y in range(max(y0, 0), min(y1, grid.height - 1) + 1):
            for x in range(max(x0, 0), min(x1, grid.width - 1) + 1):
                if _dist_to_segment(x + 0.5, y + 0.5, ax, ay, bx, by) < r:
                    grid.set(x, y, value)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run --with pillow --with pytest pytest tools/campus-map/tests/test_raster.py -v`
Expected: 7 PASS

- [ ] **Step 5: Commit**

```bash
git add tools/campus-map/campusmap/raster.py tools/campus-map/tests/test_raster.py
git commit -m "campus-map: cell grid with polygon fill and polyline stroke"
```

---

### Task 4: Autotile module

**Files:**
- Create: `tools/campus-map/campusmap/autotile.py`
- Create: `tools/campus-map/tests/test_autotile.py`

**Interfaces:**
- Produces:
  - `autotile.road_variant(same: callable[[int,int], bool], x, y) -> str` returning one of `road-h | road-v | road-x | road-plain`
  - `autotile.ring_variant(same, x, y) -> str` returning one of `top | bottom | left | right | corner-tl | corner-tr | corner-bl | corner-br | inner` (which edge of a building footprint the cell is on; `inner` = not on the ring)
  - `same(x, y)` is a predicate "cell (x,y) belongs to the same region".

- [ ] **Step 1: Write failing tests**

`tools/campus-map/tests/test_autotile.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run --with pillow --with pytest pytest tools/campus-map/tests/test_autotile.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Implement `campusmap/autotile.py`**

```python
"""Pick a tile variant from a cell's 4-neighbourhood within its region."""


def _n4(same, x, y):
    return same(x, y - 1), same(x + 1, y), same(x, y + 1), same(x - 1, y)  # up, right, down, left


def road_variant(same, x, y):
    u, r, d, l = _n4(same, x, y)
    if u and d and not (l or r):
        return "road-v"
    if l and r and not (u or d):
        return "road-h"
    if u and d and l and r:
        # a genuine crossing has open corners; a wide road's interior does not
        if not any(same(x + dx, y + dy) for dx in (-1, 1) for dy in (-1, 1)):
            return "road-x"
    return "road-plain"


def ring_variant(same, x, y):
    u, r, d, l = _n4(same, x, y)
    if not d:
        if not l:
            return "corner-bl"
        if not r:
            return "corner-br"
        return "bottom"
    if not u:
        if not l:
            return "corner-tl"
        if not r:
            return "corner-tr"
        return "top"
    if not l:
        return "left"
    if not r:
        return "right"
    return "inner"
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run --with pillow --with pytest pytest tools/campus-map/tests/test_autotile.py -v`
Expected: 7 PASS

- [ ] **Step 5: Commit**

```bash
git add tools/campus-map/campusmap/autotile.py tools/campus-map/tests/test_autotile.py
git commit -m "campus-map: road and building-ring autotiling"
```

---

### Task 5: Tile manifest, CREDITS, and real sprite slicing

**Files:**
- Create: `tools/campus-map/tiles.toml`
- Create: `apps/web/public/campus/CREDITS.md`
- Modify (regenerated): `apps/web/public/campus/*.png` (old procedurally drawn files deleted by the slicer; `overview.png` and `gec-bilaspur-thumb.png` are regenerated in Task 8)
- Create: `tools/campus-map/tests/test_manifest.py`

**Interfaces:**
- Produces: the sprite names below, consumed by Task 6 `layout.py` via `SPRITES`. Every name is `apps/web/public/campus/<name>.png`, size `w*32 × h*32`.

Sprite names and sizes (w×h tiles):

| name | w×h | purpose |
|---|---|---|
| grass, grass-tuft | 1×1 | base floor (tuft = 12 % random) |
| lawn, flowerbed | 1×1 | garden |
| court | 1×1 | badminton pitch |
| paver | 1×1 | quadrangle / plaza |
| asphalt | 1×1 | parking |
| road-h, road-v, road-x, road-plain | 1×1 | roads |
| mark-p, mark-bike | 1×1 | parking symbols |
| roof-{a,b,c,d} | 1×1 | building interior (one per style) |
| wall-{a,b,c,d} | 1×1 | ring: left/right/top edges |
| wallbase-{a,b,c,d} | 1×1 | ring: bottom edge (ground floor) |
| window-{a,b,c,d} | 1×1 | wallbase with window overlay |
| door | 2×2 | entrance; bottom row sits on the ring's bottom edge |
| tree-a, tree-b | 1×2 | roadside trees |
| lamp | 1×2 | road corners |
| bench | 2×1 | garden |
| car-h-{green,gray,orange} | 2×1 | parking |
| car-v-{green,gray,orange} | 1×2 | parking |
| bike | 1×1 | motorcycle parking |
| bin, cone | 1×1 | props |
| flag | 1×2 | main gate |
| gate-arch | 5×2 | main gate (topObjects) — composed in Task 6 from `gate-pillar` + text, not sliced |
| gate-pillar | 1×2 | main gate |

- [ ] **Step 1: Write `tiles.toml`**

Coordinates are tile column/row in the sheet (0-based). Kenney sheets: `Tilemap/tilemap_packed.png`, 16 px, no spacing (city 37×28, town 12×11). LPC: `LPC_city_outside/city_outside.png`, 32 px (24×18).

```toml
# Sliced by fetch_sprites.py into apps/web/public/campus/. See CREDITS.md.
# Kenney packs are 16 px (scale = 2); LPC is 32 px (scale = 1).

# ---- ground (Kenney Roguelike Modern City)
[grass]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 1
y = 26
scale = 2

[grass-tuft]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 0
y = 25
scale = 2

[lawn]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 0
y = 24
scale = 2

[flowerbed]
pack = "tiny-town"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 2
y = 0
scale = 2

[court]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 2
y = 24
scale = 2

[paver]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 6
y = 24
scale = 2

[asphalt]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 10
y = 20
scale = 2

[road-plain]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 10
y = 20
scale = 2

[road-h]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 9
y = 19
scale = 2

[road-v]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 9
y = 20
scale = 2

[road-x]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 12
y = 19
scale = 2

[mark-p]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 13
y = 24
scale = 2

[mark-bike]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 14
y = 24
scale = 2

# ---- roofs (Kenney city, flat roof interiors)
[roof-a]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 26
y = 2
scale = 2

[roof-b]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 2
y = 2
scale = 2

[roof-c]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 10
y = 2
scale = 2

[roof-d]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 18
y = 2
scale = 2

# ---- walls (LPC City Outside, 32 px)
# a = yellow brick, b = red brick, c = grey brick, d = white wall
[wall-a]
pack = "lpc-city-outside"
sheet = "LPC_city_outside/city_outside.png"
tile = 32
x = 19
y = 7

[wallbase-a]
pack = "lpc-city-outside"
sheet = "LPC_city_outside/city_outside.png"
tile = 32
x = 19
y = 8

[window-a]
pack = "lpc-city-outside"
sheet = "LPC_city_outside/city_outside.png"
tile = 32
x = 19
y = 8
over = [{ sheet = "LPC_city_outside/city_outside.png", tile = 32, x = 20, y = 1 }]

[wall-b]
pack = "lpc-city-outside"
sheet = "LPC_city_outside/city_outside.png"
tile = 32
x = 4
y = 4

[wallbase-b]
pack = "lpc-city-outside"
sheet = "LPC_city_outside/city_outside.png"
tile = 32
x = 4
y = 6

[window-b]
pack = "lpc-city-outside"
sheet = "LPC_city_outside/city_outside.png"
tile = 32
x = 4
y = 6
over = [{ sheet = "LPC_city_outside/city_outside.png", tile = 32, x = 20, y = 1 }]

[wall-c]
pack = "lpc-city-outside"
sheet = "LPC_city_outside/city_outside.png"
tile = 32
x = 15
y = 9

[wallbase-c]
pack = "lpc-city-outside"
sheet = "LPC_city_outside/city_outside.png"
tile = 32
x = 15
y = 10

[window-c]
pack = "lpc-city-outside"
sheet = "LPC_city_outside/city_outside.png"
tile = 32
x = 15
y = 10
over = [{ sheet = "LPC_city_outside/city_outside.png", tile = 32, x = 20, y = 1 }]

[wall-d]
pack = "lpc-city-outside"
sheet = "LPC_city_outside/city_outside.png"
tile = 32
x = 10
y = 3

[wallbase-d]
pack = "lpc-city-outside"
sheet = "LPC_city_outside/city_outside.png"
tile = 32
x = 10
y = 5

[window-d]
pack = "lpc-city-outside"
sheet = "LPC_city_outside/city_outside.png"
tile = 32
x = 10
y = 5
over = [{ sheet = "LPC_city_outside/city_outside.png", tile = 32, x = 20, y = 1 }]

[door]
pack = "lpc-city-outside"
sheet = "LPC_city_outside/city_outside.png"
tile = 32
x = 21
y = 0
w = 2
h = 2

# ---- props
[tree-a]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 31
y = 10
h = 2
scale = 2

[tree-b]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 33
y = 10
h = 2
scale = 2

[lamp]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 6
y = 16
h = 2
scale = 2

[bench]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 17
y = 16
w = 2
scale = 2

[car-h-green]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 32
y = 17
w = 2
scale = 2

[car-h-gray]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 32
y = 21
w = 2
scale = 2

[car-h-orange]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 32
y = 25
w = 2
scale = 2

[car-v-green]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 32
y = 18
h = 2
scale = 2

[car-v-gray]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 32
y = 22
h = 2
scale = 2

[car-v-orange]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 32
y = 26
h = 2
scale = 2

[bike]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 14
y = 24
scale = 2

[bin]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 12
y = 14
scale = 2

[cone]
pack = "roguelike-modern-city"
sheet = "Tilemap/tilemap_packed.png"
tile = 16
x = 14
y = 18
scale = 2

[flag]
pack = "lpc-city-outside"
sheet = "LPC_city_outside/city_outside.png"
tile = 32
x = 20
y = 3
h = 2

[gate-pillar]
pack = "lpc-city-outside"
sheet = "LPC_city_outside/city_outside.png"
tile = 32
x = 22
y = 7
h = 2
```

- [ ] **Step 2: Write `CREDITS.md`**

`apps/web/public/campus/CREDITS.md`:

```markdown
# Campus map art credits

The campus map tiles in this folder are sliced from these packs by
`tools/campus-map/fetch_sprites.py`.

| Pack | Author | Licence | Source |
|---|---|---|---|
| Roguelike Modern City | Kenney | CC0 1.0 | https://kenney.nl/assets/roguelike-modern-city |
| Tiny Town | Kenney | CC0 1.0 | https://kenney.nl/assets/tiny-town |
| LPC City Outside | Tuomo Untinen and others (see below) | CC-BY-SA 3.0 / GPL 3.0 | https://opengameart.org/content/lpc-city-outside |

LPC City Outside combines work by Tuomo Untinen, Lanea Zimmerman (Sharm),
Hyptosis, Guido Bos, Johann C, Johannes Sjölund, Xenodora, William Thompson,
Daniel Eddeland, bluecarrot16 and caeles; the full per-tile credit list is in
the pack's `credits.txt`. Tiles derived from it (`wall-*`, `wallbase-*`,
`window-*`, `door`, `flag`, `gate-pillar`) are therefore CC-BY-SA 3.0.

Map geometry: © OpenStreetMap contributors, ODbL 1.0
(https://www.openstreetmap.org/copyright).
```

- [ ] **Step 3: Write failing manifest test**

`tools/campus-map/tests/test_manifest.py`:

```python
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
```

- [ ] **Step 4: Run tests**

Run: `uv run --with pillow --with pytest pytest tools/campus-map/tests/test_manifest.py -v`
Expected: 2 PASS (the manifest already exists; if a name is missing the first test names it).

- [ ] **Step 5: Download packs and slice**

Run: `uv run --with pillow python tools/campus-map/fetch_sprites.py`
Expected: `wrote 47 sprites to .../apps/web/public/campus`. `ls apps/web/public/campus` shows only the manifest names + `CREDITS.md` (the old `admin-block.png`, `dept-*.png`, `overview.png` etc. are gone — `overview.png`/thumb come back in Task 8).

- [ ] **Step 6: Eyeball the slices**

Run:
```bash
uv run --with pillow python - <<'EOF'
from PIL import Image, ImageDraw
from pathlib import Path
d = Path("apps/web/public/campus"); files = sorted(d.glob("*.png"))
cell = 96; cols = 8; rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGBA", (cols * cell, rows * (cell + 14)), (255, 0, 255, 255)); dr = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert("RGBA"); im.thumbnail((cell, cell), Image.NEAREST)
    x, y = (i % cols) * cell, (i // cols) * (cell + 14)
    sheet.alpha_composite(im, (x, y)); dr.text((x + 2, y + cell), f.stem, fill=(0, 0, 0, 255))
sheet.save("/tmp/campus-contact.png"); print(len(files))
EOF
```
Then open `/tmp/campus-contact.png` with the Read tool. Every cell must show the thing its label says (a tree under `tree-a`, a door under `door`, asphalt with dashes under `road-h`, …). If a cell shows the wrong art, fix that entry's `x`/`y` in `tiles.toml` using the labelled contact sheets (regenerate them with the `contact.py` snippet from the planning session, or read the pack's `Tilemap/tilemap.png` with the Read tool and count tiles) and re-run step 5. Iterate until the contact sheet is right.

- [ ] **Step 7: Commit**

```bash
git add tools/campus-map/tiles.toml tools/campus-map/tests/test_manifest.py apps/web/public/campus/
git commit -m "campus-map: tile manifest, sliced Kenney/LPC sprites and credits"
```

---

### Task 6: Layout module (buildings, doors, signs, props, spawn)

**Files:**
- Create: `tools/campus-map/campusmap/layout.py`
- Create: `tools/campus-map/tests/test_layout.py`

**Interfaces:**
- Consumes: `geo.Feature`, `raster.Grid/fill_polygon/stroke_polyline`, `autotile.ring_variant/road_variant`.
- Produces:
  - `layout.Placement` dataclass: `key: str` (element key), `x: int`, `y: int`
  - `layout.ElementDef` dataclass: `key, image_url, width, height, static, layer`
  - `layout.Layout` dataclass: `width, height, elements: dict[str, ElementDef], placements: list[Placement], spawn: tuple[int,int], doors: list[tuple[str,int,int]]` (building name, door x, door y of the bottom-left door tile), `signs: dict[str, str]` (element key → text to render; emit renders these to PNG)
  - `layout.build(features: list[Feature], width: int, height: int, rng: random.Random) -> Layout`
  - `layout.SPRITE_SIZES: dict[str, tuple[int,int]]` — every sliced sprite's w×h in tiles (matches Task 5 table)
  - Element keys = sprite names (e.g. `"tree-a"`), plus `sign:<slug>` for name boards and `gate-arch`. imageUrl = `/campus/<key>.png` (signs: `/campus/sign-<slug>.png`).

- [ ] **Step 1: Write failing tests**

`tools/campus-map/tests/test_layout.py`:

```python
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
    roof = placed(lay, "roof-a") + placed(lay, "roof-b") + placed(lay, "roof-c") + placed(lay, "roof-d")
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
    # but the door cell must be adjacent to the ring edge nearest the road: we keep the bottom
    # edge and the approach path becomes a paver strip around the building to the road.
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
    assert lay.elements["road-h"].layer == "floor"


def test_parking_gets_cars_and_bikes():
    car_park = Feature(kind="asphalt", name=None, points=rect(2, 2, 10, 6), osm_id=3, sub="parking")
    bike_park = Feature(kind="asphalt", name=None, points=rect(2, 10, 10, 14), osm_id=4, sub="motorcycle_parking")
    lay = layout.build([car_park, bike_park], 20, 20, random.Random(1))
    cars = [p for p in lay.placements if p.key.startswith("car-")]
    assert cars and placed(lay, "bike")
    assert all(2 <= p.x < 10 and 2 <= p.y < 6 for p in cars)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run --with pillow --with pytest pytest tools/campus-map/tests/test_layout.py -v`
Expected: FAIL with `ImportError: cannot import name 'layout'`

- [ ] **Step 3: Implement `campusmap/layout.py`**

```python
"""Turn classified features into a cell grid, then into element placements."""
import re
from dataclasses import dataclass, field

from .autotile import ring_variant, road_variant
from .raster import Grid, bbox_of, fill_polygon, stroke_polyline

# w, h in tiles for every sliced sprite (see tools/campus-map/tiles.toml)
SPRITE_SIZES = {
    **{k: (1, 1) for k in (
        "grass", "grass-tuft", "lawn", "flowerbed", "court", "paver", "asphalt",
        "road-h", "road-v", "road-x", "road-plain", "mark-p", "mark-bike",
        "roof-a", "roof-b", "roof-c", "roof-d",
        "wall-a", "wall-b", "wall-c", "wall-d",
        "wallbase-a", "wallbase-b", "wallbase-c", "wallbase-d",
        "window-a", "window-b", "window-c", "window-d",
        "bike", "bin", "cone")},
    "door": (2, 2), "tree-a": (1, 2), "tree-b": (1, 2), "lamp": (1, 2), "bench": (2, 1),
    "car-h-green": (2, 1), "car-h-gray": (2, 1), "car-h-orange": (2, 1),
    "car-v-green": (1, 2), "car-v-gray": (1, 2), "car-v-orange": (1, 2),
    "flag": (1, 2), "gate-pillar": (1, 2), "gate-arch": (5, 2),
}

FLOOR = {"grass", "grass-tuft", "lawn", "flowerbed", "court", "paver", "asphalt",
         "road-h", "road-v", "road-x", "road-plain", "mark-p", "mark-bike"}
TOP = {"gate-arch"}
NON_STATIC_OBJECTS = {"door"}

STYLES = ["a", "b", "c", "d"]
SIGN_W, SIGN_H = 3, 1
TREE_SPACING = 6
DOOR_APPROACH = 3  # tiles in front of a door kept free of props
CAR_KEYS = ["car-h-green", "car-h-gray", "car-h-orange"]
CAR_V_KEYS = ["car-v-green", "car-v-gray", "car-v-orange"]


@dataclass
class Placement:
    key: str
    x: int
    y: int


@dataclass
class ElementDef:
    key: str
    image_url: str
    width: int
    height: int
    static: bool
    layer: str


@dataclass
class Layout:
    width: int
    height: int
    elements: dict = field(default_factory=dict)
    placements: list = field(default_factory=list)
    spawn: tuple = (0, 0)
    doors: list = field(default_factory=list)
    signs: dict = field(default_factory=dict)

    def element(self, key, w=None, h=None, image_url=None):
        if key not in self.elements:
            w, h = (w, h) if w else SPRITE_SIZES[key]
            layer = "floor" if key in FLOOR else "topObjects" if key in TOP else \
                "wall" if key.startswith(("wall-", "wallbase-", "window-", "roof-")) else "objects"
            static = key not in NON_STATIC_OBJECTS and layer not in ("floor", "topObjects")
            self.elements[key] = ElementDef(key, image_url or f"/campus/{key}.png", w, h, static, layer)
        return self.elements[key]

    def put(self, key, x, y, **kw):
        self.element(key, **kw)
        self.placements.append(Placement(key, x, y))


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


# ----------------------------------------------------------------------------- grid painting

def paint(features, width, height):
    """Rasterize features into a Grid. Later kinds win: ground < road < building."""
    grid = Grid(width, height)
    order = {"lawn": 0, "court": 0, "paver": 0, "asphalt": 0, "road": 1, "building": 2}
    for f in sorted(features, key=lambda f: order[f.kind]):
        if f.kind == "road":
            stroke_polyline(grid, f.points, f.width, "road")
        elif f.kind == "building":
            fill_polygon(grid, f.points, f"building:{f.osm_id}")
        else:
            fill_polygon(grid, f.points, f.kind)
    return grid


def building_cells(grid, osm_id):
    return grid.find(f"building:{osm_id}")


# ----------------------------------------------------------------------------- buildings

def nearest_road_side(grid, cells):
    """Which side (N/E/S/W) of the footprint has the closest road cell."""
    xs = [c[0] for c in cells]
    ys = [c[1] for c in cells]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    best, best_d = "S", None
    for (x, y) in grid.find("road"):
        d = (x - cx) ** 2 + (y - cy) ** 2
        if best_d is None or d < best_d:
            best_d = d
            dx, dy = x - cx, y - cy
            best = ("E" if dx > 0 else "W") if abs(dx) > abs(dy) else ("S" if dy > 0 else "N")
    return best


def door_position(cells):
    """Door is always on the bottom edge (top-down art), centred on the widest bottom run."""
    bottom = {}
    for (x, y) in cells:
        bottom[x] = max(bottom.get(x, y), y)
    # longest run of bottom cells sharing the same y
    runs = []
    for x in sorted(bottom):
        y = bottom[x]
        if runs and runs[-1][1] == y and runs[-1][2] == x - 1:
            runs[-1][2] = x
        else:
            runs.append([x, y, x])
    x0, y, x1 = max(runs, key=lambda r: r[2] - r[0])
    dx = x0 + (x1 - x0 + 1 - 2) // 2
    return dx, y - 1  # 2x2 door; its bottom row is the ring's bottom row


def place_building(lay, grid, feat, style, rng):
    cells = building_cells(grid, feat.osm_id)
    if not cells:
        return
    cellset = set(cells)
    same = lambda x, y: (x, y) in cellset
    door = door_position(cells) if feat.name else None
    door_cells = set()
    if door:
        dx, dy = door
        door_cells = {(dx, dy + 1), (dx + 1, dy + 1)}
    for i, (x, y) in enumerate(sorted(cells)):
        v = ring_variant(same, x, y)
        if v == "inner":
            lay.put(f"roof-{style}", x, y)
        elif v in ("bottom", "corner-bl", "corner-br"):
            if (x, y) in door_cells:
                continue
            key = f"window-{style}" if (x % 3 == 1 and v == "bottom") else f"wallbase-{style}"
            lay.put(key, x, y)
        else:
            lay.put(f"wall-{style}", x, y)
    if door:
        dx, dy = door
        lay.put("door", dx, dy)
        lay.doors.append((feat.name, dx, dy))
        key = f"sign:{slug(feat.name)}"
        lay.signs[key] = feat.name
        lay.put(key, dx - (SIGN_W - 2) // 2, dy - 1, w=SIGN_W, h=SIGN_H, image_url=f"/campus/sign-{slug(feat.name)}.png")
        # approach: paver strip from the door down to the nearest road row (or 3 tiles)
        for y in range(dy + 2, min(dy + 2 + DOOR_APPROACH, grid.height)):
            for x in (dx, dx + 1):
                if grid.get(x, y) == "grass":
                    grid.set(x, y, "paver")
        side = nearest_road_side(grid, cells)
        if side == "N":
            # road is behind: pave a path around the building's nearest vertical edge
            xs = [c[0] for c in cells]
            ex = min(xs) - 1 if dx - min(xs) < max(xs) - dx else max(xs) + 1
            for y in range(min(c[1] for c in cells) - 1, dy + 2 + DOOR_APPROACH):
                if grid.get(ex, y) == "grass":
                    grid.set(ex, y, "paver")


# ----------------------------------------------------------------------------- ground + props

def approach_cells(lay):
    cells = set()
    for (_, dx, dy) in lay.doors:
        for x in (dx, dx + 1):
            for y in range(dy + 2, dy + 2 + DOOR_APPROACH):
                cells.add((x, y))
    return cells


def free(grid, lay, x, y, w, h, keep_clear):
    """True when a w x h prop anchored at (x, y) sits fully on grass/lawn and off approaches."""
    for dx in range(w):
        for dy in range(h):
            c = grid.get(x + dx, y + dy)
            if c not in ("grass", "lawn") or (x + dx, y + dy) in keep_clear:
                return False
    return True


def place_ground(lay, grid, rng):
    for y in range(grid.height):
        for x in range(grid.width):
            c = grid.cells[y][x]
            if c == "grass":
                lay.put("grass-tuft" if rng.random() < 0.12 else "grass", x, y)
            elif c == "road":
                same = lambda a, b: grid.get(a, b) == "road"
                lay.put(road_variant(same, x, y), x, y)
            elif c == "lawn":
                lay.put("flowerbed" if rng.random() < 0.08 else "lawn", x, y)
            elif c in ("court", "paver", "asphalt"):
                lay.put(c, x, y)
            # building cells get no floor: the wall/roof covers them


def place_props(lay, grid, features, rng):
    keep_clear = approach_cells(lay)
    occupied = set()

    def take(key, x, y):
        w, h = SPRITE_SIZES[key]
        for dx in range(w):
            for dy in range(h):
                occupied.add((x + dx, y + dy))
        lay.put(key, x, y)

    def can(key, x, y):
        w, h = SPRITE_SIZES[key]
        return free(grid, lay, x, y, w, h, keep_clear | occupied)

    # trees + lamps along road edges
    roads = set(grid.find("road"))
    for (x, y) in sorted(roads):
        if (x, y - 1) not in roads and (x + y) % TREE_SPACING == 0:
            key = "tree-a" if rng.random() < 0.5 else "tree-b"
            if can(key, x, y - 3):
                take(key, x, y - 3)
        if (x, y + 1) not in roads and (x + y) % TREE_SPACING == 3:
            key = "tree-a" if rng.random() < 0.5 else "tree-b"
            if can(key, x, y + 1):
                take(key, x, y + 1)
        if (x - 1, y) not in roads and (x, y - 1) not in roads and can("lamp", x - 1, y - 2):
            take("lamp", x - 1, y - 2)

    # benches in lawns
    for (x, y) in sorted(grid.find("lawn")):
        if (x * 7 + y * 3) % 23 == 0 and can("bench", x, y):
            take("bench", x, y)

    # cars / bikes in parking
    for f in features:
        if f.kind != "asphalt":
            continue
        x0, y0, x1, y1 = bbox_of(f.points)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if grid.get(x, y) != "asphalt":
                    continue
                if f.sub == "parking":
                    if (x - x0) % 3 == 0 and (y - y0) % 2 == 0 and rng.random() < 0.7:
                        key = rng.choice(CAR_KEYS)
                        if all(grid.get(x + dx, y) == "asphalt" and (x + dx, y) not in occupied for dx in (0, 1)):
                            take(key, x, y)
                elif f.sub == "motorcycle_parking":
                    if (x - x0) % 2 == 0 and (y - y0) % 2 == 0 and rng.random() < 0.6 and (x, y) not in occupied:
                        take("bike", x, y)
        mark = "mark-p" if f.sub == "parking" else "mark-bike"
        if grid.get(x0, y0) == "asphalt":
            lay.placements = [p for p in lay.placements if not (p.key == "asphalt" and (p.x, p.y) == (x0, y0))]
            lay.put(mark, x0, y0)

    # bins next to doors
    for (_, dx, dy) in lay.doors:
        if can("bin", dx + 2, dy + 1):
            take("bin", dx + 2, dy + 1)


# ----------------------------------------------------------------------------- gate + spawn

def main_gate(lay, grid):
    """The southernmost road run nearest the map's centre column is the gate:
    pillars, flag, arch, and the spawn one tile inside it."""
    roads = grid.find("road")
    y = max(cy for _, cy in roads)
    xs = sorted(x for x, cy in roads if cy == y)
    runs = []
    for x in xs:
        if runs and runs[-1][1] == x - 1:
            runs[-1][1] = x
        else:
            runs.append([x, x])
    x0, x1 = min(runs, key=lambda r: abs((r[0] + r[1]) / 2 - grid.width / 2))
    w = x1 - x0 + 3

    def put_if_inside(key, x, py, **kw):
        kw_w, kw_h = (kw["w"], kw["h"]) if "w" in kw else SPRITE_SIZES[key]
        if 0 <= x and x + kw_w <= grid.width and 0 <= py and py + kw_h <= grid.height:
            lay.put(key, x, py, **kw)

    put_if_inside("gate-pillar", x0 - 1, y - 2)
    put_if_inside("gate-pillar", x1 + 1, y - 2)
    put_if_inside("flag", x0 - 2, y - 2)
    put_if_inside("gate-arch", x0 - 1, y - 4, w=w, h=2, image_url="/campus/gate-arch.png")
    if "gate-arch" in lay.elements:
        lay.signs["gate-arch"] = "GEC BILASPUR"
    lay.spawn = ((x0 + x1) // 2, y - 1)


def spawn_fallback(lay, grid):
    roads = grid.find("road")
    if roads:
        return roads[len(roads) // 2]
    return (grid.width // 2, grid.height // 2)


# ----------------------------------------------------------------------------- entry point

def build(features, width, height, rng):
    lay = Layout(width, height)
    grid = paint(features, width, height)
    buildings = [f for f in features if f.kind == "building"]
    for i, f in enumerate(sorted(buildings, key=lambda f: f.osm_id)):
        place_building(lay, grid, f, STYLES[i % len(STYLES)], rng)
    place_ground(lay, grid, rng)
    place_props(lay, grid, features, rng)
    if grid.find("road"):
        main_gate(lay, grid)
    else:
        lay.spawn = spawn_fallback(lay, grid)
    return lay
```

Note on test `test_building_ring_and_roof`: with style rotation the first building gets style `a`; the roof count sums every style so the assertion holds regardless.

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run --with pillow --with pytest pytest tools/campus-map/tests/test_layout.py -v`
Expected: 9 PASS. If `test_road_cells_become_floor_and_spawn_is_on_road` fails on the spawn, check `main_gate`: for a horizontal road not touching the south edge it uses the lowest road row; spawn is one row above the road's bottom row and must be a road cell (width 3 → yes).

- [ ] **Step 5: Commit**

```bash
git add tools/campus-map/campusmap/layout.py tools/campus-map/tests/test_layout.py
git commit -m "campus-map: building rings, doors, signs, props and gate layout"
```

---

### Task 7: Reachability module

**Files:**
- Create: `tools/campus-map/campusmap/reach.py`
- Create: `tools/campus-map/tests/test_reach.py`

**Interfaces:**
- Consumes: `layout.Layout`
- Produces: `reach.blocked_tiles(lay) -> set[tuple[int,int]]` (same rules as ws `SpaceGrid.ts`), `reach.unreachable_doors(lay) -> list[str]` (building names whose door approach tile `(dx, dy+2)` is not reachable from `lay.spawn`), `reach.reachable_count(lay) -> int`

- [ ] **Step 1: Write failing tests**

`tools/campus-map/tests/test_reach.py`:

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from campusmap import reach  # noqa: E402
from campusmap.layout import ElementDef, Layout, Placement  # noqa: E402


def lay_with(elements, placements, spawn, doors=()):
    lay = Layout(10, 10)
    lay.elements = {e.key: e for e in elements}
    lay.placements = [Placement(*p) for p in placements]
    lay.spawn = spawn
    lay.doors = list(doors)
    return lay


WALL = ElementDef("wall-a", "/campus/wall-a.png", 1, 1, True, "wall")
TREE = ElementDef("tree-a", "/campus/tree-a.png", 1, 2, True, "objects")
DOOR = ElementDef("door", "/campus/door.png", 2, 2, False, "objects")
GRASS = ElementDef("grass", "/campus/grass.png", 1, 1, False, "floor")


def test_blocked_wall_whole_footprint_objects_bottom_row_only():
    lay = lay_with([WALL, TREE, DOOR, GRASS], [("wall-a", 1, 1), ("tree-a", 3, 3), ("door", 5, 5), ("grass", 0, 0)], (0, 0))
    b = reach.blocked_tiles(lay)
    assert (1, 1) in b and (3, 4) in b and (3, 3) not in b and (5, 5) not in b and (5, 6) not in b


def test_unreachable_door_is_reported():
    ring = [("wall-a", x, y) for x in range(2, 8) for y in range(2, 8) if x in (2, 7) or y in (2, 7)]
    lay = lay_with([WALL, DOOR], ring + [("door", 4, 4)], (0, 0), doors=[("Boxed Hall", 4, 4)])
    assert reach.unreachable_doors(lay) == ["Boxed Hall"]


def test_reachable_door_not_reported():
    lay = lay_with([WALL, DOOR], [("door", 4, 2)], (0, 0), doors=[("Open Hall", 4, 2)])
    assert reach.unreachable_doors(lay) == []
    assert reach.reachable_count(lay) == 100
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run --with pillow --with pytest pytest tools/campus-map/tests/test_reach.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Implement `campusmap/reach.py`**

```python
"""Movement blocking (mirrors apps/ws/src/SpaceGrid.ts) and BFS reachability."""
from collections import deque


def blocked_tiles(lay):
    blocked = set()
    for p in lay.placements:
        e = lay.elements[p.key]
        if not e.static:
            continue
        if e.layer == "wall":
            rows = range(p.y, p.y + e.height)
        elif e.layer == "objects":
            rows = range(p.y + e.height - 1, p.y + e.height)
        else:
            continue
        for y in rows:
            for x in range(p.x, p.x + e.width):
                blocked.add((x, y))
    return blocked


def _flood(lay):
    blocked = blocked_tiles(lay)
    seen = set()
    if lay.spawn in blocked:
        return seen
    q = deque([lay.spawn])
    seen.add(lay.spawn)
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < lay.width and 0 <= ny < lay.height and (nx, ny) not in blocked and (nx, ny) not in seen:
                seen.add((nx, ny))
                q.append((nx, ny))
    return seen


def reachable_count(lay):
    return len(_flood(lay))


def unreachable_doors(lay):
    seen = _flood(lay)
    return [name for (name, dx, dy) in lay.doors if (dx, dy + 2) not in seen]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run --with pillow --with pytest pytest tools/campus-map/tests/test_reach.py -v`
Expected: 3 PASS

- [ ] **Step 5: Commit**

```bash
git add tools/campus-map/campusmap/reach.py tools/campus-map/tests/test_reach.py
git commit -m "campus-map: blocking rules and door reachability check"
```

---

### Task 8: Emit module + `generate.py` CLI, regenerate the map, reseed

**Files:**
- Create: `tools/campus-map/campusmap/emit.py`
- Rewrite: `tools/campus-map/generate.py` (replace entire file)
- Create: `tools/campus-map/tests/test_emit.py`
- Regenerated: `packages/db/prisma/maps/gec-bilaspur.json`, `apps/web/public/campus/overview.png`, `apps/web/public/campus/gec-bilaspur-thumb.png`, `apps/web/public/campus/sign-*.png`, `apps/web/public/campus/gate-arch.png`, `tools/campus-map/preview.png`

**Interfaces:**
- Consumes: `layout.Layout`, `reach`
- Produces:
  - `emit.render_sign(text, w_tiles, h_tiles) -> Image` and `emit.render_arch(text, w_tiles, h_tiles) -> Image`
  - `emit.to_json(lay, map_id, name, thumbnail) -> dict` (seed schema)
  - `emit.render_preview(lay, public_dir) -> Image`
  - `emit.validate(lay) -> list[str]` (out-of-bounds, wall overlap, spawn blocked, unreachable doors, missing sprite files)

- [ ] **Step 1: Write failing tests**

`tools/campus-map/tests/test_emit.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `uv run --with pillow --with pytest pytest tools/campus-map/tests/test_emit.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Implement `campusmap/emit.py`**

```python
"""Seed JSON, sign/arch sprites and preview rendering."""
from PIL import Image, ImageDraw, ImageFont

from .reach import blocked_tiles, unreachable_doors

T = 32
ELEMENT_PREFIX = "campus-"
SIGN_BG = (30, 98, 72, 255)
SIGN_EDGE = (18, 60, 44, 255)
ARCH_BG = (140, 52, 48, 255)
WHITE = (250, 250, 246, 255)

FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
]


def _font(size):
    for path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _fit(d, text, max_w, start=14, min_size=7):
    size = start
    while size > min_size:
        x0, _, x1, _ = d.textbbox((0, 0), text, font=_font(size))
        if x1 - x0 <= max_w:
            break
        size -= 1
    return _font(size)


def _board(text, w_tiles, h_tiles, bg, edge):
    im = Image.new("RGBA", (w_tiles * T, h_tiles * T), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 2, im.width - 1, im.height - 3), fill=bg, outline=edge, width=2)
    d.fontmode = "1"
    f = _fit(d, text, im.width - 10)
    x0, y0, x1, y1 = d.textbbox((0, 0), text, font=f)
    d.text(((im.width - (x1 - x0)) / 2 - x0, (im.height - (y1 - y0)) / 2 - y0), text, font=f, fill=WHITE)
    return im


def render_sign(text, w_tiles, h_tiles):
    return _board(text, w_tiles, h_tiles, SIGN_BG, SIGN_EDGE)


def render_arch(text, w_tiles, h_tiles):
    return _board(text, w_tiles, h_tiles, ARCH_BG, SIGN_EDGE)


def element_id(key):
    return ELEMENT_PREFIX + key.replace(":", "-")


def to_json(lay, map_id, name, thumbnail):
    used = {p.key for p in lay.placements}
    elements = [
        {"id": element_id(e.key), "imageUrl": e.image_url, "width": e.width, "height": e.height,
         "static": e.static, "layer": e.layer}
        for e in lay.elements.values() if e.key in used
    ]
    return {
        "map": {"id": map_id, "name": name, "width": lay.width, "height": lay.height,
                "thumbnail": thumbnail, "spawnX": lay.spawn[0], "spawnY": lay.spawn[1]},
        "elements": elements,
        "placements": [{"elementId": element_id(p.key), "x": p.x, "y": p.y} for p in lay.placements],
    }


def sprite_file(e):
    return e.image_url.rsplit("/", 1)[-1]


def validate(lay, public_campus_dir):
    errors = []
    for e in lay.elements.values():
        if not (public_campus_dir / sprite_file(e)).exists():
            errors.append(f"missing sprite {sprite_file(e)}")
    for p in lay.placements:
        e = lay.elements[p.key]
        if p.x < 0 or p.y < 0 or p.x + e.width > lay.width or p.y + e.height > lay.height:
            errors.append(f"{p.key} at {p.x},{p.y} is out of bounds")
    seen = {}
    for p in lay.placements:
        e = lay.elements[p.key]
        if e.layer != "wall":
            continue
        for y in range(p.y, p.y + e.height):
            for x in range(p.x, p.x + e.width):
                if (x, y) in seen:
                    errors.append(f"{p.key} overlaps {seen[(x, y)]} at {x},{y}")
                seen[(x, y)] = p.key
    if lay.spawn in blocked_tiles(lay):
        errors.append("spawn tile is blocked")
    for name in unreachable_doors(lay):
        errors.append(f"door of {name} is unreachable from spawn")
    return errors


def render_preview(lay, public_campus_dir):
    canvas = Image.new("RGBA", (lay.width * T, lay.height * T), (0, 0, 0, 0))
    cache = {}
    order = {"floor": 0, "wall": 1, "objects": 2, "topObjects": 3}
    placed = sorted(lay.placements, key=lambda p: (order[lay.elements[p.key].layer], p.y + lay.elements[p.key].height))
    for p in placed:
        e = lay.elements[p.key]
        if p.key not in cache:
            cache[p.key] = Image.open(public_campus_dir / sprite_file(e)).convert("RGBA")
        canvas.alpha_composite(cache[p.key], (p.x * T, p.y * T))
    return canvas
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run --with pillow --with pytest pytest tools/campus-map/tests/test_emit.py -v`
Expected: 5 PASS

- [ ] **Step 5: Rewrite `generate.py`**

Replace the whole file with:

```python
#!/usr/bin/env python3
"""
Generates the GEC Bilaspur campus map from real OpenStreetMap geometry.

Inputs
  tools/campus-map/osm/gec-bilaspur.osm.json   fetched by fetch_osm.py (ODbL)
  apps/web/public/campus/*.png                  sliced by fetch_sprites.py from tiles.toml

Outputs
  packages/db/prisma/maps/gec-bilaspur.json     elements + placements consumed by the seed script
  apps/web/public/campus/sign-*.png, gate-arch.png   rendered name boards
  apps/web/public/campus/overview.png           full render used by the landing page
  apps/web/public/campus/gec-bilaspur-thumb.png thumbnail shown in the space creator
  tools/campus-map/preview.png                  same as overview, for eyeballing

Layer rules (mirrored by the web renderer and the ws server):
  floor       drawn first, never blocks movement
  wall        drawn after floor, blocks its whole footprint when static
  objects     y-sorted with players, blocks only its bottom row when static
  topObjects  drawn above players, never blocks

Run: uv run --with pillow python tools/campus-map/generate.py
Then: pnpm db:seed
"""
import json
import random
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from campusmap import emit, geo, layout, reach  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "apps/web/public/campus"
OSM = Path(__file__).resolve().parent / "osm/gec-bilaspur.osm.json"
MAP_JSON = ROOT / "packages/db/prisma/maps/gec-bilaspur.json"
PREVIEW = Path(__file__).resolve().parent / "preview.png"

MAP_ID = "gec-bilaspur-campus"
MAP_NAME = "GEC Bilaspur Campus"
THUMB = "/campus/gec-bilaspur-thumb.png"


def main():
    proj = geo.Projector()
    features = geo.load_features(json.loads(OSM.read_text()), proj)
    lay = layout.build(features, proj.width, proj.height, random.Random(42))

    for key, text in lay.signs.items():
        e = lay.elements[key]
        im = emit.render_arch(text, e.width, e.height) if key == "gate-arch" else emit.render_sign(text, e.width, e.height)
        im.save(PUBLIC / emit.sprite_file(e), optimize=True)

    errors = emit.validate(lay, PUBLIC)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        sys.exit(1)

    preview = emit.render_preview(lay, PUBLIC)
    preview.save(PREVIEW, optimize=True)
    preview.convert("RGB").save(PUBLIC / "overview.png", optimize=True)
    thumb = preview.resize((lay.width * 4, lay.height * 4), Image.LANCZOS).convert("RGB")
    thumb.save(PUBLIC / "gec-bilaspur-thumb.png", optimize=True)

    MAP_JSON.parent.mkdir(parents=True, exist_ok=True)
    MAP_JSON.write_text(json.dumps(emit.to_json(lay, MAP_ID, MAP_NAME, THUMB), indent=1) + "\n")

    print(f"{lay.width}x{lay.height} tiles, {len(lay.elements)} elements, {len(lay.placements)} placements, "
          f"{reach.reachable_count(lay)} reachable tiles, spawn {lay.spawn}")
    print("doors:", ", ".join(f"{n}@{x},{y}" for n, x, y in lay.doors))


if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Generate and look**

Run: `uv run --with pillow python tools/campus-map/generate.py`
Expected: prints size ≈ `176x171`, ≥ 15 doors, no errors. If it exits with `door of X is unreachable`, open `tools/campus-map/preview.png` with the Read tool, find X, and fix the cause (usually a tree/lamp placed on the approach; adjust `place_props` guards) — do not special-case the building.

Open `tools/campus-map/preview.png` with the Read tool. Check first that the gate (two pillars + "GEC BILASPUR" arch) sits on GEC Bilaspur Road — the service road entering from the south near the map's middle — and not on a residential road clipped by the bbox edge; if it is wrong, extend `main_gate` to prefer the run whose column is closest to the CS/IT Block door rather than the map centre. Then check: roads form a connected network, buildings have walls on the ring and roofs inside, each named building has a door on its bottom edge with a green sign above, the gate is at the south, parking has cars.

- [ ] **Step 7: Run the full Python suite + the ws test**

Run: `uv run --with pillow --with pytest pytest tools/campus-map/tests -q`
Expected: all PASS

Run: `node apps/ws/test/blocked-tiles.test.mjs`
Expected: exits 0 (the ws helpers are pure and independent of map data; this confirms nothing regressed).

- [ ] **Step 8: Reseed and check the DB**

Run: `npx -y pnpm@9.0.0 db:seed`
Expected: `Seeded "GEC Bilaspur Campus" with N placements` with N equal to the generator's placement count.

- [ ] **Step 9: Commit**

```bash
git add tools/campus-map/generate.py tools/campus-map/campusmap/emit.py tools/campus-map/tests/test_emit.py tools/campus-map/preview.png packages/db/prisma/maps/gec-bilaspur.json apps/web/public/campus/
git commit -m "campus-map: generate the real GEC Bilaspur layout from OSM data"
```

---

### Task 9: Landing page constants, README, run the app

**Files:**
- Modify: `apps/web/components/campus/CampusMap.tsx:6-33`
- Create: `tools/campus-map/README.md`

- [ ] **Step 1: Get road coordinates for walker routes**

Run:
```bash
uv run --with pillow python - <<'EOF'
import json, sys, random; sys.path.insert(0, "tools/campus-map")
from campusmap import geo, layout
proj = geo.Projector(); feats = geo.load_features(json.load(open("tools/campus-map/osm/gec-bilaspur.osm.json")), proj)
grid = layout.paint(feats, proj.width, proj.height)
rows = {}
for (x, y) in grid.find("road"): rows.setdefault(y, []).append(x)
best = sorted(rows.items(), key=lambda kv: -len(kv[1]))[:4]
for y, xs in best: print("row", y, "x", min(xs), "->", max(xs))
cols = {}
for (x, y) in grid.find("road"): cols.setdefault(x, []).append(y)
for x, ys in sorted(cols.items(), key=lambda kv: -len(kv[1]))[:3]: print("col", x, "y", min(ys), "->", max(ys))
print("size", proj.width, proj.height)
EOF
```

- [ ] **Step 2: Update `CampusMap.tsx`**

Replace `MAP_W`/`MAP_H` with the printed size and the `WALKERS` array with 6–7 routes along the printed rows/cols (use `y + 0.6` for a row so feet sit on the road, same convention as the current file). Example shape, with real numbers substituted:

```ts
const MAP_W = 176;
const MAP_H = 171;
// ...
const WALKERS: Walker[] = [
  { avatar: '/avatars/cse-blue.png', route: [[20, 120.6], [90, 120.6]], speed: 2.1, start: 3 },
  { avatar: '/avatars/rose.png', route: [[150, 120.6], [100, 120.6]], speed: 1.8, start: 6 },
  { avatar: '/avatars/forest.png', route: [[60.5, 40], [60.5, 110]], speed: 1.6, start: 0 },
  { avatar: '/avatars/violet.png', route: [[110.5, 30], [110.5, 95], [140, 95]], speed: 1.9, start: 4 },
  { avatar: '/avatars/crimson.png', route: [[88.5, 168], [88.5, 125]], speed: 2.3, start: 1 },
  { avatar: '/avatars/teal.png', route: [[10, 60.6], [160, 60.6]], speed: 2.6, start: 12 },
  { avatar: '/avatars/classic.png', route: [[70, 80.6], [70, 50], [120, 50]], speed: 1.5, start: 2 },
];
```

Also update the comment on line 5 to `// The seeded GEC Bilaspur map, generated from OSM data by tools/campus-map/generate.py.`

Run: `cd apps/web && npx tsc --noEmit` — Expected: no errors.

- [ ] **Step 3: Write `tools/campus-map/README.md`**

```markdown
# Campus map generator

Builds the seeded "GEC Bilaspur Campus" map from OpenStreetMap geometry and
downloaded sprite packs.

## Regenerate

```bash
uv run --with pillow python tools/campus-map/fetch_sprites.py   # once; downloads packs into packs/ (gitignored)
uv run --with pillow python tools/campus-map/generate.py        # writes JSON, overview.png, thumb, signs
npx pnpm db:seed
```

## Refresh the campus data

```bash
python3 tools/campus-map/fetch_osm.py   # overwrites osm/gec-bilaspur.osm.json
```

Improve the campus on https://www.openstreetmap.org first (building outlines,
`name=` tags, `highway=service` roads) — the generator only draws what OSM has.

## Change what is drawn

- Sign text: `campusmap/geo.py` → `ALIASES` (OSM name → short label).
- Which tile a sprite uses: `tiles.toml` (sheet column/row), then re-run `fetch_sprites.py`.
- Building wall styles, prop density, door approach: `campusmap/layout.py`.
- Scale (metres per tile), bbox, margin: `campusmap/geo.py`.

## Tests

```bash
uv run --with pillow --with pytest pytest tools/campus-map/tests -q
```

## Licences

Map data © OpenStreetMap contributors (ODbL). Sprites: see
`apps/web/public/campus/CREDITS.md`.
```

- [ ] **Step 4: Run the app and walk the map**

Servers (http 4000, ws 3001, web 3002) may already be running from the earlier session; if not:

```bash
(cd apps/http && npm run dev > /tmp/http.log 2>&1 &)
(cd apps/ws && sh -c 'npm run build && sh -ac "set -a && . ../../.env && set +a && node dist/index.js"' > /tmp/ws.log 2>&1 &)
(cd apps/web && sh -ac 'set -a && . ../../.env && set +a && npx next dev --turbopack --port 3002' > /tmp/web.log 2>&1 &)
```

Playwright with the system Chrome (Playwright's own browser is not installed): write to the scratchpad a script that logs in (any existing test user, or sign one up via `POST /api/v1/signup`), creates a space from the "GEC Bilaspur Campus" map through the UI, enters it, presses ArrowUp ×20 and ArrowRight ×20 with 120 ms gaps, and screenshots. Use `chromium.launch({ channel: 'chrome' })`. Open the screenshot with the Read tool: the player must be standing on real road tiles with a building and a green sign visible, and the console must show no errors.

Also screenshot `http://localhost:3002/` (landing page) and confirm the new overview renders behind the hero with walkers on roads.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/campus/CampusMap.tsx tools/campus-map/README.md
git commit -m "campus-map: landing walkers on the new map, generator README"
```

---

## Self-review notes

- Spec coverage: fetch (T2), sprites + CREDITS (T1, T5), projection/classify (T2), rasterize (T3), autotile (T4), buildings/doors/signs/props/gate/spawn (T6), reachability (T7), emit/validate/preview/thumb/JSON (T8), CampusMap + README (T9). Spec's "sprites not in the manifest are deleted" → T1 `slice_manifest` `KEEP`. Spec's "unknown name → truncated" → `_fit` in T8 shrinks font to fit.
- Deviation from spec, recorded here: doors are always on the bottom edge of a footprint (top-down art has no north/east/west door sprites); when the nearest road is north, a paver path is laid around the building instead (T6 `place_building`). Spec said "door on the ring edge closest to a road" — this is the closest legal equivalent.
- Review Focus → tests: 1 → `test_load_features_skips_missing_nodes`; 2 → `test_fill_clips_outside_grid`; 3 → `test_touching_buildings_do_not_overlap_walls`; 4 → `test_building_without_road_still_gets_door`; 5 → `test_trees_skip_door_approach`.
- Types: `Layout.doors` is `(name, x, y)` everywhere (T6, T7, T8); `ElementDef` field order `(key, image_url, width, height, static, layer)` is used positionally in T7/T8 tests and matches T6.
