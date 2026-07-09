import { describe, expect, it } from 'vitest';
import { TokenBucketRateLimiter } from './rate-limiter.js';

describe('TokenBucketRateLimiter', () => {
  it('respects capacity and refills with clock advance', () => {
    let now = 0;
    const rl = new TokenBucketRateLimiter({ capacity: 2, refillPerSecond: 1, clock: () => now });

    expect(rl.tryAcquire()).toBe(true);
    expect(rl.tryAcquire()).toBe(true);
    expect(rl.tryAcquire()).toBe(false);

    now = 1000; // +1 token
    expect(rl.tryAcquire()).toBe(true);
    expect(rl.tryAcquire()).toBe(false);

    now = 60_000; // refill caps at capacity 2
    expect(rl.tryAcquire()).toBe(true);
    expect(rl.tryAcquire()).toBe(true);
    expect(rl.tryAcquire()).toBe(false);
  });

  it('acquire waits via injected sleep until a token refills', async () => {
    let now = 0;
    const rl = new TokenBucketRateLimiter({ capacity: 1, refillPerSecond: 2, clock: () => now });
    expect(rl.tryAcquire()).toBe(true); // bucket empty

    const sleeps: number[] = [];
    await rl.acquire(async (ms) => {
      sleeps.push(ms);
      now += ms; // fake clock advances exactly by the sleep
    });
    expect(sleeps).toEqual([500]); // 1 token / 2 per second = 500ms
    expect(rl.tryAcquire()).toBe(false); // acquire consumed the refilled token
  });

  it('rejects invalid configuration', () => {
    expect(
      () => new TokenBucketRateLimiter({ capacity: 0, refillPerSecond: 1, clock: () => 0 }),
    ).toThrow('capacity');
    expect(
      () => new TokenBucketRateLimiter({ capacity: 1, refillPerSecond: 0, clock: () => 0 }),
    ).toThrow('refillPerSecond');
  });
});
