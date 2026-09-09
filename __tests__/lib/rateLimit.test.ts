import { describe, it, expect, vi, beforeEach } from "vitest";
import { rateLimit } from "@/lib/rateLimit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it("allows requests under the limit", () => {
    const result = rateLimit("client-1", { windowMs: 60_000, maxRequests: 3 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("blocks requests over the limit", () => {
    const key = "client-2";
    rateLimit(key, { windowMs: 60_000, maxRequests: 2 });
    rateLimit(key, { windowMs: 60_000, maxRequests: 2 });
    const result = rateLimit(key, { windowMs: 60_000, maxRequests: 2 });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets after the window expires", () => {
    const key = "client-3";
    rateLimit(key, { windowMs: 60_000, maxRequests: 1 });
    const blocked = rateLimit(key, { windowMs: 60_000, maxRequests: 1 });
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(61_000);

    const reset = rateLimit(key, { windowMs: 60_000, maxRequests: 1 });
    expect(reset.allowed).toBe(true);
    expect(reset.remaining).toBe(0);
  });
});
