"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../contexts/WebSocketsContexts';

// Players within HEAR_RANGE tiles are connected; connections close past DROP_RANGE,
// so walking along the edge doesn't flap the connection on and off.
export const HEAR_RANGE = 4;
const DROP_RANGE = 6;
const CHECK_MS = 400;

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

interface Peer {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
}

export interface RemoteMedia {
  userId: string;
  stream: MediaStream;
  hasVideo: boolean;
  hasAudio: boolean;
  // 0..1, louder when closer
  volume: number;
}

type Position = { x: number; y: number };

/**
 * Proximity voice/video over peer-to-peer WebRTC. Signalling goes through the WebSocket server
 * ("rtc" messages); media never touches it. Uses the "perfect negotiation" pattern so either side
 * can (re)negotiate when tracks are added or removed without offer collisions.
 */
export function useProximityMedia(getSelfPosition: () => Position | null) {
  const { selfId, users, sendRtc, subscribeRtc } = useWebSocket();
  const peers = useRef<Map<string, Peer>>(new Map());
  const localStream = useRef<MediaStream>(new MediaStream());
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [remote, setRemote] = useState<Map<string, RemoteMedia>>(new Map());
  const [localVersion, setLocalVersion] = useState(0);
  const [nearbyCount, setNearbyCount] = useState(0);
  const usersRef = useRef(users);
  usersRef.current = users;

  const distanceTo = useCallback((userId: string) => {
    const me = getSelfPosition();
    const other = usersRef.current.get(userId);
    if (!me || !other) return Infinity;
    return Math.hypot(me.x - other.x, me.y - other.y);
  }, [getSelfPosition]);

  const refreshRemote = useCallback((userId: string, stream: MediaStream | null) => {
    setRemote((prev) => {
      const next = new Map(prev);
      if (!stream) {
        next.delete(userId);
        return next;
      }
      const live = (t: MediaStreamTrack) => t.readyState === 'live' && !t.muted;
      next.set(userId, {
        userId,
        stream,
        hasVideo: stream.getVideoTracks().some(live),
        hasAudio: stream.getAudioTracks().some(live),
        volume: prev.get(userId)?.volume ?? 1,
      });
      return next;
    });
  }, []);

  const closePeer = useCallback((userId: string, notify: boolean) => {
    const peer = peers.current.get(userId);
    if (!peer) return;
    peers.current.delete(userId);
    peer.pc.ontrack = peer.pc.onicecandidate = peer.pc.onnegotiationneeded = peer.pc.onconnectionstatechange = null;
    peer.pc.close();
    refreshRemote(userId, null);
    if (notify) sendRtc(userId, { bye: true });
  }, [refreshRemote, sendRtc]);

  const createPeer = useCallback((userId: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    // the peer with the larger id yields when both sides offer at once
    const peer: Peer = { pc, polite: selfId > userId, makingOffer: false, ignoreOffer: false };
    peers.current.set(userId, peer);

    localStream.current.getTracks().forEach((t) => pc.addTrack(t, localStream.current));

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) sendRtc(userId, { candidate: candidate.toJSON() });
    };
    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        sendRtc(userId, { description: pc.localDescription?.toJSON() });
      } catch (err) {
        console.warn('negotiation failed', err);
      } finally {
        peer.makingOffer = false;
      }
    };
    pc.ontrack = ({ track, streams }) => {
      const stream = streams[0] ?? new MediaStream([track]);
      // tracks fire "ended" when the connection closes; ignore events from peers we've already dropped
      const update = () => { if (peers.current.get(userId) === peer) refreshRemote(userId, stream); };
      track.onmute = track.onunmute = track.onended = update;
      stream.onremovetrack = update;
      update();
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') pc.restartIce();
    };
    return peer;
  }, [selfId, sendRtc, refreshRemote]);

  // incoming signalling
  useEffect(() => subscribeRtc(async (from, data: any) => {
    if (data?.bye) {
      closePeer(from, false);
      return;
    }
    let peer = peers.current.get(from);
    if (!peer) {
      // only accept connections from players who are (about to be) in range
      if (distanceTo(from) > DROP_RANGE || !data?.description) return;
      peer = createPeer(from);
    }
    const { pc } = peer;
    try {
      if (data.description) {
        const description = data.description as RTCSessionDescriptionInit;
        const collision = description.type === 'offer' && (peer.makingOffer || pc.signalingState !== 'stable');
        peer.ignoreOffer = !peer.polite && collision;
        if (peer.ignoreOffer) return;
        await pc.setRemoteDescription(description);
        if (description.type === 'offer') {
          await pc.setLocalDescription();
          sendRtc(from, { description: pc.localDescription?.toJSON() });
        }
      } else if (data.candidate) {
        try {
          await pc.addIceCandidate(data.candidate);
        } catch (err) {
          if (!peer.ignoreOffer) throw err;
        }
      }
    } catch (err) {
      console.warn('rtc signal failed', err);
    }
  }), [subscribeRtc, createPeer, closePeer, distanceTo, sendRtc]);

  // connect to players who come into range, drop the ones who walk away or leave
  useEffect(() => {
    if (!selfId) return;
    const timer = setInterval(() => {
      for (const userId of usersRef.current.keys()) {
        if (userId === selfId) continue;
        const d = distanceTo(userId);
        if (d <= HEAR_RANGE && !peers.current.has(userId)) createPeer(userId);
        else if (d > DROP_RANGE && peers.current.has(userId)) closePeer(userId, true);
      }
      for (const userId of [...peers.current.keys()]) {
        if (!usersRef.current.has(userId)) closePeer(userId, false);
      }
      setNearbyCount(peers.current.size);
      // quieter with distance: full volume up close, silent at the drop edge
      setRemote((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [id, media] of prev) {
          const volume = Math.max(0, Math.min(1, 1 - (distanceTo(id) - 1.5) / (DROP_RANGE - 1.5)));
          if (Math.abs(volume - media.volume) > 0.02) {
            next.set(id, { ...media, volume });
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, CHECK_MS);
    return () => clearInterval(timer);
  }, [selfId, distanceTo, createPeer, closePeer]);

  // close everything when leaving the space
  useEffect(() => () => {
    for (const id of [...peers.current.keys()]) closePeer(id, true);
    localStream.current.getTracks().forEach((t) => t.stop());
  }, [closePeer]);

  const setTrack = useCallback(async (kind: 'audio' | 'video', on: boolean) => {
    setMediaError('');
    const stream = localStream.current;
    if (!on) {
      for (const track of stream.getTracks().filter((t) => t.kind === kind)) {
        track.stop();
        stream.removeTrack(track);
        for (const { pc } of peers.current.values()) {
          const sender = pc.getSenders().find((s) => s.track === track);
          if (sender) pc.removeTrack(sender);
        }
      }
    } else {
      try {
        const media = await navigator.mediaDevices.getUserMedia(
          kind === 'audio'
            ? { audio: { echoCancellation: true, noiseSuppression: true } }
            : { video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15 } } },
        );
        for (const track of media.getTracks()) {
          stream.addTrack(track);
          for (const { pc } of peers.current.values()) pc.addTrack(track, stream);
        }
      } catch (err) {
        const name = (err as DOMException)?.name;
        setMediaError(name === 'NotAllowedError'
          ? `Allow ${kind === 'audio' ? 'microphone' : 'camera'} access in your browser to use it here.`
          : `No ${kind === 'audio' ? 'microphone' : 'camera'} found.`);
        return false;
      }
    }
    setLocalVersion((v) => v + 1);
    return true;
  }, []);

  const toggleMic = useCallback(async () => {
    if (await setTrack('audio', !micOn)) setMicOn((v) => !v);
  }, [micOn, setTrack]);

  const toggleCam = useCallback(async () => {
    if (await setTrack('video', !camOn)) setCamOn((v) => !v);
  }, [camOn, setTrack]);

  return {
    micOn,
    camOn,
    toggleMic,
    toggleCam,
    mediaError,
    localStream: localStream.current,
    localVersion,
    remote: [...remote.values()],
    nearbyCount,
  };
}
