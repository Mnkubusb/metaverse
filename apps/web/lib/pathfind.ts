export type Direction = "down" | "right" | "left" | "up";

const STEPS: [Direction, number, number][] = [["right", 1, 0], ["left", -1, 0], ["down", 0, 1], ["up", 0, -1]];

/**
 * Shortest walk (breadth-first, four directions) from `from` to the nearest tile that satisfies `goal`.
 * Tiles in `avoid` (doors) are never stepped on unless they are the goal itself, so tapping across the
 * map doesn't accidentally walk you into a building. Gives up after `limit` tiles explored.
 * Returns the list of steps, [] when already there, or null when unreachable.
 */
export function findPath(
  from: { x: number; y: number },
  goal: (x: number, y: number) => boolean,
  walkable: (x: number, y: number) => boolean,
  avoid: Set<string> = new Set(),
  limit = 6000,
): Direction[] | null {
  if (goal(from.x, from.y)) return [];
  const key = (x: number, y: number) => `${x},${y}`;
  const prev = new Map<string, { k: string; d: Direction } | null>([[key(from.x, from.y), null]]);
  const queue: [number, number][] = [[from.x, from.y]];
  for (let i = 0; i < queue.length && prev.size < limit; i++) {
    const [x, y] = queue[i]!;
    for (const [d, dx, dy] of STEPS) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (prev.has(k) || !walkable(nx, ny)) continue;
      const isGoal = goal(nx, ny);
      if (avoid.has(k) && !isGoal) continue;
      prev.set(k, { k: key(x, y), d });
      if (isGoal) {
        const path: Direction[] = [];
        for (let cur = prev.get(k); cur; cur = prev.get(cur.k)) path.unshift(cur.d);
        return path;
      }
      queue.push([nx, ny]);
    }
  }
  return null;
}
