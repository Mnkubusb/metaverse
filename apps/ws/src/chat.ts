import client from "@repo/db/client";

export const MAX_CHAT_LENGTH = 500;
export const CHAT_HISTORY = 50;
// Token bucket: a burst of 5 messages, refilled at one every 2 seconds.
const BURST = 5;
const REFILL_MS = 2000;

export interface ChatPayload {
    id: string;
    userId: string | null;
    username: string;
    text: string;
    createdAt: string;
}

// Trim, drop control characters (keeps normal text and emoji), reject empty or over-long messages.
export function cleanChatText(raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    const text = raw.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
    if (!text || text.length > MAX_CHAT_LENGTH) return null;
    return text;
}

export class ChatRateLimiter {
    private tokens = BURST;
    private last = Date.now();

    take(): boolean {
        const now = Date.now();
        this.tokens = Math.min(BURST, this.tokens + (now - this.last) / REFILL_MS);
        this.last = now;
        if (this.tokens < 1) return false;
        this.tokens -= 1;
        return true;
    }
}

export async function saveChatMessage(spaceId: string, authorId: string, username: string, text: string): Promise<ChatPayload> {
    const msg = await client.chatMessage.create({ data: { spaceId, authorId, body: text } });
    return { id: msg.id, userId: authorId, username, text, createdAt: msg.createdAt.toISOString() };
}

export async function recentChat(spaceId: string): Promise<ChatPayload[]> {
    const rows = await client.chatMessage.findMany({
        where: { spaceId },
        orderBy: { createdAt: "desc" },
        take: CHAT_HISTORY,
        include: { author: { select: { username: true } } },
    });
    return rows.reverse().map((m) => ({
        id: m.id,
        userId: m.authorId,
        username: m.author?.username ?? "Deleted user",
        text: m.body,
        createdAt: m.createdAt.toISOString(),
    }));
}
