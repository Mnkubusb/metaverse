import { Router } from "express";
import crypto from "crypto";
import { AddElementSchema, CreateSpaceSchema, DeleteElementSchema, JoinSpaceSchema, UpdateSpaceSchema } from "../../types";
import { getAccess } from "../../access";
import client from "@repo/db/client";
import { userMiddleware } from "../../middleware/user";
export const spaceRouter = Router();


spaceRouter.post("/" ,userMiddleware, async (req, res) => {
    const parseData = CreateSpaceSchema.safeParse(req.body);
    if (!parseData.success) {
        res.status(400).json({
            message: "Invalid data",
            error: parseData.error.format()
        });
        return
    };

    const { name, dimensions, mapId, visibility } = parseData.data;
    const ownership = { visibility, members: { create: { userId: req.userId, role: "Owner" as const } } };

    if (!mapId) {
        const [width, height] = dimensions.split("x").map(Number);
        const space = await client.space.create({
            data: { name, width: width!, height: height!, creatorId: req.userId, ...ownership },
        });
        res.status(200).json({ spaceId: space.id, message: "Space created" });
        return;
    }

    const map = await client.map.findUnique({
        where: { id: mapId },
        select: { mapElements: true, width: true, height: true, thumbnail: true, spawnX: true, spawnY: true },
    });
    if (!map) {
        res.status(404).json({ message: "Map not found" });
        return;
    }

    const space = await client.$transaction(async (tx) => {
        const space = await tx.space.create({
            data: {
                name,
                width: map.width,
                height: map.height,
                thumbnail: map.thumbnail,
                spawnX: map.spawnX,
                spawnY: map.spawnY,
                creatorId: req.userId,
                ...ownership,
            },
        });
        await tx.spaceElements.createMany({
            data: map.mapElements.map((e) => ({
                spaceId: space.id,
                elementId: e.elementId,
                x: e.x,
                y: e.y,
            })),
        });
        return space;
    });

    res.status(200).json({ spaceId: space.id, message: "Space created" });
});

spaceRouter.delete("/element", userMiddleware, async (req, res) => {

    const parsedData = DeleteElementSchema.safeParse(req.body);
    if (!parsedData.success) {
        res.status(400).json({
            message: "Invalid data",
            error: parsedData.error.format()
        });
        return
    };

    const spaceElement = await client.spaceElements.findFirst({
        where: {
            id: parsedData.data.id,
        }, include: {
            space: true
        }
    })
    if(!spaceElement?.space.creatorId || spaceElement?.space.creatorId !== req.userId){
        res.status(403).json({
            message: "You are not the creator of this space"
        })
        return
    }
    
    await client.spaceElements.delete({
        where:{
            id: parsedData.data.id,
        }
    })

    res.status(200).json({
        message: "Element deleted from space"
    })

});

spaceRouter.delete("/:spaceId", userMiddleware, async (req, res) => {
    const spaceId = req.params.spaceId;
    const space = await client.space.findUnique({
        where:{
            id: spaceId
        },select :{
            creatorId: true,
        }
    })

    if(!space){
        res.status(400).json({
            message: "Space not found"
        })
        return
    }

    if(req.userId !== space?.creatorId){
        res.status(403).json({
            message: "You are not the creator of this space"
        })
        return
    }

    await client.space.delete({
        where:{
            id: spaceId
        }
    });

    res.status(200).json({
        message: "Space deleted"
    })
});


spaceRouter.get("/all",userMiddleware, async (req, res) => {

    const spaces = await client.space.findMany({
        where:{
            creatorId: req.userId
        }
    })

    res.status(200).json({
        spaces: spaces.map(space => ({
            id: space.id,
            name: space.name,
            dimensions: `${space.width}x${space.height}`,
            thumbnail: space.thumbnail,
            visibility: space.visibility,
        }))
    })

});

// Spaces the user has joined but doesn't own
spaceRouter.get("/joined", userMiddleware, async (req, res) => {
    const memberships = await client.spaceMember.findMany({
        where: { userId: req.userId, role: "Member" },
        orderBy: { joinedAt: "desc" },
        take: 50,
        include: { space: { include: { creator: { select: { username: true } } } } },
    });
    res.status(200).json({
        spaces: memberships.map(({ space }) => ({
            id: space.id,
            name: space.name,
            dimensions: `${space.width}x${space.height}`,
            thumbnail: space.thumbnail,
            visibility: space.visibility,
            owner: space.creator.username,
        })),
    });
});

// Public spaces, newest first
spaceRouter.get("/explore", userMiddleware, async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 24;
    const spaces = await client.space.findMany({
        where: { visibility: "Public" },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { creator: { select: { username: true } }, _count: { select: { members: true } } },
    });
    res.status(200).json({
        spaces: spaces.map((space) => ({
            id: space.id,
            name: space.name,
            dimensions: `${space.width}x${space.height}`,
            thumbnail: space.thumbnail,
            owner: space.creator.username,
            members: space._count.members,
        })),
        page,
        hasMore: spaces.length === limit,
    });
});


spaceRouter.post("/element", userMiddleware, async(req, res) => {
    const parsedData = AddElementSchema.safeParse(req.body);
    if (!parsedData.success) {
        res.status(400).json({
            message: "Invalid data",
            error: parsedData.error.format()
        });
        return
    };

    const space = await client.space.findUnique({
        where:{
            id: parsedData.data.spaceId,
            creatorId: req.userId
        },select : {
            width: true,
            height: true,
        }
    });

    if(!space){
        res.status(403).json({
            message: "Space not found"
        })
        return
    }

    if(parsedData.data.x >= space.width || parsedData.data.y >= space.height || parsedData.data.x < 0 || parsedData.data.y < 0){
        res.status(400).json({
            message: "Element out of bounds"
        })
        return
    }
    

   await client.spaceElements.create({
        data:{
            spaceId: parsedData.data.spaceId,
            elementId: parsedData.data.elementId,
            x: parsedData.data.x,
            y: parsedData.data.y,
        }
    })

    res.status(200).json({
        message: "Element added to space"
    })
});


