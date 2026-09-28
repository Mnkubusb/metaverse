import client from "@repo/db/client";

type Layer = "floor" | "wall" | "objects" | "topObjects";

interface PlacedElement {
    x: number;
    y: number;
    element: { width: number; height: number; static: boolean; layer: Layer };
}

// Tiles an element blocks. Keep in sync with apps/web/lib/collision.ts:
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

export class SpaceGrid {
    private blocked = new Set<number>();

    constructor(
        public readonly width: number,
        public readonly height: number,
        elements: PlacedElement[],
        private readonly spawnHint: { x: number; y: number } | null,
    ) {
        for (const e of elements) {
            for (const [tx, ty] of blockedTiles(e)) this.blocked.add(this.key(tx, ty));
        }
    }

    static async load(spaceId: string): Promise<SpaceGrid | null> {
        const space = await client.space.findUnique({
            where: { id: spaceId },
            include: { elements: { include: { element: true } } },
        });
        if (!space) return null;
        const spawn = space.spawnX !== null && space.spawnY !== null ? { x: space.spawnX, y: space.spawnY } : null;
        return new SpaceGrid(space.width, space.height, space.elements, spawn);
    }

    private key(x: number, y: number) {
        return y * this.width + x;
    }

    isWalkable(x: number, y: number) {
        return (
            Number.isInteger(x) && Number.isInteger(y) &&
            x >= 0 && y >= 0 && x < this.width && y < this.height &&
            !this.blocked.has(this.key(x, y))
        );
    }

    // Nearest walkable tile to the spawn point (or the centre), found with a BFS.
    spawnPoint(): { x: number; y: number } {
        const start = this.spawnHint ?? { x: Math.floor(this.width / 2), y: Math.floor(this.height / 2) };
        const sx = Math.min(Math.max(start.x, 0), this.width - 1);
        const sy = Math.min(Math.max(start.y, 0), this.height - 1);
        const seen = new Set<number>([this.key(sx, sy)]);
        const queue: [number, number][] = [[sx, sy]];
        for (let i = 0; i < queue.length; i++) {
            const [x, y] = queue[i]!;
            if (this.isWalkable(x, y)) return { x, y };
            for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
                if (nx < 0 || ny < 0 || nx >= this.width || ny >= this.height) continue;
                const k = this.key(nx, ny);
                if (seen.has(k)) continue;
                seen.add(k);
                queue.push([nx, ny]);
            }
        }
        return { x: sx, y: sy };
    }
}
