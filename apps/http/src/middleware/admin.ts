import { requireAuth } from "./auth";

export const adminMiddleware = requireAuth("Admin");
