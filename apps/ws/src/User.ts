import WebSocket from "ws";
import { RoomManager } from "./RoomManager";
import { outgoingMessage } from "./types";
import client from "@repo/db/client";
import jwt, { JwtPayload } from "jsonwebtoken"
import { JWT_SECRET } from "./config";

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
    private spaceId?: string
    private x: number
    private y: number
    private ws: WebSocket
    constructor(ws: WebSocket) {
        this.ws = ws;
        this.id = getRandomId(10);
        this.x = 0;
        this.y = 0;
        this.initHandlers();
    }

    initHandlers() {
        this.ws.on("message", async (data) => {
            const parsedData = JSON.parse(data.toString());
            console.log(parsedData)
            switch (parsedData.type) {
                case "join":
                    const spaceId = parsedData.payload.spaceId;
                    const token = parsedData.payload.token;
                    const userId = (jwt.verify(token, JWT_SECRET) as JwtPayload).userId
                    if (!userId) {
                        this.ws.close()
                        return
                    }
                    this.userId = userId;
                    const space = await client.space.findFirst({
                        where: {
                            id: spaceId
                        }
                    })
                    if (!space) {
                        this.ws.close()
                        return
                    }
                    this.spaceId = spaceId;
                    RoomManager.getInstance().addUser(spaceId, this);
                    this.send({
                        type: "space-joined",
                        payload: {
                            spawn: {
                                x: this.x,
                                y: this.y
                            },
                            users: RoomManager.getInstance().rooms.get(spaceId)?.filter((u) => u.id !== this.id).map(() => ({ userId: this.userId })) ?? []
                        }
                    })
                    RoomManager.getInstance().broadcast({
                        type: "user-joined",
                        payload: {
                            x: this.x,
                            y: this.y,
                            userId: this.userId
                        }
                    }, this, spaceId)
                    break;
                case "move":
                    const { x, y } = parsedData.payload;
                    const xDistance = Math.abs(this.x - x);
                    const yDistance = Math.abs(this.y - y);
                    if ((xDistance == 1 && yDistance == 0) || (xDistance == 0 && yDistance == 1)) {
                        this.x = x;
                        this.y = y;
                        this.send({
                            type: "movement-accepted",
                            payload: {
                                x: this.x,
                                y: this.y,
                                userId: this.userId
                            }
                        })
                        RoomManager.getInstance().broadcast({
                            type: "move",
                            payload: {
                                x: this.x,
                                y: this.y,
                                userId: this.userId,
                            }
                        }, this, this.spaceId!)
                        return;
                    }
                    this.send({
                        type: "movement-rejected",
                        payload: {
                            x: this.x,
                            y: this.y,
                            userId: this.userId
                        }
                    })
                    break;
            }
        })
    }

    destroy() {
        RoomManager.getInstance().broadcast({
            type: "user-left",
            payload: {
                userId: this.userId
            }
        }, this, this.spaceId!);
        RoomManager.getInstance().removeUser(this, this.spaceId!);
    }

    send(payload: outgoingMessage) {
        this.ws.send(JSON.stringify(payload));
    }
}