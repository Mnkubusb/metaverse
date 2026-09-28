import jwt from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import { JWT_SECRET } from "../config";

interface TokenPayload {
    userId: string;
    role: "Admin" | "User";
}

function readToken(req: Request): TokenPayload | null {
    const [scheme, token] = (req.headers["authorization"] ?? "").split(" ");
    if (scheme !== "Bearer" || !token) return null;
    try {
        const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as TokenPayload;
        return typeof decoded.userId === "string" ? decoded : null;
    } catch {
        return null;
    }
}

// 401 when the token is missing, malformed or expired; 403 when it's valid but lacks the role.
export function requireAuth(role?: "Admin") {
    return (req: Request, res: Response, next: NextFunction): void => {
        const payload = readToken(req);
        if (!payload) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        if (role && payload.role !== role) {
            res.status(403).json({ message: "Forbidden" });
            return;
        }
        req.userId = payload.userId;
        req.role = payload.role;
        next();
    };
}
