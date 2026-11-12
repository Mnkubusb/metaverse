"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Clapperboard, Pause, Play, Square, Volume2, VolumeX, X } from 'lucide-react';
import { useWebSocket, WatchState } from '@/contexts/WebSocketsContexts';
import type { ScreenSpot } from '@/lib/interactions';
import { cn } from '@/lib/utils';

// Watch parties: a YouTube video or video file playing on a screen in the space, in sync for
// everyone. The server holds the state (apps/ws/src/watch.ts); this component follows it.
//
// The video lives in ONE element that is either pinned over the screen in the room ("world":
// it moves with the camera, its sound fades with distance) or blown up into the theater view.
// Switching modes animates that same element between the two rectangles (FLIP), so playback
// never restarts and the picture visibly flies out of the screen and back into it.

const DRIFT_S = 1.5;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const FLIP_MS = 520;

export type Rect = { left: number; top: number; width: number; height: number };

export function expectedPosition(s: WatchState, now = Date.now()) {
  return s.playing ? s.position + (now - s.updatedAt) / 1000 : s.position;
}

function fmt(t: number) {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

let ytReady: Promise<any> | null = null;
function loadYouTube(): Promise<any> {
  const w = window as any;
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (!ytReady) {
    ytReady = new Promise((resolve) => {
      const prev = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => { prev?.(); resolve(w.YT); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      document.head.appendChild(s);
    });
  }
  return ytReady;
}

interface Player {
  time(): number;
  duration(): number;
  title(): string;
  isPlaying(): boolean;
  play(): Promise<boolean>;
  pause(): void;
  seek(t: number): void;
  setMuted(m: boolean): void;
  setVolume(v: number): void;
  destroy(): void;
}

// Creates the player inside `host` for the current video and keeps it in sync with `state`.
// Autoplay with sound can be refused by the browser; then it plays muted and `needsSound` is set.
function useScreenPlayer(state: WatchState | null, host: React.RefObject<HTMLDivElement | null>) {
  const player = useRef<Player | null>(null);
  const [needsSound, setNeedsSound] = useState(false);
  const [, setTick] = useState(0);
  const forcedMute = useRef(false);
  const source = state ? `${state.youtubeId ?? state.url}` : '';
  const stateRef = useRef(state);
  stateRef.current = state;

  const sync = useCallback(async () => {
    const p = player.current, s = stateRef.current;
    if (!p || !s) return;
    const want = expectedPosition(s);
    if (Math.abs(p.time() - want) > DRIFT_S) p.seek(want);
    if (s.playing && !p.isPlaying()) {
      if (!(await p.play())) {
        // no user gesture yet: start muted so the picture still runs on the screen
        forcedMute.current = true;
        p.setMuted(true);
        await p.play();
        setNeedsSound(true);
      }
    }
    if (!s.playing && p.isPlaying()) p.pause();
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!el || !state) return;
    let cancelled = false;
    el.innerHTML = '';
    const mount = document.createElement('div');
    mount.style.cssText = 'width:100%;height:100%';
    el.appendChild(mount);
    if (state.youtubeId) {
      loadYouTube().then((YT) => {
        if (cancelled) return;
        let yt: any;
        new Promise<void>((resolve) => {
          yt = new YT.Player(mount, {
            videoId: state.youtubeId,
            width: '100%', height: '100%',
            playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1, iv_load_policy: 3, fs: 0,
              start: Math.floor(expectedPosition(state)) },
            events: { onReady: () => resolve(), onStateChange: () => setTick((t) => t + 1) },
          });
        }).then(() => {
          if (cancelled) return;
          player.current = {
            time: () => yt.getCurrentTime?.() ?? 0,
            duration: () => yt.getDuration?.() ?? 0,
            title: () => yt.getVideoData?.()?.title ?? '',
            isPlaying: () => [1, 3].includes(yt.getPlayerState?.()),
            play: async () => {
              yt.playVideo();
              await new Promise((r) => setTimeout(r, 800));
              return [1, 3].includes(yt.getPlayerState?.());
            },
            pause: () => yt.pauseVideo(),
            seek: (t) => yt.seekTo(t, true),
            setMuted: (m) => (m ? yt.mute() : yt.unMute()),
            setVolume: (v) => yt.setVolume(Math.round(v * 100)),
            destroy: () => yt.destroy(),
          };
          sync();
        });
      });
    } else {
      const v = document.createElement('video');
      v.src = state.url;
      v.playsInline = true;
      v.style.cssText = 'width:100%;height:100%;background:#000;object-fit:contain';
      v.onplay = v.onpause = v.onseeked = () => setTick((t) => t + 1);
      mount.appendChild(v);
      player.current = {
        time: () => v.currentTime,
        duration: () => v.duration || 0,
        title: () => decodeURIComponent(state.url.split('/').pop()?.split('?')[0] ?? ''),
        isPlaying: () => !v.paused,
        play: () => v.play().then(() => true, () => false),
        pause: () => v.pause(),
        seek: (t) => { v.currentTime = t; },
        setMuted: (m) => { v.muted = m; },
        setVolume: (vol) => { v.volume = vol; },
        destroy: () => { v.pause(); v.removeAttribute('src'); v.load(); },
      };
      v.onloadedmetadata = () => sync();
    }
    return () => {
      cancelled = true;
      player.current?.destroy();
      player.current = null;
      el.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  useEffect(() => { sync(); }, [state, sync]);
  useEffect(() => {
    const id = setInterval(() => { sync(); setTick((t) => t + 1); }, 1000);
    return () => clearInterval(id);
  }, [sync]);

  // called from a click or key press, which lets the browser play sound
  const enableSound = useCallback(async () => {
    forcedMute.current = false;
    setNeedsSound(false);
    player.current?.setMuted(false);
    if (stateRef.current?.playing) await player.current?.play();
  }, []);

  return { player, needsSound, enableSound, forcedMute };
}

export default function WatchParty({ screen, mode, onModeChange, worldRect, proximity }: {
  screen: ScreenSpot;
  mode: 'world' | 'theater';
  onModeChange: (mode: 'world' | 'theater' | null) => void;
  // where the screen's picture is on the page right now (moves with the camera); null = off-screen
  worldRect: () => Rect | null;
  // 0..1, how loud the room's copy should be from where the player stands
  proximity: () => number;
}) {
  const { watching, sendWatch } = useWebSocket();
  const state = watching.get(screen.screenId) ?? null;
  const host = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const soundChip = useRef<HTMLButtonElement>(null);
  const { player, needsSound, enableSound, forcedMute } = useScreenPlayer(state, host);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.9);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [scrub, setScrub] = useState<number | null>(null);
  const theater = mode === 'theater';
  // the theater card stays mounted for its exit animation
  const [cardMounted, setCardMounted] = useState(theater);
  const [flying, setFlying] = useState(false);
  const lastRect = useRef<Rect | null>(null);
  const hasVideo = useRef(!!state);
  hasVideo.current = !!state;
  const flipFrom = useRef<Rect | null>(null);

  useEffect(() => {
    if (theater) { setCardMounted(true); return; }
    const t = setTimeout(() => setCardMounted(false), 320);
    return () => clearTimeout(t);
  }, [theater]);

  // remember where the picture was, so the next frame can animate from there
  useLayoutEffect(() => { flipFrom.current = lastRect.current; }, [theater]);

  // keep the picture glued to its target rectangle every frame
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = host.current;
      if (el) {
        let target: Rect | null = null;
        if (theater && slot.current && el.offsetParent) {
          const a = slot.current.getBoundingClientRect(), b = el.offsetParent.getBoundingClientRect();
          target = { left: a.left - b.left, top: a.top - b.top, width: a.width, height: a.height };
        } else if (!theater) {
          target = worldRect();
        }
        if (target && target.width > 2 && hasVideo.current) {
          el.style.visibility = 'visible';
          el.style.left = `${target.left}px`;
          el.style.top = `${target.top}px`;
          el.style.width = `${target.width}px`;
          el.style.height = `${target.height}px`;
          const from = flipFrom.current;
          if (from && from.width > 2) {
            flipFrom.current = null;
            setFlying(true);
            el.animate([
              { transform: `translate(${from.left - target.left}px, ${from.top - target.top}px) scale(${from.width / target.width}, ${from.height / target.height})`, borderRadius: theater ? '2px' : '14px' },
              { transform: 'none', borderRadius: theater ? '14px' : '2px' },
            ], { duration: FLIP_MS, easing: EASE }).finished.then(() => setFlying(false), () => setFlying(false));
          } else {
            flipFrom.current = null;
          }
          lastRect.current = target;
          const chip = soundChip.current;
          if (chip) {
            chip.style.left = `${target.left + target.width / 2}px`;
            chip.style.top = `${target.top + target.height + 8}px`;
          }
        } else {
          el.style.visibility = 'hidden';
          lastRect.current = null;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [theater, worldRect]);

  // loudness: your volume in the theater; in the room it fades with distance from the screen
  useEffect(() => {
    const id = setInterval(() => {
      const p = player.current;
      if (!p) return;
      const level = muted ? 0 : volume * (theater ? 1 : proximity());
      if (!forcedMute.current) p.setMuted(level === 0);
      p.setVolume(level);
    }, 250);
    return () => clearInterval(id);
  }, [muted, volume, theater, proximity, player, forcedMute]);

  useEffect(() => {
    if (!theater) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onModeChange(state ? 'world' : null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [theater, onModeChange, state]);

  // opening the theater is a click or key press: use it to turn the sound on
  useEffect(() => { if (theater && needsSound) enableSound(); }, [theater, needsSound, enableSound]);

  const load = (e: React.FormEvent) => {
    e.preventDefault();
    const link = url.trim();
    if (/netflix\.com|primevideo|hotstar|jiocinema|sonyliv/i.test(link)) {
      setError('Streaming services like Netflix block playing their shows on other websites. Use a YouTube link or a video file.');
      return;
    }
    if (!/youtu\.?be|\.(mp4|webm|ogg|m4v)(\?|$)/i.test(link)) {
      setError('Paste a YouTube link, or an https link to an .mp4 or .webm video.');
      return;
    }
    setError('');
    sendWatch(screen.screenId, { action: 'load', url: link });
    setUrl('');
  };

  const now = player.current?.time() ?? (state ? expectedPosition(state) : 0);
  const duration = player.current?.duration() ?? 0;
  const position = scrub ?? now;
  const title = player.current?.title() || (state?.youtubeId ? 'YouTube video' : 'Video');

  return (
    <>
      {/* lights down */}
      <div aria-hidden onClick={() => onModeChange(state ? 'world' : null)}
        className={cn('absolute inset-0 z-[38] bg-[radial-gradient(ellipse_at_center,rgb(8_10_14/0.72),rgb(3_4_6/0.94))] transition-opacity duration-500',
          theater ? 'opacity-100' : 'pointer-events-none opacity-0')} />

      {/* the picture: pinned to the screen in the room, or flown into the theater slot */}
      <div ref={host} aria-hidden={!theater}
        style={{ position: 'absolute', visibility: 'hidden', transformOrigin: '0 0' }}
        className={cn('overflow-hidden bg-black [&_iframe]:pointer-events-none',
          theater || flying ? 'z-[46] rounded-[14px] shadow-[0_30px_80px_-20px_rgb(0_0_0/0.8)]' : 'pointer-events-none z-[15] rounded-[2px]')} />

      {!theater && state && needsSound && (
        <button ref={soundChip} type="button" onClick={enableSound}
          style={{ position: 'absolute', transform: 'translateX(-50%)' }}
          className="z-[16] flex items-center gap-1.5 rounded-full hud px-3 py-1 text-xs font-semibold text-white animate-in fade-in-0 slide-in-from-top-1 duration-300">
          <VolumeX className="size-3.5" /> Tap for sound
        </button>
      )}

      {cardMounted && (
        <section
          aria-label={`Watch party on the ${screen.label}`}
          className={cn('absolute left-1/2 top-1/2 z-[45] flex max-h-[calc(100%-2rem)] w-[min(1000px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 overflow-y-auto text-white',
            'lg:left-[calc(50%+190px)] lg:w-[min(1000px,calc(100%-440px))]',
            'transition-[opacity,translate] duration-300 ease-out',
            theater ? 'opacity-100 animate-in fade-in-0 duration-300' : 'pointer-events-none opacity-0')}
        >
          <header className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-white/10"><Clapperboard className="size-4 text-emerald-300" /></span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-bold">{state ? title : `Watch together on the ${screen.label}`}</h2>
              <p className="truncate text-xs text-white/55">
                {state ? `On the ${screen.label} · started by ${state.by} · everyone here sees the same moment` : 'Pick a video and everyone in this space watches it with you, in sync.'}
              </p>
            </div>
            <button type="button" onClick={() => onModeChange(state ? 'world' : null)} aria-label="Back to the room (Esc)" title="Back to the room (Esc)"
              className="hud-btn flex size-9 items-center justify-center rounded-lg bg-white/10 text-white/80 hover:text-white">
              <X className="size-4" />
            </button>
          </header>

          {/* the video flies into this box */}
          <div ref={slot} className="relative aspect-video w-full rounded-[14px] bg-black/40 ring-1 ring-white/10">
            {!state && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
                <Clapperboard className="size-10 text-white/25" />
                <p className="font-pixel text-4xl leading-none">Lights down, screen&apos;s empty</p>
                <p className="max-w-[46ch] text-sm text-white/60">Paste a YouTube link below. It plays here and on the {screen.label} in the room for everyone nearby.</p>
              </div>
            )}
          </div>

          {state && (
            <div className="flex items-center gap-3 rounded-xl hud px-3 py-2">
              <button type="button" aria-label={state.playing ? 'Pause for everyone' : 'Play for everyone'}
                onClick={() => sendWatch(screen.screenId, { action: state.playing ? 'pause' : 'play', position: now })}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-[#06281c] transition hover:bg-emerald-300 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200">
                {state.playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
              </button>
              <span className="w-24 shrink-0 text-xs tabular-nums text-white/70">{fmt(position)} / {fmt(duration)}</span>
              <input
                type="range" min={0} max={Math.max(1, duration)} step={1} value={Math.min(position, duration || position)}
                aria-label="Seek for everyone"
                onChange={(e) => setScrub(Number(e.target.value))}
                onPointerUp={() => { if (scrub !== null) sendWatch(screen.screenId, { action: 'seek', position: scrub }); setScrub(null); }}
                onKeyUp={() => { if (scrub !== null) sendWatch(screen.screenId, { action: 'seek', position: scrub }); setScrub(null); }}
                className="h-1.5 min-w-0 flex-1 cursor-pointer accent-emerald-400"
              />
              <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Unmute' : 'Mute'} className="hud-btn flex size-8 shrink-0 items-center justify-center text-white/80">
                {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </button>
              <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))}
                aria-label="Your volume" className="h-1.5 w-20 shrink-0 cursor-pointer accent-emerald-400" />
              <button type="button" onClick={() => sendWatch(screen.screenId, { action: 'stop' })} aria-label="Stop for everyone" title="Stop for everyone"
                className="hud-btn flex size-8 shrink-0 items-center justify-center text-white/70 hover:text-red-300">
                <Square className="size-3.5" />
              </button>
            </div>
          )}

          <form onSubmit={load} className="flex items-center gap-2">
            <label htmlFor="watch-url" className="sr-only">Video link</label>
            <input id="watch-url" value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="off"
              placeholder={state ? 'Play something else: paste a YouTube link' : 'https://www.youtube.com/watch?v=…'}
              className="h-10 min-w-0 flex-1 rounded-lg bg-white/10 px-3 text-sm text-white placeholder:text-white/40 outline-none ring-1 ring-white/10 focus:bg-white/15 focus:ring-2 focus:ring-emerald-300/50" />
            <button type="submit" disabled={!url.trim()}
              className="h-10 shrink-0 rounded-lg bg-emerald-400 px-4 text-sm font-bold text-[#06281c] transition hover:bg-emerald-300 active:scale-[0.98] disabled:bg-white/10 disabled:text-white/40">
              {state ? 'Play for everyone' : 'Start the show'}
            </button>
          </form>
          {error && <p role="alert" className="-mt-1 text-xs text-red-300">{error}</p>}
        </section>
      )}
    </>
  );
}
