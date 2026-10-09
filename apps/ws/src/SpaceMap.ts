export type BlockingElement = {
    x: number;
    y: number;
    element: {
        width: number;
        height: number;
        static: boolean;
    };
};

export type SeatElement = {
    x: number;
    y: number;
    element: {
        width: number;
        height: number;
        imageUrl: string;
    };
};

const SEAT_SUFFIXES = ["chair.png", "couch.png", "stool.png"];

/**
 * Pure: every element with `static === true` blocks every tile in its
 * width x height footprint, anchored at (x, y). Non-static elements
 * (floors, doors, chairs, rugs, lamps) block nothing.
 *
 * Kept free of imports so it can be bundled and unit tested standalone.
 */
export function buildBlockedTiles(elements: BlockingElement[]): Set<string> {
    const blocked = new Set<string>();
    for (const e of elements) {
        if (!e || !e.element || e.element.static !== true) {
            continue;
        }
        const width = Math.max(1, e.element.width ?? 1);
        const height = Math.max(1, e.element.height ?? 1);
        for (let dx = 0; dx < width; dx++) {
            for (let dy = 0; dy < height; dy++) {
                blocked.add(`${e.x + dx},${e.y + dy}`);
            }
        }
    }
    return blocked;
}

/**
 * Pure: true when (x, y) falls inside the footprint of an element whose
 * imageUrl ends in chair.png / couch.png / stool.png.
 */
export function isSeatTile(elements: SeatElement[], x: number, y: number): boolean {
    for (const e of elements) {
        if (!e || !e.element) {
            continue;
        }
        const url = (e.element.imageUrl ?? "").toLowerCase();
        if (!SEAT_SUFFIXES.some((suffix) => url.endsWith(suffix))) {
            continue;
        }
        const width = Math.max(1, e.element.width ?? 1);
        const height = Math.max(1, e.element.height ?? 1);
        if (x >= e.x && x < e.x + width && y >= e.y && y < e.y + height) {
            return true;
        }
    }
    return false;
}

export type SpaceMapEntry = {
    spaceId: string;
    width: number;
    height: number;
    elements: (BlockingElement & SeatElement)[];
    blocked: Set<string>;
};

/**
 * One blocked-tile set per spaceId, loaded on the first join to that space
 * and dropped when the room empties, so a space is queried once rather than
 * once per player.
 */
class SpaceMapCache {
    private entries: Map<string, SpaceMapEntry> = new Map();
    private inflight: Map<string, Promise<SpaceMapEntry | undefined>> = new Map();

    public get(spaceId: string): SpaceMapEntry | undefined {
        return this.entries.get(spaceId);
    }

    public async load(spaceId: string): Promise<SpaceMapEntry | undefined> {
        const cached = this.entries.get(spaceId);
        if (cached) {
            return cached;
        }
        const pending = this.inflight.get(spaceId);
        if (pending) {
            return pending;
        }
        const load = this.fetch(spaceId).finally(() => {
            this.inflight.delete(spaceId);
        });
        this.inflight.set(spaceId, load);
        return load;
    }

    private async fetch(spaceId: string): Promise<SpaceMapEntry | undefined> {
        // Imported lazily so the pure helpers above stay bundler-standalone.
        const mod: any = await import("@repo/db/client");
        const client: any = mod.default ?? mod;
        const space = await client.space.findFirst({
            where: { id: spaceId },
            select: { width: true, height: true }
        });
        if (!space) {
            return undefined;
        }
        const elements = await client.spaceElements.findMany({
            where: { spaceId },
            include: { element: true }
        });
        const entry: SpaceMapEntry = {
            spaceId,
            width: space.width,
            height: space.height,
            elements: elements as unknown as (BlockingElement & SeatElement)[],
            blocked: buildBlockedTiles(elements as unknown as BlockingElement[])
        };
        this.entries.set(spaceId, entry);
        return entry;
    }

    public isBlocked(spaceId: string, x: number, y: number): boolean {
        const entry = this.entries.get(spaceId);
        if (!entry) {
            return false;
        }
        return entry.blocked.has(`${x},${y}`);
    }

    public inBounds(spaceId: string, x: number, y: number): boolean {
        const entry = this.entries.get(spaceId);
        if (!entry) {
            return true;
        }
        return x >= 0 && y >= 0 && x < entry.width && y < entry.height;
    }

    public isSeat(spaceId: string, x: number, y: number): boolean {
        const entry = this.entries.get(spaceId);
        if (!entry) {
            return false;
        }
        return isSeatTile(entry.elements, x, y);
    }

    /**
     * First walkable tile scanning outward (by Chebyshev ring) from the map
     * centre. Falls back to (0, 0) when the whole map is blocked.
     */
    public resolveSpawn(spaceId: string): { x: number; y: number } {
        const entry = this.entries.get(spaceId);
        if (!entry) {
            return { x: 0, y: 0 };
        }
        const cx = Math.floor(entry.width / 2);
        const cy = Math.floor(entry.height / 2);
        const maxRadius = Math.max(entry.width, entry.height);
        for (let r = 0; r <= maxRadius; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (r > 0 && Math.max(Math.abs(dx), Math.abs(dy)) !== r) {
                        continue;
                    }
                    const x = cx + dx;
                    const y = cy + dy;
                    if (x < 0 || y < 0 || x >= entry.width || y >= entry.height) {
                        continue;
                    }
                    if (!entry.blocked.has(`${x},${y}`)) {
                        return { x, y };
                    }
                }
            }
        }
        return { x: 0, y: 0 };
    }

    public drop(spaceId: string) {
        this.entries.delete(spaceId);
    }
}

export const SpaceMap = new SpaceMapCache();

export type PortalRect = {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    targetSpaceId: string;
    targetX: number;
    targetY: number;
};

/**
 * Pure: the portal whose footprint contains tile (x, y), or null.
 */
export function portalAt<P extends PortalRect>(portals: P[], x: number, y: number): P | null {
    for (const p of portals) {
        if (x >= p.x && x < p.x + p.width && y >= p.y && y < p.y + p.height) {
            return p;
        }
    }
    return null;
}
