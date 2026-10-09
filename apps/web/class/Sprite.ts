import { Vector2 } from "@/types/Vector2";

// One HTMLImageElement per resource URL, shared by every Sprite instance.
// Sprites are constructed inside the draw loop (once per element per frame),
// so without this every frame would issue a fresh HTTP request.
const imageCache = new Map<string, HTMLImageElement>();

export function getCachedImage(resource: string): HTMLImageElement {
    const cached = imageCache.get(resource);
    if (cached) return cached;
    const img = new Image();
    img.src = resource;
    imageCache.set(resource, img);
    return img;
}

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
        if(!this.resource) return;
        const img = getCachedImage(this.resource);
        // Draw nothing until the image has actually decoded. A missing or
        // still-loading asset simply skips this frame instead of throwing.
        if(!img.complete || img.naturalWidth === 0) return;
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
