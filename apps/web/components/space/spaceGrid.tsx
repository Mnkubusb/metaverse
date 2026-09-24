"use client"
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { avatarAPI, spaceAPI, userAPI } from '../../lib/api';
import { useWebSocket } from '../../contexts/WebSocketsContexts';
import { useAuth } from '../../contexts/authContext';
import { spaceElement } from './SpaceElement';
import { buildWalkability } from '@/lib/collision';

interface Space {
  name: string;
  dimensions: string;
  elements: spaceElement[];
}

type Direction = "down" | "right" | "left" | "up";

interface Actor {
  // position in tiles; `x`/`y` are the target tile, `rx`/`ry` the rendered (interpolated) position
  x: number;
  y: number;
  rx: number;
  ry: number;
  dir: Direction;
  movingUntil: number;
  name: string;
  avatar: string;
  self?: boolean;
}

const TILE = 32;
const STEP_MS = 140;            // time to walk one tile
const DEFAULT_AVATAR = "/Characters/WalkAnimations.png";
const GROUND_TILES = ["/Tiles/BasicTiles8.png", "/Tiles/BasicTiles22.png"];

// Avatar sheets: 5x5 grid of 80px frames, 6 frames per direction.
const FRAME = 80;
const SHEET_COLS = 5;
const DIR_BASE: Record<Direction, number> = { down: 0, right: 6, left: 12, up: 18 };
const AVATAR_SIZE = 64;

const KEY_DIRS: Record<string, Direction> = {
  w: "up", arrowup: "up",
  s: "down", arrowdown: "down",
  a: "left", arrowleft: "left",
  d: "right", arrowright: "right",
};
const DIR_DELTA: Record<Direction, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

const imageCache = new Map<string, HTMLImageElement>();
function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached?.complete) return Promise.resolve(cached);
  return new Promise((resolve) => {
    const img = cached ?? new Image();
    imageCache.set(src, img);
    img.onload = () => resolve(img);
    img.onerror = () => resolve(img); // draw nothing for broken images instead of blocking the space
    if (!cached) img.src = src;
  });
}
const ready = (img: HTMLImageElement | undefined): img is HTMLImageElement =>
  !!img && img.complete && img.naturalWidth > 0;

// Floor and wall layers never change while you're in a space, so they're drawn once
// onto an offscreen canvas and blitted every frame.
async function renderBackground(width: number, height: number, elements: spaceElement[]) {
  const canvas = document.createElement("canvas");
  canvas.width = width * TILE;
  canvas.height = height * TILE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  const [grass, tuft] = await Promise.all(GROUND_TILES.map(loadImage));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // deterministic scatter of grass tufts
      const tile = ((x * 7919 + y * 104729) % 100) < 12 ? tuft : grass;
      if (ready(tile)) ctx.drawImage(tile, x * TILE, y * TILE, TILE, TILE);
    }
  }
  for (const layer of ["floor", "wall"]) {
    for (const e of elements.filter((el) => (el.element.layer ?? "floor") === layer)) {
      const img = await loadImage(e.element.imageUrl);
      if (ready(img)) ctx.drawImage(img, e.x * TILE, e.y * TILE, e.element.width * TILE, e.element.height * TILE);
    }
  }
  return canvas;
}

