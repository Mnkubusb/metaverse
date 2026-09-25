import { outgoingMessage } from "./types";
import type { User } from "./User";
import { SpaceGrid } from "./SpaceGrid";

export class RoomManager {
    rooms: Map<string, User[]> = new Map();
    // Collision grids are cached while a room has players and dropped when it empties,
    // so edits to a space are picked up the next time someone joins it.
    private grids: Map<string, Promise<SpaceGrid | null>> = new Map();
    static instance: RoomManager;
    private constructor() {
        this.rooms = new Map();
    }

    static getInstance() {
        if (!this.instance) {
            this.instance = new RoomManager();
        }
        return this.instance;
    }

    public getGrid(spaceId: string): Promise<SpaceGrid | null> {
        let grid = this.grids.get(spaceId);
        if (!grid) {
            grid = SpaceGrid.load(spaceId).catch((err) => {
                console.error(`Failed to load space ${spaceId}`, err);
                this.grids.delete(spaceId);
                return null;
            });
            this.grids.set(spaceId, grid);
        }
        return grid;
    }

    public removeUser(user: User, spaceId: string) {
        if (!this.rooms.has(spaceId)) {
            return;
        }
        const remaining = this.rooms.get(spaceId)?.filter((u) => u.id !== user.id) ?? [];
        if (remaining.length === 0) {
            this.rooms.delete(spaceId);
            this.grids.delete(spaceId);
            return;
        }
        this.rooms.set(spaceId, remaining);
    }

    public addUser(spaceId: string, user: User) {
        this.rooms.set(spaceId, [...(this.rooms.get(spaceId) ?? []), user]);
    }

    public findUser(roomId: string, userId: string): User | undefined {
        return this.rooms.get(roomId)?.find((u) => u.userId === userId);
    }

    public broadcast(message: outgoingMessage, user: User, roomId: string) {
        this.rooms.get(roomId)?.forEach((u) => {
            if (u.id !== user.id) {
                u.send(message);
            }
        });
    }
}
