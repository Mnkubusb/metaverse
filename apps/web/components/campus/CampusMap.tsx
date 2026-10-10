"use client";
import { CSSProperties, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

// The seeded GEC Bilaspur map, generated from OSM data by tools/campus-map/generate.py.
const MAP_URL = '/campus/overview.png';
const MAP_W = 176;
const MAP_H = 171;

// Avatar sheets: 5x5 grid of 80px frames, 6 frames per direction (same layout spaceGrid.tsx draws).
const SHEET_COLS = 5;
const DIR_BASE = { down: 0, right: 6, left: 12, up: 18 } as const;
type Direction = keyof typeof DIR_BASE;
// Drawn a little larger than in-game (2 tiles) so they read at landing-page zoom.
const WALKER_TILES = 3;

type Walker = {
  avatar: string;
  // tile coordinates of the walker's feet; the route is walked there and back
  route: [number, number][];
  speed: number; // tiles per second
  start: number; // seconds into the route, so walkers don't move in lockstep
};

// Routes follow real footpaths and roads on the map.
const WALKERS: Walker[] = [
  { avatar: '/avatars/cse-blue.png', route: [[44, 70.6], [70, 70.6]], speed: 2.1, start: 3 },
  { avatar: '/avatars/rose.png', route: [[70, 69.6], [53, 69.6]], speed: 1.8, start: 6 },
  { avatar: '/avatars/forest.png', route: [[43.5, 9], [43.5, 30]], speed: 1.6, start: 0 },
  { avatar: '/avatars/violet.png', route: [[34.5, 79], [34.5, 99]], speed: 1.9, start: 4 },
  { avatar: '/avatars/crimson.png', route: [[72.5, 94], [72.5, 76]], speed: 2.3, start: 1 },
  { avatar: '/avatars/teal.png', route: [[13, 105.6], [21, 105.6]], speed: 2.6, start: 12 },
  { avatar: '/avatars/classic.png', route: [[71.5, 88], [71.5, 70], [60, 70]], speed: 1.5, start: 2 },
];

function routeLength(route: [number, number][]) {
  let len = 0;
  for (let i = 1; i < route.length; i++) {
    len += Math.abs(route[i]![0] - route[i - 1]![0]) + Math.abs(route[i]![1] - route[i - 1]![1]);
  }
  return len;
}

// Where a walker is `d` tiles along its route, and which way it faces.
function pointAt(route: [number, number][], d: number): { x: number; y: number; dir: Direction } {
  for (let i = 1; i < route.length; i++) {
    const [ax, ay] = route[i - 1]!;
    const [bx, by] = route[i]!;
    const seg = Math.abs(bx - ax) + Math.abs(by - ay);
    if (d <= seg || i === route.length - 1) {
      const t = seg === 0 ? 0 : Math.min(d / seg, 1);
      const dir: Direction = bx > ax ? 'right' : bx < ax ? 'left' : by > ay ? 'down' : 'up';
      return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, dir };
    }
    d -= seg;
  }
  const [x, y] = route[0]!;
  return { x, y, dir: 'down' };
}

const FLIP: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };

function frameStyle(frame: number) {
  const col = frame % SHEET_COLS;
  const row = Math.floor(frame / SHEET_COLS);
  return `${col * 25}% ${row * 25}%`;
}

function Walkers({ still }: { still: boolean }) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const place = (i: number, x: number, y: number, frame: number) => {
      const el = refs.current[i];
      if (!el) return;
      el.style.left = `${((x - WALKER_TILES / 2) / MAP_W) * 100}%`;
      el.style.top = `${((y - WALKER_TILES * 0.92) / MAP_H) * 100}%`;
      el.style.backgroundPosition = frameStyle(frame);
    };

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (still || reduce.matches) {
      WALKERS.forEach((w, i) => {
        const p = pointAt(w.route, w.start * w.speed);
        place(i, p.x, p.y, DIR_BASE.down);
      });
      return;
    }

    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = (now - t0) / 1000;
      WALKERS.forEach((w, i) => {
        const len = routeLength(w.route);
        const d = ((t + w.start) * w.speed) % (len * 2);
        const back = d > len;
        const p = pointAt(w.route, back ? len * 2 - d : d);
        const dir = back ? FLIP[p.dir] : p.dir;
        place(i, p.x, p.y, DIR_BASE[dir] + (Math.floor(now / 110) % 6));
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [still]);

  return (
    <>
      {WALKERS.map((w, i) => (
        <div
          key={w.avatar}
          ref={(el) => { refs.current[i] = el; }}
          aria-hidden
          className="absolute [image-rendering:pixelated] bg-no-repeat"
          style={{
            width: `${(WALKER_TILES / MAP_W) * 100}%`,
            height: `${(WALKER_TILES / MAP_H) * 100}%`,
            backgroundImage: `url("${w.avatar}")`,
            backgroundSize: '500% 500%',
          }}
        />
      ))}
    </>
  );
}

/**
 * The campus map with students walking it.
 * - `drift`: fills its parent and pans slowly across the campus (the landing hero).
 * - `gate`: a fixed view of the map's bottom edge, centred horizontally on `focus`.
 */
export default function CampusMap({
  mode,
  focus = [MAP_W / 2, MAP_H / 2],
  className,
  still = false,
}: {
  mode: 'drift' | 'gate';
  focus?: [number, number];
  className?: string;
  still?: boolean;
}) {
  const style = mode === 'gate'
    ? ({ '--fx': focus[0] } as CSSProperties)
    : undefined;

  return (
    <div aria-hidden className={cn('absolute inset-0 overflow-hidden bg-[#8fd05a]', className)}>
      <div className={cn('campus-map absolute', mode === 'drift' ? 'campus-map--drift' : 'campus-map--gate')} style={style}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MAP_URL} alt="" draggable={false} className="absolute inset-0 size-full [image-rendering:pixelated] select-none" />
        <Walkers still={still} />
      </div>
    </div>
  );
}
