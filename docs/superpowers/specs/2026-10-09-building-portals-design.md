# Building portals — design

Date: 2026-10-09
Status: approved by standing instruction ("do all 4"); decisions below made by the executor

Sub-project 2 of the campus work (see `2026-10-09-real-gecb-campus-map-design.md`).
Sub-project 3 (hand-designed interiors) is folded in as *generated* interiors so
buildings are enterable now; bespoke room layouts can replace them later.

## Goal

Walking into a building's door on the campus map takes the player into that
building's interior space; walking out of the interior's exit door returns them to
the campus in front of the same building. Everyone in an interior sees each other
(chat, proximity media, benches) exactly as in any space.

## Non-goals

- Hand-authored room layouts per department (later).
- Portals between arbitrary user spaces (only map-defined portals).
- Editing portals in the admin map editor.

## Model

```
Map        1 ─── * MapPortal   (x, y, w, h, targetMapId, targetX, targetY)
Space      1 ─── * SpacePortal (x, y, w, h, targetSpaceId, targetX, targetY)
Space.parentId  → the campus space an interior belongs to (null for roots)
```

- `MapPortal` lives on the template. The campus map has one portal per named
  building (its 2×2 door footprint → that building's interior map). Each interior map
  has one exit portal (its door → the campus map, landing on the door approach tile).
  Because the exit targets the *parent* map, `targetMapId` for an exit is the campus
  map id; at space-creation time it resolves to the parent space.
- `SpacePortal` is the instance. Creating a space from a map with portals also creates
  one child space per distinct target map (same name prefix, same visibility and
  creator, `parentId` = the new space) and `SpacePortal` rows in both directions.
  Deleting the root cascades to children.
- Access: membership is kept on the root space only. `getAccess` and the ws `join`
  resolve `space.parentId ?? space.id` before checking visibility/members.
  Children are not listed on Explore / My spaces (`parentId IS NULL` filter).

## Runtime

- ws `move`: after a move is accepted, if the new tile is inside a `SpacePortal`
  footprint of the current space, the server sends
  `{ type: "portal", payload: { spaceId: targetSpaceId, portalId } }` to that user
  only. Portals are loaded with the grid (`SpaceGrid.load`) and cached with it.
- ws `join` accepts an optional `portalId`. If a `SpacePortal` with that id targets
  the joined space, the spawn is the portal's `targetX/Y` (nearest walkable), else the
  space's spawn.
- web: `WebSocketsContexts` handles `portal` by `router.push('/space/<id>?via=<portalId>')`.
  `SpaceGate` passes `via` into the provider; the page remounts (`key={id}`) and the
  new join carries `portalId`. A 200 ms black fade covers the switch.
- http `GET /space/:id` includes `portals` so the client can draw a doorway hint
  (small "Enter ↵" label over the portal footprint when the player is adjacent).

## Interiors (generated)

`tools/campus-map/campusmap/interiors.py` emits one interior map per named campus
building into the same `gec-bilaspur.json` under `interiors: [...]`:

- id `gec-bilaspur-<slug>`, name `<building name>`, size from the footprint:
  `w = clamp(bbox_w, 12, 40)`, `h = clamp(bbox_h, 10, 30)`.
- Tiles: `/Office/floor-tile.png` floor, `/Office/wall-h.png|wall-v.png|wall-corner.png`
  ring (existing office art), exit door = the campus `door` sprite centred on the
  bottom wall, non-static. Furniture by building kind: departments get rows of
  desk+chair with a whiteboard on the top wall; hostels get couches and bookshelves;
  canteen gets conference tables and chairs; workshop gets desks only.
- Element ids are fixed (`campus-int-floor`, `campus-int-wall-h`, …) so the seed
  upserts them like the campus elements.
- Spawn = tile just inside the exit door.
- Portals: campus door footprint (2×2) → interior, landing at the interior spawn;
  interior door footprint → campus, landing at the campus door approach tile
  `(dx, dy + 2)`.

## Seed

`seedCampus` additionally upserts interior maps (replace their mapElements) and
replaces `MapPortal` rows for the campus map and each interior. `migrateCampusSpaces`
(already present) also creates missing child spaces + portals for rebuilt spaces.

## Testing

- Python: interiors generator (size clamp, ring, exit door position, portal pairs
  consistent in both directions).
- ws: `node apps/ws/test/portals.test.mjs` — pure `portalAt(portals, x, y)` helper.
- http: space creation from the campus map creates N+1 spaces and 2N portals
  (checked against the local DB with a script, not a framework).
- Manual: walk into CS/IT Block door → interior; walk out → back in front of the door.
