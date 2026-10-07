import { outgoingMessage } from "./types";
import type { User } from "./User";
import { SpaceGrid } from "./SpaceGrid";
import { RedisBus, type Envelope, type Snapshot } from "./bus";

// How often a moving player's position is written to Redis. Other instances follow the "move"
// messages anyway; the stored position only has to be fresh for an instance joining a space.
const PRESENCE_WRITE_MS = 2000;
// How often remote users are reconciled against Redis (catches instances that died silently).
const RECONCILE_MS = 30_000;

export interface RosterEntry {
    userId: string;
    username?: string;
    avatar: string | null;
    area: string;
    x: number;
    y: number;
    seat: { x: number; y: number } | null;
}

/**
 * The players in each space. With a single server instance everything lives in memory.
 * With REDIS_URL set, every instance also mirrors its players to Redis and relays messages
 * through it, so players connected to different instances share one room.
 */
export class RoomManager {
    rooms: Map<string, User[]> = new Map();
    // Collision grids are cached while a room has players and dropped when it empties,
    // so edits to a space are picked up the next time someone joins it.
    private grids: Map<string, Promise<SpaceGrid | null>> = new Map();
    // players on other instances, by space, kept up to date from the messages they send
    private remote: Map<string, Map<string, RosterEntry>> = new Map();
    private lastPresenceWrite = new Map<string, number>();
    private bus: RedisBus | null = null;
    private reconcileTimer?: ReturnType<typeof setInterval>;
    static instance: RoomManager;

    private constructor() {
        const url = process.env.REDIS_URL;
        if (url) {
            this.bus = new RedisBus(url);
            this.reconcileTimer = setInterval(() => this.reconcile(), RECONCILE_MS);
            console.log(`Rooms shared through Redis (instance ${this.bus.instanceId})`);
        }
    }

    static getInstance() {
        if (!this.instance) {
            this.instance = new RoomManager();
        }
        return this.instance;
    }

    get clustered() {
        return this.bus !== null;
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

    // --- membership ------------------------------------------------------------------------

    public async addUser(spaceId: string, user: User) {
        const first = !this.rooms.has(spaceId);
        this.rooms.set(spaceId, [...(this.rooms.get(spaceId) ?? []), user]);
        if (this.bus) {
            if (first) {
                this.remote.set(spaceId, new Map());
                await this.bus.subscribe(spaceId, (env) => this.deliver(spaceId, env));
                // learn who is already here on other instances
                for (const snap of await this.bus.listPresence(spaceId)) {
                    if (snap.instance !== this.bus.instanceId) this.remote.get(spaceId)?.set(snap.userId, snap);
                }
            }
            this.writePresence(spaceId, user, true);
        }
    }

    public removeUser(user: User, spaceId: string) {
        if (!this.rooms.has(spaceId)) return;
        if (this.bus && user.userId) this.bus.removePresence(spaceId, user.userId);
        this.lastPresenceWrite.delete(user.id);
        const remaining = this.rooms.get(spaceId)?.filter((u) => u.id !== user.id) ?? [];
        if (remaining.length === 0) {
            this.rooms.delete(spaceId);
            this.grids.delete(spaceId);
            this.remote.delete(spaceId);
            this.bus?.unsubscribe(spaceId).catch(() => undefined);
            return;
        }
        this.rooms.set(spaceId, remaining);
    }

    // Everyone else in the space: players on this instance plus those on other instances.
    public roster(spaceId: string, except: User): RosterEntry[] {
        const local = (this.rooms.get(spaceId) ?? [])
            .filter((u) => u.id !== except.id && u.userId)
            .map((u) => ({ userId: u.userId!, username: u.username, avatar: u.avatar, area: u.area, x: u.x, y: u.y, seat: u.seat }));
        const seen = new Set(local.map((u) => u.userId));
        const others = [...(this.remote.get(spaceId)?.values() ?? [])].filter((u) => !seen.has(u.userId) && u.userId !== except.userId);
        return [...local, ...others];
    }

    // Call after a player's position, pose or avatar changed so late joiners on other instances see it.
    public updatePresence(spaceId: string, user: User, immediate = false) {
        if (this.bus) this.writePresence(spaceId, user, immediate);
    }

    private writePresence(spaceId: string, user: User, immediate: boolean) {
        if (!this.bus || !user.userId) return;
        const now = Date.now();
        if (!immediate && now - (this.lastPresenceWrite.get(user.id) ?? 0) < PRESENCE_WRITE_MS) return;
        this.lastPresenceWrite.set(user.id, now);
        const snap: Snapshot = {
            userId: user.userId, username: user.username, avatar: user.avatar,
            area: user.area, x: user.x, y: user.y, seat: user.seat, instance: this.bus.instanceId,
        };
        this.bus.setPresence(spaceId, snap);
    }

    // --- messaging -------------------------------------------------------------------------

    public broadcast(message: outgoingMessage, user: User, roomId: string) {
        this.rooms.get(roomId)?.forEach((u) => {
            if (u.id !== user.id) u.send(message);
        });
        this.bus?.publish(roomId, { exclude: user.userId, message });
    }

    // One player, wherever they are connected (used for WebRTC signalling).
    public sendTo(roomId: string, userId: string, message: outgoingMessage) {
        const local = this.rooms.get(roomId)?.find((u) => u.userId === userId);
        if (local) {
            local.send(message);
            return;
        }
        if (this.remote.get(roomId)?.has(userId)) this.bus?.publish(roomId, { to: userId, message });
    }

    // A message relayed from another instance: hand it to our players and keep the remote roster current.
    private deliver(spaceId: string, env: Envelope) {
        const users = this.rooms.get(spaceId);
        if (!users) return;
        this.track(spaceId, env.message);
        for (const u of users) {
            if (env.to !== undefined ? u.userId === env.to : u.userId !== env.exclude) u.send(env.message);
        }
    }

    private track(spaceId: string, message: outgoingMessage) {
        const remote = this.remote.get(spaceId);
        const p = message?.payload;
        if (!remote || !p?.userId) return;
        switch (message.type) {
            case "user-joined":
                remote.set(p.userId, { userId: p.userId, username: p.username, avatar: p.avatar ?? null, area: p.area, x: p.x, y: p.y, seat: null });
                break;
            case "move": {
                const r = remote.get(p.userId);
                if (r) { r.area = p.area; r.x = p.x; r.y = p.y; r.seat = null; }
                break;
            }
            case "pose": {
                const r = remote.get(p.userId);
                if (r) r.seat = p.seat ?? null;
                break;
            }
            case "avatar-changed": {
                const r = remote.get(p.userId);
                if (r) r.avatar = p.avatar ?? null;
                break;
            }
            case "user-left":
                remote.delete(p.userId);
                break;
        }
    }

    // Drop remote players whose instance stopped heartbeating, telling our players they left.
    private async reconcile() {
        if (!this.bus) return;
        for (const [spaceId, remote] of this.remote) {
            try {
                const live = new Set((await this.bus.listPresence(spaceId)).map((s) => s.userId));
                for (const userId of [...remote.keys()]) {
                    if (live.has(userId)) continue;
                    remote.delete(userId);
                    this.rooms.get(spaceId)?.forEach((u) => u.send({ type: "user-left", payload: { userId } }));
                }
            } catch (err) {
                console.error("presence reconcile failed", err);
            }
        }
    }

    public async shutdown() {
        if (this.reconcileTimer) clearInterval(this.reconcileTimer);
        for (const [spaceId, users] of this.rooms) {
            for (const u of users) if (u.userId) this.bus?.removePresence(spaceId, u.userId);
        }
        await this.bus?.close();
    }
}
