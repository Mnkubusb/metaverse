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

// Screens that host watch parties (Netflix-and-chill): the multiplex screen, the auditorium's
// projector, hostel common-room TVs and the riverfront's open-air screen.
const SCREEN_ELEMENTS: Record<string, string> = {
  'campus-cinema-screen': 'cinema screen',
  'campus-projector-screen': 'projector screen',
  'campus-tv': 'TV',
  'campus-led-screen': 'open-air screen',
};
export const SCREEN_RANGE = 9;

export interface ScreenSpot { screenId: string; label: string; x: number; y: number; width: number; height: number }

export function screensIn(elements: spaceElement[]): ScreenSpot[] {
  return elements
    .filter((e) => e.element.id in SCREEN_ELEMENTS)
    .map((e) => ({ screenId: e.id, label: SCREEN_ELEMENTS[e.element.id]!, x: e.x, y: e.y, width: e.element.width, height: e.element.height }));
}

// The closest screen within SCREEN_RANGE tiles of (x, y) (measured to the screen's footprint).
export function nearestScreen(screens: ScreenSpot[], x: number, y: number): ScreenSpot | null {
  let best: { d: number; s: ScreenSpot } | null = null;
  for (const s of screens) {
    const dx = Math.max(s.x - x, 0, x - (s.x + s.width - 1));
    const dy = Math.max(s.y - y, 0, y - (s.y + s.height - 1));
    const d = Math.max(dx, dy);
    if (d <= SCREEN_RANGE && (!best || d < best.d)) best = { d, s };
  }
  return best?.s ?? null;
}
