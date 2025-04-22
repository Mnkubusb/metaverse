/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import WebSocketService from '../lib/webSocket';
import { useAuth } from './authContext';

interface WebSocketContextType {
  connected: boolean;
  users: Map<any, any>;
  currentUser: { x: number, y: number, userId: string };
  sendMessage: (type: string, payload: any) => void;
  moveUser: (x: number, y: number) => void;
  messages: any[];
}

const WebSocketContext = createContext<WebSocketContextType>({
  connected: false,
  users: new Map(),
  currentUser: { x: 0, y: 0, userId: '' },
  sendMessage: () => { },
  moveUser: () => { },
  messages: [{ type: "mock", payload: "hello" }],
});

export const WebSocketProvider = ({ children, spaceId }: {
  children: React.ReactNode;
  spaceId: string
}) => {
  const [socket, setSocket] = useState<WebSocketService | null>(null);
  const [connected, setConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>({});
  const [users, setUsers] = useState(new Map());
  const [messages, setMessages] = useState<any[]>([]);
  const { token } = useAuth();

  const handleMessage = useCallback((message: any) => {
    console.log('WS message received:', message);
    setMessages(prevMessages => {
      const newMessages = [...prevMessages, message];
      console.log("setMessages called. New messages:", newMessages);
      return newMessages;
    });
    switch (message.type) {
      case 'space-joined': {
        setCurrentUser({
          x: message.payload.spawn.x,
          y: message.payload.spawn.y,
          userId: message.payload.userId
        });
        // Initialize other users from the payload
        const userMap = new Map();
        message.payload.users.forEach((user: any) => {
          userMap.set(user.userId, user);
        });
        setUsers(userMap);
        setConnected(true)
        break;
      }

      case 'user-joined':
        setUsers(prev => {
          const newUsers = new Map(prev);
          newUsers.set(message.payload.userId, {
            x: message.payload.x,
            y: message.payload.y,
            userId: message.payload.userId
          });
          return newUsers;
        });
        break;

      case 'move':
        setUsers(prev => {
          const newUsers = new Map(prev);
          newUsers.set(message.payload.userId, {
            x: message.payload.x,
            y: message.payload.y,
            userId: message.payload.userId
          });
          return newUsers;
        });
        break;

      case 'movement-accepted':
        // Update current user position if movement was accepted
        setCurrentUser((prev: any) => ({
          ...prev,
          x: message.payload.x,
          y: message.payload.y
        }));
        break;

      case 'movement-rejected':
        // Reset current user position if movement was rejected
        setCurrentUser((prev: any) => ({
          ...prev,
          x: message.payload.x,
          y: message.payload.y
        }));
        break;

      case 'user-left':
        setUsers(prev => {
          const newUsers = new Map(prev);
          newUsers.delete(message.payload.userId);
          return newUsers;
        });
        break;
    }
  }, []);

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
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [token, spaceId, handleMessage]);

  interface MessagePayload {
    type: string;
    payload: any;
  }

  const sendMessage = useCallback((type: string, payload: any) => {
    if (socket && connected) {
      const message: MessagePayload = { type, payload };
      socket.sendMessage(message);
    }
  }, [socket, connected]);

  const moveUser = useCallback((x: number, y: number) => {
    if (socket && connected) {
      socket.move(x, y);
      setCurrentUser({ x, y });
    }
  }, [socket, connected]);

  const value = useMemo(() => ({
    connected,
    users,
    currentUser,
    messages,
  }), [connected, users, currentUser, messages]);

  return <WebSocketContext.Provider value={{ ...value, sendMessage, moveUser }} >
    {connected ? children : <div>Connecting WebSocket...</div>}
  </WebSocketContext.Provider>;
};

export const useWebSocket = () => useContext(WebSocketContext);

export default WebSocketContext;