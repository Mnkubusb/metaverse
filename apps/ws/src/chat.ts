import client from "@repo/db/client";

export const MAX_CHAT_LENGTH = 500;
export const CHAT_HISTORY = 50;

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

// Token bucket: allows a burst of `burst` actions, refilled at one every `refillMs`.
export class RateLimiter {
    private tokens: number;
    private last = Date.now();

    constructor(private readonly burst: number, private readonly refillMs: number) {
        this.tokens = burst;
    }

    take(): boolean {
        const now = Date.now();
        this.tokens = Math.min(this.burst, this.tokens + (now - this.last) / this.refillMs);
        this.last = now;
        if (this.tokens < 1) return false;
        this.tokens -= 1;
        return true;
    }
}

// Chat: a burst of 5 messages, then one every 2 seconds.
export const chatRateLimiter = () => new RateLimiter(5, 2000);

// Emotes are shown for a few seconds, so a burst of 3 then one per second is plenty.
export const EMOTES = ["wave", "laugh", "heart", "thumbs-up", "party", "think"] as const;
export const emoteRateLimiter = () => new RateLimiter(3, 1000);

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
