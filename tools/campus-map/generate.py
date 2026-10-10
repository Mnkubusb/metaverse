#!/usr/bin/env python3
"""
Generates the GEC Bilaspur campus map from real OpenStreetMap geometry, with a
walk-in interior for every named building.

Inputs
  tools/campus-map/osm/gec-bilaspur.osm.json   fetched by fetch_osm.py (ODbL)
  apps/web/public/campus/*.png                  sliced by fetch_sprites.py from tiles.toml
  tools/campus-map/interiors.py                 room art + templates (classroom, lab, hostel ...)

Outputs
  packages/db/prisma/maps/gec-bilaspur.json     map (+ areas) / elements / placements for the seed
  apps/web/public/campus/road-*.png             rendered road tiles, forest-*.png canopy blocks,
                                                sign-*.png name boards, interior sprites
  apps/web/public/campus/overview.png           full outdoor render used by the landing page
  apps/web/public/campus/gec-bilaspur-thumb.png thumbnail shown in the space creator
  tools/campus-map/preview.png                  same as overview, for eyeballing
  tools/campus-map/preview-interiors.png        every room on one sheet

Areas: the outdoors is area "main"; each building interior is its own area with its
own walkable grid. Doors are placements with a target (toArea/toX/toY): the two mats
in front of a building lead to its room, the room's exit mats lead back out.

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
from campusmap import areas, emit, geo, layout, reach  # noqa: E402

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
    rooms = areas.RoomBuilder(lay)
    area_defs = rooms.build()

    emit.render_forest_blocks(PUBLIC, random.Random(3))
    for old in PUBLIC.glob("road-*.png"):
        old.unlink()
    for key, png in lay.road_tiles.items():
        (PUBLIC / f"road-{key}.png").write_bytes(png)
    for key, img in rooms.images.items():
        img.save(PUBLIC / emit.sprite_file(lay.elements[key]), optimize=True)
    for key, text in lay.signs.items():
        e = lay.elements[key]
        im = emit.render_arch(text, e.width, e.height) if key == "gate-arch" else emit.render_sign(text, e.width, e.height)
        im.save(PUBLIC / emit.sprite_file(e), optimize=True)

    errors = emit.validate(lay, PUBLIC, area_defs)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        sys.exit(1)

    preview = emit.render_preview(lay, PUBLIC)
    preview.save(PREVIEW, optimize=True)
    preview.convert("RGB").save(PUBLIC / "overview.png", optimize=True)
    thumb = preview.resize((lay.width * 4, lay.height * 4), Image.LANCZOS).convert("RGB")
    thumb.save(PUBLIC / "gec-bilaspur-thumb.png", optimize=True)
    emit.render_interiors_sheet(lay, PUBLIC, area_defs).save(PREVIEW.with_name("preview-interiors.png"), optimize=True)

    MAP_JSON.parent.mkdir(parents=True, exist_ok=True)
    MAP_JSON.write_text(json.dumps(emit.to_json(lay, MAP_ID, MAP_NAME, THUMB, area_defs), indent=1) + "\n")

    outdoors = sum(1 for p in lay.placements if p.area == "main")
    print(f"{lay.width}x{lay.height} tiles, {len(lay.elements)} elements, {len(lay.placements)} placements "
          f"({outdoors} outdoors), {reach.reachable_count(lay)} reachable tiles, spawn {lay.spawn}")
    print("doors:", ", ".join(f"{n}@{x},{y}" for n, x, y in lay.doors))
    print(f"{len(area_defs)} interiors")


if __name__ == "__main__":
    main()
