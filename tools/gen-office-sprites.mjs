// Generates the 32px-grid office tileset into apps/web/public/Office/.
// Zero dependencies: PNGs are encoded by hand with zlib.
//
//   node tools/gen-office-sprites.mjs
//
// Re-running overwrites every sprite, so tweak a palette entry or a draw
// function and regenerate rather than editing the PNGs.

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "apps", "web", "public", "Office");
const TILE = 32;

// ---------------------------------------------------------------- png writer

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha
  // 10-12 stay zero: deflate, adaptive filtering, no interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- canvas

// "#rrggbb" or "#rrggbbaa"
function parseColor(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
    h.length > 6 ? parseInt(h.slice(6, 8), 16) : 255,
  ];
}

class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 4); // transparent
  }

  // Alpha-blends src over whatever is already there, so translucent
  // highlights and shadows stack the way they read in pixel art.
  px(x, y, color) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const [r, g, b, a] = typeof color === "string" ? parseColor(color) : color;
    if (a === 0) return;
    const i = (y * this.w + x) * 4;
    if (a === 255) {
      this.data[i] = r;
      this.data[i + 1] = g;
      this.data[i + 2] = b;
      this.data[i + 3] = 255;
      return;
    }
    const sa = a / 255;
    const da = this.data[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    if (oa === 0) return;
    this.data[i] = Math.round((r * sa + this.data[i] * da * (1 - sa)) / oa);
    this.data[i + 1] = Math.round((g * sa + this.data[i + 1] * da * (1 - sa)) / oa);
    this.data[i + 2] = Math.round((b * sa + this.data[i + 2] * da * (1 - sa)) / oa);
    this.data[i + 3] = Math.round(oa * 255);
  }

  rect(x, y, w, h, color) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, color);
  }

  outline(x, y, w, h, color) {
    for (let i = 0; i < w; i++) {
      this.px(x + i, y, color);
      this.px(x + i, y + h - 1, color);
    }
    for (let j = 0; j < h; j++) {
      this.px(x, y + j, color);
      this.px(x + w - 1, y + j, color);
    }
  }

  hline(x, y, w, color) {
    this.rect(x, y, w, 1, color);
  }

  vline(x, y, h, color) {
    this.rect(x, y, 1, h, color);
  }

  // Rounded-ish blob used for foliage and cushions.
  ellipse(cx, cy, rx, ry, color) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.px(x, y, color);
      }
    }
  }
}

// Deterministic noise so regenerating produces byte-identical files.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ---------------------------------------------------------------- palette

const C = {
  carpet: "#5c6675",
  carpetDark: "#525b69",
  carpetLight: "#69738233",
  wood: "#a9763f",
  woodDark: "#8d5f31",
  woodSeam: "#7a5029",
  tile: "#d9d6cc",
  tileSeam: "#bab6aa",
  wall: "#e6e1d7",
  wallShade: "#cbc4b6",
  wallEdge: "#9c9384",
  wallTop: "#b6ad9c",
  deskTop: "#c08a52",
  deskEdge: "#8a5c30",
  deskLeg: "#6f4a26",
  metal: "#8e97a3",
  metalDark: "#5d6673",
  chair: "#3f4a5a",
  chairLight: "#55627660",
  screen: "#1b2532",
  screenGlow: "#2dd4bf",
  plantPot: "#a9603a",
  plantPotDark: "#8a4c2d",
  leaf: "#2f8f4e",
  leafLight: "#43b167",
  couch: "#41648f",
  couchLight: "#5b81ad",
  couchDark: "#2f4a6b",
  board: "#f6f5f1",
  boardFrame: "#8e97a3",
  accent: "#2dd4bf",
  ink: "#e05252",
  shadow: "#00000030",
  shadowSoft: "#00000018",
  glow: "#ffe9a840",
  book: ["#c0504d", "#4f81bd", "#9bbb59", "#e0a33e", "#8064a2"],
};

// ---------------------------------------------------------------- sprites
// Each entry returns a Canvas. Sizes are whole tiles so the element rows in
// the seed can use width/height directly.

const sprites = {};

// --- floors -----------------------------------------------------------

sprites["floor-carpet"] = () => {
  const c = new Canvas(TILE, TILE);
  c.rect(0, 0, TILE, TILE, C.carpet);
  const rand = rng(11);
  for (let i = 0; i < 90; i++) {
    c.px(Math.floor(rand() * TILE), Math.floor(rand() * TILE), rand() > 0.5 ? C.carpetDark : C.carpetLight);
  }
  return c;
};

