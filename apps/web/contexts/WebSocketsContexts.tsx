/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import WebSocketService from '../lib/webSocket';
import { useAuth } from './authContext';

export type Seat = { x: number; y: number };
export const MAIN_AREA = 'main';

export interface RemoteUser {
  userId: string;
  username?: string;
  // sprite sheet URL, null = default character
  avatar?: string | null;
  // bench tile the player is sitting on
  seat?: Seat | null;
  // "main" outdoors, or the id of the building interior they're in
  area: string;
  x: number;
  y: number;
}

// Authoritative position from the server. `seq` increases on every correction
// (join, rejected move or walking through a door) so the renderer knows when to snap the local player.
export interface ServerPosition {
  area: string;
  x: number;
  y: number;
  seq: number;
}

export interface ChatMessage {
  id: string;
  userId: string | null;
  username: string;
  text: string;
  createdAt: string;
  // join/leave notices generated locally; never sent to the server
  system?: boolean;
}

const MAX_CHAT_MESSAGES = 200;

export interface EmoteEvent {
  userId: string;
  emote: string;
  // increases per event so the same emote twice in a row still triggers
  seq: number;
}

interface WebSocketContextType {
  connected: boolean;
  users: Map<string, RemoteUser>;
  selfId: string;
  serverPosition: ServerPosition;
  sendMessage: (type: string, payload: any) => void;
  moveUser: (x: number, y: number) => void;
  chat: ChatMessage[];
  chatError: string;
  sendChat: (text: string) => void;
  lastEmote: EmoteEvent | null;
  sendEmote: (emote: string) => void;
  selfAvatar: string | null;
  // call after saving a new avatar over HTTP so everyone in the space sees it
  announceAvatarChange: () => void;
  // WebRTC signalling relayed through the server to one player in the space
  sendRtc: (to: string, data: unknown) => void;
  subscribeRtc: (handler: RtcHandler) => () => void;
  selfSeat: Seat | null;
  sit: (seat: Seat | null) => void;
  // bumps when someone else changes a notice board, so an open board can refresh
  boardUpdate: { boardId: string; seq: number } | null;
  announceBoardUpdate: (boardId: string) => void;
  sendDm: (to: string, text: string) => void;
  subscribeDm: (handler: DmHandler) => () => void;
  dmError: string;
  watching: Map<string, WatchState>;
  sendWatch: (screenId: string, action: WatchAction) => void;
}

export type RtcHandler = (from: string, data: any) => void;

// A live direct message (sent or received by this user)
export interface DirectMessage {
  id: string;
  from: string;
  fromName: string;
  to: string;
  toName: string;
  text: string;
  createdAt: string;
}
export type DmHandler = (msg: DirectMessage) => void;

// The video on one screen in this space (see apps/ws/src/watch.ts)
export interface WatchState {
  screenId: string;
  url: string;
  youtubeId: string | null;
  playing: boolean;
  position: number;
  // local clock time the position was measured at (ms)
  updatedAt: number;
  by: string;
}
export type WatchAction =
  | { action: 'load'; url: string }
  | { action: 'play' | 'pause' | 'seek'; position: number }
  | { action: 'stop' };

const WebSocketContext = createContext<WebSocketContextType>({
  connected: false,
  users: new Map(),
  selfId: '',
  serverPosition: { area: MAIN_AREA, x: 0, y: 0, seq: 0 },
  sendMessage: () => { },
  moveUser: () => { },
  chat: [],
  chatError: '',
  sendChat: () => { },
  lastEmote: null,
  sendEmote: () => { },
  selfAvatar: null,
  announceAvatarChange: () => { },
  sendRtc: () => { },
  subscribeRtc: () => () => { },
  selfSeat: null,
  sit: () => { },
  boardUpdate: null,
  announceBoardUpdate: () => { },
  sendDm: () => { },
  subscribeDm: () => () => { },
  dmError: '',
  watching: new Map(),
  sendWatch: () => { },
});

