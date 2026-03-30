import WebSocket from "ws";
import { RoomManager } from "./RoomManager";
import { outgoingMessage } from "./types";
import client from "@repo/db/client";
import jwt, { JwtPayload } from "jsonwebtoken"
import { JWT_SECRET } from "./config";

const HEARTBEAT_INTERVAL = 30_000; // 30 seconds
const HEARTBEAT_TIMEOUT = 10_000;  // 10 seconds to pong

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
    public x: number;
    public y: number;
    private spaceId?: string;
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
                    const spaceId = parsedData.payload.spaceId;
                    const token = parsedData.payload.token;
                    let userId: string;
                    try {
                        userId = (jwt.verify(token, JWT_SECRET) as JwtPayload).userId;
                    } catch {
                        this.ws.close();
                        return;
                    }
                    if (!userId) {
                        this.ws.close();
                        return;
                    }
                    this.userId = userId;
                    const space = await client.space.findFirst({ where: { id: spaceId } });
                    if (!space) {
                        this.ws.close();
                        return;
                    }
                    this.spaceId = spaceId;
                    RoomManager.getInstance().addUser(spaceId, this);
                    // Fix: each user maps to their own userId/x/y, not the joining user's data
                    this.send({
                        type: "space-joined",
                        payload: {
                            spawn: { x: this.x, y: this.y },
                            users: RoomManager.getInstance().rooms.get(spaceId)
                                ?.filter((u) => u.id !== this.id)
                                .map((u) => ({ userId: u.userId, x: u.x, y: u.y })) ?? []
                        }
                    });
                    RoomManager.getInstance().broadcast({
                        type: "user-joined",
                        payload: { x: this.x, y: this.y, userId: this.userId }
                    }, this, spaceId);
                    break;
                }
                case "move": {
                    const { x, y } = parsedData.payload;
                    const xDistance = Math.abs(this.x - x);
                    const yDistance = Math.abs(this.y - y);
                    if ((xDistance === 1 && yDistance === 0) || (xDistance === 0 && yDistance === 1)) {
                        this.x = x;
                        this.y = y;
                        this.send({
                            type: "movement-accepted",
                            payload: { x: this.x, y: this.y, userId: this.userId }
                        });
                        RoomManager.getInstance().broadcast({
                            type: "move",
                            payload: { x: this.x, y: this.y, userId: this.userId }
                        }, this, this.spaceId!);
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
