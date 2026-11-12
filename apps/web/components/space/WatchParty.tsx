"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Clapperboard, Maximize2, Minimize2, Pause, Play, Square, Volume2, VolumeX, X } from 'lucide-react';
import { useWebSocket, WatchState } from '@/contexts/WebSocketsContexts';
import { cn } from '@/lib/utils';

// Watch parties ("Netflix and chill"): a YouTube video or video file playing on a screen in the
// space, in sync for everyone. The server holds the state (apps/ws/src/watch.ts); this panel
// follows it, and its controls send changes back instead of driving the player directly.

const DRIFT_S = 1.5;

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
  if (typeof window === 'undefined') return Promise.reject();
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

// Minimal player interface over the YouTube player and <video>
interface Player {
  time(): number;
  duration(): number;
  isPlaying(): boolean;
  play(): Promise<boolean>;
  pause(): void;
  seek(t: number): void;
  setMuted(m: boolean): void;
  setVolume(v: number): void;
  destroy(): void;
}

function useScreenPlayer(state: WatchState | null, host: React.RefObject<HTMLDivElement | null>, muted: boolean, volume: number) {
  const player = useRef<Player | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [tick, setTick] = useState(0);
  const source = state ? `${state.youtubeId ?? state.url}` : '';
  const stateRef = useRef(state);
  stateRef.current = state;

  const sync = useCallback(async () => {
    const p = player.current, s = stateRef.current;
    if (!p || !s) return;
    const want = expectedPosition(s);
    if (Math.abs(p.time() - want) > DRIFT_S) p.seek(want);
    if (s.playing && !p.isPlaying()) setBlocked(!(await p.play()));
    if (!s.playing && p.isPlaying()) p.pause();
  }, []);

  // (re)create the player when the video changes
  useEffect(() => {
    const el = host.current;
    if (!el || !state) return;
    let cancelled = false;
    el.innerHTML = '';
    const mount = document.createElement('div');
    mount.className = 'size-full';
    el.appendChild(mount);
    if (state.youtubeId) {
      loadYouTube().then((YT) => {
        if (cancelled) return;
        let yt: any;
        const ready = new Promise<void>((resolve) => {
          yt = new YT.Player(mount, {
            videoId: state.youtubeId,
            width: '100%', height: '100%',
            playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1, iv_load_policy: 3, start: Math.floor(expectedPosition(state)) },
            events: { onReady: () => resolve(), onStateChange: () => setTick((t) => t + 1) },
          });
        });
        ready.then(() => {
          if (cancelled) return;
          player.current = {
            time: () => yt.getCurrentTime?.() ?? 0,
            duration: () => yt.getDuration?.() ?? 0,
            isPlaying: () => yt.getPlayerState?.() === 1 || yt.getPlayerState?.() === 3,
            play: async () => {
              yt.playVideo();
              await new Promise((r) => setTimeout(r, 700));
              return yt.getPlayerState?.() === 1 || yt.getPlayerState?.() === 3;
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
      v.className = 'size-full bg-black object-contain';
      v.onplay = v.onpause = v.onseeked = () => setTick((t) => t + 1);
      mount.appendChild(v);
      player.current = {
        time: () => v.currentTime,
        duration: () => v.duration || 0,
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
  useEffect(() => { player.current?.setMuted(muted); }, [muted, tick]);
  useEffect(() => { player.current?.setVolume(volume); }, [volume, tick]);

  const join = async () => {
    const p = player.current;
    if (!p) return;
    p.setMuted(false);
    setBlocked(!(await p.play()));
  };
  return { player, blocked, join, tick };
}

export default function WatchParty({ screenId, label, onClose }: { screenId: string; label: string; onClose: () => void }) {
  const { watching, sendWatch } = useWebSocket();
  const state = watching.get(screenId) ?? null;
  const host = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.9);
  const [mini, setMini] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [scrub, setScrub] = useState<number | null>(null);
  const { player, blocked, join } = useScreenPlayer(state, host, muted, volume);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !mini) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, mini]);

  const load = (e: React.FormEvent) => {
    e.preventDefault();
    const link = url.trim();
    if (!/youtu\.?be|\.(mp4|webm|ogg|m4v)(\?|$)/i.test(link)) {
      setError('Paste a YouTube link, or an https link to an .mp4 or .webm video.');
      return;
    }
    setError('');
    sendWatch(screenId, { action: 'load', url: link });
    setUrl('');
  };

  const now = player.current?.time() ?? (state ? expectedPosition(state) : 0);
  const duration = player.current?.duration() ?? 0;
  const position = scrub ?? now;

  return (
    <>
      {!mini && <div aria-hidden className="absolute inset-0 z-30 bg-[#05080a]/75 backdrop-blur-[2px] transition-opacity" onClick={onClose} />}
      <section
        aria-label={`Watch party on the ${label}`}
        className={cn('absolute z-[35] flex flex-col overflow-hidden hud rounded-2xl text-white',
          mini ? 'right-4 top-20 w-[min(360px,calc(100%-2rem))]'
            // big: centred; on wide screens it sits right of the chat so you can talk while you watch
            : 'left-1/2 top-1/2 max-h-[calc(100%-2rem)] w-[min(960px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto lg:left-[calc(50%+190px)] lg:w-[min(960px,calc(100%-440px))]')}
      >
        <header className="flex items-center gap-2 px-4 py-2.5">
          <Clapperboard className="size-4 text-emerald-300" />
          <h2 className="min-w-0 flex-1 truncate text-sm font-bold">
            {state ? <>Watching together on the {label}<span className="font-normal text-white/55"> · started by {state.by}</span></> : `Watch together on the ${label}`}
          </h2>
          <button type="button" onClick={() => setMini((m) => !m)} aria-label={mini ? 'Make bigger' : 'Shrink to a corner and keep walking'} title={mini ? 'Make bigger' : 'Shrink and keep walking'}
            className="hud-btn flex size-8 items-center justify-center text-white/75 hover:text-white">
            {mini ? <Maximize2 className="size-4" /> : <Minimize2 className="size-4" />}
          </button>
          <button type="button" onClick={onClose} aria-label="Close" className="hud-btn flex size-8 items-center justify-center text-white/75 hover:text-white">
            <X className="size-4" />
          </button>
        </header>

        <div className="relative aspect-video w-full bg-black">
          <div ref={host} className="absolute inset-0 [&_iframe]:pointer-events-none" />
          {!state && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
              <Clapperboard className="size-10 text-white/30" />
              <p className="font-pixel text-3xl leading-none">Nothing playing yet</p>
              <p className="max-w-[44ch] text-sm text-white/60">Paste a YouTube link below. Everyone in this space who opens the screen watches it with you, in sync.</p>
            </div>
          )}
          {state && blocked && (
            <button type="button" onClick={join}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-white">
              <span className="flex size-16 items-center justify-center rounded-full bg-emerald-400 text-[#06281c]"><Play className="size-7 translate-x-0.5" /></span>
              <span className="font-bold">Join the watch party</span>
            </button>
          )}
        </div>

        {state && (
          <div className="flex items-center gap-3 px-4 pt-3">
            <button type="button" aria-label={state.playing ? 'Pause for everyone' : 'Play for everyone'}
              onClick={() => sendWatch(screenId, { action: state.playing ? 'pause' : 'play', position: now })}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-[#06281c] transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200">
              {state.playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
            </button>
            <span className="w-24 shrink-0 text-xs tabular-nums text-white/70">{fmt(position)} / {fmt(duration)}</span>
            <input
              type="range" min={0} max={Math.max(1, duration)} step={1} value={Math.min(position, duration || position)}
              aria-label="Seek for everyone"
              onChange={(e) => setScrub(Number(e.target.value))}
              onPointerUp={() => { if (scrub !== null) sendWatch(screenId, { action: 'seek', position: scrub }); setScrub(null); }}
              onKeyUp={() => { if (scrub !== null) sendWatch(screenId, { action: 'seek', position: scrub }); setScrub(null); }}
              className="h-1.5 min-w-0 flex-1 cursor-pointer accent-emerald-400"
            />
            <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Unmute' : 'Mute'} className="hud-btn flex size-8 shrink-0 items-center justify-center text-white/80">
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
            {!mini && (
              <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))}
                aria-label="Your volume" className="h-1.5 w-20 shrink-0 cursor-pointer accent-emerald-400" />
            )}
            <button type="button" onClick={() => sendWatch(screenId, { action: 'stop' })} aria-label="Stop for everyone" title="Stop for everyone"
              className="hud-btn flex size-8 shrink-0 items-center justify-center text-white/70 hover:text-red-300">
              <Square className="size-3.5" />
            </button>
          </div>
        )}

        {!mini && (
          <form onSubmit={load} className="flex items-center gap-2 p-4">
            <label htmlFor="watch-url" className="sr-only">Video link</label>
            <input id="watch-url" value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="off"
              placeholder={state ? 'Play something else: paste a YouTube link' : 'https://www.youtube.com/watch?v=…'}
              className="h-10 min-w-0 flex-1 rounded-lg bg-white/10 px-3 text-sm text-white placeholder:text-white/40 outline-none focus:bg-white/15 focus:ring-2 focus:ring-emerald-300/50" />
            <button type="submit" disabled={!url.trim()}
              className="h-10 shrink-0 rounded-lg bg-emerald-400 px-4 text-sm font-bold text-[#06281c] transition hover:bg-emerald-300 disabled:bg-white/10 disabled:text-white/40">
              {state ? 'Play for everyone' : 'Start watch party'}
            </button>
          </form>
        )}
        {error && !mini && <p role="alert" className="-mt-2 px-4 pb-3 text-xs text-red-300">{error}</p>}
      </section>
    </>
  );
}
