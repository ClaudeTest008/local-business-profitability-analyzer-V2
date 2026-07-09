import { describe, expect, it } from 'vitest';
import { withRetry } from './retry.js';

const captureSleep = (sleeps: number[]) => async (ms: number) => {
  sleeps.push(ms);
};

describe('withRetry', () => {
  it('succeeds after 2 failures', async () => {
    const sleeps: number[] = [];
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        if (calls <= 2) throw new Error(`boom ${calls}`);
        return 'ok';
      },
      { attempts: 4, baseDelayMs: 100, factor: 2, maxDelayMs: 10_000, sleep: captureSleep(sleeps) },
    );
    expect(result).toBe('ok');
    expect(calls).toBe(3);
    expect(sleeps).toEqual([100, 200]);
  });

  it('delays follow base*factor^n capped at max', async () => {
    const sleeps: number[] = [];
    await expect(
      withRetry(() => Promise.reject(new Error('always')), {
        attempts: 5,
        baseDelayMs: 10,
        factor: 3,
        maxDelayMs: 50,
        sleep: captureSleep(sleeps),
      }),
    ).rejects.toThrow('always');
    expect(sleeps).toEqual([10, 30, 50, 50]);
  });

  it('rethrows the original error after the final attempt', async () => {
    const original = new Error('original failure');
    let calls = 0;
    await expect(
      withRetry(
        () => {
          calls += 1;
          return Promise.reject(original);
        },
        { attempts: 3, baseDelayMs: 1, factor: 2, maxDelayMs: 8, sleep: async () => {} },
      ),
    ).rejects.toBe(original);
    expect(calls).toBe(3);
  });

  it('does not sleep before the first attempt', async () => {
    const sleeps: number[] = [];
    await withRetry(() => Promise.resolve(1), {
      attempts: 3,
      baseDelayMs: 100,
      factor: 2,
      maxDelayMs: 1000,
      sleep: captureSleep(sleeps),
    });
    expect(sleeps).toEqual([]);
  });
});
