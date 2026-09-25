import WebSocket from "ws";
import { RoomManager } from "./RoomManager";
import { outgoingMessage } from "./types";
import client from "@repo/db/client";
import jwt, { JwtPayload } from "jsonwebtoken"
import { JWT_SECRET } from "./config";
import type { SpaceGrid } from "./SpaceGrid";
import { EMOTES, chatRateLimiter, cleanChatText, emoteRateLimiter, recentChat, saveChatMessage } from "./chat";

const HEARTBEAT_INTERVAL = 30_000; // 30 seconds
const HEARTBEAT_TIMEOUT = 10_000;  // 10 seconds to pong
// One tile per step; the client animates each step over ~140ms, so this only stops floods.
const MIN_MOVE_INTERVAL = 60;

function getRandomId(length: number) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

export class User {
    public id: string;
    public userId?: string;
    public username?: string;
    public x: number;
    public y: number;
    private spaceId?: string;
    private grid?: SpaceGrid;
    private lastMoveAt = 0;
    private chatLimiter = chatRateLimiter();
    private emoteLimiter = emoteRateLimiter();
    private ws: WebSocket;
    private heartbeatInterval?: ReturnType<typeof setInterval>;
    private heartbeatTimeout?: ReturnType<typeof setTimeout>;
    private isAlive: boolean = true;

    constructor(ws: WebSocket) {
        this.ws = ws;
        this.id = getRandomId(10);
        this.x = 0;
        this.y = 0;
        this.startHeartbeat();
        this.initHandlers();
    }

    private startHeartbeat() {
        this.ws.on("pong", () => {
            this.isAlive = true;
            if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
        });

        this.heartbeatInterval = setInterval(() => {
            if (!this.isAlive) {
                this.ws.terminate();
                return;
            }
            this.isAlive = false;
            this.ws.ping();
            this.heartbeatTimeout = setTimeout(() => {
                if (!this.isAlive) this.ws.terminate();
            }, HEARTBEAT_TIMEOUT);
        }, HEARTBEAT_INTERVAL);
    }

    private stopHeartbeat() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
    }

    initHandlers() {
        this.ws.on("message", async (data) => {
            let parsedData: any;
            try {
                parsedData = JSON.parse(data.toString());
            } catch {
                return;
            }

            switch (parsedData.type) {
                case "join": {
                    if (this.spaceId) return; // one space per connection
                    const spaceId = parsedData.payload?.spaceId;
                    const token = parsedData.payload?.token;
                    let userId: string | undefined;
                    try {
                        userId = (jwt.verify(String(token), JWT_SECRET, { algorithms: ["HS256"] }) as JwtPayload).userId;
                    } catch {
                        this.ws.close();
                        return;
                    }
                    if (!userId || typeof spaceId !== "string") {
                        this.ws.close();
                        return;
                    }
                    const rooms = RoomManager.getInstance();
                    const [grid, dbUser, chat] = await Promise.all([
                        rooms.getGrid(spaceId),
                        client.user.findUnique({ where: { id: userId }, select: { username: true } }),
                        recentChat(spaceId).catch(() => []),
                    ]);
                    if (!grid || !dbUser) {
                        this.ws.close();
                        return;
                    }
                    this.userId = userId;
                    this.username = dbUser.username;
                    this.spaceId = spaceId;
                    this.grid = grid;
                    const spawn = grid.spawnPoint();
                    this.x = spawn.x;
                    this.y = spawn.y;
                    rooms.addUser(spaceId, this);
                    this.send({
                        type: "space-joined",
                        payload: {
                            userId: this.userId,
                            spawn: { x: this.x, y: this.y },
                            chat,
                            users: rooms.rooms.get(spaceId)
                                ?.filter((u) => u.id !== this.id)
                                .map((u) => ({ userId: u.userId, username: u.username, x: u.x, y: u.y })) ?? []
                        }
                    });
                    rooms.broadcast({
                        type: "user-joined",
                        payload: { x: this.x, y: this.y, userId: this.userId, username: this.username }
                    }, this, spaceId);
                    break;
                }
                case "chat": {
                    if (!this.spaceId || !this.userId || !this.username) return;
                    const text = cleanChatText(parsedData.payload?.text);
                    if (!text) {
                        this.send({ type: "chat-rejected", payload: { reason: "invalid" } });
                        return;
                    }
                    if (!this.chatLimiter.take()) {
                        this.send({ type: "chat-rejected", payload: { reason: "rate-limited" } });
                        return;
                    }
                    try {
                        const message = await saveChatMessage(this.spaceId, this.userId, this.username, text);
                        // everyone in the room, sender included, so the sender sees the stored message
                        this.send({ type: "chat", payload: message });
                        RoomManager.getInstance().broadcast({ type: "chat", payload: message }, this, this.spaceId);
                    } catch (err) {
                        console.error("Failed to save chat message", err);
                        this.send({ type: "chat-rejected", payload: { reason: "error" } });
                    }
                    break;
                }
                case "emote": {
                    if (!this.spaceId || !this.userId) return;
                    const emote = parsedData.payload?.emote;
                    if (!EMOTES.includes(emote) || !this.emoteLimiter.take()) return;
                    RoomManager.getInstance().broadcast({
                        type: "emote",
                        payload: { userId: this.userId, emote }
                    }, this, this.spaceId);
                    break;
                }
                case "move": {
                    if (!this.spaceId || !this.grid) return;
                    const x = Number(parsedData.payload?.x);
                    const y = Number(parsedData.payload?.y);
                    const now = Date.now();
                    const step = Math.abs(this.x - x) + Math.abs(this.y - y);
                    if (step === 1 && now - this.lastMoveAt >= MIN_MOVE_INTERVAL && this.grid.isWalkable(x, y)) {
                        this.lastMoveAt = now;
                        this.x = x;
                        this.y = y;
                        this.send({
                            type: "movement-accepted",
                            payload: { x: this.x, y: this.y, userId: this.userId }
                        });
                        RoomManager.getInstance().broadcast({
                            type: "move",
                            payload: { x: this.x, y: this.y, userId: this.userId }
                        }, this, this.spaceId);
                        return;
                    }
                    this.send({
                        type: "movement-rejected",
                        payload: { x: this.x, y: this.y, userId: this.userId }
                    });
                    break;
                }
            }
        });
    }

    destroy() {
        this.stopHeartbeat();
        if (!this.spaceId) return;
        RoomManager.getInstance().broadcast({
            type: "user-left",
            payload: { userId: this.userId }
        }, this, this.spaceId!);
        RoomManager.getInstance().removeUser(this, this.spaceId!);
    }

    send(payload: outgoingMessage) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(payload));
        }
    }
}
