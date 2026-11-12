import { Router } from "express";
import client from "@repo/db/client";
import { userMiddleware } from "../../middleware/user";

// One-to-one messages. They are sent over the WebSocket (apps/ws "dm") so they arrive live;
// these routes load the inbox and the history of one conversation.
export const dmRouter = Router();
const PAGE = 50;

// Conversations, newest first: the other person, the last message and how many are unread.
dmRouter.get("/", userMiddleware, async (req, res) => {
    const me = req.userId!;
    const recent = await client.directMessage.findMany({
        where: { OR: [{ senderId: me }, { recipientId: me }] },
        orderBy: { createdAt: "desc" },
        take: 500,
        select: { senderId: true, recipientId: true, body: true, createdAt: true },
    });
    const threads = new Map<string, { userId: string; last: string; lastAt: string; fromMe: boolean }>();
    for (const m of recent) {
        const other = m.senderId === me ? m.recipientId : m.senderId;
        if (!threads.has(other)) {
            threads.set(other, { userId: other, last: m.body, lastAt: m.createdAt.toISOString(), fromMe: m.senderId === me });
        }
    }
    const ids = [...threads.keys()];
    const [users, unread] = await Promise.all([
        client.user.findMany({ where: { id: { in: ids } }, select: { id: true, username: true, avatar: { select: { imageUrl: true } } } }),
        client.directMessage.groupBy({ by: ["senderId"], where: { recipientId: me, readAt: null }, _count: { _all: true } }),
    ]);
    const byId = new Map(users.map((u) => [u.id, u]));
    const unreadBy = new Map(unread.map((u) => [u.senderId, u._count._all]));
    res.json({
        threads: ids.filter((id) => byId.has(id)).map((id) => ({
            ...threads.get(id)!,
            username: byId.get(id)!.username,
            avatar: byId.get(id)!.avatar?.imageUrl ?? null,
            unread: unreadBy.get(id) ?? 0,
        })),
    });
});

// History with one person (oldest first), PAGE at a time; `before` is an ISO date for older pages.
// Loading it marks their messages to you as read.
dmRouter.get("/:userId", userMiddleware, async (req, res) => {
    const me = req.userId!;
    const other = String(req.params.userId);
    const before = typeof req.query.before === "string" ? new Date(req.query.before) : null;
    const user = await client.user.findUnique({ where: { id: other }, select: { id: true, username: true, avatar: { select: { imageUrl: true } } } });
    if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
    }
    const rows = await client.directMessage.findMany({
        where: {
            OR: [{ senderId: me, recipientId: other }, { senderId: other, recipientId: me }],
            ...(before && !Number.isNaN(before.getTime()) ? { createdAt: { lt: before } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: PAGE,
    });
    await client.directMessage.updateMany({ where: { senderId: other, recipientId: me, readAt: null }, data: { readAt: new Date() } });
    res.json({
        user: { userId: user.id, username: user.username, avatar: user.avatar?.imageUrl ?? null },
        hasMore: rows.length === PAGE,
        messages: rows.reverse().map((m) => ({
            id: m.id, from: m.senderId, to: m.recipientId, text: m.body, createdAt: m.createdAt.toISOString(),
        })),
    });
});

// Mark everything from one person as read (the chat panel calls this when a live message arrives
// in the conversation that is open).
dmRouter.post("/:userId/read", userMiddleware, async (req, res) => {
    await client.directMessage.updateMany({
        where: { senderId: String(req.params.userId), recipientId: req.userId!, readAt: null },
        data: { readAt: new Date() },
    });
    res.json({ ok: true });
});