sprites["floor-wood"] = () => {
  const c = new Canvas(TILE, TILE);
  c.rect(0, 0, TILE, TILE, C.wood);
  const rand = rng(23);
  // Two plank rows per tile, offset so a run of tiles reads as a floor.
  for (const y of [0, 16]) {
    c.rect(0, y, TILE, 15, rand() > 0.5 ? C.wood : C.woodDark);
    c.hline(0, y + 15, TILE, C.woodSeam);
  }
  c.vline(10, 0, 16, C.woodSeam);
  c.vline(22, 16, 16, C.woodSeam);
  for (let i = 0; i < 40; i++) {
    c.px(Math.floor(rand() * TILE), Math.floor(rand() * TILE), C.woodSeam + "");
  }
  return c;
};

sprites["floor-tile"] = () => {
  const c = new Canvas(TILE, TILE);
  c.rect(0, 0, TILE, TILE, C.tile);
  c.hline(0, 0, TILE, C.tileSeam);
  c.vline(0, 0, TILE, C.tileSeam);
  c.hline(0, 16, TILE, C.tileSeam);
  c.vline(16, 0, TILE, C.tileSeam);
  return c;
};

// --- walls ------------------------------------------------------------

// Horizontal wall: face plus a darker cap, so north/south runs read as walls
// seen slightly from above.
sprites["wall-h"] = () => {
  const c = new Canvas(TILE, TILE);
  c.rect(0, 0, TILE, TILE, C.wall);
  c.rect(0, 0, TILE, 8, C.wallTop);
  c.hline(0, 8, TILE, C.wallEdge);
  c.hline(0, TILE - 1, TILE, C.wallShade);
  return c;
};

sprites["wall-v"] = () => {
  const c = new Canvas(TILE, TILE);
  c.rect(0, 0, TILE, TILE, C.wall);
  c.rect(0, 0, 8, TILE, C.wallTop);
  c.vline(8, 0, TILE, C.wallEdge);
  c.vline(TILE - 1, 0, TILE, C.wallShade);
  return c;
};

sprites["wall-corner"] = () => {
  const c = new Canvas(TILE, TILE);
  c.rect(0, 0, TILE, TILE, C.wall);
  c.rect(0, 0, TILE, 8, C.wallTop);
  c.rect(0, 0, 8, TILE, C.wallTop);
  c.hline(8, 8, TILE - 8, C.wallEdge);
  c.vline(8, 8, TILE - 8, C.wallEdge);
  return c;
};

sprites["door"] = () => {
  const c = new Canvas(TILE, TILE);
  c.rect(0, 0, TILE, TILE, C.wall);
  c.rect(4, 2, 24, 28, C.woodDark);
  c.rect(6, 4, 20, 24, C.wood);
  c.outline(6, 4, 20, 24, C.woodSeam);
  c.rect(21, 15, 3, 3, C.metal); // handle
  return c;
};

// --- objects ----------------------------------------------------------

sprites["desk"] = () => {
  const c = new Canvas(TILE * 2, TILE);
  c.rect(2, 4, 60, 24, C.deskEdge);
  c.rect(3, 5, 58, 20, C.deskTop);
  c.hline(3, 25, 58, C.deskEdge);
  c.rect(4, 27, 4, 4, C.deskLeg);
  c.rect(56, 27, 4, 4, C.deskLeg);
  c.rect(2, 28, 60, 2, C.shadow);
  return c;
};

sprites["chair"] = () => {
  const c = new Canvas(TILE, TILE);
  c.ellipse(16, 22, 12, 8, C.shadowSoft);
  c.rect(8, 6, 16, 6, C.chair); // backrest
  c.rect(9, 7, 14, 4, C.chairLight);
  c.rect(7, 12, 18, 12, C.chair); // seat
  c.rect(8, 13, 16, 9, C.chairLight);
  c.rect(14, 24, 4, 4, C.metalDark); // post
  c.rect(9, 27, 14, 3, C.metal); // base
  return c;
};

sprites["monitor"] = () => {
  const c = new Canvas(TILE, TILE);
  c.rect(4, 6, 24, 16, C.metalDark);
  c.rect(6, 8, 20, 12, C.screen);
  const rand = rng(7);
  for (let i = 0; i < 5; i++) {
    c.hline(8, 10 + i * 2, 4 + Math.floor(rand() * 12), C.screenGlow);
  }
  c.rect(14, 22, 4, 4, C.metalDark); // stand
  c.rect(10, 26, 12, 2, C.metal);
  return c;
};

