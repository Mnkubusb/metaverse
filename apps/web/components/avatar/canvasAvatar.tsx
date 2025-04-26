"use client"
import { Sprite } from "@/class/Sprite";
import { Vector2 } from "@/types/Vector2";
import { useEffect, useRef } from "react";
const CanvasAvatar = ( { imageUrl } : {imageUrl : string} ) => {
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
      if (imageUrl) {
        const playerSprite = new Sprite({
          resource: imageUrl,
          frameSize: new Vector2(38, 38),
          hFrames: 9,
          vFrames: 9,
          frame: 0,
          scale: 1,
        });

        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            playerSprite.drawImage(ctx, 0, 0);
          }
        }
      }
    });

    return (
      <canvas ref={canvasRef} width={64} height={64}></canvas>
    )
  }
  
  export default CanvasAvatar