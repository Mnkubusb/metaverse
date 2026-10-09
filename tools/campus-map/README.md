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
- Building wall styles, prop density, door approach, gate: `campusmap/layout.py`.
- Scale (metres per tile), bbox, margin: `campusmap/geo.py`.

## Tests

```bash
uv run --with pillow --with pytest pytest tools/campus-map/tests -q
```

## Licences

Map data © OpenStreetMap contributors (ODbL). Sprites: see
`apps/web/public/campus/CREDITS.md`.

## Interiors and portals

`generate.py` also emits one generated interior map per named building
(`interiors` in the JSON, built by `campusmap/interiors.py` from the `/Office` art)
and the door portals both ways (`portals`). The seed upserts them as maps +
`MapPortal` rows; creating a space from the campus map (`@repo/db/spaces`) creates
one child space per interior and the `SpacePortal` rows. Walking onto a door tile
makes the ws server send `portal`, and the client opens the target space with
`?via=<portalId>` so it spawns at that door's exit. To hand-design an interior,
replace its entry in `interiors.py` (or edit the map in the admin editor after
seeding — portals are matched by map id, not by content).
