import type { Clock } from './types.js';

/** Token bucket: starts full, refills continuously at refillPerSecond up to capacity. */
export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(private readonly opts: { capacity: number; refillPerSecond: number; clock: Clock }) {
    if (opts.capacity < 1 || opts.refillPerSecond <= 0) {
      throw new Error(
        `TokenBucketRateLimiter: capacity must be >= 1 and refillPerSecond > 0, got capacity=${opts.capacity}, refillPerSecond=${opts.refillPerSecond}`,
      );
    }
    this.tokens = opts.capacity;
    this.lastRefill = opts.clock();
  }

  private refill(): void {
    const now = this.opts.clock();
    const elapsedMs = now - this.lastRefill;
    if (elapsedMs <= 0) return;
    this.tokens = Math.min(
      this.opts.capacity,
      this.tokens + (elapsedMs / 1000) * this.opts.refillPerSecond,
    );
    this.lastRefill = now;
  }

  tryAcquire(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  /** Waits (via the injected sleep) until a token is available, then takes it. */
  async acquire(sleep: (ms: number) => Promise<void>): Promise<void> {
    while (!this.tryAcquire()) {
      const deficitMs = Math.ceil(((1 - this.tokens) / this.opts.refillPerSecond) * 1000);
      await sleep(Math.max(1, deficitMs));
    }
  }
}
