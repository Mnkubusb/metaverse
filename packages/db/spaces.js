// Creates a space from a map template, including the child spaces and portals a map
// with portals (the campus and its building interiors) needs. Shared by the http
// server's "create space" route and the seed's campus-space migration.
//
// `tx` is a Prisma client or interactive-transaction client.

async function createSpaceFromMap(tx, mapId, { name, creatorId, visibility, parentId = null, members = true }) {
    const map = await tx.map.findUnique({
        where: { id: mapId },
        include: { mapElements: true, portals: true },
    });
    if (!map) return null;

    const space = await tx.space.create({
        data: {
            name,
            width: map.width,
            height: map.height,
            thumbnail: map.thumbnail,
            spawnX: map.spawnX,
            spawnY: map.spawnY,
            creatorId,
            visibility,
            parentId,
            ...(members ? { members: { create: { userId: creatorId, role: "Owner" } } } : {}),
        },
    });
    await tx.spaceElements.createMany({
        data: map.mapElements.map((e) => ({ spaceId: space.id, elementId: e.elementId, x: e.x, y: e.y })),
    });

    // one child space per distinct target map; portals back to the root resolve to this space
    const rootId = parentId ?? space.id;
    const children = new Map();
    for (const portal of map.portals) {
        if (portal.targetMapId === mapId || children.has(portal.targetMapId)) continue;
        const target = await tx.map.findUnique({ where: { id: portal.targetMapId }, select: { name: true } });
        const child = await createSpaceFromMap(tx, portal.targetMapId, {
            name: `${name} · ${target?.name ?? "inside"}`,
            creatorId,
            visibility,
            parentId: rootId,
            members: false,
        });
        children.set(portal.targetMapId, child);
    }
    if (map.portals.length) {
        // a portal to a map we made a child for goes there; anything else (an interior's
        // exit, which targets the campus map) goes back to the root
        await tx.spacePortal.createMany({
            data: map.portals.map((p) => ({
                spaceId: space.id,
                x: p.x, y: p.y, width: p.width, height: p.height,
                targetSpaceId: children.get(p.targetMapId)?.id ?? rootId,
                targetX: p.targetX, targetY: p.targetY,
            })),
        });
    }
    return space;
}

// Gives an existing space (made before portals existed, or rebuilt by the seed) the
// child spaces and portal rows its map defines. Existing children are replaced.
async function attachPortals(tx, spaceId, mapId) {
    const space = await tx.space.findUnique({ where: { id: spaceId }, select: { name: true, creatorId: true, visibility: true } });
    const map = await tx.map.findUnique({ where: { id: mapId }, include: { portals: true } });
    if (!space || !map) return 0;
    await tx.space.deleteMany({ where: { parentId: spaceId } });
    await tx.spacePortal.deleteMany({ where: { spaceId } });
    const children = new Map();
    for (const portal of map.portals) {
        if (portal.targetMapId === mapId || children.has(portal.targetMapId)) continue;
        const target = await tx.map.findUnique({ where: { id: portal.targetMapId }, select: { name: true } });
        const child = await createSpaceFromMap(tx, portal.targetMapId, {
            name: `${space.name} · ${target?.name ?? "inside"}`,
            creatorId: space.creatorId,
            visibility: space.visibility,
            parentId: spaceId,
            members: false,
        });
        children.set(portal.targetMapId, child);
    }
    if (map.portals.length) {
        await tx.spacePortal.createMany({
            data: map.portals.map((p) => ({
                spaceId,
                x: p.x, y: p.y, width: p.width, height: p.height,
                targetSpaceId: children.get(p.targetMapId)?.id ?? spaceId,
                targetX: p.targetX, targetY: p.targetY,
            })),
        });
    }
    return children.size;
}

module.exports = { createSpaceFromMap, attachPortals };
