import Redis from "ioredis";
import { outgoingMessage } from "./types";

/**
 * Cross-instance plumbing for rooms, used when REDIS_URL is set (several server instances, e.g.
 * Vercel Functions or more than one Render instance). Without it the server is a single process
 * and RoomManager keeps everything in memory.
 *
 *   presence   hash  space:{id}:users   userId -> Snapshot JSON (who is in the space, roughly where)
 *   liveness   key   inst:{instanceId}  refreshed every HEARTBEAT ms; a user whose instance key is
 *                                       gone is treated as having left (the instance died)
 *   fan-out    pub/sub channel space:{id}  every broadcast / direct message, as an Envelope
 */

export interface Snapshot {
    userId: string;
    username?: string;
    avatar: string | null;
    area: string;
    x: number;
    y: number;
    seat: { x: number; y: number } | null;
    instance: string;
}

export interface Envelope {
    from: string;        // instance id of the sender
    exclude?: string;    // userId not to deliver to (the author of a broadcast)
    to?: string;         // deliver only to this userId (rtc relay)
    message: outgoingMessage;
}

const HEARTBEAT = 20_000;
const INSTANCE_TTL = 60; // seconds; > 2 heartbeats so a slow instance isn't declared dead

export class RedisBus {
    readonly instanceId = Math.random().toString(36).slice(2, 10);
    private pub: Redis;
    private sub: Redis;
    private handlers = new Map<string, (env: Envelope) => void>();
    private heartbeat: ReturnType<typeof setInterval>;

    constructor(url: string, private onError: (err: unknown) => void = (err) => console.error("redis", err)) {
        // ioredis reconnects on its own; commands queue while it's down and fail after a while
        this.pub = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3, enableOfflineQueue: true });
        this.sub = new Redis(url, { maxRetriesPerRequest: 3 });
        this.pub.on("error", this.onError);
        this.sub.on("error", this.onError);
        this.sub.on("message", (channel: string, raw: string) => {
            const handler = this.handlers.get(channel);
            if (!handler) return;
            try {
                const env = JSON.parse(raw) as Envelope;
                if (env.from !== this.instanceId) handler(env);
            } catch (err) {
                this.onError(err);
            }
        });
        this.touch();
        this.heartbeat = setInterval(() => this.touch(), HEARTBEAT);
    }

    private touch() {
        this.pub.set(`inst:${this.instanceId}`, "1", "EX", INSTANCE_TTL).catch(this.onError);
    }

    // --- fan-out ---------------------------------------------------------------------------

    async subscribe(spaceId: string, handler: (env: Envelope) => void) {
        this.handlers.set(`space:${spaceId}`, handler);
        await this.sub.subscribe(`space:${spaceId}`);
    }

    async unsubscribe(spaceId: string) {
        this.handlers.delete(`space:${spaceId}`);
        await this.sub.unsubscribe(`space:${spaceId}`);
    }

    publish(spaceId: string, env: Omit<Envelope, "from">) {
        this.pub.publish(`space:${spaceId}`, JSON.stringify({ ...env, from: this.instanceId })).catch(this.onError);
    }

    // --- presence --------------------------------------------------------------------------

    setPresence(spaceId: string, snap: Snapshot) {
        this.pub.hset(`space:${spaceId}:users`, snap.userId, JSON.stringify(snap)).catch(this.onError);
    }

    removePresence(spaceId: string, userId: string) {
        this.pub.hdel(`space:${spaceId}:users`, userId).catch(this.onError);
    }

    // Everyone in the space according to Redis, minus entries whose instance has stopped heartbeating.
    async listPresence(spaceId: string): Promise<Snapshot[]> {
        const raw = await this.pub.hgetall(`space:${spaceId}:users`);
        const snaps: Snapshot[] = [];
        for (const v of Object.values(raw)) {
            try { snaps.push(JSON.parse(v)); } catch { /* ignore a corrupt entry */ }
        }
        const instances = [...new Set(snaps.map((s) => s.instance))].filter((i) => i !== this.instanceId);
        const alive = new Set<string>([this.instanceId]);
        if (instances.length) {
            const flags = await Promise.all(instances.map((i) => this.pub.exists(`inst:${i}`)));
            instances.forEach((i, k) => { if (flags[k]) alive.add(i); });
        }
        const dead = snaps.filter((s) => !alive.has(s.instance));
        if (dead.length) this.pub.hdel(`space:${spaceId}:users`, ...dead.map((s) => s.userId)).catch(this.onError);
        return snaps.filter((s) => alive.has(s.instance));
    }

    async close() {
        clearInterval(this.heartbeat);
        await this.pub.del(`inst:${this.instanceId}`).catch(() => undefined);
        this.pub.disconnect();
        this.sub.disconnect();
    }
}