const SpaceGrid = ({ id }: { id: string }) => {
  const { user } = useAuth();
  const { moveUser, serverPosition, users, selfId } = useWebSocket();
  const [space, setSpace] = useState<Space | null>(null);
  const [error, setError] = useState("");
  const [loadingArt, setLoadingArt] = useState(true);
  const [selfAvatar, setSelfAvatar] = useState(DEFAULT_AVATAR);
  const [otherAvatars, setOtherAvatars] = useState<Map<string, string>>(new Map());

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const backgroundRef = useRef<HTMLCanvasElement | null>(null);
  const selfRef = useRef<Actor | null>(null);
  const othersRef = useRef<Map<string, Actor>>(new Map());
  const heldRef = useRef<Direction[]>([]);
  const lastStepRef = useRef(0);

  const dims = useMemo(() => {
    if (!space) return null;
    const [w, h] = space.dimensions.split('x').map(Number);
    return { w: w!, h: h! };
  }, [space]);

  const isWalkable = useMemo(
    () => (space && dims ? buildWalkability(dims.w, dims.h, space.elements) : () => false),
    [space, dims],
  );

  const sprites = useMemo(() => {
    const els = space?.elements ?? [];
    return {
      objects: els.filter((e) => e.element.layer === "objects"),
      top: els.filter((e) => e.element.layer === "topObjects"),
    };
  }, [space]);

  // --- data loading ---------------------------------------------------------
  useEffect(() => {
    spaceAPI.getSpace(id)
      .then((res) => setSpace(res.data))
      .catch((err) => {
        console.error(err);
        setError('Failed to load space');
      });
  }, [id]);

  useEffect(() => {
    if (!space || !dims) return;
    let cancelled = false;
    setLoadingArt(true);
    const urls = new Set(space.elements.map((e) => e.element.imageUrl));
    Promise.all([...urls].map(loadImage))
      .then(() => renderBackground(dims.w, dims.h, space.elements))
      .then((bg) => {
        if (cancelled) return;
        backgroundRef.current = bg;
        setLoadingArt(false);
      });
    return () => { cancelled = true; };
  }, [space, dims]);

  useEffect(() => {
    if (!user) return;
    avatarAPI.getUserAvatar(user.id)
      .then((res) => { if (res.data.avatar?.imageUrl) setSelfAvatar(res.data.avatar.imageUrl); })
      .catch(() => { /* fall back to the default sprite */ });
  }, [user]);

  useEffect(() => {
    const uncached = [...users.keys()].filter((uid) => uid && !otherAvatars.has(uid));
    if (uncached.length === 0) return;
    userAPI.getBulkMetadata(uncached).then((res) => {
      const avatarData: { userId: string; avatarId?: string }[] = res.data.avatars;
      setOtherAvatars((prev) => {
        const next = new Map(prev);
        avatarData.forEach(({ userId, avatarId }) => next.set(userId, avatarId || DEFAULT_AVATAR));
        return next;
      });
    }).catch(() => { });
  }, [users, otherAvatars]);

  // --- actors ---------------------------------------------------------------
  useEffect(() => {
    // join or rejected move: snap the local player to the server's position
    const self = selfRef.current;
    if (!self) {
      selfRef.current = {
        x: serverPosition.x, y: serverPosition.y, rx: serverPosition.x, ry: serverPosition.y,
        dir: "down", movingUntil: 0, name: user?.username ?? "You", avatar: selfAvatar, self: true,
      };
    } else {
      self.x = self.rx = serverPosition.x;
      self.y = self.ry = serverPosition.y;
    }
  }, [serverPosition, user, selfAvatar]);

  useEffect(() => {
    if (selfRef.current) {
      selfRef.current.avatar = selfAvatar;
      selfRef.current.name = user?.username ?? "You";
    }
  }, [selfAvatar, user]);

  useEffect(() => {
    const actors = othersRef.current;
    const now = performance.now();
    for (const [uid, u] of users) {
      if (uid === selfId) continue;
      const a = actors.get(uid);
      const avatar = otherAvatars.get(uid) ?? DEFAULT_AVATAR;
      const name = u.username ?? "Player";
      if (!a) {
        actors.set(uid, { x: u.x, y: u.y, rx: u.x, ry: u.y, dir: "down", movingUntil: 0, name, avatar });
        continue;
      }
      if (a.x !== u.x || a.y !== u.y) {
        a.dir = u.x > a.x ? "right" : u.x < a.x ? "left" : u.y > a.y ? "down" : "up";
        a.movingUntil = now + STEP_MS * 1.5;
        // far jumps (e.g. a resync) teleport instead of sliding across the map
        if (Math.abs(u.x - a.rx) + Math.abs(u.y - a.ry) > 3) { a.rx = u.x; a.ry = u.y; }
        a.x = u.x;
        a.y = u.y;
      }
      a.avatar = avatar;
      a.name = name;
    }
    for (const uid of [...actors.keys()]) if (!users.has(uid)) actors.delete(uid);
  }, [users, otherAvatars, selfId]);

  // --- input ----------------------------------------------------------------
  useEffect(() => {
    const isTyping = (e: KeyboardEvent) =>
      e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
    const down = (e: KeyboardEvent) => {
      const dir = KEY_DIRS[e.key.toLowerCase()];
      if (!dir || isTyping(e)) return;
      e.preventDefault();
      heldRef.current = [dir, ...heldRef.current.filter((d) => d !== dir)];
    };
    const up = (e: KeyboardEvent) => {
      const dir = KEY_DIRS[e.key.toLowerCase()];
      if (dir) heldRef.current = heldRef.current.filter((d) => d !== dir);
    };
    const clear = () => { heldRef.current = []; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    };
  }, []);

  // --- game loop ------------------------------------------------------------
  useEffect(() => {
    if (!dims || loadingArt) return;
    let raf = 0;
    let last = performance.now();

    const drawActor = (ctx: CanvasRenderingContext2D, a: Actor, now: number) => {
      const img = imageCache.get(a.avatar) ?? imageCache.get(DEFAULT_AVATAR);
      if (!imageCache.has(a.avatar)) loadImage(a.avatar);
      const px = a.rx * TILE, py = a.ry * TILE;
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath();
      ctx.ellipse(px + TILE / 2, py + TILE - 3, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      if (!ready(img)) return;
      const moving = now < a.movingUntil;
      const frame = DIR_BASE[a.dir] + (moving ? Math.floor(now / 100) % 6 : 0);
      const sx = (frame % SHEET_COLS) * FRAME, sy = Math.floor(frame / SHEET_COLS) * FRAME;
      // the character's feet sit ~64px down an 80px frame; anchor them to the tile's bottom
      const scale = AVATAR_SIZE / FRAME;
      ctx.drawImage(img, sx, sy, FRAME, FRAME,
        px + TILE / 2 - AVATAR_SIZE / 2, py + TILE - 2 - 64 * scale, AVATAR_SIZE, AVATAR_SIZE);
    };

    const drawName = (ctx: CanvasRenderingContext2D, a: Actor) => {
      const px = a.rx * TILE + TILE / 2, py = a.ry * TILE - 22;
      ctx.font = "bold 11px ui-sans-serif, system-ui, sans-serif";
      const w = ctx.measureText(a.name).width + 10;
      ctx.fillStyle = a.self ? "rgba(30,98,72,0.9)" : "rgba(20,20,28,0.75)";
      ctx.beginPath();
      ctx.roundRect(px - w / 2, py - 9, w, 16, 8);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(a.name, px, py);
    };

    const tick = (now: number) => {
      const dt = Math.min(now - last, 100);
      last = now;
      const canvas = canvasRef.current;
      const self = selfRef.current;
      if (!canvas || !self) { raf = requestAnimationFrame(tick); return; }

      // step the local player one tile at a time while a direction key is held
      const dir = heldRef.current[0];
      const arrived = Math.abs(self.rx - self.x) < 0.05 && Math.abs(self.ry - self.y) < 0.05;
      if (dir && arrived && now - lastStepRef.current >= STEP_MS) {
        self.dir = dir;
        const [dx, dy] = DIR_DELTA[dir];
        const nx = self.x + dx, ny = self.y + dy;
        if (isWalkable(nx, ny)) {
          self.x = nx;
          self.y = ny;
          self.movingUntil = now + STEP_MS * 1.2;
          lastStepRef.current = now;
          moveUser(nx, ny);
        }
      }

      // ease rendered positions toward their tiles
      const speed = dt / STEP_MS;
      for (const a of [self, ...othersRef.current.values()]) {
        const dx = a.x - a.rx, dy = a.y - a.ry;
        a.rx += Math.sign(dx) * Math.min(Math.abs(dx), speed);
        a.ry += Math.sign(dy) * Math.min(Math.abs(dy), speed);
      }

      // resize to the container
      const parent = canvas.parentElement;
      const cw = parent?.clientWidth ?? window.innerWidth, ch = parent?.clientHeight ?? window.innerHeight;
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;

      // camera follows the player, clamped to the world (centred if the world is smaller)
      const worldW = dims.w * TILE, worldH = dims.h * TILE;
      const camX = worldW <= cw ? (worldW - cw) / 2 : Math.max(0, Math.min(self.rx * TILE + TILE / 2 - cw / 2, worldW - cw));
      const camY = worldH <= ch ? (worldH - ch) / 2 : Math.max(0, Math.min(self.ry * TILE + TILE / 2 - ch / 2, worldH - ch));

      ctx.fillStyle = "#2f3b2a";
      ctx.fillRect(0, 0, cw, ch);
      ctx.save();
      ctx.translate(-Math.round(camX), -Math.round(camY));
      if (backgroundRef.current) ctx.drawImage(backgroundRef.current, 0, 0);

      // objects and players, sorted by their bottom edge so nearer things overlap farther ones
      const actors = [self, ...othersRef.current.values()];
      const drawables: { bottom: number; draw: () => void }[] = [
        ...sprites.objects.map((e) => ({
          bottom: e.y + e.element.height,
          draw: () => {
            const img = imageCache.get(e.element.imageUrl);
            if (ready(img)) ctx.drawImage(img, e.x * TILE, e.y * TILE, e.element.width * TILE, e.element.height * TILE);
          },
        })),
        ...actors.map((a) => ({ bottom: a.ry + 1 + 0.01, draw: () => drawActor(ctx, a, now) })),
      ];
      drawables.sort((a, b) => a.bottom - b.bottom);
      drawables.forEach((d) => d.draw());

      for (const e of sprites.top) {
        const img = imageCache.get(e.element.imageUrl);
        if (ready(img)) ctx.drawImage(img, e.x * TILE, e.y * TILE, e.element.width * TILE, e.element.height * TILE);
      }
      actors.forEach((a) => drawName(ctx, a));
      ctx.restore();

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dims, loadingArt, isWalkable, sprites, moveUser]);

  if (error) return <div className="text-center p-8 text-red-500">{error}</div>;
  if (!space) return <div className="text-center p-8">Loading space...</div>;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#2f3b2a]">
      <div className="absolute z-20 m-4 rounded-lg bg-black/60 px-4 py-3 text-white shadow-lg">
        <h2 className="text-lg font-bold">{space.name}</h2>
        <p className="text-sm opacity-80">{users.size + 1} online · move with WASD / arrow keys</p>
      </div>
      {loadingArt && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-white">Loading map...</div>
      )}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ imageRendering: "pixelated" }} />
    </div>
  );
};

export default SpaceGrid;
