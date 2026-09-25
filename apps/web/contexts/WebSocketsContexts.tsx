/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import WebSocketService from '../lib/webSocket';
import { useAuth } from './authContext';

export interface RemoteUser {
  userId: string;
  username?: string;
  x: number;
  y: number;
}

// Authoritative position from the server. `seq` increases on every correction
// (join or rejected move) so the renderer knows when to snap the local player.
export interface ServerPosition {
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
}

const WebSocketContext = createContext<WebSocketContextType>({
  connected: false,
  users: new Map(),
  selfId: '',
  serverPosition: { x: 0, y: 0, seq: 0 },
  sendMessage: () => { },
  moveUser: () => { },
  chat: [],
  chatError: '',
  sendChat: () => { },
});

export const WebSocketProvider = ({ children, spaceId }: {
  children: React.ReactNode;
  spaceId: string
}) => {
  const [socket, setSocket] = useState<WebSocketService | null>(null);
  const [connected, setConnected] = useState(false);
  const [selfId, setSelfId] = useState('');
  const [serverPosition, setServerPosition] = useState<ServerPosition>({ x: 0, y: 0, seq: 0 });
  const [users, setUsers] = useState<Map<string, RemoteUser>>(new Map());
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState('');
  const seq = useRef(0);
  const namesRef = useRef<Map<string, string>>(new Map());
  const { token } = useAuth();

  const correct = useCallback((x: number, y: number) => {
    seq.current += 1;
    setServerPosition({ x, y, seq: seq.current });
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
        setSelfId(payload.userId);
        correct(payload.spawn.x, payload.spawn.y);
        setUsers(new Map((payload.users as RemoteUser[]).map((u) => [u.userId, u])));
        (payload.users as RemoteUser[]).forEach((u) => u.username && namesRef.current.set(u.userId, u.username));
        setChat((payload.chat ?? []).slice(-MAX_CHAT_MESSAGES));
        setConnected(true);
        break;
      }
      case 'chat':
        setChatError('');
        pushChat(payload);
        break;
      case 'chat-rejected':
        setChatError(payload?.reason === 'rate-limited'
          ? 'You are sending messages too fast. Wait a moment.'
          : 'That message could not be sent.');
        break;
      case 'user-joined':
        if (payload.username) notice(`${payload.username} joined`);
        setUsers(prev => new Map(prev).set(payload.userId, {
          userId: payload.userId, username: payload.username, x: payload.x, y: payload.y,
        }));
        break;
      case 'move':
        setUsers(prev => {
          const next = new Map(prev);
          const existing = next.get(payload.userId);
          next.set(payload.userId, {
            userId: payload.userId,
            username: payload.username ?? existing?.username,
            x: payload.x,
            y: payload.y,
          });
          return next;
        });
        break;
      case 'movement-rejected':
        correct(payload.x, payload.y);
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
    }
  }, [socket, connected]);

  const sendChat = useCallback((text: string) => {
    const trimmed = text.trim();
    if (socket && connected && trimmed) {
      socket.sendMessage({ type: 'chat', payload: { text: trimmed } });
    }
  }, [socket, connected]);

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
  }), [connected, users, selfId, serverPosition, sendMessage, moveUser, chat, chatError, sendChat]);

  return <WebSocketContext.Provider value={value}>
    {connected ? children : <div className="flex h-screen items-center justify-center text-gray-500">Connecting to space...</div>}
  </WebSocketContext.Provider>;
};

export const useWebSocket = () => useContext(WebSocketContext);

export default WebSocketContext;
