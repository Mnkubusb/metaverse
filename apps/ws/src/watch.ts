// Watch parties: a video playing on a screen element (cinema screen, projector, TV) that everyone
// in the space sees in sync. The server keeps the authoritative state per screen; clients render
// it with the YouTube player or a <video> element and seek to `position + (now - updatedAt)`.

export interface WatchState {
    screenId: string;
    url: string;
    // YouTube video id, or null for a direct video file
    youtubeId: string | null;
    playing: boolean;
    // seconds into the video at `updatedAt`
    position: number;
    updatedAt: number;
    by: string;
}

const YT = /^(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
const FILE = /^https:\/\/[^\s]+\.(?:mp4|webm|ogg|m4v)(?:\?[^\s]*)?$/i;

// A YouTube link or an https link to a video file; anything else is refused.
export function parseVideoUrl(raw: unknown): { url: string; youtubeId: string | null } | null {
    if (typeof raw !== "string") return null;
    const url = raw.trim();
    if (!url || url.length > 500) return null;
    const yt = url.match(YT);
    if (yt) return { url, youtubeId: yt[1]! };
    if (FILE.test(url)) return { url, youtubeId: null };
    return null;
}

export function currentPosition(s: WatchState, now = Date.now()): number {
    return s.playing ? s.position + (now - s.updatedAt) / 1000 : s.position;
}

export type WatchAction =
    | { action: "load"; url: unknown }
    | { action: "play" | "pause" | "seek"; position?: unknown }
    | { action: "stop" };

// Pure state transition; returns the next state (null = nothing playing) or undefined when invalid.
export function applyWatch(prev: WatchState | null, screenId: string, msg: WatchAction, by: string, now = Date.now()): WatchState | null | undefined {
    if (msg.action === "load") {
        const video = parseVideoUrl(msg.url);
        if (!video) return undefined;
        return { screenId, ...video, playing: true, position: 0, updatedAt: now, by };
    }
    if (msg.action === "stop") return null;
    if (!prev) return undefined;
    const pos = Number(msg.position);
    const position = Number.isFinite(pos) && pos >= 0 && pos < 24 * 3600 ? pos : currentPosition(prev, now);
    return { ...prev, playing: msg.action === "play" ? true : msg.action === "pause" ? false : prev.playing, position, updatedAt: now, by };
}
