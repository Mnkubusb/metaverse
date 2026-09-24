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

interface WebSocketContextType {
  connected: boolean;
  users: Map<string, RemoteUser>;
  selfId: string;
  serverPosition: ServerPosition;
  sendMessage: (type: string, payload: any) => void;
  moveUser: (x: number, y: number) => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  connected: false,
  users: new Map(),
  selfId: '',
  serverPosition: { x: 0, y: 0, seq: 0 },
  sendMessage: () => { },
  moveUser: () => { },
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
  const seq = useRef(0);
  const { token } = useAuth();

  const correct = useCallback((x: number, y: number) => {
    seq.current += 1;
    setServerPosition({ x, y, seq: seq.current });
  }, []);

  const handleMessage = useCallback((message: any) => {
    const { type, payload } = message;
    switch (type) {
      case 'space-joined': {
        setSelfId(payload.userId);
        correct(payload.spawn.x, payload.spawn.y);
        setUsers(new Map((payload.users as RemoteUser[]).map((u) => [u.userId, u])));
        setConnected(true);
        break;
      }
      case 'user-joined':
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
      case 'user-left':
        setUsers(prev => {
          const next = new Map(prev);
          next.delete(payload.userId);
          return next;
        });
        break;
    }
  }, [correct]);

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

  const value = useMemo(() => ({
    connected,
    users,
    selfId,
    serverPosition,
    sendMessage,
    moveUser,
  }), [connected, users, selfId, serverPosition, sendMessage, moveUser]);

  return <WebSocketContext.Provider value={value}>
    {connected ? children : <div className="flex h-screen items-center justify-center text-gray-500">Connecting to space...</div>}
  </WebSocketContext.Provider>;
};

export const useWebSocket = () => useContext(WebSocketContext);

export default WebSocketContext;
