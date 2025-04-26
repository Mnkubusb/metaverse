import { Vector2 } from "@/types/Vector2";

export class Sprite {
    resource: string;
    frameSize: Vector2;
    hFrames: number;
    vFrames: number;
    frame: number;
    scale: number;
    position: Vector2;
    frameMap: Map<number, Vector2>;

    constructor({
        resource,
        frameSize,
        hFrames,
        vFrames,
        frame,
        scale,
        position
    }:{ resource: string, frameSize?: Vector2, hFrames?: number, vFrames?: number, frame?: number, scale?: number, position?: Vector2 }){
        this.resource = resource;
        this.frameSize = frameSize ?? new Vector2(16 , 16);
        this.hFrames = hFrames ?? 1;
        this.vFrames = vFrames ?? 1;
        this.frame = frame ?? 0;
        this.frameMap = new Map();
        this.scale = scale ?? 1;     
        this.position = position ?? new Vector2(0, 0);
        this.buildFrameMap();
    }

    buildFrameMap() {
        let frameCount = 0;
        for(let v = 0; v < this.vFrames; v++) {
            for(let h = 0; h < this.hFrames; h++) {
                this.frameMap.set(
                    frameCount,
                    new Vector2(this.frameSize.x * h, this.frameSize.y * v)
                )
                frameCount++;
            }
        }
    }

    drawImage(ctx: CanvasRenderingContext2D ,x : number, y : number) {
        const img = new Image();
        img.src = this.resource;
        if(!this.resource) return;
        let frameCordX = 0;
        let frameCordY = 0;
        const frame = this.frameMap.get(this.frame);
        if(frame) {
            frameCordX = frame.x;
            frameCordY = frame.y;
        }
        const frameSizeX = this.frameSize.x
        const frameSizeY = this.frameSize.y
        ctx.drawImage(
            img,
            frameCordX,
            frameCordY,
            frameSizeX,
            frameSizeY,
            x,
            y,
            frameSizeX * this.scale,
            frameSizeY * this.scale
        )
    }
} 