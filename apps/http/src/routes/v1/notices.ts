import { Router } from "express";
import rateLimit from "express-rate-limit";
import client from "@repo/db/client";
import { userMiddleware } from "../../middleware/user";
import { getAccess } from "../../access";
import { NoticeSchema } from "../../types";

// Elements that open a notice board when a player presses E next to them.
// Keep in sync with apps/web/lib/interactions.ts.
export const BOARD_ELEMENT_IDS = ["campus-notice-board", "campus-sign-welcome", "campus-sign-hostels"];
const MAX_NOTES_PER_BOARD = 60;

export const noticeRouter = Router({ mergeParams: true });

// 10 notes a minute per client is plenty for pinning by hand
const postLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "You're pinning notes too fast. Wait a minute." },
});

async function findBoard(spaceId: string, boardId: string, userId: string) {
    const access = await getAccess(spaceId, userId);
    if (!access) return { ok: false as const, status: 404, message: "Space not found" };
    if (!access.canEnter) return { ok: false as const, status: 403, message: "This space is private" };
    const board = await client.spaceElements.findFirst({
        where: { id: boardId, spaceId, elementId: { in: BOARD_ELEMENT_IDS } },
        select: { id: true },
    });
    if (!board) return { ok: false as const, status: 404, message: "Notice board not found" };
    return { ok: true as const, access, board };
}

noticeRouter.get("/boards/:boardId/notices", userMiddleware, async (req, res) => {
    const { spaceId, boardId } = req.params as { spaceId: string; boardId: string };
    const found = await findBoard(spaceId, boardId, req.userId);
    if (!found.ok) {
        res.status(found.status).json({ message: found.message });
        return;
    }
    const isOwner = found.access.role === "Owner";
    const notices = await client.noticePost.findMany({
        where: { boardId },
        orderBy: { createdAt: "desc" },
        take: MAX_NOTES_PER_BOARD,
        include: { author: { select: { username: true } } },
    });
    res.status(200).json({
        notices: notices.map((n) => ({
            id: n.id,
            body: n.body,
            color: n.color,
            createdAt: n.createdAt,
            author: n.author?.username ?? "Deleted user",
            mine: n.authorId === req.userId,
            canDelete: isOwner || n.authorId === req.userId,
        })),
    });
});

noticeRouter.post("/boards/:boardId/notices", userMiddleware, postLimiter, async (req, res) => {
    const { spaceId, boardId } = req.params as { spaceId: string; boardId: string };
    const parsed = NoticeSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: "Notes are 1–280 characters", error: parsed.error.format() });
        return;
    }
    const found = await findBoard(spaceId, boardId, req.userId);
    if (!found.ok) {
        res.status(found.status).json({ message: found.message });
        return;
    }
    const count = await client.noticePost.count({ where: { boardId } });
    if (count >= MAX_NOTES_PER_BOARD) {
        res.status(409).json({ message: "This board is full. Remove an old note first." });
        return;
    }
    const notice = await client.noticePost.create({
        data: { spaceId, boardId, authorId: req.userId, body: parsed.data.body, color: parsed.data.color },
    });
    res.status(200).json({ id: notice.id });
});

noticeRouter.delete("/notices/:noticeId", userMiddleware, async (req, res) => {
    const { spaceId, noticeId } = req.params as { spaceId: string; noticeId: string };
    const notice = await client.noticePost.findFirst({ where: { id: noticeId, spaceId } });
    if (!notice) {
        res.status(404).json({ message: "Note not found" });
        return;
    }
    const access = await getAccess(spaceId, req.userId);
    if (notice.authorId !== req.userId && access?.role !== "Owner") {
        res.status(403).json({ message: "Only the note's author or the space owner can remove it" });
        return;
    }
    await client.noticePost.delete({ where: { id: noticeId } });
    res.status(200).json({ message: "Note removed" });
});
