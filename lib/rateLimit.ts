interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 10;

// In-memory store. In production use Redis/Upstash KV for multi-instance deployments.
const store = new Map<string, RateLimitEntry>();

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  key: string,
  options: { windowMs?: number; maxRequests?: number } = {}
): RateLimitResult {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const now = Date.now();

  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, limit: maxRequests, remaining: maxRequests - 1, resetAt };
  }

  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    limit: maxRequests,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return "unknown";
}