// Records a visit: joins Unlisted/Public spaces as a member, or Private ones with the right invite code.
spaceRouter.post("/:spaceId/join", userMiddleware, async (req, res) => {
    const parsed = JoinSpaceSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
        res.status(400).json({ message: "Invalid data" });
        return;
    }
    const access = await getAccess(req.params.spaceId, req.userId);
    if (!access) {
        res.status(404).json({ message: "Space not found" });
        return;
    }
    if (access.role) {
        res.status(200).json({ role: access.role });
        return;
    }
    const code = parsed.data.inviteCode;
    const validInvite = !!code && code.length === access.space.inviteCode.length &&
        crypto.timingSafeEqual(Buffer.from(code), Buffer.from(access.space.inviteCode));
    if (access.space.visibility === "Private" && !validInvite) {
        res.status(403).json({ message: "This space is private", code: "private" });
        return;
    }
    await client.spaceMember.upsert({
        where: { spaceId_userId: { spaceId: access.space.id, userId: req.userId } },
        create: { spaceId: access.space.id, userId: req.userId, role: "Member" },
        update: {},
    });
    res.status(200).json({ role: "Member" });
});

spaceRouter.patch("/:spaceId", userMiddleware, async (req, res) => {
    const parsed = UpdateSpaceSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: "Invalid data", error: parsed.error.format() });
        return;
    }
    const access = await getAccess(req.params.spaceId, req.userId);
    if (!access) {
        res.status(404).json({ message: "Space not found" });
        return;
    }
    if (access.role !== "Owner") {
        res.status(403).json({ message: "Only the owner can change this space" });
        return;
    }
    const space = await client.space.update({ where: { id: access.space.id }, data: parsed.data });
    res.status(200).json({ name: space.name, visibility: space.visibility });
});

// New invite code; links with the old code stop working (existing members keep access)
spaceRouter.post("/:spaceId/invite/reset", userMiddleware, async (req, res) => {
    const access = await getAccess(req.params.spaceId, req.userId);
    if (!access) {
        res.status(404).json({ message: "Space not found" });
        return;
    }
    if (access.role !== "Owner") {
        res.status(403).json({ message: "Only the owner can reset the invite link" });
        return;
    }
    const space = await client.space.update({
        where: { id: access.space.id },
        data: { inviteCode: crypto.randomBytes(18).toString("base64url") },
    });
    res.status(200).json({ inviteCode: space.inviteCode });
});

spaceRouter.get("/:spaceId/members", userMiddleware, async (req, res) => {
    const access = await getAccess(req.params.spaceId, req.userId);
    if (!access || !access.role) {
        res.status(access ? 403 : 404).json({ message: access ? "Members only" : "Space not found" });
        return;
    }
    const members = await client.spaceMember.findMany({
        where: { spaceId: access.space.id },
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
        take: 500,
        include: { user: { select: { username: true, avatar: { select: { imageUrl: true } } } } },
    });
    res.status(200).json({
        members: members.map((m) => ({
            userId: m.userId,
            username: m.user.username,
            avatar: m.user.avatar?.imageUrl ?? null,
            role: m.role,
            joinedAt: m.joinedAt,
        })),
    });
});

spaceRouter.delete("/:spaceId/members/:userId", userMiddleware, async (req, res) => {
    const access = await getAccess(req.params.spaceId, req.userId);
    if (!access) {
        res.status(404).json({ message: "Space not found" });
        return;
    }
    if (access.role !== "Owner") {
        res.status(403).json({ message: "Only the owner can remove members" });
        return;
    }
    if (req.params.userId === req.userId) {
        res.status(400).json({ message: "The owner can't be removed" });
        return;
    }
    await client.spaceMember.delete({
        where: { spaceId_userId: { spaceId: access.space.id, userId: req.params.userId } },
    });
    res.status(200).json({ message: "Member removed" });
});

spaceRouter.get("/:spaceId",userMiddleware, async (req, res) => {
    const access = await getAccess(req.params.spaceId, req.userId);
    if (access && !access.canEnter) {
        res.status(403).json({ message: "This space is private", code: "private" });
        return;
    }
    const space = await client.space.findUnique({
        where:{
            id: req.params.spaceId,
        }, include: {
            elements: {
                include: {
                    element: true,
                }
            }
        }
    });
    if(!space){
        res.status(404).json({
            message: "Space not found"
        })
        return
    }

    const isOwner = access?.role === "Owner";
    res.status(200).json({
        name: space.name,
        visibility: space.visibility,
        role: access?.role ?? null,
        // only the owner can hand out invite links to a private space
        inviteCode: isOwner ? space.inviteCode : null,
        dimensions: `${space.width}x${space.height}`,
        spawn: space.spawnX !== null && space.spawnY !== null ? { x: space.spawnX, y: space.spawnY } : null,
        elements: space.elements.map(e => ({
            id: e.id,
            element: {
                id: e.element.id,
                imageUrl: e.element.imageUrl,
                width: e.element.width,
                height: e.element.height,
                static: e.element.static,
                layer: e.element.layer,
            },
            x: e.x,
            y: e.y,
        }))
    })
});