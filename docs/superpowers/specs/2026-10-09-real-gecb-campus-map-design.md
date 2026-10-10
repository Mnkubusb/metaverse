# Real GEC Bilaspur campus map — design

Date: 2026-10-09
Status: approved in discussion, awaiting implementation plan

## Goal

Replace the fictional GEC Bilaspur layout produced by `tools/campus-map/generate.py`
with the real campus geometry, so GECB students recognise the campus when they walk
it. Building positions and shapes come from OpenStreetMap; tile art comes from
downloaded sprite packs instead of procedurally drawn pixel art.

This is sub-project 1 of 3:

1. **Real campus exterior** (this spec).
2. Portal mechanic — door tile teleports the player into a per-building space.
3. Building interiors — one interior map per building, wired through portals.

Sub-projects 2 and 3 get their own specs. This spec leaves doors as plain
non-blocking tiles so portals can attach later without regenerating art.

## Non-goals

- Enterable buildings, interiors, teleports.
- Shipping satellite imagery. Google/Esri tiles are not redistributable and are not
  used. OSM building footprints (ODbL) are the only geographic source.
- Girls hostels, dispensary, auditorium, etc. that OSM does not have. Only mapped
  features are drawn; unmapped ground is grass.
- Changing the renderer (`spaceGrid.tsx`), the ws collision rules, or the Prisma
  schema. The generator emits the same JSON shape the seed already consumes.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Layout source | OSM building/road/landuse polygons via the OSM API, cached in repo |
| Sprite licences | CC0 + CC-BY + CC-BY-SA/GPL (LPC) allowed, with a CREDITS file |
| Coverage / scale | Campus core only, 3 m per tile, ≈130 × 128 tiles |
| Buildings | Solid exteriors (wall layer, static); door tile reserved for portals |

## Source data

OSM bbox `82.1280,22.1340,82.1330,22.1385` (W,S,E,N) covers every mapped campus
feature: CS/IT/ET&T Building, Civil / Electronics / Mechanical / Mining / Electrical
departments, Electrical Quadrangle, Workshop, M. Visvesvaraya Hall, main college
building, canteen, badminton court, outdoor gym, Royal Shubhash Garden, car and
motorcycle parking, Amarkantak / Shaheed Veer Narayan Singh / Panchsheel boys
hostels, GEC Bilaspur Road and the internal service roads.

Fetched with `GET https://api.openstreetmap.org/api/0.6/map.json?bbox=…` (the
Overpass mirrors returned 406/500 during exploration; the main API works). The raw
response is committed as `tools/campus-map/osm/gec-bilaspur.osm.json` so regeneration
is offline and reproducible. `tools/campus-map/osm/LICENSE` carries the ODbL
attribution ("© OpenStreetMap contributors").

## Components

All under `tools/campus-map/`. Python 3, Pillow, pytest. No new JS dependencies.

### `fetch_osm.py`

Downloads the bbox above and writes `osm/gec-bilaspur.osm.json`. Sends a
`User-Agent: metaverse-campus-map` header. Run only when the map data should be
refreshed; the generator never calls the network.

### `fetch_sprites.py` + `tiles.toml`

Downloads these packs into `packs/` (gitignored):

| Pack | Licence | Used for |
|---|---|---|
| Kenney Roguelike Modern City | CC0 | roads, asphalt, roofs, cars, bikes, lamps, benches, trees |
| Kenney Tiny Town | CC0 | grass, flowers, fences, extra props |
| LPC City Outside (OpenGameArt) | CC-BY-SA 3.0 / GPL 3.0 | 32 px walls, windows, doors, signs |

`tiles.toml` is the slicing manifest. Each entry names an output sprite and where it
comes from:

```toml
[road-h]
pack = "roguelike-modern-city"
sheet = "tilemap_packed.png"
x = 3        # tile column in the sheet
y = 1        # tile row
w = 1        # tiles wide
h = 1
scale = 2    # 16 px packs are nearest-neighbour upscaled to the 32 px grid
```

`fetch_sprites.py` slices every entry into `apps/web/public/campus/<name>.png`,
replacing the current procedurally drawn files of the same name. Sprites not in the
manifest are deleted from `public/campus/` so stale art cannot linger.

`apps/web/public/campus/CREDITS.md` lists each pack, author, licence and URL. This
satisfies CC-BY-SA attribution and is served with the site.

### `generate.py`

Rewritten. Keeps only the text-rendering helpers (building name boards); all
pixel-art drawing functions are removed.

Pipeline:

1. **Load** `osm/gec-bilaspur.osm.json`; resolve way node refs to lat/lon.
2. **Project** every point: equirectangular with the bbox NW corner as origin,
   `tx = (lon − lon0) · cos(lat_mid) · 111320 / 3`, `ty = (lat0 − lat) · 111320 / 3`.
   Add a 2-tile grass margin on every side. Map width/height = ceil of extents.
