"use client"
import React, { useState, useEffect, useRef, } from 'react';
import { spaceAPI } from '../../lib/api';
import { useWebSocket } from '../../contexts/WebSocketsContexts';
import { useAuth } from '../../contexts/authContext';
import SpaceElement, { spaceElement } from './SpaceElement';


interface Space {
  dimensions: string;
  elements: spaceElement[];
}

interface User {
  id: string;
  x: number;
  y: number;
}

const SpaceGrid = (
  { id }: { id: string }
) => {
  const spaceId = id;
  const { user } = useAuth();
  const { sendMessage, messages, connected } = useWebSocket();
  const [space, setSpace] = useState<Space | null>(null);
  const [elements, setElements] = useState<spaceElement[] | []>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const gridRef = useRef(null);
  const [currentUser, setCurrentUser] = useState<any>({});
  const [users, setUsers] = useState(new Map());

  // Load space details
  useEffect(() => {
    const fetchSpaceDetails = async () => {
      try {
        setLoading(true);
        const spaceData = await spaceAPI.getSpace(spaceId as string);
        setSpace(spaceData.data);
        setElements(spaceData.data.elements || []);
        setError("");
      } catch (err) {
        setError('Failed to load space');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSpaceDetails();
  }, [spaceId]);

  // Handle WebSocket messages
  console.log(messages, user);
  useEffect(() => {

    if (!messages) return;

    const lastMessage = messages[messages.length - 1]
    const { type, payload } = lastMessage;

    switch (type) {
      case 'space-joined': {
        setCurrentUser({
          x: payload.spawn.x,
          y: payload.spawn.y,
          userId: payload.userId
        });
        // Initialize other users from the payload
        const userMap = new Map();
        payload.users.forEach((user: any) => {
          userMap.set(user.userId, user);
        });
        setUsers(userMap);
        break;
      }

      case 'user-joined':
        setUsers(prev => {
          const newUsers = new Map(prev);
          newUsers.set(payload.userId, {
            x: payload.x,
            y: payload.y,
            userId: payload.userId
          });
          return newUsers;
        });
        break;

      case 'move':
        setUsers(prev => {
          const newUsers = new Map(prev);
          newUsers.set(payload.userId, {
            x: payload.x,
            y: payload.y,
            userId: payload.userId
          });
          return newUsers;
        });
        break;
      case 'movement-accepted':
        setCurrentUser((prev: any) => ({
          ...prev,
          x: payload.x,
          y: payload.y
        }));
        break;
      case 'movement-rejected':
        // Reset current user position if movement was rejected
        setCurrentUser((prev: any) => ({
          ...prev,
          x: payload.x,
          y: payload.y
        }));
        break;

      case 'user-left':
        setUsers(prev => {
          const newUsers = new Map(prev);
          newUsers.delete(payload.userId);
          return newUsers;
        });
        break;
    }

  }, [messages, user]);

  console.log(users)

  // Handle keyboard movements
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!space) return;
      const [maxWidth, maxHeight] = space.dimensions.split('x').map(Number);
      let newX = currentUser.x;
      let newY = currentUser.y;

      switch (e.key) {
        case 'w':
          newY = Math.max(0, currentUser.y - 1);
          break;
        case 's':
          newY = Math.min(maxHeight as number - 1, currentUser.y + 1);
          break;
        case 'a':
          newX = Math.max(0, currentUser.x - 1);
          break;
        case 'd':
          newX = Math.min(maxWidth as number - 1, currentUser.x + 1);
          break;
        default:
          return;
      }

      // Only send if position actually changed
      if (newX !== currentUser.x || newY !== currentUser.y) {
        sendMessage('move', { x: newX, y: newY, userId: user?.id });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [space, currentUser, sendMessage, user]);

  if (loading) return <div className="text-center p-8">Loading space...</div>;
  if (error) return <div className="text-center p-8 text-red-500">{error}</div>;
  if (!space) return <div className="text-center p-8">Space not found</div>;

  const [width, height] = space.dimensions.split('x').map(Number);

  if (!connected) {
    return (
      <div className="text-center text-gray-500">
        Connecting to space...
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">The Space</h2>
      <div className="mb-4">
        <p>Dimensions: {space.dimensions}</p>
        <p>Users Online: {users.size + (currentUser ? 1 : 0)}</p>
      </div>

      <div
        ref={gridRef}
        className="relative bg-gray-100 border border-gray-300 overflow-hidden w-full h-full"
        style={{
          width: '100%',
          height: '80vh',
          position: 'relative'
        }}
      >
        <div
          className="absolute top-0 left-0"
          style={{
            width: `${width as number * 32}px`,
            height: `${height as number * 32}px`,
            backgroundSize: '32px 32px',
            backgroundImage: 'linear-gradient(to right, #e0e0e0 1px, transparent 1px), linear-gradient(to bottom, #e0e0e0 1px, transparent 1px)'
          }}
        >
          {/* Render static elements */}
          {elements.map(element => (
            <SpaceElement
              key={element.id}
              element={element}
              onRemove={user?.type === 'admin' ? () => spaceAPI.deleteElement(element.id) : undefined}
            />
          ))}

          {/* Render other users */}
          {Array.from(users.values()).filter((u) => u.userId !== user?.id).map((u) => (
            <div
              key={u.userId}
              className="absolute bg-blue-500 rounded-full flex items-center justify-center text-white"
              style={{
                width: '32px',
                height: '32px',
                left: `${u.x * 32}px`,
                top: `${u.y * 32}px`,
                transition: 'left 0.3s, top 0.3s'
              }}
            >
              U
            </div>
          ))}

          {/* Render current user */}
          <div
            className="absolute bg-green-500 rounded-full flex items-center justify-center text-white z-10"
            style={{
              width: '32px',
              height: '32px',
              left: `${currentUser.x * 32}px`,
              top: `${currentUser.y * 32}px`,
              transition: 'left 0.3s, top 0.3s'
            }}
          >
            Me
          </div>
        </div>
      </div>
      <div className="mt-4 text-center">
        <p className="text-gray-600">Use WSAD keys to move your character</p>
      </div>
    </div>
  );
};

export default SpaceGrid;