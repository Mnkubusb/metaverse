import { requireAuth } from "./auth";

export const userMiddleware = requireAuth();
