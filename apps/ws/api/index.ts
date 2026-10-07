// Vercel entry: the same WebSocket server as src/index.ts, served by a Vercel Function.
// Every request is rewritten here (see vercel.json). Needs REDIS_URL: each function instance
// holds its own connections, and Redis is what makes them one room (see src/bus.ts).
import { experimental_upgradeWebSocket } from "@vercel/functions";
import { RoomManager } from "../src/RoomManager";
import { User } from "../src/User";

const MAX_PAYLOAD = 16 * 1024;

export async function GET(req: Request) {
    const upgrade = req.headers.get("upgrade")?.toLowerCase() === "websocket";
    if (!upgrade) {
        const rooms = RoomManager.getInstance();
        if (!rooms.clustered) {
            return new Response("REDIS_URL is not set: players on different function instances would not see each other", { status: 503 });
        }
        return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
    }
    return experimental_upgradeWebSocket((ws) => {
        const user = new User(ws);
        ws.on("error", console.error);
        ws.on("close", () => user.destroy());
    }, { maxPayload: MAX_PAYLOAD });
}
