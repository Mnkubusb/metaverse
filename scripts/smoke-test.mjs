// End-to-end smoke test against running API + WebSocket servers and a seeded database.
// Usage: API_URL=http://localhost:3000/api/v1 WS_URL=ws://localhost:3001 node scripts/smoke-test.mjs
import assert from "node:assert/strict";

const API = process.env.API_URL ?? "http://localhost:3000/api/v1";
const WS = process.env.WS_URL ?? "ws://localhost:3001";

async function call(method, path, body, token) {
    const res = await fetch(API + path, {
        method,
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json().catch(() => null) };
}

async function account(prefix) {
    const username = `${prefix}${Date.now() % 1e6}`;
    const signup = await call("POST", "/signup", { username, password: "password123", type: "admin" });
    assert.equal(signup.status, 200, "signup");
    const signin = await call("POST", "/signin", { username, password: "password123" });
    assert.equal(signin.status, 200, "signin");
    return { username, token: signin.body.token };
}

function connect(token, spaceId) {
    const ws = new WebSocket(WS);
    const inbox = [];
    ws.onmessage = (e) => inbox.push(JSON.parse(e.data));
    const next = (type, timeout = 5000) => new Promise((resolve, reject) => {
        const started = Date.now();
        const timer = setInterval(() => {
            const i = inbox.findIndex((m) => m.type === type);
            if (i >= 0) { clearInterval(timer); resolve(inbox.splice(i, 1)[0]); }
            else if (Date.now() - started > timeout) { clearInterval(timer); reject(new Error(`timed out waiting for ${type}`)); }
        }, 10);
    });
    const send = (type, payload) => ws.send(JSON.stringify({ type, payload }));
    return new Promise((resolve, reject) => {
        ws.onerror = reject;
        ws.onopen = () => { send("join", { spaceId, token }); resolve({ ws, next, send }); };
    });
}

const steps = [];
const step = async (name, fn) => { await fn(); steps.push(name); console.log(`ok - ${name}`); };

const a = await account("smokeA");
const b = await account("smokeB");
let spaceId;

await step("signup never grants admin", async () => {
    assert.equal(JSON.parse(Buffer.from(a.token.split(".")[1], "base64")).role, "User");
});
await step("protected endpoints reject anonymous callers", async () => {
    assert.equal((await call("GET", "/users")).status, 401);
    assert.equal((await call("GET", "/users", null, a.token)).status, 403);
});
await step("seeded campus map and avatars exist", async () => {
    const maps = await call("GET", "/maps");
    assert.ok(maps.body.maps.some((m) => m.id === "gec-bilaspur-campus"));
    const avatars = await call("GET", "/avatars");
    assert.ok(avatars.body.avatars.length >= 8);
});
await step("create a space from the campus map", async () => {
    const res = await call("POST", "/space", { name: "Smoke", dimensions: "76x54", mapId: "gec-bilaspur-campus" }, a.token);
    assert.equal(res.status, 200);
    spaceId = res.body.spaceId;
    const space = await call("GET", `/space/${spaceId}`, null, a.token);
    assert.ok(space.body.elements.length > 1000);
});

const pa = await connect(a.token, spaceId);
const joinedA = await pa.next("space-joined");
await step("join spawns at the main gate", async () => {
    assert.deepEqual(joinedA.payload.spawn, { x: 37, y: 48 });
});
await step("movement is validated", async () => {
    pa.send("move", { x: 36, y: 48 });
    assert.equal((await pa.next("movement-accepted")).payload.x, 36);
    pa.send("move", { x: 36, y: 40 });
    assert.equal((await pa.next("movement-rejected")).payload.y, 48);
});
const pb = await connect(b.token, spaceId);
await pb.next("space-joined");
await step("presence reaches other players", async () => {
    assert.equal((await pa.next("user-joined")).payload.username, b.username);
});
await step("chat is saved and broadcast", async () => {
    pb.send("chat", { text: "  hello   campus " });
    assert.equal((await pa.next("chat")).payload.text, "hello campus");
});
await step("emotes are relayed", async () => {
    pa.send("emote", { emote: "wave" });
    assert.equal((await pb.next("emote")).payload.emote, "wave");
});

await step("sitting needs an adjacent seat", async () => {
    pa.send("sit", { seat: { x: 10, y: 10 } }); // far away: ignored
    await assert.rejects(pb.next("pose", 600));
});
await step("notice boards: pin, read, and only author/owner can remove", async () => {
    const space = await call("GET", `/space/${spaceId}`, null, a.token);
    const board = space.body.elements.find((e) => e.element.id === "campus-notice-board");
    assert.ok(board, "campus map has notice boards");
    const url = `/space/${spaceId}/boards/${board.id}/notices`;
    assert.equal((await call("POST", url, { body: "   " }, b.token)).status, 400);
    const pinned = await call("POST", url, { body: "Study group at 5", color: "blue" }, b.token);
    assert.equal(pinned.status, 200);
    const list = await call("GET", url, null, a.token);
    const note = list.body.notices.find((n) => n.id === pinned.body.id);
    assert.equal(note.body, "Study group at 5");
    assert.equal(note.canDelete, true, "the space owner can remove any note");
    const notABoard = space.body.elements.find((e) => e.element.id === "campus-bench");
    assert.equal((await call("GET", `/space/${spaceId}/boards/${notABoard.id}/notices`, null, a.token)).status, 404);
    const c2 = await account("smokeD");
    assert.equal((await call("DELETE", `/space/${spaceId}/notices/${note.id}`, null, c2.token)).status, 403);
    assert.equal((await call("DELETE", `/space/${spaceId}/notices/${note.id}`, null, b.token)).status, 200);
});

pa.ws.close();
pb.ws.close();

// --- space permissions -------------------------------------------------------
const c = await account("smokeC");
let privateId, inviteCode;
await step("owner creates a private space", async () => {
    const res = await call("POST", "/space", { name: "Private", dimensions: "20x15", visibility: "Private" }, a.token);
    assert.equal(res.status, 200);
    privateId = res.body.spaceId;
    const space = await call("GET", `/space/${privateId}`, null, a.token);
    assert.equal(space.body.role, "Owner");
    assert.equal(space.body.visibility, "Private");
    inviteCode = space.body.inviteCode;
    assert.ok(inviteCode);
});
await step("outsiders can't see or join a private space", async () => {
    assert.equal((await call("GET", `/space/${privateId}`, null, b.token)).status, 403);
    assert.equal((await call("POST", `/space/${privateId}/join`, {}, b.token)).status, 403);
    assert.equal((await call("POST", `/space/${privateId}/join`, { inviteCode: "wrong" }, b.token)).status, 403);
    const outsider = await connect(b.token, privateId);
    assert.equal((await outsider.next("join-rejected")).payload.reason, "private");
});
await step("the invite link lets a player in", async () => {
    const join = await call("POST", `/space/${privateId}/join`, { inviteCode }, b.token);
    assert.equal(join.status, 200);
    assert.equal(join.body.role, "Member");
    const space = await call("GET", `/space/${privateId}`, null, b.token);
    assert.equal(space.status, 200);
    assert.equal(space.body.inviteCode, null, "members don't get the invite code");
    const member = await connect(b.token, privateId);
    await member.next("space-joined");
    member.ws.close();
});
await step("only the owner can change settings", async () => {
    assert.equal((await call("PATCH", `/space/${privateId}`, { visibility: "Public" }, b.token)).status, 403);
    assert.equal((await call("POST", `/space/${privateId}/invite/reset`, {}, b.token)).status, 403);
});
await step("resetting the invite link revokes the old one", async () => {
    const reset = await call("POST", `/space/${privateId}/invite/reset`, {}, a.token);
    assert.equal(reset.status, 200);
    assert.notEqual(reset.body.inviteCode, inviteCode);
    assert.equal((await call("POST", `/space/${privateId}/join`, { inviteCode }, c.token)).status, 403);
    assert.equal((await call("GET", `/space/${privateId}`, null, b.token)).status, 200, "existing members keep access");
});
await step("members list and removal", async () => {
    const members = await call("GET", `/space/${privateId}/members`, null, b.token);
    assert.deepEqual(members.body.members.map((m) => m.role).sort(), ["Member", "Owner"]);
    assert.equal((await call("DELETE", `/space/${privateId}/members/${members.body.members.find((m) => m.role === "Member").userId}`, null, a.token)).status, 200);
    assert.equal((await call("GET", `/space/${privateId}`, null, b.token)).status, 403);
});
await step("public spaces show up on Explore, joined spaces on the dashboard", async () => {
    assert.equal((await call("PATCH", `/space/${privateId}`, { visibility: "Public", name: "Open Lab" }, a.token)).status, 200);
    const explore = await call("GET", "/space/explore", null, c.token);
    assert.ok(explore.body.spaces.some((s) => s.id === privateId && s.name === "Open Lab"));
    assert.equal((await call("POST", `/space/${privateId}/join`, {}, c.token)).status, 200);
    const joined = await call("GET", "/space/joined", null, c.token);
    assert.ok(joined.body.spaces.some((s) => s.id === privateId));
});
console.log(`\n${steps.length} checks passed`);
