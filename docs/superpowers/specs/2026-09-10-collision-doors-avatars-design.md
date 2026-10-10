# Collision, door animation, sitting, and selectable avatars

Date: 2026-09-10
Status: approved

## Problem

Four gaps in the space renderer and the WebSocket server:

1. Players walk through walls. `User.ts` validates only that a move is one
   step; it never loads the space's elements, so it cannot know where the
   walls are.
2. Doors are static images. Nothing reacts when a player approaches.
3. Chairs are decoration; there is no way to sit on one.
4. The avatar picker (`avatarSelection.tsx`) exists but the `Avatar` table is
   empty, so there is nothing to pick.

A fifth problem blocks the first: the player and the tiles use different
coordinate systems.

## Decisions

| Question | Decision |
|---|---|
| Coordinate system | One player unit = one tile |
| Collision authority | Server-authoritative with client-side prediction |
| Avatar source | Generated recolours from the sprite generator |
| Build order | These features first, College Lab map after |

## 1. Coordinate unification

`spaceGrid.tsx` draws tiles at `x * 32` but the player at `x * 8`, so the
player grid is four times finer than the tile grid. Movement bounds clamp to
`height * 32` rather than `height - 1`, which lets the player walk far outside
the map.

Player `x`/`y` become tile coordinates:

- The player and other users draw at `x * 32`, `y * 32`.
- Keyboard bounds clamp to `width - 1` and `height - 1`.
- The camera centres on the interpolated position, not the logical tile.

To avoid steppy motion, the renderer keeps a `renderPos` (a `Vector2` in
pixels) that eases toward `tile * 32` over roughly 120ms. The existing
`isMoving` / `direction` state already drives the walk cycle, so the animation
needs no change beyond being tied to the tween rather than the keypress.

The server's spawn point must be a walkable tile. `User.ts` spawns at `(0,0)`,
which is a wall corner on the office map. Spawn resolves to the first
non-blocked tile scanning from the map centre outward.

## 2. Collision

### Blocked-tile set

New module `apps/ws/src/SpaceMap.ts`:

```
buildBlockedTiles(elements) -> Set<"x,y">
```

A pure function over the space's elements. For each element with
`static === true`, every tile in its `width` x `height` footprint is added.
Elements with `static === false` (floors, doors, chairs, rugs, lamps) are not
blocked. Being pure and exported, it is directly testable.

`SpaceMap` caches one blocked set per `spaceId`, loaded on the first join to
that space and dropped when the room empties, so a space is queried once
rather than once per player.

### Server enforcement

The `move` handler in `User.ts` gains two checks alongside the existing
one-step check:

1. Target is inside `0..width-1`, `0..height-1`.
2. Target is not in the blocked set.

Failure sends the existing `movement-rejected` message with the player's
current position, which the client already handles by snapping back.

### Client prediction

The renderer builds the same blocked set from the elements it already fetches
and refuses the keypress locally, so movement feels instant. The server stays
the authority: a rejection snaps the player back. The shared rule — "static
means blocked" — is stated once in this spec and implemented on both sides.

## 3. Door animation

A new `door-sheet.png` holds four 32x32 frames: closed, ajar, open, wide.

Each frame of the draw loop, the renderer measures Chebyshev distance from the
player's tile to each door element. At distance <= 1 the door eases toward the
open frame; beyond, it eases closed. Per-element progress lives in a ref keyed
by element id, so doors animate independently.

This is cosmetic. Doors are `static: false` and stay walkable whatever the
animation shows.

## 4. Sprite image cache

`Sprite.drawImage` constructs `new Image()` on every call, which happens once
per element per frame. One office-space load issued 1098 image requests, and
the first draws land before the image decodes.

A module-level `Map<string, HTMLImageElement>` keyed by resource URL fixes
both: images load once, and `drawImage` returns early until `img.complete`.
Frame-accurate animation depends on this, so it lands before the door and
avatar work.

## 5. Avatars

The generator emits eight walk-cycle sheets in the layout the renderer already
assumes: 400x400, a 5x5 grid of 80x80 frames, with frames 0-5 walking down,
6-11 right, 12-17 left, 18-23 up. Sheets vary by skin tone, hair colour, and
shirt colour.

Two existing defects are fixed alongside:

- Other players draw at 64x64 on a 4x4 grid while the local player draws at
  80x80 on a 5x5 grid (`spaceGrid.tsx`). Both use the 80x80 5x5 layout.
- `GET /api/v1/avatar` returns 500 when a user has no `avatarId`, because
  `findUnique` is called with `undefined`. It returns `{ avatar: null }`.

The seed adds one `Avatar` row per sheet. `avatarSelection.tsx` already lists
avatars and saves the choice through `/user/metadata`; it needs rows, not
changes.

## 6. Sitting

Chairs and couches are `static: false`, so a player can already stand on one.
Sitting turns that into a state.

Pressing `e` while standing on a seat tile sits the player down; pressing `e`
again, or any movement key, stands them up. A seat tile is one covered by an
element whose `imageUrl` ends in `chair.png`, `couch.png`, or `stool.png`;
the renderer resolves this from the elements it already has, and the server
resolves it from the same element list it loads for collision, so the two
agree without a new schema field.

The seated player draws frame 24 of the walk sheet — the spare cell in the 5x5
grid, which the generator fills with a sitting pose facing down.

Protocol additions, following the existing accept/reject shape:

- Client sends `{ type: "sit" }` or `{ type: "stand" }`.
- The server verifies the player's current tile is a seat (for `sit`) and
  replies `sit-accepted` / `sit-rejected` with the authoritative state.
- `sit` and `stand` broadcast to the room so other players see the pose.
- While a player is seated the server rejects `move` outright; the client
  sends `stand` first when a movement key is pressed, then moves.

Seated state lives on `User` in the WS server and in the `users` map the
context already maintains, so other players render seated correctly.

## Interfaces between workstreams

Asset paths are fixed here so the pieces can be built independently:

- Door sheet: `/Office/door-sheet.png`, 128x32, four 32x32 frames left to
  right, closed first.
- Avatars: `/Avatars/avatar-1.png` through `/Avatars/avatar-8.png`, each
  400x400. Frame 24 (last cell) is the sitting pose.
- `buildBlockedTiles(elements)` takes `{ x, y, element: { width, height,
  static } }[]` and returns `Set<string>` of `"x,y"`.

## Verification

- A test script asserts `buildBlockedTiles`: a wall tile is blocked, a door
  tile is not, and a 2x1 desk blocks both of its tiles.
- Walking into a wall leaves the position unchanged; walking through a doorway
  succeeds; the door animates on approach.
- The avatar picker lists eight avatars and the choice persists across reload.
- A screenshot of the office space confirms the render.

## Out of scope

- The `MapEditor.tsx` `"top-objects"` vs `"topObjects"` mismatch.
- The College Lab map, which follows this work.
- Proximity chat, voice, and anything else on the README roadmap.
