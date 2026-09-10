// Seeds the office element set and the "Default Office" map.
//
//   pnpm db:seed
//
// Re-runnable: elements are matched by imageUrl and the map is rebuilt from
// scratch each run, so editing the layout below and re-seeding is safe.

const client = require("../client.js");

const OFFICE = "/Office";

// Element catalogue. `static` is the collision flag; `layer` drives draw order
// (floor -> wall -> objects -> player -> topObjects).
const ELEMENTS = {
  carpet: { imageUrl: `${OFFICE}/floor-carpet.png`, width: 1, height: 1, static: false, layer: "floor" },
  wood: { imageUrl: `${OFFICE}/floor-wood.png`, width: 1, height: 1, static: false, layer: "floor" },
  tile: { imageUrl: `${OFFICE}/floor-tile.png`, width: 1, height: 1, static: false, layer: "floor" },

  wallH: { imageUrl: `${OFFICE}/wall-h.png`, width: 1, height: 1, static: true, layer: "wall" },
  wallV: { imageUrl: `${OFFICE}/wall-v.png`, width: 1, height: 1, static: true, layer: "wall" },
  wallCorner: { imageUrl: `${OFFICE}/wall-corner.png`, width: 1, height: 1, static: true, layer: "wall" },
  door: { imageUrl: `${OFFICE}/door.png`, width: 1, height: 1, static: false, layer: "wall" },

  desk: { imageUrl: `${OFFICE}/desk.png`, width: 2, height: 1, static: true, layer: "objects" },
  chair: { imageUrl: `${OFFICE}/chair.png`, width: 1, height: 1, static: false, layer: "objects" },
  monitor: { imageUrl: `${OFFICE}/monitor.png`, width: 1, height: 1, static: true, layer: "objects" },
  plant: { imageUrl: `${OFFICE}/plant.png`, width: 1, height: 1, static: true, layer: "objects" },
  couch: { imageUrl: `${OFFICE}/couch.png`, width: 2, height: 1, static: false, layer: "objects" },
  confTable: { imageUrl: `${OFFICE}/conf-table.png`, width: 3, height: 2, static: true, layer: "objects" },
  whiteboard: { imageUrl: `${OFFICE}/whiteboard.png`, width: 2, height: 1, static: true, layer: "objects" },
  coffee: { imageUrl: `${OFFICE}/coffee.png`, width: 1, height: 1, static: true, layer: "objects" },
  bookshelf: { imageUrl: `${OFFICE}/bookshelf.png`, width: 1, height: 1, static: true, layer: "objects" },
  rug: { imageUrl: `${OFFICE}/rug.png`, width: 2, height: 2, static: false, layer: "floor" },

  lamp: { imageUrl: `${OFFICE}/lamp.png`, width: 1, height: 1, static: false, layer: "topObjects" },
};

const MAP_NAME = "Default Office";
const WIDTH = 30;
const HEIGHT = 20;

// Meeting room in the top-right, walled off from the open plan.
const ROOM = { x0: 20, y0: 1, x1: 28, y1: 8 };

