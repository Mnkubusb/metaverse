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
from campusmap import emit, geo, interiors, layout, reach  # noqa: E402

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

    data = emit.to_json(lay, MAP_ID, MAP_NAME, THUMB)
    # one generated interior per named building, plus the door portals both ways
    inside = interiors.build_all(lay, lay.footprints, random.Random(7))
    data["interiors"] = [emit.interior_to_json(m) for m in inside.maps]
    data["portals"] = [emit.portal_to_json(pt) for pt in inside.portals]
    MAP_JSON.parent.mkdir(parents=True, exist_ok=True)
    MAP_JSON.write_text(json.dumps(data, indent=1) + "\n")

    print(f"{lay.width}x{lay.height} tiles, {len(lay.elements)} elements, {len(lay.placements)} placements, "
          f"{reach.reachable_count(lay)} reachable tiles, spawn {lay.spawn}")
    print("doors:", ", ".join(f"{n}@{x},{y}" for n, x, y in lay.doors))
    print(f"{len(inside.maps)} interiors, {len(inside.portals)} portals")


if __name__ == "__main__":
    main()