export const WebSocketProvider = ({ children, spaceId }: {
  children: React.ReactNode;
  spaceId: string
}) => {
  const [socket, setSocket] = useState<WebSocketService | null>(null);
  const [connected, setConnected] = useState(false);
  const [selfId, setSelfId] = useState('');
  const [serverPosition, setServerPosition] = useState<ServerPosition>({ area: MAIN_AREA, x: 0, y: 0, seq: 0 });
  const [users, setUsers] = useState<Map<string, RemoteUser>>(new Map());
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState('');
  const [lastEmote, setLastEmote] = useState<EmoteEvent | null>(null);
  const [selfAvatar, setSelfAvatar] = useState<string | null>(null);
  const [selfSeat, setSelfSeat] = useState<Seat | null>(null);
  const [boardUpdate, setBoardUpdate] = useState<{ boardId: string; seq: number } | null>(null);
  const boardSeq = useRef(0);
  const dmHandlers = useRef<Set<DmHandler>>(new Set());
  const [dmError, setDmError] = useState('');
  // why the server refused or failed the last join (shown on the connecting screen)
  const [joinError, setJoinError] = useState('');
  const [watching, setWatching] = useState<Map<string, WatchState>>(new Map());
  const selfIdRef = useRef('');
  const everConnected = useRef(false);
  const rtcHandlers = useRef<Set<RtcHandler>>(new Set());
  const seq = useRef(0);
  const emoteSeq = useRef(0);
  const namesRef = useRef<Map<string, string>>(new Map());
  const { token } = useAuth();

  const correct = useCallback((area: string | undefined, x: number, y: number) => {
    seq.current += 1;
    setServerPosition({ area: area ?? MAIN_AREA, x, y, seq: seq.current });
  }, []);

  const pushChat = useCallback((...msgs: ChatMessage[]) => {
    setChat(prev => [...prev, ...msgs].slice(-MAX_CHAT_MESSAGES));
  }, []);

  const notice = useCallback((text: string) => {
    pushChat({ id: `sys-${Date.now()}-${Math.random()}`, userId: null, username: '', text, createdAt: new Date().toISOString(), system: true });
  }, [pushChat]);

  const handleMessage = useCallback((message: any) => {
    const { type, payload } = message;
    if (payload?.userId && payload?.username) namesRef.current.set(payload.userId, payload.username);
    switch (type) {
      case 'space-joined': {
        setJoinError('');
        setSelfId(payload.userId);
        selfIdRef.current = payload.userId;
        setSelfAvatar(payload.avatar ?? null);
        correct(payload.spawn.area, payload.spawn.x, payload.spawn.y);
        setUsers(new Map((payload.users as RemoteUser[]).map((u) => [u.userId, { ...u, area: u.area ?? MAIN_AREA }])));
        (payload.users as RemoteUser[]).forEach((u) => u.username && namesRef.current.set(u.userId, u.username));
        setChat((payload.chat ?? []).slice(-MAX_CHAT_MESSAGES));
        // server positions are current as of now; re-stamp with the local clock
        setWatching(new Map(((payload.watching ?? []) as WatchState[]).map((w) => [w.screenId, { ...w, updatedAt: Date.now() }])));
        everConnected.current = true;
        setConnected(true);
        break;
      }
      case 'chat':
        setChatError('');
        pushChat(payload);
        break;
      case 'emote':
        emoteSeq.current += 1;
        setLastEmote({ userId: payload.userId, emote: payload.emote, seq: emoteSeq.current });
        break;
      case 'chat-rejected':
        setChatError(payload?.reason === 'rate-limited'
          ? 'You are sending messages too fast. Wait a moment.'
          : 'That message could not be sent.');
        break;
      case 'user-joined':
        if (payload.username) notice(`${payload.username} joined`);
        setUsers(prev => new Map(prev).set(payload.userId, {
          userId: payload.userId, username: payload.username, avatar: payload.avatar,
          area: payload.area ?? MAIN_AREA, x: payload.x, y: payload.y,
        }));
        break;
      case 'rtc':
        rtcHandlers.current.forEach((h) => h(payload.from, payload.data));
        break;
      case 'join-rejected':
        setJoinError(payload?.reason === 'private' ? 'This space is private. Ask the owner for an invite link.'
          : `The server couldn't open this space${payload?.detail ? ` (${payload.detail})` : ''}. Retrying…`);
        break;
      case 'dm':
        setDmError('');
        dmHandlers.current.forEach((h) => h(payload as DirectMessage));
        break;
      case 'dm-rejected':
        setDmError(payload?.reason === 'rate-limited' ? 'You are sending messages too fast. Wait a moment.'
          : payload?.reason === 'no-user' ? 'That player no longer exists.' : 'That message could not be sent.');
        break;
      case 'watch-state':
        setWatching((prev) => {
          const next = new Map(prev);
          if (payload.state) next.set(payload.screenId, { ...payload.state, updatedAt: Date.now() });
          else next.delete(payload.screenId);
          return next;
        });
        break;
      case 'pose':
        if (payload.userId === selfIdRef.current) {
          setSelfSeat(payload.seat ?? null);
        } else {
          setUsers(prev => {
            const existing = prev.get(payload.userId);
            return existing ? new Map(prev).set(payload.userId, { ...existing, seat: payload.seat ?? null }) : prev;
          });
        }
        break;
      case 'board-updated':
        boardSeq.current += 1;
        setBoardUpdate({ boardId: payload.boardId, seq: boardSeq.current });
        break;
      case 'avatar-changed':
        if (payload.userId === selfIdRef.current) {
          setSelfAvatar(payload.avatar ?? null);
        } else {
          setUsers(prev => {
            const existing = prev.get(payload.userId);
            return existing ? new Map(prev).set(payload.userId, { ...existing, avatar: payload.avatar }) : prev;
          });
        }
        break;
      case 'move':
        setUsers(prev => {
          const next = new Map(prev);
          const existing = next.get(payload.userId);
          next.set(payload.userId, {
            userId: payload.userId,
            username: payload.username ?? existing?.username,
            avatar: existing?.avatar,
            seat: null, // moving stands a player up
            area: payload.area ?? MAIN_AREA,
            x: payload.x,
            y: payload.y,
          });
          return next;
        });
        break;
      case 'movement-rejected':
      case 'teleported': // walked through a door: the server put us on the other side
        correct(payload.area, payload.x, payload.y);
        break;
      case 'user-left': {
        const name = namesRef.current.get(payload.userId);
        if (name) notice(`${name} left`);
        setUsers(prev => {
          const next = new Map(prev);
          next.delete(payload.userId);
          return next;
        });
        break;
      }
    }
  }, [correct, pushChat, notice]);

  useEffect(() => {
    if (!token || !spaceId) return;
    const wsService = new WebSocketService(
      process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
      token,
      spaceId,
      handleMessage,
      () => setConnected(false)
    );

    const newSocket = wsService.connect();
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token, spaceId, handleMessage]);

  const sendMessage = useCallback((type: string, payload: any) => {
    if (socket && connected) {
      socket.sendMessage({ type, payload });
    }
  }, [socket, connected]);

  const moveUser = useCallback((x: number, y: number) => {
    if (socket && connected) {
      socket.move(x, y);
      setSelfSeat(null); // the server stands you up when you move
    }
  }, [socket, connected]);

  const sit = useCallback((seat: Seat | null) => {
    if (socket && connected) socket.sendMessage({ type: 'sit', payload: { seat } });
  }, [socket, connected]);

  const announceBoardUpdate = useCallback((boardId: string) => {
    if (socket && connected) socket.sendMessage({ type: 'board-updated', payload: { boardId } });
  }, [socket, connected]);

  const sendChat = useCallback((text: string) => {
    const trimmed = text.trim();
    if (socket && connected && trimmed) {
      socket.sendMessage({ type: 'chat', payload: { text: trimmed } });
    }
  }, [socket, connected]);

  // shown locally right away; the server relays it to everyone else
  const sendEmote = useCallback((emote: string) => {
    if (socket && connected && selfId) {
      socket.sendMessage({ type: 'emote', payload: { emote } });
      emoteSeq.current += 1;
      setLastEmote({ userId: selfId, emote, seq: emoteSeq.current });
    }
  }, [socket, connected, selfId]);

  const announceAvatarChange = useCallback(() => {
    if (socket && connected) socket.sendMessage({ type: 'avatar-changed', payload: {} });
  }, [socket, connected]);

  const sendRtc = useCallback((to: string, data: unknown) => {
    if (socket && connected) socket.sendMessage({ type: 'rtc', payload: { to, data } });
  }, [socket, connected]);

  const sendDm = useCallback((to: string, text: string) => {
    const trimmed = text.trim();
    if (socket && connected && trimmed) socket.sendMessage({ type: 'dm', payload: { to, text: trimmed } });
  }, [socket, connected]);

  const subscribeDm = useCallback((handler: DmHandler) => {
    dmHandlers.current.add(handler);
    return () => { dmHandlers.current.delete(handler); };
  }, []);

  const sendWatch = useCallback((screenId: string, action: WatchAction) => {
    if (socket && connected) socket.sendMessage({ type: 'watch', payload: { screenId, ...action } });
  }, [socket, connected]);

  const subscribeRtc = useCallback((handler: RtcHandler) => {
    rtcHandlers.current.add(handler);
    return () => { rtcHandlers.current.delete(handler); };
  }, []);

  const value = useMemo(() => ({
    connected,
    users,
    selfId,
    serverPosition,
    sendMessage,
    moveUser,
    chat,
    chatError,
    sendChat,
    lastEmote,
    sendEmote,
    selfAvatar,
    announceAvatarChange,
    sendRtc,
    subscribeRtc,
    selfSeat,
    sit,
    boardUpdate,
    announceBoardUpdate,
    sendDm,
    subscribeDm,
    dmError,
    watching,
    sendWatch,
  }), [sendDm, subscribeDm, dmError, watching, sendWatch, sendRtc, subscribeRtc, selfSeat, sit, boardUpdate, announceBoardUpdate, connected, users, selfId, serverPosition, sendMessage, moveUser, chat, chatError, sendChat, lastEmote, sendEmote,
    selfAvatar, announceAvatarChange]);

  return <WebSocketContext.Provider value={value}>
    {connected ? children : (
      <div className="flex h-dvh flex-col items-center justify-center gap-2 text-gray-500">
        <div className="size-8 animate-spin rounded-full border-b-2 border-t-2 border-blue-500" />
        <p>{everConnected.current ? 'Connection lost. Reconnecting…' : 'Connecting to space...'}</p>
        {joinError && <p role="alert" className="max-w-md text-center text-sm text-red-500">{joinError}</p>}
        {!everConnected.current && <p className="text-xs text-gray-400">A sleeping server can take up to a minute to wake up.</p>}
      </div>
    )}
  </WebSocketContext.Provider>;
};

export const useWebSocket = () => useContext(WebSocketContext);

export default WebSocketContext;
