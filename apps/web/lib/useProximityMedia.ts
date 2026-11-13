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
  // microphone + camera
  stream: MediaStream;
  hasVideo: boolean;
  hasAudio: boolean;
  // 0..1, louder when closer
  volume: number;
  // a shared screen or tab (with its audio, if the presenter shared it)
  screen: MediaStream | null;
}

type Position = { area?: string; x: number; y: number };

/**
 * Proximity voice/video and screen sharing over peer-to-peer WebRTC.
 * A shared screen travels as a second stream on the same connection; its id is announced with
 * a { screen: streamId } signal so the other side can tell it from the camera. While someone
 * presents, everyone in the same room (not just within HEAR_RANGE) is connected to them and
 * hears them at full volume, like a talk in a hall. Signalling goes through the WebSocket server
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
  const screenStream = useRef<MediaStream | null>(null);
  const [sharing, setSharing] = useState(false);
  const sharingRef = useRef(false);
  sharingRef.current = sharing;
  // per remote player: every stream they send us, and which of them is their screen
  const remoteStreams = useRef<Map<string, Map<string, MediaStream>>>(new Map());
  const remoteScreenIds = useRef<Map<string, string>>(new Map());
  const usersRef = useRef(users);
  usersRef.current = users;

  const sameArea = useCallback((userId: string) => {
    const me = getSelfPosition();
    const other = usersRef.current.get(userId);
    return !!me && !!other && (me.area ?? 'main') === (other.area ?? 'main');
  }, [getSelfPosition]);
  // someone presenting reaches the whole room
  const presenting = useCallback((userId: string) =>
    sameArea(userId) && (sharingRef.current || remoteScreenIds.current.has(userId)), [sameArea]);

  const distanceTo = useCallback((userId: string) => {
    const me = getSelfPosition();
    const other = usersRef.current.get(userId);
    if (!me || !other) return Infinity;
    // someone inside a building can't be heard from outside it (or from another building)
    if ((me.area ?? 'main') !== (other.area ?? 'main')) return Infinity;
    return Math.hypot(me.x - other.x, me.y - other.y);
  }, [getSelfPosition]);

  const refreshRemote = useCallback((userId: string) => {
    setRemote((prev) => {
      const next = new Map(prev);
      const streams = remoteStreams.current.get(userId);
      // forget streams whose tracks were all removed (e.g. a screen share that stopped), so a dead
      // stream is never mistaken for the camera stream later
      if (streams) for (const [id, st] of streams) if (st.getTracks().length === 0) streams.delete(id);
      if (!streams || streams.size === 0) {
        next.delete(userId);
        return next;
      }
      const screenId = remoteScreenIds.current.get(userId);
      const live = (t: MediaStreamTrack) => t.readyState === 'live' && !t.muted;
      const others = [...streams.values()].filter((st) => st.id !== screenId);
      const camera = others.find((st) => st.getTracks().some((t) => t.readyState === 'live')) ?? others[0] ?? new MediaStream();
      const screen = screenId ? streams.get(screenId) ?? null : null;
      next.set(userId, {
        userId,
        stream: camera,
        hasVideo: camera.getVideoTracks().some(live),
        hasAudio: camera.getAudioTracks().some(live),
        volume: prev.get(userId)?.volume ?? 1,
        screen: screen && screen.getVideoTracks().some((t) => t.readyState === 'live') ? screen : null,
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
    remoteStreams.current.delete(userId);
    remoteScreenIds.current.delete(userId);
    refreshRemote(userId);
    if (notify) sendRtc(userId, { bye: true });
  }, [refreshRemote, sendRtc]);

  const createPeer = useCallback((userId: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    // the peer with the larger id yields when both sides offer at once
    const peer: Peer = { pc, polite: selfId > userId, makingOffer: false, ignoreOffer: false };
    peers.current.set(userId, peer);

    localStream.current.getTracks().forEach((t) => pc.addTrack(t, localStream.current));
    const screen = screenStream.current;
    if (screen) {
      screen.getTracks().forEach((t) => pc.addTrack(t, screen));
      sendRtc(userId, { screen: screen.id });
    }

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) sendRtc(userId, { candidate: candidate.toJSON() });
    };
    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        sendRtc(userId, { description: pc.localDescription?.toJSON(), present: sharingRef.current });
      } catch (err) {
        console.warn('negotiation failed', err);
      } finally {
        peer.makingOffer = false;
      }
    };
    pc.ontrack = ({ track, streams }) => {
      const stream = streams[0] ?? new MediaStream([track]);
      if (!remoteStreams.current.has(userId)) remoteStreams.current.set(userId, new Map());
      remoteStreams.current.get(userId)!.set(stream.id, stream);
      // tracks fire "ended" when the connection closes; ignore events from peers we've already dropped
      const update = () => { if (peers.current.get(userId) === peer) refreshRemote(userId); };
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
    if ('screen' in (data ?? {})) {
      // which of their streams is a shared screen (null: they stopped)
      if (data.screen) remoteScreenIds.current.set(from, String(data.screen));
      else remoteScreenIds.current.delete(from);
      refreshRemote(from);
      return;
    }
    let peer = peers.current.get(from);
    if (!peer) {
      // only accept connections from players who are (about to be) in range, or presenting in this room
      if (!data?.description || (distanceTo(from) > DROP_RANGE && !(data.present && sameArea(from)))) return;
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
          sendRtc(from, { description: pc.localDescription?.toJSON(), present: sharingRef.current });
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
  }), [subscribeRtc, createPeer, closePeer, distanceTo, sendRtc, refreshRemote, sameArea]);

  // connect to players who come into range, drop the ones who walk away or leave
  useEffect(() => {
    if (!selfId) return;
    const timer = setInterval(() => {
      for (const userId of usersRef.current.keys()) {
        if (userId === selfId) continue;
        const d = distanceTo(userId);
        const talk = presenting(userId);
        if ((d <= HEAR_RANGE || (talk && sharingRef.current)) && !peers.current.has(userId)) createPeer(userId);
        else if (d > DROP_RANGE && !talk && peers.current.has(userId)) closePeer(userId, true);
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
          const near = Math.max(0, Math.min(1, 1 - (distanceTo(id) - 1.5) / (DROP_RANGE - 1.5)));
          // a presenter is heard across the room
          const volume = remoteScreenIds.current.has(id) && sameArea(id) ? Math.max(near, 0.9) : near;
          if (Math.abs(volume - media.volume) > 0.02) {
            next.set(id, { ...media, volume });
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, CHECK_MS);
    return () => clearInterval(timer);
  }, [selfId, distanceTo, createPeer, closePeer, presenting, sameArea]);

  // close everything when leaving the space
  useEffect(() => () => {
    for (const id of [...peers.current.keys()]) closePeer(id, true);
    localStream.current.getTracks().forEach((t) => t.stop());
    screenStream.current?.getTracks().forEach((t) => t.stop());
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

  const stopSharing = useCallback(() => {
    const screen = screenStream.current;
    if (!screen) return;
    screenStream.current = null;
    const tracks = screen.getTracks();
    tracks.forEach((t) => t.stop());
    for (const [userId, { pc }] of peers.current) {
      for (const sender of pc.getSenders()) if (sender.track && tracks.includes(sender.track)) pc.removeTrack(sender);
      sendRtc(userId, { screen: null });
    }
    setSharing(false);
    setLocalVersion((v) => v + 1);
  }, [sendRtc]);

  const toggleScreen = useCallback(async () => {
    setMediaError('');
    if (screenStream.current) {
      stopSharing();
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setMediaError('This browser cannot share its screen.');
      return;
    }
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 }, width: { max: 1920 }, height: { max: 1080 } },
        audio: true, // tab or system audio, when the browser offers it
      });
      const video = screen.getVideoTracks()[0];
      if (video) {
        video.contentHint = 'detail'; // keep text sharp rather than motion smooth
        video.onended = () => stopSharing(); // the browser's own "Stop sharing" button
      }
      screenStream.current = screen;
      setSharing(true);
      for (const [userId, { pc }] of peers.current) {
        screen.getTracks().forEach((t) => pc.addTrack(t, screen));
        sendRtc(userId, { screen: screen.id });
      }
      setLocalVersion((v) => v + 1);
    } catch (err) {
      if ((err as DOMException)?.name !== 'NotAllowedError') setMediaError('Could not start sharing your screen.');
    }
  }, [sendRtc, stopSharing]);

  return {
    micOn,
    camOn,
    toggleMic,
    toggleCam,
    mediaError,
    localStream: localStream.current,
    sharing,
    toggleScreen,
    screenStream: screenStream.current,
    localVersion,
    remote: [...remote.values()],
    nearbyCount,
  };
}
