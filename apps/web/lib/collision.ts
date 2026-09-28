export type Layer = "floor" | "wall" | "objects" | "topObjects";

export interface PlacedElement {
  x: number;
  y: number;
  element: { width: number; height: number; static: boolean; layer?: Layer };
}

// Tiles an element blocks. Keep in sync with apps/ws/src/SpaceGrid.ts:
//   wall     -> whole footprint (buildings, ponds, boundary walls)
//   objects  -> bottom row only, so players can walk "behind" trees and lamps
//   floor / topObjects never block
export function blockedTiles({ x, y, element }: PlacedElement): [number, number][] {
  if (!element.static) return [];
  let rows: number[];
  if (element.layer === "wall") {
    rows = Array.from({ length: element.height }, (_, i) => y + i);
  } else if (element.layer === "objects") {
    rows = [y + element.height - 1];
  } else {
    return [];
  }
  const tiles: [number, number][] = [];
  for (const ty of rows) {
    for (let tx = x; tx < x + element.width; tx++) tiles.push([tx, ty]);
  }
  return tiles;
}

export function buildWalkability(width: number, height: number, elements: PlacedElement[]) {
  const blocked = new Set<number>();
  for (const e of elements) {
    for (const [tx, ty] of blockedTiles(e)) blocked.add(ty * width + tx);
  }
  return (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && !blocked.has(y * width + x);
}
