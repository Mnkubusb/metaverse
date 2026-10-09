import type { PrismaClient, Prisma, Space } from "./node_modules/.prisma/client";

export type SpaceTx = PrismaClient | Prisma.TransactionClient;

export function createSpaceFromMap(
    tx: SpaceTx,
    mapId: string,
    opts: { name: string; creatorId: string; visibility: "Private" | "Unlisted" | "Public"; parentId?: string | null; members?: boolean },
): Promise<Space | null>;

export function attachPortals(tx: SpaceTx, spaceId: string, mapId: string): Promise<number>;
