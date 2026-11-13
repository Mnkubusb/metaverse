"use client"
import { useEffect, useRef } from 'react';
import { useState } from 'react';
import { Maximize2, Mic, MicOff, Minimize2, MonitorUp, MonitorX, ScreenShare, Video, VideoOff, Volume2 } from 'lucide-react';
import type { RemoteMedia } from '@/lib/useProximityMedia';
import { HEAR_RANGE } from '@/lib/useProximityMedia';
import { cn } from '@/lib/utils';

function StreamVideo({ stream, muted, mirrored, className }: { stream: MediaStream; muted?: boolean; mirrored?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={cn('h-full w-full object-cover', mirrored && '-scale-x-100', className)}
    />
  );
}

function StreamAudio({ stream, volume }: { stream: MediaStream; volume: number }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  useEffect(() => {
    if (ref.current) ref.current.volume = volume;
  }, [volume]);
  return <audio ref={ref} autoPlay />;
}

export function MediaControls({ micOn, camOn, onMic, onCam, sharing, onShare }: {
  micOn: boolean;
  camOn: boolean;
  onMic: () => void;
  onCam: () => void;
  sharing?: boolean;
  onShare?: () => void;
}) {
  const btn = 'flex size-10 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70';
  return (
    <>
      <button type="button" onClick={onMic} aria-pressed={micOn} aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
        title={micOn ? 'Mute microphone' : 'Talk to people near you'}
        className={cn(btn, micOn ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'text-white/80 hover:bg-white/15')}>
        {micOn ? <Mic className="size-5" /> : <MicOff className="size-5" />}
      </button>
      <button type="button" onClick={onCam} aria-pressed={camOn} aria-label={camOn ? 'Turn camera off' : 'Turn camera on'}
        title={camOn ? 'Turn camera off' : 'Show your camera to people near you'}
        className={cn(btn, camOn ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'text-white/80 hover:bg-white/15')}>
        {camOn ? <Video className="size-5" /> : <VideoOff className="size-5" />}
      </button>
      {onShare && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia && (
        <button type="button" onClick={onShare} aria-pressed={!!sharing} aria-label={sharing ? 'Stop sharing your screen' : 'Share your screen'}
          title={sharing ? 'Stop sharing your screen' : 'Share your screen with everyone in this room'}
          className={cn(btn, sharing ? 'bg-sky-500 text-white hover:bg-sky-600' : 'text-white/80 hover:bg-white/15')}>
          {sharing ? <MonitorX className="size-5" /> : <MonitorUp className="size-5" />}
        </button>
      )}
      <span aria-hidden className="mx-1 w-px self-stretch bg-white/15" />
    </>
  );
}