3. **Classify** ways by tag:
   - `building=*` → building (named from `name`, shortened by an alias table, e.g.
     `GEC Bilaspur CS/IT/ET&T Building` → `CS/IT Block`; unnamed → no sign)
   - `highway=service` → road, 2 tiles wide; `residential|tertiary` → 3 wide
   - `leisure=garden` → lawn with flowerbeds; `leisure=pitch` → court
   - `amenity=parking` → asphalt + cars; `amenity=motorcycle_parking` → asphalt + bikes
   - named `amenity=college` (quadrangle, ground, gym) → paver plaza
   - everything else ignored
4. **Rasterize** into `cell[y][x]` of kind `grass | lawn | court | paver | asphalt |
   road | building(id)`. Paint order grass → lawn/court/paver/asphalt → road →
   building; later wins. Polygons use even-odd scanline fill; roads stroke the
   centreline with the given width.
5. **Autotile.** Road and building cells get an 8-neighbour bitmask that selects the
   tile variant (straight / corner / T / cross for roads; wall-top / wall-side /
   corner / roof-interior for buildings). Variants the packs lack fall back to the
   nearest available one.
6. **Buildings.** Footprint → `wall` layer, `static: true`. Outer ring is LPC wall
   tiles with a window every third tile; interior cells are roof tiles. Each named
   building gets a 2-tile-wide door on the ring edge closest to a road cell (`objects`
   layer, `static: false`, imageUrl ends in `door.png`) and a name board directly
   above it (`objects`, static, text rendered from the alias).
7. **Props** (deterministic, `random.Random(42)`): trees along road edges every ~6
   tiles unless the tile is on a door's approach; lamps at road corners; benches in
   the garden; cars / bikes in the parking lots; flagpole and gate arch where GEC
   Bilaspur Road enters the bbox from the south. Props are `objects` layer (bottom row
   blocks) except the gate arch, which is `topObjects`.
8. **Spawn**: the road tile directly inside the main gate.
9. **Reachability**: BFS from spawn over non-blocked tiles, using the same blocking
   rules as `apps/ws/src/SpaceGrid.ts` (wall → whole footprint, objects → bottom row).
   Every door tile must be reachable; otherwise exit non-zero naming the building.
10. **Emit**:
    - `packages/db/prisma/maps/gec-bilaspur.json` — unchanged schema
      (`map`, `elements`, `placements`); floor cells become per-tile placements as
      today, so the seed script needs no change.
    - `apps/web/public/campus/overview.png` (full render) and
      `gec-bilaspur-thumb.png` (scaled).
    - `tools/campus-map/preview.png`.

### `CampusMap.tsx` (landing page)

`MAP_W` / `MAP_H` and the `WALKERS` routes are updated to the new grid; routes follow
the new road coordinates (generator prints a few suggested routes along the longest
roads to make this easy).

### `README.md`

How to refetch OSM, refetch sprites, regenerate, reseed; where to edit the alias
table and `tiles.toml`.

## Data flow

```
OSM API ──fetch_osm.py──▶ osm/gec-bilaspur.osm.json ─┐
                                                      ├─generate.py─▶ gec-bilaspur.json ─▶ pnpm db:seed
Kenney/LPC zips ─fetch_sprites.py─▶ public/campus/*.png ┘            overview.png, thumb, preview
```

## Error handling

- `fetch_osm.py` / `fetch_sprites.py`: non-200 response or missing sheet → exit 1
  with the URL. No partial writes (download to temp, then move).
- `generate.py`: missing sprite named in the layout → exit 1 listing the names;
  unreachable door → exit 1 naming the building; unknown building name without alias
  → warning, sign uses the OSM name truncated to fit.

## Testing

`tools/campus-map/test_generate.py` (pytest), pure functions only:

- projection: a known lat/lon pair maps to the expected tile; 3 m east ≈ 1 tile.
- rasterize: a 4×4 square polygon fills exactly 16 cells; a concave L-shape fills
  the right cells.
- road bitmask: isolated / straight / corner / T / cross neighbourhoods pick the
  expected variant.
- door placement: a building beside a road puts its door on the road-facing edge.
- reachability: a building fully enclosed by another returns a failure naming it.

Integration:

- `apps/ws/test` runs unchanged against the new JSON.
- Manual: `pnpm db:seed`, run the app, create a space from the map, walk
  gate → CS/IT Block → Amarkantak hostel; screenshot the landing page.

## Open items for later sub-projects

- Door tiles are identified by imageUrl suffix `door.png` and by `x, y` in the JSON;
  sub-project 2 will add a `portals` section mapping each door to a child map.
