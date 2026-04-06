/**
 * Simple in-memory rate limiter for Next.js API routes.
 * For production, replace with Redis-backed solution (e.g. Upstash).
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window duration in seconds */
  windowSec: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSec * 1000;
  const entry = store.get(identifier);

  if (!entry || entry.resetAt < now) {
    store.set(identifier, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: config.limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= config.limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return {
    success: true,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
  };
}

/** Preset: AI endpoints — 10 requests per minute per user */
export const AI_RATE_LIMIT: RateLimitConfig = { limit: 10, windowSec: 60 };

/** Preset: General API — 60 requests per minute */
export const API_RATE_LIMIT: RateLimitConfig = { limit: 60, windowSec: 60 };