// A shared screen: a large panel at the top of the map, expandable to fill the view.
function ScreenStage({ stream, name, self, onStop }: { stream: MediaStream; name: string; self: boolean; onStop?: () => void }) {
  const [big, setBig] = useState(false);
  return (
    <>
      {big && <div aria-hidden className="absolute inset-0 z-[39] bg-[#05080a]/80 backdrop-blur-[2px] animate-in fade-in-0 duration-300" onClick={() => setBig(false)} />}
      <figure
        aria-label={self ? 'Your shared screen' : `${name}'s shared screen`}
        className={cn('absolute z-[40] flex flex-col overflow-hidden rounded-2xl hud transition-[left,top,width,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
          big ? 'left-1/2 top-1/2 w-[min(1200px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2'
            : 'right-4 top-16 w-[min(440px,calc(100%-2rem))] translate-x-0 translate-y-0')}
      >
        <figcaption className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white">
          <ScreenShare className="size-4 text-sky-300" />
          <span className="min-w-0 flex-1 truncate">{self ? 'You are presenting to this room' : `${name} is presenting`}</span>
          {self && onStop && (
            <button type="button" onClick={onStop} className="rounded-md bg-rose-500 px-2 py-1 text-[11px] font-bold text-white hover:bg-rose-600">Stop</button>
          )}
          <button type="button" onClick={() => setBig((b) => !b)} aria-label={big ? 'Make smaller' : 'Make bigger'}
            className="hud-btn flex size-7 items-center justify-center text-white/80 hover:text-white">
            {big ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
        </figcaption>
        <div className="aspect-video w-full bg-black">
          {/* your own screen is not played back with sound (it would echo) */}
          <StreamVideo stream={stream} muted={self} className="object-contain" />
        </div>
      </figure>
    </>
  );
}

// Video tiles for nearby players (and yourself when your camera is on), plus their audio.
export default function MediaDock({ remote, names, localStream, camOn, micOn, nearbyCount, error, screenStream, sharing, onStopSharing }: {
  remote: RemoteMedia[];
  names: Map<string, string>;
  localStream: MediaStream;
  camOn: boolean;
  micOn: boolean;
  nearbyCount: number;
  error: string;
  screenStream?: MediaStream | null;
  sharing?: boolean;
  onStopSharing?: () => void;
}) {
  const presenter = remote.find((r) => r.screen);
  const videos = remote.filter((r) => r.hasVideo);
  const voices = remote.filter((r) => r.hasAudio && !r.hasVideo);

  return (
    <>
      {remote.map((r) => <StreamAudio key={r.userId} stream={r.stream} volume={r.volume} />)}
      {sharing && screenStream ? (
        <ScreenStage stream={screenStream} name="You" self onStop={onStopSharing} />
      ) : presenter?.screen ? (
        <ScreenStage key={presenter.userId} stream={presenter.screen} name={names.get(presenter.userId) ?? 'Player'} self={false} />
      ) : null}

      {(camOn || videos.length > 0 || voices.length > 0) && (
        <div aria-label="Nearby video" className="pointer-events-none absolute left-1/2 top-20 z-20 flex max-w-[70%] -translate-x-1/2 flex-wrap justify-center gap-2">
          {camOn && (
            <figure className="relative h-[90px] w-[120px] overflow-hidden rounded-lg border-2 border-emerald-400 bg-black shadow-lg">
              <StreamVideo stream={localStream} muted mirrored />
              <figcaption className="absolute bottom-1 left-1 rounded hud px-1.5 text-[11px] font-semibold text-white">You</figcaption>
            </figure>
          )}
          {videos.map((r) => (
            <figure key={r.userId} className="relative h-[90px] w-[120px] overflow-hidden rounded-lg border-2 border-white/30 bg-black shadow-lg"
              style={{ opacity: 0.45 + 0.55 * r.volume }}>
              <StreamVideo stream={r.stream} muted />
              <figcaption className="absolute bottom-1 left-1 flex items-center gap-1 rounded hud px-1.5 text-[11px] font-semibold text-white">
                {r.hasAudio && <Volume2 className="size-3" />}{names.get(r.userId) ?? 'Player'}
              </figcaption>
            </figure>
          ))}
          {voices.map((r) => (
            <span key={r.userId} className="flex h-8 items-center gap-1.5 self-end rounded-full hud px-3 text-xs font-semibold text-white">
              <Volume2 className="size-3.5 text-emerald-300" /> {names.get(r.userId) ?? 'Player'}
            </span>
          ))}
        </div>
      )}

      {(micOn || camOn || error) && !sharing && (
        <p role="status" className={cn(
          'pointer-events-none absolute bottom-[4.5rem] left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium',
          error ? 'bg-red-600/90 text-white' : 'hud text-white/90',
        )}>
          {error || (nearbyCount === 0
            ? `Walk within ${HEAR_RANGE} tiles of someone to talk`
            : `${nearbyCount} ${nearbyCount === 1 ? 'person' : 'people'} nearby can ${camOn ? 'see and hear' : 'hear'} you`)}
        </p>
      )}
    </>
  );
}
