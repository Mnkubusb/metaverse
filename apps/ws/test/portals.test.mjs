// Plain-node test for the pure portal helper in src/SpaceMap.ts.
// Run with:  node apps/ws/test/portals.test.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, "..", "src", "SpaceMap.ts");
const outDir = mkdtempSync(path.join(tmpdir(), "portals-test-"));
const out = path.join(outDir, "SpaceMap.mjs");

execFileSync(
    path.join(here, "..", "node_modules", ".bin", "esbuild"),
    [src, "--bundle", "--format=esm", "--platform=node", `--outfile=${out}`],
    { stdio: "inherit" },
);
const { portalAt } = await import(pathToFileURL(out).href);

const portals = [
    { id: "p1", x: 10, y: 20, width: 2, height: 2, targetSpaceId: "s2", targetX: 5, targetY: 5 },
    { id: "p2", x: 30, y: 40, width: 2, height: 1, targetSpaceId: "s3", targetX: 1, targetY: 1 },
];

let passed = 0;
function test(name, fn) { fn(); passed++; console.log("  ok ", name); }

console.log("portalAt");
test("inside a 2x2 footprint", () => assert.equal(portalAt(portals, 11, 21)?.id, "p1"));
test("top-left corner counts", () => assert.equal(portalAt(portals, 10, 20)?.id, "p1"));
test("just outside returns null", () => assert.equal(portalAt(portals, 12, 20), null));
test("second portal, 2x1", () => assert.equal(portalAt(portals, 31, 40)?.id, "p2"));
test("row below a 2x1 is outside", () => assert.equal(portalAt(portals, 31, 41), null));
test("empty list", () => assert.equal(portalAt([], 0, 0), null));

rmSync(outDir, { recursive: true, force: true });
console.log(`\n${passed}/6 assertions passed`);
