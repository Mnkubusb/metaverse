"use client"
import React, { useState, useEffect, useRef, useCallback, } from 'react';
import { avatarAPI, spaceAPI } from '../../lib/api';
import { useWebSocket } from '../../contexts/WebSocketsContexts';
import { useAuth } from '../../contexts/authContext';
import { spaceElement } from './SpaceElement';
import { Sprite } from '@/class/Sprite';
import { Vector2 } from '@/types/Vector2';


interface Space {
  dimensions: string;
  elements: spaceElement[];
}

interface Avatar {
  imageUrl: string;
}
const SpaceGrid = (
  { id }: { id: string }
) => {
  const spaceId = id;
  const { user } = useAuth();
  const { sendMessage, connected , currentUser , users } = useWebSocket();
  const [space, setSpace] = useState<Space | null>(null);
  const [elements, setElements] = useState<spaceElement[] | []>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const gridRef = useRef(null);
  // const [currentUser, setCurrentUser] = useState<any>({});
  // const [users, setUsers] = useState(new Map());
  const [userAvatar, setUserAvatar] = useState<Avatar | null>(null);
  const [frame, setFrame] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationRef = useRef<number | null>(null)
  const [direction, setDirection] = useState<"down" | "up" | "left" | "right" | null>(null);
  const [isMoving, setIsMoving] = useState(false);




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

  useEffect(() => {
    if (!user) return;
    const fetchUserAvatar = async () => {
      try {
        setLoading(true);
        const response = await avatarAPI.getUserAvatar(user.id);
        console.log(response);
        setUserAvatar(response.data.avatar);
      } catch (err) {
        console.log("Internal Error", err);
      } finally {
        setLoading(false);
      }
    }
    fetchUserAvatar();
  }, [user]);

  // useEffect(() => {

  //   if (!messages) return;

  //   const lastMessage = messages[messages.length - 1]
  //   const { type, payload } = lastMessage;

  //   switch (type) {
  //     case 'space-joined': {
  //       setCurrentUser({
  //         x: payload.spawn.x,
  //         y: payload.spawn.y,
  //         userId: payload.userId
  //       });
  //       const userMap = new Map();
  //       payload.users.forEach((user: any) => {
  //         userMap.set(user.userId, user);
  //       });
  //       setUsers(userMap);
  //       break;
  //     }

  //     case 'user-joined':
  //       setUsers(prev => {
  //         const newUsers = new Map(prev);
  //         newUsers.set(payload.userId, {
  //           x: payload.x,
  //           y: payload.y,
  //           userId: payload.userId
  //         });
  //         return newUsers;
  //       });
  //       break;

  //     case 'move':
  //       setUsers(prev => {
  //         const newUsers = new Map(prev);
  //         newUsers.set(payload.userId, {
  //           x: payload.x,
  //           y: payload.y,
  //           userId: payload.userId
  //         });
  //         return newUsers;
  //       });
  //       break;
  //     case 'movement-accepted':
  //       setCurrentUser((prev: any) => ({
  //         ...prev,
  //         x: payload.x,
  //         y: payload.y
  //       }));
  //       break;
  //     case 'movement-rejected':
  //       setCurrentUser((prev: any) => ({
  //         ...prev,
  //         x: payload.x,
  //         y: payload.y
  //       }));
  //       break;

  //     case 'user-left':
  //       setUsers(prev => {
  //         const newUsers = new Map(prev);
  //         newUsers.delete(payload.userId);
  //         return newUsers;
  //       });
  //       break;
  //   }

  // }, [messages, user]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!space) return;
      const [maxWidth, maxHeight] = (space.dimensions.split('x').map(Number));
      let newX = currentUser.x;
      let newY = currentUser.y;
      switch (e.key) {
        case 'w':
          newY = Math.max(0, currentUser.y - 1);
          setDirection("up");
          break;
        case 's':
          newY = Math.min((maxHeight as number * 32) - 1, currentUser.y + 1);
          setDirection("down");
          break;
        case 'a':
          newX = Math.max(0, currentUser.x - 1);
          setDirection("left");
          break;
        case 'd':
          newX = Math.min((maxWidth as number * 32) - 1, currentUser.x + 1);
          setDirection("right");
          break;
        default:
          return;
      }

      if (newX !== currentUser.x || newY !== currentUser.y) {
        setIsMoving(true);
        sendMessage('move', { x: newX, y: newY, userId: user?.id });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [space, currentUser, sendMessage, user, frame]);

  useEffect(() => {
    if (!isMoving || direction === null) return;

    const baseFrameMap = {
      down: 0,
      right: 6,
      left: 12,
      up: 18
    };
    setFrame(prev => {
      const base = baseFrameMap[direction];
      const next = prev + 1;
      return next < base || next >= base + 6 ? base : next;
    });
    const interval = setInterval(() => {
      setFrame(prev => {
        const base = baseFrameMap[direction];
        const next = prev + 1;
        return next < base || next >= base + 6 ? base : next;
      });
    }, 160);

    return () => clearInterval(interval);
  }, [direction, isMoving]);


const drawGame = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !space) return;

    canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
    canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;

    const [width, height] = space.dimensions.split('x').map(Number);


    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const canvasWidth = canvasRef.current?.width || window.innerWidth;
    const canvasHeight = canvasRef.current?.height || window.innerHeight;
    const tileSize = 32;

    const playerPixelX = currentUser.x * 8
    const playerPixelY = currentUser.y * 8

    const camX = playerPixelX - canvasWidth / 2;
    const camY = playerPixelY - canvasHeight / 2;

    const worldPixelWidth = width as number * tileSize;
    const worldPixelHeight = height as number * tileSize;
    const localCamX = Math.max(0, Math.min(camX, worldPixelWidth - canvasWidth));
    const localCamY = Math.max(0, Math.min(camY, worldPixelHeight - canvasHeight));

    ctx.save();
    ctx.translate(-localCamX, -localCamY);


    ctx.strokeStyle = '#e0e0e0';
    ctx.beginPath();
    for (let x = 0; x <= Number(width); x++) {
      ctx.moveTo(x * 32, 0);
      ctx.lineTo(x * 32, height as number * 32);
    }
    for (let y = 0; y <= Number(height); y++) {
      ctx.moveTo(0, y * 32);
      ctx.lineTo(width as number * 32, y * 32);
    }
    ctx.stroke();

    const player = new Sprite({
      resource: userAvatar?.imageUrl as string || "/Characters/WalkAnimations.png",
      frameSize: new Vector2(80, 80),
      hFrames: 5,
      vFrames: 5,
      frame,
      scale: 1,
    })

    elements.filter((element) => element.element.static === false).map((element) => {
      const elements = new Sprite({
        resource: element.element.imageUrl,
        frameSize: new Vector2(element.element.width * 32 , element.element.height * 32),
      })
      elements.drawImage(ctx, element.x * 32, element.y * 32);
    })

    const targetX = currentUser.x * 8
    const targetY = currentUser.y * 8

    ctx.fillStyle = '#000';
    ctx.fillText(user?.username as string, targetX + 15, targetY + 8);
    player.drawImage(ctx, targetX, targetY);

    Array.from(users.values()).map((user) => {
      const player2 = new Sprite({
        resource: userAvatar?.imageUrl as string || "/Characters/WalkAnimations.png",
        frameSize: new Vector2(64, 64),
        hFrames: 4,
        vFrames: 4,
        frame: 0,
        scale: 1,
      })
      ctx.fillText(user.id, user.x * 8 + 15, user.y * 8 + 8);
      player2.drawImage(ctx, user.x * 8, user.y * 8);
    })

    elements.filter((element) => element.element.static === true).map((element) => {
      const elements = new Sprite({
        resource: element.element.imageUrl,
        frameSize: new Vector2(element.element.width * 32, element.element.height * 32),
      })
      elements.drawImage(ctx, element.x * 32, element.y * 32);
    })

    ctx.restore();

    animationRef.current = requestAnimationFrame(drawGame)
  }, [space, currentUser, frame, elements , user , users , userAvatar]);

  useEffect(() => {
    if (!space) return;
    animationRef.current = requestAnimationFrame(drawGame);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [space, drawGame])


  useEffect(() => {
    const handleKeyUp = () => {
      setIsMoving(false);
    };

    window.addEventListener("keyup", handleKeyUp);
    return () => window.removeEventListener("keyup", handleKeyUp);
  }, []);


  if (loading) return <div className="text-center p-8">Loading space...</div>;
  if (error) return <div className="text-center p-8 text-red-500">{error}</div>;
  if (!space) return <div className="text-center p-8">Space not found</div>;

  if (!connected) {
    return (
      <div className="text-center text-gray-500">
        Connecting to space...
      </div>
    );
  }


  const width = parseInt(space?.dimensions.split('x')[0] as string)
  const height = parseInt(space?.dimensions.split('x')[1] as string)


  return (
    <div className="mx-auto w-full h-full">
      <div className='absolute z-20 p-4'>
        <h2 className="text-2xl font-bold mb-4">The Space</h2>
        <div className="mb-4">
          <p>Dimensions: {space.dimensions}</p>
          <p>Users Online: {users.size + (currentUser ? 1 : 0)}</p>
        </div>
      </div>
      <div
        ref={gridRef}
        className="relative bg-gray-100 overflow-hidden w-full h-full"
        style={{
          width: '100%',
          height: '100vh',
          position: 'relative'
        }}
      >
        <canvas
          className='absolute top-0 left-0'
          ref={canvasRef}
          width={width * 32}
          height={height * 32}
        >
        </canvas>
      </div>
    </div>
  );
};

export default SpaceGrid;