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

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "apps", "web", "public");
const OUT_DIR = join(PUBLIC_DIR, "Office");
const AVATAR_DIR = join(PUBLIC_DIR, "Avatars");
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

  // Copies a rectangle, optionally flipped horizontally. Used to turn the
  // right-facing walk frames into left-facing ones without redrawing them.
  blit(sx, sy, w, h, dx, dy, flipX = false) {
    const src = Buffer.from(this.data);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const si = ((sy + j) * this.w + (sx + (flipX ? w - 1 - i : i))) * 4;
        const di = ((dy + j) * this.w + (dx + i)) * 4;
        this.data[di] = src[si];
        this.data[di + 1] = src[si + 1];
        this.data[di + 2] = src[si + 2];
        this.data[di + 3] = src[si + 3];
      }
    }
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

// ---------------------------------------------------------------- sheets
// Multi-frame sheets. These live alongside the single tiles above but are
// emitted from their own table so the 18 tiles stay byte-identical.

const sheets = {};

// Multiplies a hex colour, keeping alpha. Returns the [r,g,b,a] form that
// Canvas.px already understands.
function shade(hex, factor) {
  const [r, g, b, a] = parseColor(hex);
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v * factor)));
  return [clamp(r), clamp(g), clamp(b), a];
}

// --- door-sheet -------------------------------------------------------
// Four 32x32 frames: closed, ajar, open, wide. The wall and the jamb are
// identical in every frame, so only the leaf reads as moving. Frame 0 is a
// pixel-for-pixel copy of the `door` sprite above.

const DOOR_LEAF_W = [20, 13, 7, 3];
const doorway = "#2b2119";
const doorwayFloor = "#3d3227";

sheets["door-sheet"] = () => {
  const c = new Canvas(TILE * 4, TILE);
  for (let k = 0; k < 4; k++) {
    const ox = k * TILE;
    // Surround: wall, then the dark jamb. Identical across all four frames.
    c.rect(ox, 0, TILE, TILE, C.wall);
    c.rect(ox + 4, 2, 24, 28, C.woodDark);

    if (k === 0) {
      c.rect(ox + 6, 4, 20, 24, C.wood);
      c.outline(ox + 6, 4, 20, 24, C.woodSeam);
      c.rect(ox + 21, 15, 3, 3, C.metal);
      continue;
    }

    // The opening behind the leaf: a dark room with a sliver of lit floor.
    c.rect(ox + 6, 4, 20, 24, doorway);
    c.rect(ox + 6, 24, 20, 4, doorwayFloor);
    c.hline(ox + 6, 4, 20, shade(doorway, 0.7));

    // The leaf is hinged on the left and swings inward, so it narrows and
    // darkens as it turns away from the room light.
    const w = DOOR_LEAF_W[k];
    const dim = 1 - k * 0.09;
    c.rect(ox + 6, 4, w, 24, shade(C.wood, dim));
    c.outline(ox + 6, 4, w, 24, shade(C.woodSeam, dim));
    if (w >= 7) {
      c.vline(ox + 6 + w - 2, 4, 24, shade(C.woodSeam, dim * 0.9));
      c.rect(ox + 6 + w - 5, 15, 3, 3, shade(C.metal, dim));
    }
    // Edge highlight on the swinging side reads as the leaf's thickness.
    c.vline(ox + 6 + w, 4, 24, shade(C.woodSeam, 0.65));
  }
  return c;
};

// --- avatars ----------------------------------------------------------
// 400x400 sheets: a 5x5 grid of 80x80 frames. 0-5 down, 6-11 right,
// 12-17 left (mirrored right), 18-23 up, 24 sitting.

const CELL = 80;

// Contact / pass / contact / pass over six frames. Frame 0 is forced to a
// neutral standing pose by the phase being exactly 0 there.
const PHASE = [0, 0.55, 1, 0.55, -0.55, -1];

const AVATARS = [
  { skin: "#f0c49a", hair: "#3b2a20", style: "short", shirt: "#3f6fd8", pants: "#2f3a4d" },
  { skin: "#e8b184", hair: "#8b3a1e", style: "ponytail", shirt: "#d8564a", pants: "#3a3f52" },
  { skin: "#c98a5e", hair: "#1c1512", style: "curly", shirt: "#2fae7a", pants: "#333b46" },
  { skin: "#8d5a34", hair: "#2a1c14", style: "bun", shirt: "#e0a33e", pants: "#2e3440" },
  { skin: "#f6d8bd", hair: "#e0c05a", style: "long", shirt: "#8064a2", pants: "#3b3550" },
  { skin: "#6b4326", hair: "#120d0a", style: "buzz", shirt: "#2dd4bf", pants: "#26333a" },
  { skin: "#eab98c", hair: "#c4622a", style: "spiky", shirt: "#d95a9a", pants: "#3a3a44" },
  { skin: "#d8a273", hair: "#7a4a9c", style: "bob", shirt: "#f2f2ef", pants: "#31415c" },
];

