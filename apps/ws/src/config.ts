const secret = process.env.JWT_SECRET;
if (!secret) {
    throw new Error("JWT_SECRET env var is not set");
}
if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production");
}
export const JWT_SECRET: string = secret;