/** Builds the [{ key, x, y }] placement list for the office floor. */
function buildLayout() {
  const placements = [];
  const put = (key, x, y) => placements.push({ key, x, y });

  // --- floor: carpet everywhere inside the perimeter --------------------
  const floorAt = new Map();
  for (let y = 1; y < HEIGHT - 1; y++) {
    for (let x = 1; x < WIDTH - 1; x++) floorAt.set(`${x},${y}`, "carpet");
  }
  // Lounge gets wood, coffee corner gets tile.
  for (let y = 12; y <= 18; y++) for (let x = 1; x <= 8; x++) floorAt.set(`${x},${y}`, "wood");
  for (let y = 15; y <= 18; y++) for (let x = 13; x <= 18; x++) floorAt.set(`${x},${y}`, "tile");
  for (const [pos, key] of floorAt) {
    const [x, y] = pos.split(",").map(Number);
    put(key, x, y);
  }

  // --- walls: perimeter -------------------------------------------------
  const DOOR_X = 15; // main entrance, bottom wall
  for (let x = 0; x < WIDTH; x++) {
    put(x === 0 || x === WIDTH - 1 ? "wallCorner" : "wallH", x, 0);
    if (x === DOOR_X) put("door", x, HEIGHT - 1);
    else put(x === 0 || x === WIDTH - 1 ? "wallCorner" : "wallH", x, HEIGHT - 1);
  }
  for (let y = 1; y < HEIGHT - 1; y++) {
    put("wallV", 0, y);
    put("wallV", WIDTH - 1, y);
  }

  // --- meeting room partition ------------------------------------------
  const ROOM_DOOR_Y = 5;
  for (let y = ROOM.y0; y <= ROOM.y1; y++) {
    if (y === ROOM_DOOR_Y) put("door", ROOM.x0 - 1, y);
    else put("wallV", ROOM.x0 - 1, y);
  }
  for (let x = ROOM.x0 - 1; x <= ROOM.x1; x++) put("wallH", x, ROOM.y1 + 1);

  // Conference table centred in the room, chairs on all four sides.
  put("confTable", 23, 4);
  for (const x of [23, 24, 25]) {
    put("chair", x, 3);
    put("chair", x, 6);
  }
  put("chair", 22, 4);
  put("chair", 22, 5);
  put("chair", 26, 4);
  put("chair", 26, 5);
  put("whiteboard", 23, 1);
  put("plant", 27, 7);

  // --- open plan: four desk pods ---------------------------------------
  // Each pod is a 2x1 desk with a monitor on it and two chairs in front.
  for (const [dx, dy] of [[3, 3], [9, 3], [3, 8], [9, 8]]) {
    put("desk", dx, dy);
    put("monitor", dx, dy);
    put("chair", dx, dy + 1);
    put("chair", dx + 1, dy + 1);
  }
  put("plant", 7, 3);
  put("plant", 13, 8);
  put("bookshelf", 28 - 1, 12);
  put("bookshelf", 28 - 1, 13);
  put("bookshelf", 28 - 1, 14);

  // --- lounge (bottom-left, wood floor) --------------------------------
  put("rug", 3, 14);
  put("couch", 3, 13);
  put("plant", 2, 13);
  put("plant", 6, 13);
  put("plant", 1, 18);

  // --- coffee corner (tiled) -------------------------------------------
  put("coffee", 14, 16);
  put("coffee", 15, 16);
  put("bookshelf", 17, 16);
  put("plant", 18, 18);

  // --- ceiling lamps ----------------------------------------------------
  for (const [lx, ly] of [[6, 2], [12, 2], [6, 10], [12, 10], [24, 2]]) put("lamp", lx, ly);

  return placements;
}

async function upsertElements() {
  const ids = {};
  for (const [key, spec] of Object.entries(ELEMENTS)) {
    const existing = await client.element.findFirst({ where: { imageUrl: spec.imageUrl } });
    const element = existing
      ? await client.element.update({ where: { id: existing.id }, data: spec })
      : await client.element.create({ data: spec });
    ids[key] = element.id;
  }
  return ids;
}

async function main() {
  const ids = await upsertElements();
  console.log(`Elements ready: ${Object.keys(ids).length}`);

  // Rebuild the map so re-seeding never stacks duplicate layouts.
  await client.map.deleteMany({ where: { name: MAP_NAME } });

  const placements = buildLayout();
  const map = await client.map.create({
    data: {
      name: MAP_NAME,
      width: WIDTH,
      height: HEIGHT,
      thumbnail: "/Office/conf-table.png",
      mapElements: {
        create: placements.map((p) => ({ elementId: ids[p.key], x: p.x, y: p.y })),
      },
    },
  });

  console.log(`Map "${MAP_NAME}" created: ${map.id} (${WIDTH}x${HEIGHT}, ${placements.length} elements)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => client.$disconnect());
