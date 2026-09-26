import type { spaceElement } from '@/components/space/SpaceElement';

// Elements you can use by walking up and pressing E.
// Board ids must match BOARD_ELEMENT_IDS in apps/http/src/routes/v1/notices.ts.
const BOARD_ELEMENTS = new Set(['campus-notice-board', 'campus-sign-welcome', 'campus-sign-hostels']);
const SEAT_ELEMENTS = new Set(['campus-bench']);

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
