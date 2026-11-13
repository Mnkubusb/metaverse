import { Redis } from "@upstash/redis";

// Upstash Redis over its REST API (works from serverless and edge functions).
// Reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from the environment.
// Server-side only: never import this from a "use client" component, the token would ship to browsers.
export const redis = Redis.fromEnv();
