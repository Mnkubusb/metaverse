"use client"
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { spaceAPI } from '../../lib/api';
import { useWebSocket } from '../../contexts/WebSocketsContexts';
import { useAuth } from '../../contexts/authContext';
import { spaceElement } from './SpaceElement';
import { buildWalkability } from '@/lib/collision';
import ChatPanel from './ChatPanel';
import AvatarPicker, { AvatarSprite } from '../avatar/AvatarPicker';
import { EMOTES, emojiFor } from '@/lib/emotes';
import { findPlaces, nearestPlace } from '@/lib/places';
import { Check, Link2, MapPin, Map as MapIcon } from 'lucide-react';
import { useProximityMedia } from '@/lib/useProximityMedia';
import MediaDock, { MediaControls } from './MediaDock';

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
const BUBBLE_MS = 6000;         // how long a chat message floats above its author
const EMOTE_MS = 2800;          // how long an emote floats above an avatar
const MINIMAP_W = 200;          // minimap width in CSS pixels
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
  const { moveUser, serverPosition, users, selfId, chat, lastEmote, sendEmote, selfAvatar: selfAvatarUrl, announceAvatarChange } = useWebSocket();
  const [place, setPlace] = useState<string | null>(null);
  const [showMinimap, setShowMinimap] = useState(true);
  const [copied, setCopied] = useState(false);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);
  const emotesRef = useRef<Map<string, { emoji: string; start: number }>>(new Map());
  const [space, setSpace] = useState<Space | null>(null);
  const [error, setError] = useState("");
  const [loadingArt, setLoadingArt] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const backgroundRef = useRef<HTMLCanvasElement | null>(null);
  const selfRef = useRef<Actor | null>(null);
  const othersRef = useRef<Map<string, Actor>>(new Map());
  const heldRef = useRef<Direction[]>([]);
  // taps queued so a key pressed and released within one frame still moves a tile
  const tapsRef = useRef<Direction[]>([]);
  const lastStepRef = useRef(0);
  const bubblesRef = useRef<Map<string, { text: string; until: number }>>(new Map());
  // history loaded on join shouldn't pop up as bubbles
  const chatSeenRef = useRef(chat.length);

  const dims = useMemo(() => {
    if (!space) return null;
    const [w, h] = space.dimensions.split('x').map(Number);
    return { w: w!, h: h! };
  }, [space]);

  const isWalkable = useMemo(
    () => (space && dims ? buildWalkability(dims.w, dims.h, space.elements) : () => false),
    [space, dims],
  );

  const places = useMemo(() => findPlaces(space?.elements ?? []), [space]);

  // --- proximity voice / video ---------------------------------------------
  const getSelfPosition = useCallback(
    () => (selfRef.current ? { x: selfRef.current.x, y: selfRef.current.y } : null), []);
  const media = useProximityMedia(getSelfPosition);
  const names = useMemo(
    () => new Map([...users.values()].map((u) => [u.userId, u.username ?? 'Player'])), [users]);

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

  const selfAvatar = selfAvatarUrl ?? DEFAULT_AVATAR;

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
      const avatar = u.avatar || DEFAULT_AVATAR;
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
  }, [users, selfId]);

  // --- chat bubbles -----------------------------------------------------------
  useEffect(() => {
    const fresh = chat.slice(chatSeenRef.current);
    chatSeenRef.current = chat.length;
    const now = performance.now();
    for (const m of fresh) {
      if (m.system || !m.userId) continue;
      bubblesRef.current.set(m.userId, { text: m.text, until: now + BUBBLE_MS });
    }
  }, [chat]);

  // --- emotes ---------------------------------------------------------------
  // the keyboard handler is registered once, so it calls the latest sendEmote through a ref
  const sendEmoteRef = useRef(sendEmote);
  useEffect(() => { sendEmoteRef.current = sendEmote; }, [sendEmote]);

  useEffect(() => {
    const emoji = lastEmote && emojiFor(lastEmote.emote);
    if (emoji) emotesRef.current.set(lastEmote.userId, { emoji, start: performance.now() });
  }, [lastEmote]);

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link to invite people:', window.location.href);
    }
  };

  // --- input ----------------------------------------------------------------
  useEffect(() => {
    const isTyping = (e: KeyboardEvent) =>
      e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
    const down = (e: KeyboardEvent) => {
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      const emote = EMOTES[Number(e.key) - 1];
      if (emote && !e.repeat) {
        sendEmoteRef.current(emote.id);
        return;
      }
      if (e.key.toLowerCase() === 'm' && !e.repeat) {
        setShowMinimap((v) => !v);
        return;
      }
      const dir = KEY_DIRS[e.key.toLowerCase()];
      if (!dir) return;
      e.preventDefault();
      heldRef.current = [dir, ...heldRef.current.filter((d) => d !== dir)];
      if (!e.repeat && tapsRef.current.length < 3) tapsRef.current.push(dir);
    };
    const up = (e: KeyboardEvent) => {
      const dir = KEY_DIRS[e.key.toLowerCase()];
      if (dir) heldRef.current = heldRef.current.filter((d) => d !== dir);
    };
    const clear = () => { heldRef.current = []; tapsRef.current = []; };
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

    const wrap = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) => {
      const words = text.split(' ');
      const lines: string[] = [];
      let line = '';
      for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (ctx.measureText(next).width > maxWidth && line) {
          lines.push(line);
          line = w;
        } else {
          line = next;
        }
      }
      if (line) lines.push(line);
      if (lines.length > maxLines) {
        lines.length = maxLines;
        lines[maxLines - 1] = lines[maxLines - 1]!.replace(/.{0,2}$/, '…');
      }
      // hard-cut single words that are still too wide
      return lines.map((l) => {
        while (ctx.measureText(l).width > maxWidth && l.length > 1) l = l.slice(0, -2) + '…';
        return l;
      });
    };

    // Lays out every live bubble, nudging later ones upward so nearby players' bubbles don't overlap.
    const drawBubbles = (ctx: CanvasRenderingContext2D, speakers: [string, Actor][], now: number) => {
      ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
      const placed: { x: number; y: number; w: number; h: number }[] = [];
      const items = speakers
        .map(([id, a]) => ({ id, a, bubble: bubblesRef.current.get(id) }))
        .filter((it): it is { id: string; a: Actor; bubble: { text: string; until: number } } => {
          if (!it.bubble) return false;
          if (now > it.bubble.until) { bubblesRef.current.delete(it.id); return false; }
          return true;
        })
        .sort((p, q) => q.a.ry - p.a.ry); // nearest to the camera keeps its natural spot
      for (const { a, bubble } of items) {
        const lines = wrap(ctx, bubble.text, 180, 3);
        const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16;
        const h = lines.length * 15 + 10;
        const cx = a.rx * TILE + TILE / 2;
        const tip = a.ry * TILE - 36;
        const rect = { x: cx - w / 2, y: tip - h, w, h };
        for (let moved = true; moved;) {
          moved = false;
          for (const r of placed) {
            if (rect.x < r.x + r.w && r.x < rect.x + rect.w && rect.y < r.y + r.h && r.y < rect.y + rect.h) {
              rect.y = r.y - rect.h - 4;
              moved = true;
            }
          }
        }
        placed.push(rect);
        // fade out over the last half second
        ctx.globalAlpha = Math.min(1, (bubble.until - now) / 500);
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "rgba(20,20,28,0.25)";
        ctx.beginPath();
        ctx.roundRect(rect.x, rect.y, w, h, 8);
        if (rect.y + h === tip) {
          ctx.moveTo(cx - 5, tip);
          ctx.lineTo(cx, tip + 6);
          ctx.lineTo(cx + 5, tip);
        }
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#1a1d24";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        lines.forEach((l, i) => ctx.fillText(l, cx, rect.y + 5 + i * 15));
        ctx.globalAlpha = 1;
      }
    };

    const drawEmotes = (ctx: CanvasRenderingContext2D, speakers: [string, Actor][], now: number) => {
      for (const [id, a] of speakers) {
        const emote = emotesRef.current.get(id);
        if (!emote) continue;
        const t = (now - emote.start) / EMOTE_MS;
        if (t >= 1) { emotesRef.current.delete(id); continue; }
        // pop in, drift upward, fade out over the last 30%
        const pop = Math.min(1, (now - emote.start) / 150);
        ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
        ctx.font = `${Math.round(18 + 10 * pop)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        // just past the right end of the name tag
        ctx.save();
        ctx.font = "bold 11px ui-sans-serif, system-ui, sans-serif";
        const tagHalf = ctx.measureText(a.name).width / 2 + 5;
        ctx.restore();
        ctx.fillText(emote.emoji, a.rx * TILE + TILE / 2 + tagHalf + 14, a.ry * TILE - 22 - t * 22);
        ctx.globalAlpha = 1;
      }
    };

    let lastPlaceCheck = 0;
    let lastMinimap = 0;
    const drawMinimap = (self: Actor) => {
      const mini = minimapRef.current;
      const bg = backgroundRef.current;
      if (!mini || !bg) return;
      const dpr = window.devicePixelRatio || 1;
      const w = MINIMAP_W, h = Math.round(MINIMAP_W * dims.h / dims.w);
      if (mini.width !== w * dpr) { mini.width = w * dpr; mini.height = h * dpr; }
      const m = mini.getContext("2d")!;
      m.setTransform(dpr, 0, 0, dpr, 0, 0);
      m.imageSmoothingEnabled = true;
      m.drawImage(bg, 0, 0, w, h);
      const sx = w / dims.w, sy = h / dims.h;
      for (const a of othersRef.current.values()) {
        m.fillStyle = "#f8fafc";
        m.beginPath(); m.arc((a.rx + 0.5) * sx, (a.ry + 0.5) * sy, 3, 0, Math.PI * 2); m.fill();
        m.strokeStyle = "#0f172a"; m.lineWidth = 1; m.stroke();
      }
      m.fillStyle = "#22c55e";
      m.beginPath(); m.arc((self.rx + 0.5) * sx, (self.ry + 0.5) * sy, 4, 0, Math.PI * 2); m.fill();
      m.strokeStyle = "#ffffff"; m.lineWidth = 1.5; m.stroke();
    };

    const tick = (now: number) => {
      const dt = Math.min(now - last, 100);
      last = now;
      const canvas = canvasRef.current;
      const self = selfRef.current;
      if (!canvas || !self) { raf = requestAnimationFrame(tick); return; }

      // step the local player one tile at a time while a direction key is held (or was just tapped)
      const arrived = Math.abs(self.rx - self.x) < 0.05 && Math.abs(self.ry - self.y) < 0.05;
      const canStep = arrived && now - lastStepRef.current >= STEP_MS;
      const dir = canStep ? (tapsRef.current.shift() ?? heldRef.current[0]) : undefined;
      if (dir) {
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
      const speakers: [string, Actor][] = [[selfId, self], ...othersRef.current.entries()];
      drawBubbles(ctx, speakers, now);
      drawEmotes(ctx, speakers, now);
      ctx.restore();

      // HUD updates that don't need 60fps
      if (now - lastPlaceCheck > 250) {
        lastPlaceCheck = now;
        setPlace(nearestPlace(places, self.x, self.y));
      }
      if (now - lastMinimap > 100) {
        lastMinimap = now;
        drawMinimap(self);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dims, loadingArt, isWalkable, sprites, moveUser, selfId, places]);

  if (error) return <div className="text-center p-8 text-red-500">{error}</div>;
  if (!space) return <div className="text-center p-8">Loading space...</div>;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#2f3b2a]">
      <div className="absolute left-4 top-4 z-20 flex max-w-[calc(100%-2rem)] flex-wrap items-start gap-2">
        <div className="rounded-lg bg-black/60 px-4 py-3 text-white shadow-lg">
          <h2 className="text-lg font-bold">{space.name}</h2>
          <p className="text-sm opacity-80">{users.size + 1} online · WASD to move · Enter to chat · 1–6 emotes · M map</p>
        </div>
        <button
          type="button"
          onClick={copyInvite}
          className="flex h-10 items-center gap-2 rounded-lg bg-black/60 px-3 text-sm font-semibold text-white shadow-lg transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          {copied ? <Check className="size-4 text-emerald-300" /> : <Link2 className="size-4" />}
          {copied ? 'Link copied' : 'Invite'}
        </button>
        <AvatarPicker
          currentUrl={selfAvatarUrl}
          onSaved={() => announceAvatarChange()}
          trigger={
            <button
              type="button"
              className="flex h-10 items-center gap-1.5 overflow-hidden rounded-lg bg-black/60 pl-1 pr-3 text-sm font-semibold text-white shadow-lg transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              {/* head-and-shoulders crop of the current avatar */}
              <span className="relative size-8 overflow-hidden rounded-md bg-emerald-100/90">
                <AvatarSprite url={selfAvatar} className="absolute -left-6 -top-3" />
              </span>
              Avatar
            </button>
          }
        />
      </div>
      {place && (
        <div aria-live="polite" className="pointer-events-none absolute right-4 top-4 z-20 flex items-center gap-1.5 rounded-full bg-black/60 px-4 py-1.5 text-sm font-medium text-white shadow-lg">
          <MapPin className="size-4 text-emerald-300" /> Near {place}
        </div>
      )}
      <div role="toolbar" aria-label="Voice, video and emotes" className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 gap-1 rounded-xl bg-black/75 p-1.5 shadow-lg backdrop-blur-sm">
        <MediaControls micOn={media.micOn} camOn={media.camOn} onMic={media.toggleMic} onCam={media.toggleCam} />
        {EMOTES.map((e, i) => (
          <button
            key={e.id}
            type="button"
            onClick={() => sendEmote(e.id)}
            title={`${e.label} (${i + 1})`}
            aria-label={`${e.label}, key ${i + 1}`}
            className="relative flex size-10 items-center justify-center rounded-lg text-xl transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            {e.emoji}
            <span className="absolute bottom-0.5 right-1 text-[9px] font-semibold text-white/50">{i + 1}</span>
          </button>
        ))}
      </div>
      <div className="absolute bottom-4 right-4 z-30 flex flex-col items-end gap-2">
        {showMinimap && (
          <canvas
            ref={minimapRef}
            aria-label="Minimap"
            className="rounded-lg border-2 border-black/40 shadow-xl"
            style={{ width: MINIMAP_W, height: dims ? Math.round(MINIMAP_W * dims.h / dims.w) : 0 }}
          />
        )}
        <button
          type="button"
          onClick={() => setShowMinimap((v) => !v)}
          aria-pressed={showMinimap}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-black/60 px-3 text-xs font-semibold text-white shadow-lg hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <MapIcon className="size-3.5" /> {showMinimap ? 'Hide map' : 'Show map'} (M)
        </button>
      </div>
      {loadingArt && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-white">Loading map...</div>
      )}
      <ChatPanel />
      <MediaDock
        remote={media.remote}
        names={names}
        localStream={media.localStream}
        camOn={media.camOn}
        micOn={media.micOn}
        nearbyCount={media.nearbyCount}
        error={media.mediaError}
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" style={{ imageRendering: "pixelated" }} />
    </div>
  );
};

export default SpaceGrid;
