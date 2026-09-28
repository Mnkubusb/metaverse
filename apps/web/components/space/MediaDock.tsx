"use client"
import { useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, Volume2 } from 'lucide-react';
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

export function MediaControls({ micOn, camOn, onMic, onCam }: {
  micOn: boolean;
  camOn: boolean;
  onMic: () => void;
  onCam: () => void;
}) {
  const btn = 'flex size-10 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60';
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
      <span aria-hidden className="mx-1 w-px self-stretch bg-white/15" />
    </>
  );
}

// Video tiles for nearby players (and yourself when your camera is on), plus their audio.
export default function MediaDock({ remote, names, localStream, camOn, micOn, nearbyCount, error }: {
  remote: RemoteMedia[];
  names: Map<string, string>;
  localStream: MediaStream;
  camOn: boolean;
  micOn: boolean;
  nearbyCount: number;
  error: string;
}) {
  const videos = remote.filter((r) => r.hasVideo);
  const voices = remote.filter((r) => r.hasAudio && !r.hasVideo);

  return (
    <>
      {remote.map((r) => <StreamAudio key={r.userId} stream={r.stream} volume={r.volume} />)}

      {(camOn || videos.length > 0 || voices.length > 0) && (
        <div aria-label="Nearby video" className="pointer-events-none absolute left-1/2 top-20 z-20 flex max-w-[70%] -translate-x-1/2 flex-wrap justify-center gap-2">
          {camOn && (
            <figure className="relative h-[90px] w-[120px] overflow-hidden rounded-lg border-2 border-emerald-400 bg-black shadow-lg">
              <StreamVideo stream={localStream} muted mirrored />
              <figcaption className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[11px] font-semibold text-white">You</figcaption>
            </figure>
          )}
          {videos.map((r) => (
            <figure key={r.userId} className="relative h-[90px] w-[120px] overflow-hidden rounded-lg border-2 border-white/30 bg-black shadow-lg"
              style={{ opacity: 0.45 + 0.55 * r.volume }}>
              <StreamVideo stream={r.stream} muted />
              <figcaption className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/60 px-1.5 text-[11px] font-semibold text-white">
                {r.hasAudio && <Volume2 className="size-3" />}{names.get(r.userId) ?? 'Player'}
              </figcaption>
            </figure>
          ))}
          {voices.map((r) => (
            <span key={r.userId} className="flex h-8 items-center gap-1.5 self-end rounded-full bg-black/60 px-3 text-xs font-semibold text-white shadow-lg">
              <Volume2 className="size-3.5 text-emerald-300" /> {names.get(r.userId) ?? 'Player'}
            </span>
          ))}
        </div>
      )}

      {(micOn || camOn || error) && (
        <p role="status" className={cn(
          'pointer-events-none absolute bottom-[4.5rem] left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium shadow-lg',
          error ? 'bg-red-600/90 text-white' : 'bg-black/60 text-white/90',
        )}>
          {error || (nearbyCount === 0
            ? `Walk within ${HEAR_RANGE} tiles of someone to talk`
            : `${nearbyCount} ${nearbyCount === 1 ? 'person' : 'people'} nearby can ${camOn ? 'see and hear' : 'hear'} you`)}
        </p>
      )}
    </>
  );
}
