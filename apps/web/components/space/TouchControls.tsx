"use client"
import { useCallback, useEffect, useRef, useState } from 'react';

export type Direction = "down" | "right" | "left" | "up";

// Phones and tablets: no keyboard, so movement comes from an on-screen joystick.
export function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const update = () => setCoarse(mq.matches || navigator.maxTouchPoints > 0);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return coarse;
}

const SIZE = 140;      // pad diameter in CSS px
const KNOB = 60;
const DEAD_ZONE = 14;  // px from the centre before a direction registers

/**
 * A thumb joystick: drag anywhere on the pad and the knob follows, snapping the
 * direction to the dominant axis (the world is tile-based, so four ways is all we need).
 * Reports the held direction, or null when released.
 */
export default function Joystick({ onDirection }: { onDirection: (dir: Direction | null) => void }) {
  const padRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const lastDir = useRef<Direction | null>(null);

  const report = useCallback((dir: Direction | null) => {
    if (dir !== lastDir.current) {
      lastDir.current = dir;
      onDirection(dir);
    }
  }, [onDirection]);

  const update = useCallback((clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const r = pad.getBoundingClientRect();
    let dx = clientX - (r.left + r.width / 2);
    let dy = clientY - (r.top + r.height / 2);
    const max = r.width / 2 - KNOB / 2;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx *= max / len; dy *= max / len; }
    setKnob({ x: dx, y: dy });
    if (len < DEAD_ZONE) {
      report(null);
    } else if (Math.abs(dx) > Math.abs(dy)) {
      report(dx > 0 ? 'right' : 'left');
    } else {
      report(dy > 0 ? 'down' : 'up');
    }
  }, [report]);

  const release = useCallback(() => {
    setActive(false);
    setKnob({ x: 0, y: 0 });
    report(null);
  }, [report]);

  // released on unmount too, so a stuck direction can't keep the player walking
  useEffect(() => () => report(null), [report]);

  return (
    <div
      ref={padRef}
      role="application"
      aria-label="Joystick: drag to walk"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setActive(true);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => { if (active) update(e.clientX, e.clientY); }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      style={{ width: SIZE, height: SIZE, touchAction: 'none' }}
      className="relative select-none rounded-full border-2 border-white/25 bg-black/45 shadow-xl backdrop-blur-sm"
    >
      {/* direction hints */}
      {(['up', 'down', 'left', 'right'] as const).map((d) => (
        <span key={d} aria-hidden className={
          'absolute text-white/40 ' +
          (d === 'up' ? 'left-1/2 top-2 -translate-x-1/2' : d === 'down' ? 'bottom-2 left-1/2 -translate-x-1/2'
            : d === 'left' ? 'left-2 top-1/2 -translate-y-1/2' : 'right-2 top-1/2 -translate-y-1/2')
        }>
          {d === 'up' ? '▲' : d === 'down' ? '▼' : d === 'left' ? '◀' : '▶'}
        </span>
      ))}
      <div
        aria-hidden
        style={{ width: KNOB, height: KNOB, transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
        className={'absolute left-1/2 top-1/2 rounded-full border-2 border-white/60 shadow-lg transition-colors ' +
          (active ? 'bg-emerald-400/90' : 'bg-white/70')}
      />
    </div>
  );
}
