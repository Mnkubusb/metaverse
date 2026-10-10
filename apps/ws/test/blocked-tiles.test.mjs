// Plain-node test for the pure helpers in src/SpaceMap.ts.
// No test framework in this repo: node:assert + a tiny esbuild step that
// bundles the TypeScript module into a temp .mjs we can import.
//
// Run with:  node apps/ws/test/blocked-tiles.test.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, "..", "src", "SpaceMap.ts");
const outDir = mkdtempSync(path.join(tmpdir(), "spacemap-test-"));
const out = path.join(outDir, "SpaceMap.mjs");

execFileSync(
    path.join(here, "..", "node_modules", ".bin", "esbuild"),
    [
        src,
        "--bundle",
        "--format=esm",
        "--platform=node",
        `--outfile=${out}`,
        "--external:@repo/db",
        "--external:@repo/db/*"
    ],
    { stdio: ["ignore", "ignore", "inherit"] }
);

const { buildBlockedTiles, isSeatTile } = await import(pathToFileURL(out).href);

const el = (x, y, width, height, isStatic, imageUrl = "/Office/thing.png") => ({
    x,
    y,
    element: { width, height, static: isStatic, imageUrl }
});

let passed = 0;
function check(name, fn) {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
}

console.log("buildBlockedTiles");

check("a 1x1 static wall blocks its tile", () => {
    const blocked = buildBlockedTiles([el(3, 4, 1, 1, true, "/Office/wall.png")]);
    assert.equal(blocked.has("3,4"), true);
    assert.equal(blocked.size, 1);
});

check("a 1x1 non-static door does not block its tile", () => {
    const blocked = buildBlockedTiles([el(5, 6, 1, 1, false, "/Office/door.png")]);
    assert.equal(blocked.has("5,6"), false);
    assert.equal(blocked.size, 0);
});

check("a 2x1 static desk blocks both of its tiles", () => {
    const blocked = buildBlockedTiles([el(10, 2, 2, 1, true, "/Office/desk.png")]);
    assert.deepEqual([...blocked].sort(), ["10,2", "11,2"]);
});

check("a 3x2 static conference table blocks all six tiles", () => {
    const blocked = buildBlockedTiles([el(1, 1, 3, 2, true, "/Office/conference-table.png")]);
    assert.deepEqual(
        [...blocked].sort(),
        ["1,1", "1,2", "2,1", "2,2", "3,1", "3,2"]
    );
    assert.equal(blocked.size, 6);
});

check("mixed elements: only static footprints land in the set", () => {
    const blocked = buildBlockedTiles([
        el(0, 0, 1, 1, true, "/Office/wall.png"),
        el(0, 1, 1, 1, false, "/Office/floor.png"),
        el(2, 0, 2, 2, true, "/Office/plant.png")
    ]);
    assert.deepEqual([...blocked].sort(), ["0,0", "2,0", "2,1", "3,0", "3,1"]);
});

check("an empty element list blocks nothing", () => {
    assert.equal(buildBlockedTiles([]).size, 0);
});

console.log("isSeatTile");

const seatElements = [
    el(4, 4, 1, 1, false, "/Office/chair.png"),
    el(8, 8, 2, 1, false, "/Office/couch.png"),
    el(0, 0, 1, 1, false, "/Office/floor.png"),
    el(6, 1, 1, 1, true, "/Office/wall.png")
];

check("true on a chair tile", () => {
    assert.equal(isSeatTile(seatElements, 4, 4), true);
});

check("false on a plain floor tile", () => {
    assert.equal(isSeatTile(seatElements, 0, 0), false);
});

check("false on a tile with no element at all", () => {
    assert.equal(isSeatTile(seatElements, 20, 20), false);
});

check("footprint-aware: both tiles of a 2x1 couch are seats", () => {
    assert.equal(isSeatTile(seatElements, 8, 8), true);
    assert.equal(isSeatTile(seatElements, 9, 8), true);
    assert.equal(isSeatTile(seatElements, 10, 8), false);
});

check("a stool tile is a seat", () => {
    assert.equal(isSeatTile([el(2, 2, 1, 1, false, "/Office/stool.png")], 2, 2), true);
});

rmSync(outDir, { recursive: true, force: true });
console.log(`\n${passed}/${passed} assertions passed`);