const SHOE = "#2a2a31";
const EYE = "#241b18";
const AV_SHADOW = "#00000026";

// Draws one 80x80 frame at (ox, oy). `dir` is "down" | "right" | "up" | "sit".
function drawAvatarFrame(c, ox, oy, s, dir, f) {
  const R = (x, y, w, h, col) => c.rect(ox + x, oy + y, w, h, col);
  const E = (cx, cy, rx, ry, col) => c.ellipse(ox + cx, oy + cy, rx, ry, col);

  const skin = s.skin;
  const skinD = shade(skin, 0.84);
  const hair = s.hair;
  const hairL = shade(hair, 1.3);
  const shirt = s.shirt;
  const shirtD = shade(shirt, 0.8);
  const pants = s.pants;
  const pantsD = shade(pants, 0.8);
  const shoeD = shade(SHOE, 0.75);

  const sit = dir === "sit";
  const p = sit ? 0 : PHASE[f];
  const bob = sit || f === 0 ? 0 : Math.abs(p) < 0.9 ? -1 : 0;
  const cy = 25 + bob;
  const hipY = 53 + bob;

  // --- hair, drawn after the torso so it falls over the shoulders --------
  const drawHair = (hy = cy) => {
    const mass = () => E(40, hy, 10, 9.5, hair);
    switch (s.style) {
      case "buzz":
        E(40, hy, 9.5, 9, hair);
        break;
      case "curly":
        E(40, hy - 1, 11, 10, hair);
        E(32, hy - 3, 4.5, 4, hair);
        E(48, hy - 3, 4.5, 4, hair);
        E(40, hy - 8, 5.5, 4.5, hair);
        E(35, hy - 7, 4, 3.5, hairL);
        E(45, hy - 6, 3.5, 3, hairL);
        break;
      case "spiky":
        mass();
        for (let i = 0; i < 5; i++) {
          const len = [6, 10, 13, 9, 5][i];
          R(31 + i * 4, hy - 3 - len, 4, len + 4, hair);
        }
        break;
      case "bun":
        mass();
        E(40, hy - 11, 5, 4.5, hair);
        E(39, hy - 12, 2.5, 2, hairL);
        break;
      case "ponytail":
        mass();
        if (dir === "up") {
          R(37, hy + 4, 6, 16, hair);
          E(40, hy + 20, 3, 3, hair);
        } else if (dir === "right") {
          E(30, hy + 2, 4, 5, hair);
          R(27, hy + 3, 5, 12, hair);
        } else {
          R(28, hy - 2, 3, 9, hair);
          R(49, hy - 2, 3, 9, hair);
        }
        break;
      case "long":
        mass();
        R(29, hy - 4, 5, 18, hair);
        R(46, hy - 4, 5, 18, hair);
        if (dir === "up") { E(40, hy + 6, 9.5, 13, hair); E(40, hy + 16, 8, 4, hair); }
        if (dir === "right") R(30, hy - 4, 8, 18, hair);
        break;
      case "bob":
        E(40, hy - 1, 10.5, 10, hair);
        R(29, hy - 2, 5, 12, hair);
        R(46, hy - 2, 5, 12, hair);
        if (dir === "up") E(40, hy + 3, 10.5, 11, hair);
        if (dir === "right") R(30, hy - 2, 9, 12, hair);
        break;
      default:
        mass();
    }
    if (s.style !== "curly") E(36, hy - 5, 4, 2.5, hairL);
  };

  if (dir === "right") {
    // Side view: a narrow body, a nose/chin profile, limbs swinging along x.
    const sw = Math.round(p * 5);
    E(40, 66, 11, 4, AV_SHADOW);
    // far leg + far arm sit behind the torso, darkened so they separate
    R(36 - sw, hipY, 7, 63 - hipY, pantsD);
    R(36 - sw, 63, 10, 3, shoeD);
    R(37 - sw, 36 + bob, 5, 11, shade(shirt, 0.66));
    R(37 - sw, 47 + bob, 5, 4, shade(skin, 0.7));
    R(36 + sw, hipY, 7, 63 - hipY, pants);
    R(36 + sw, 63, 10, 3, SHOE);
    R(34, 35 + bob, 14, 19, shirt);
    R(34, 35 + bob, 14, 3, shade(shirt, 1.08));
    R(34, 52 + bob, 14, 2, shirtD);
    R(38, 32 + bob, 6, 4, skinD);
    // back of the skull, bulked out so the profile is unmistakable
    E(39, cy, 9.5, 9, hair);
    R(30, cy - 2, 9, 10, hair);
    drawHair();
    E(43, cy + 2, 7.5, 7.5, skin);
    R(49, cy + 1, 3, 4, skin); // nose
    R(49, cy + 5, 2, 1, skinD);
    R(46, cy, 2, 3, EYE);
    R(46, cy + 7, 3, 1, skinD); // mouth
    // near arm swings in front of the torso
    R(38 + sw, 37 + bob, 5, 10, shade(shirt, 0.88));
    R(38 + sw, 47 + bob, 5, 4, skin);
    return;
  }

  if (sit) {
    // Seated, facing the viewer. The whole figure drops and compresses:
    // stubby thighs pointing at the camera, feet planted forward, hands on
    // the lap. The silhouette is a head shorter than the standing pose.
    const scy = 31;
    E(40, 68, 14, 4, AV_SHADOW);
    R(29, 56, 10, 8, pants); // thighs
    R(41, 56, 10, 8, pants);
    R(30, 62, 8, 3, pantsD); // shins
    R(42, 62, 8, 3, pantsD);
    R(29, 64, 9, 3, SHOE);
    R(42, 64, 9, 3, SHOE);
    R(31, 41, 18, 16, shirt); // torso
    R(31, 55, 18, 2, shirtD);
    R(34, 41, 12, 3, shade(shirt, 1.12)); // collar
    R(27, 43, 4, 9, shade(shirt, 0.88)); // upper arms
    R(49, 43, 4, 9, shade(shirt, 0.88));
    R(28, 52, 7, 4, skin); // forearms folded onto the lap
    R(45, 52, 7, 4, skin);
    R(37, 38, 6, 4, skinD); // neck
    drawHair(scy);
    E(40, scy + 2.5, 8.5, 8, skin);
    R(35, scy + 3, 2, 3, EYE);
    R(43, scy + 3, 2, 3, EYE);
    R(38, scy + 8, 4, 1, skinD);
    return;
  }

  // Front / back view.
  const dl = Math.round(p * 3);
  const lbot = 65 + dl;
  const rbot = 65 - dl;
  E(40, 66, 12, 4, AV_SHADOW);
  R(31, hipY, 6, lbot - 2 - hipY, pants);
  R(31, lbot - 2, 6, 3, SHOE);
  R(43, hipY, 6, rbot - 2 - hipY, pants);
  R(43, rbot - 2, 6, 3, SHOE);
  R(27, 36 + bob - dl, 4, 10, shade(shirt, 0.86));
  R(27, 46 + bob - dl, 4, 4, skin);
  R(49, 36 + bob + dl, 4, 10, shade(shirt, 0.86));
  R(49, 46 + bob + dl, 4, 4, skin);
  R(31, 35 + bob, 18, 19, shirt);
  R(31, 52 + bob, 18, 2, shirtD);
  R(37, 32 + bob, 6, 4, skinD);

  if (dir === "up") {
    // Back of the head: all hair, no face.
    R(34, 35 + bob, 12, 3, shirtD); // collar, tucked under the hair
    E(40, cy + 2, 9, 8.5, hair);
    drawHair();
  } else {
    drawHair();
    E(40, cy + 2.5, 8.5, 8, skin);
    R(35, cy + 3, 2, 3, EYE);
    R(43, cy + 3, 2, 3, EYE);
    R(38, cy + 8, 4, 1, skinD);
    R(34, 35 + bob, 12, 3, shade(shirt, 1.12)); // collar
  }
}

