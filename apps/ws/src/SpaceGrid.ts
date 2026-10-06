import client from "@repo/db/client";

type Layer = "floor" | "wall" | "objects" | "topObjects";

export interface PlacedElement {
    x: number;
    y: number;
    area?: string;
    toArea?: string | null;
    toX?: number | null;
    toY?: number | null;
    element: { width: number; height: number; static: boolean; layer: Layer };
}

export interface AreaDef {
    id: string;
    name: string;
    width: number;
    height: number;
    spawnX: number;
    spawnY: number;
}

export interface Position {
    area: string;
    x: number;
    y: number;
}

export const MAIN_AREA = "main";

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

// Walkability of one area (the outdoor map or one building interior), plus its doors.
export class AreaGrid {
    private blocked = new Set<number>();
    private doors = new Map<number, Position>();

    constructor(
        public readonly id: string,
        public readonly width: number,
        public readonly height: number,
        elements: PlacedElement[],
        private readonly spawnHint: { x: number; y: number } | null,
    ) {
        for (const e of elements) {
            for (const [tx, ty] of blockedTiles(e)) this.blocked.add(this.key(tx, ty));
            if (e.toArea && e.toX !== null && e.toX !== undefined && e.toY !== null && e.toY !== undefined) {
                // a door covers every tile of its footprint
                for (let ty = e.y; ty < e.y + e.element.height; ty++) {
                    for (let tx = e.x; tx < e.x + e.element.width; tx++) {
                        this.doors.set(this.key(tx, ty), { area: e.toArea, x: e.toX, y: e.toY });
                    }
                }
            }
        }
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

    doorAt(x: number, y: number): Position | undefined {
        return this.doors.get(this.key(x, y));
    }

    // Nearest walkable tile to the spawn point (or the centre), found with a BFS.
    spawnPoint(): { x: number; y: number } {
        const start = this.spawnHint ?? { x: Math.floor(this.width / 2), y: Math.floor(this.height / 2) };
        return this.nearestWalkable(start.x, start.y);
    }

    nearestWalkable(x0: number, y0: number): { x: number; y: number } {
        const sx = Math.min(Math.max(x0, 0), this.width - 1);
        const sy = Math.min(Math.max(y0, 0), this.height - 1);
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

// All areas of a space: the outdoor map ("main") and each building interior.
export class SpaceGrid {
    private areas = new Map<string, AreaGrid>();

    constructor(width: number, height: number, areaDefs: AreaDef[], elements: PlacedElement[], spawn: { x: number; y: number } | null) {
        const byArea = new Map<string, PlacedElement[]>();
        for (const e of elements) {
            const id = e.area ?? MAIN_AREA;
            if (!byArea.has(id)) byArea.set(id, []);
            byArea.get(id)!.push(e);
        }
        this.areas.set(MAIN_AREA, new AreaGrid(MAIN_AREA, width, height, byArea.get(MAIN_AREA) ?? [], spawn));
        for (const a of areaDefs) {
            if (a.id === MAIN_AREA || this.areas.has(a.id)) continue;
            this.areas.set(a.id, new AreaGrid(a.id, a.width, a.height, byArea.get(a.id) ?? [], { x: a.spawnX, y: a.spawnY }));
        }
    }

    static async load(spaceId: string): Promise<SpaceGrid | null> {
        const space = await client.space.findUnique({
            where: { id: spaceId },
            include: { elements: { include: { element: true } } },
        });
        if (!space) return null;
        const spawn = space.spawnX !== null && space.spawnY !== null ? { x: space.spawnX, y: space.spawnY } : null;
        return new SpaceGrid(space.width, space.height, parseAreas(space.areas), space.elements, spawn);
    }

    area(id: string): AreaGrid | undefined {
        return this.areas.get(id);
    }

    get main(): AreaGrid {
        return this.areas.get(MAIN_AREA)!;
    }

    // Where you land when the server moves you to `target`: the target tile if it's free, else the nearest free tile.
    // Unknown areas fall back to the outdoor spawn so a bad door can never strand a player.
    resolve(target: Position): Position {
        const grid = this.areas.get(target.area);
        if (!grid) return { area: MAIN_AREA, ...this.main.spawnPoint() };
        return { area: grid.id, ...grid.nearestWalkable(target.x, target.y) };
    }
}

// The `areas` JSON column is free-form in the database; keep only well-formed entries.
export function parseAreas(raw: unknown): AreaDef[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((a): a is AreaDef =>
        !!a && typeof a === "object" &&
        typeof (a as AreaDef).id === "string" &&
        Number.isInteger((a as AreaDef).width) && (a as AreaDef).width > 0 &&
        Number.isInteger((a as AreaDef).height) && (a as AreaDef).height > 0 &&
        Number.isInteger((a as AreaDef).spawnX) && Number.isInteger((a as AreaDef).spawnY),
    );
}