sprites["plant"] = () => {
  const c = new Canvas(TILE, TILE);
  c.ellipse(16, 27, 10, 4, C.shadowSoft);
  c.rect(11, 20, 10, 9, C.plantPotDark);
  c.rect(12, 20, 8, 7, C.plantPot);
  c.ellipse(16, 13, 9, 8, C.leaf);
  c.ellipse(13, 10, 5, 4, C.leafLight);
  c.ellipse(20, 15, 4, 3, C.leafLight);
  c.vline(16, 16, 5, C.plantPotDark);
  return c;
};

sprites["couch"] = () => {
  const c = new Canvas(TILE * 2, TILE);
  c.rect(2, 24, 60, 4, C.shadowSoft);
  c.rect(2, 4, 60, 10, C.couchDark); // back
  c.rect(3, 5, 58, 8, C.couch);
  c.rect(2, 12, 60, 14, C.couch); // seat
  c.rect(5, 14, 25, 10, C.couchLight); // cushions
  c.rect(34, 14, 25, 10, C.couchLight);
  c.rect(0, 10, 5, 16, C.couchDark); // arms
  c.rect(59, 10, 5, 16, C.couchDark);
  return c;
};

sprites["conf-table"] = () => {
  const c = new Canvas(TILE * 3, TILE * 2);
  c.ellipse(48, 34, 44, 24, C.shadowSoft);
  c.ellipse(48, 32, 44, 24, C.deskEdge);
  c.ellipse(48, 30, 42, 22, C.deskTop);
  c.ellipse(40, 22, 16, 8, "#d19c63"); // sheen
  return c;
};

sprites["whiteboard"] = () => {
  const c = new Canvas(TILE * 2, TILE);
  c.rect(2, 4, 60, 24, C.boardFrame);
  c.rect(4, 6, 56, 18, C.board);
  c.hline(8, 11, 20, C.accent);
  c.hline(8, 15, 32, C.metalDark);
  c.hline(8, 19, 14, C.ink);
  c.rect(4, 24, 56, 3, C.boardFrame); // marker tray
  return c;
};

sprites["coffee"] = () => {
  const c = new Canvas(TILE, TILE);
  c.rect(5, 22, 22, 6, C.metalDark); // counter block
  c.rect(7, 4, 18, 18, C.metalDark);
  c.rect(9, 6, 14, 8, C.metal);
  c.rect(11, 8, 10, 5, C.screen);
  c.rect(13, 15, 6, 5, C.woodDark); // cup slot
  c.rect(20, 6, 3, 3, C.ink); // power light
  return c;
};

sprites["bookshelf"] = () => {
  const c = new Canvas(TILE, TILE);
  c.rect(3, 3, 26, 27, C.woodDark);
  c.rect(5, 5, 22, 23, C.wood);
  const rand = rng(31);
  for (const shelfY of [6, 14, 22]) {
    let x = 6;
    while (x < 26) {
      const w = 2 + Math.floor(rand() * 2);
      if (x + w > 26) break;
      c.rect(x, shelfY, w, 6, C.book[Math.floor(rand() * C.book.length)]);
      x += w + 1;
    }
    c.hline(5, shelfY + 6, 22, C.woodSeam);
  }
  return c;
};

sprites["rug"] = () => {
  const c = new Canvas(TILE * 2, TILE * 2);
  c.rect(1, 1, 62, 62, "#3d6f74");
  c.outline(1, 1, 62, 62, "#2b5257");
  c.outline(6, 6, 52, 52, C.accent);
  c.outline(12, 12, 40, 40, "#2b5257");
  c.rect(24, 24, 16, 16, C.accent);
  return c;
};

// --- topObjects -------------------------------------------------------

// Drawn above the player, so keep it translucent: a lamp the avatar walks
// under rather than a solid block.
sprites["lamp"] = () => {
  const c = new Canvas(TILE, TILE);
  c.ellipse(16, 16, 15, 15, C.glow);
  c.ellipse(16, 14, 9, 9, "#ffe9a870");
  c.rect(10, 4, 12, 5, C.metalDark);
  c.rect(11, 9, 10, 3, "#fff6d8");
  return c;
};

// ---------------------------------------------------------------- main

mkdirSync(OUT_DIR, { recursive: true });
let count = 0;
for (const [name, draw] of Object.entries(sprites)) {
  const canvas = draw();
  writeFileSync(join(OUT_DIR, `${name}.png`), encodePng(canvas.w, canvas.h, canvas.data));
  count++;
  console.log(`  ${name}.png  ${canvas.w}x${canvas.h}`);
}
console.log(`\nWrote ${count} sprites to ${OUT_DIR}`);