function avatarSheet(s) {
  const c = new Canvas(CELL * 5, CELL * 5);
  const at = (i) => [(i % 5) * CELL, Math.floor(i / 5) * CELL];
  for (let f = 0; f < 6; f++) {
    const [dx, dy] = at(f);
    drawAvatarFrame(c, dx, dy, s, "down", f);
    const [rx, ry] = at(6 + f);
    drawAvatarFrame(c, rx, ry, s, "right", f);
    const [ux, uy] = at(18 + f);
    drawAvatarFrame(c, ux, uy, s, "up", f);
  }
  // Left is the mirrored right run.
  for (let f = 0; f < 6; f++) {
    const [rx, ry] = at(6 + f);
    const [lx, ly] = at(12 + f);
    c.blit(rx, ry, CELL, CELL, lx, ly, true);
  }
  const [sx, sy] = at(24);
  drawAvatarFrame(c, sx, sy, s, "sit", 0);
  return c;
}

AVATARS.forEach((s, i) => {
  sheets[`avatar-${i + 1}`] = () => avatarSheet(s);
});

// ---------------------------------------------------------------- main

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(AVATAR_DIR, { recursive: true });
let count = 0;
for (const [name, draw] of Object.entries(sprites)) {
  const canvas = draw();
  writeFileSync(join(OUT_DIR, `${name}.png`), encodePng(canvas.w, canvas.h, canvas.data));
  count++;
  console.log(`  Office/${name}.png  ${canvas.w}x${canvas.h}`);
}
for (const [name, draw] of Object.entries(sheets)) {
  const dir = name.startsWith("avatar-") ? AVATAR_DIR : OUT_DIR;
  const canvas = draw();
  writeFileSync(join(dir, `${name}.png`), encodePng(canvas.w, canvas.h, canvas.data));
  count++;
  console.log(`  ${name.startsWith("avatar-") ? "Avatars" : "Office"}/${name}.png  ${canvas.w}x${canvas.h}`);
}
console.log(`\nWrote ${count} images`);
