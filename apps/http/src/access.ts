import client from "@repo/db/client";

export type Visibility = "Private" | "Unlisted" | "Public";
export type SpaceRole = "Owner" | "Member";

// Anyone may enter an Unlisted or Public space; a Private space needs a membership
// (granted by opening the owner's invite link). Keep in sync with apps/ws/src/User.ts.
export function canEnter(visibility: Visibility, role: SpaceRole | null) {
    return role !== null || visibility !== "Private";
}

// Building interiors are child spaces: membership, visibility and invite codes live on
// the root space, so access to a child is access to its root.
export async function getAccess(spaceId: string, userId: string) {
    const found = await client.space.findUnique({ where: { id: spaceId }, select: { id: true, parentId: true } });
    if (!found) return null;
    const space = await client.space.findUnique({
        where: { id: found.parentId ?? found.id },
        select: {
            id: true,
            visibility: true,
            inviteCode: true,
            creatorId: true,
            members: { where: { userId }, select: { role: true } },
        },
    });
    if (!space) return null;
    const role = (space.members[0]?.role ?? null) as SpaceRole | null;
    return { space, role, canEnter: canEnter(space.visibility as Visibility, role) };
}
