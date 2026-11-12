import type { spaceElement } from '@/components/space/SpaceElement';

// Elements you can use by walking up and pressing E.
// Board ids must match BOARD_ELEMENT_IDS in apps/http/src/routes/v1/notices.ts.
const BOARD_ELEMENTS = new Set(['campus-notice-board', 'campus-sign-welcome', 'campus-sign-hostels']);
const SEAT_ELEMENTS = new Set(['campus-bench', 'campus-chair', 'campus-chair-red', 'campus-seat-row', 'campus-bench-long', 'campus-sofa']);

export type Interaction =
  | { kind: 'board'; boardId: string; label: string }
  | { kind: 'seat'; seat: { x: number; y: number } };

// Nearest thing within one tile (including diagonals) of the player's tile.
// Boards count their whole footprint; seats only their bottom (solid) row.
export function findInteraction(elements: spaceElement[], x: number, y: number): Interaction | null {
  let best: { d: number; hit: Interaction } | null = null;
  for (const e of elements) {
    const id = e.element.id;
    const isBoard = BOARD_ELEMENTS.has(id);
    const isSeat = SEAT_ELEMENTS.has(id);
    if (!isBoard && !isSeat) continue;
    const top = isSeat ? e.y + e.element.height - 1 : e.y;
    for (let ty = top; ty < e.y + e.element.height; ty++) {
      for (let tx = e.x; tx < e.x + e.element.width; tx++) {
        const d = Math.max(Math.abs(tx - x), Math.abs(ty - y));
        const dist = Math.hypot(tx - x, ty - y);
        if (d > 1 || (best && dist >= best.d)) continue;
        best = {
          d: dist,
          hit: isBoard
            ? { kind: 'board', boardId: e.id, label: id === 'campus-notice-board' ? 'notice board' : 'signboard notes' }
            : { kind: 'seat', seat: { x: tx, y: ty } },
        };
      }
    }
  }
  return best?.hit ?? null;
}

// Screens that host watch parties: the multiplex screen, the auditorium's projector, hostel
// common-room TVs and the riverfront's open-air screen. `inset` is the picture area inside the
// sprite in art pixels (left, top, right, bottom): the video is laid over exactly that rectangle.
// Keep in sync with cinema_screen() / tv() in tools/campus-map/interiors.py and led_screen() in props.py.
const SCREEN_ELEMENTS: Record<string, { label: string; inset: [number, number, number, number] }> = {
  'campus-cinema-screen': { label: 'cinema screen', inset: [8, 8, 8, 14] },
  'campus-projector-screen': { label: 'projector screen', inset: [8, 8, 8, 14] },
  'campus-tv': { label: 'TV', inset: [9, 7, 9, 6] },
  'campus-led-screen': { label: 'open-air screen', inset: [7, 9, 7, 36] },
};
export const SCREEN_RANGE = 16; // a big hall: the back row still gets the button

export interface ScreenSpot {
  screenId: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  inset: [number, number, number, number];
}

export function screensIn(elements: spaceElement[]): ScreenSpot[] {
  return elements
    .filter((e) => e.element.id in SCREEN_ELEMENTS)
    .map((e) => ({ screenId: e.id, x: e.x, y: e.y, width: e.element.width, height: e.element.height, ...SCREEN_ELEMENTS[e.element.id]! }));
}

// Tiles from (x, y) to the screen's footprint (Chebyshev).
export function screenDistance(s: ScreenSpot, x: number, y: number) {
  const dx = Math.max(s.x - x, 0, x - (s.x + s.width - 1));
  const dy = Math.max(s.y - y, 0, y - (s.y + s.height - 1));
  return Math.max(dx, dy);
}

// The closest screen within SCREEN_RANGE tiles of (x, y).
export function nearestScreen(screens: ScreenSpot[], x: number, y: number): ScreenSpot | null {
  let best: { d: number; s: ScreenSpot } | null = null;
  for (const s of screens) {
    const d = screenDistance(s, x, y);
    if (d <= SCREEN_RANGE && (!best || d < best.d)) best = { d, s };
  }
  return best?.s ?? null;
}
