import { NextFunction, Request, Response } from "express";

// Last-resort handler: log the details, send the client a generic message.
// Express 5 routes async handler rejections here.
export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
    if (res.headersSent) {
        next(err);
        return;
    }
    const code = (err as { code?: string })?.code;
    if (code === "P2025") {
        res.status(404).json({ message: "Not found" });
        return;
    }
    if (code === "P2003") {
        res.status(409).json({ message: "This item is still in use and can't be changed or removed" });
        return;
    }
    if ((err as { type?: string })?.type === "entity.too.large") {
        res.status(413).json({ message: "Request body is too large" });
        return;
    }
    if ((err as { type?: string })?.type === "entity.parse.failed") {
        res.status(400).json({ message: "Invalid JSON" });
        return;
    }
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
}
