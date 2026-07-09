import { describe, expect, it } from 'vitest';
import { CircuitBreaker, CircuitOpenError } from './circuit-breaker.js';

const fail = () => Promise.reject(new Error('upstream down'));

describe('CircuitBreaker', () => {
  it('opens after threshold, rejects instantly while open, half-opens after cooldown, closes on success', async () => {
    let now = 0;
    const cb = new CircuitBreaker({ failureThreshold: 2, cooldownMs: 1000, clock: () => now });

    await expect(cb.exec(fail)).rejects.toThrow('upstream down');
    expect(cb.state).toBe('closed');
    await expect(cb.exec(fail)).rejects.toThrow('upstream down');
    expect(cb.state).toBe('open');

    // open: rejects immediately with CircuitOpenError, fn never called
    let called = false;
    await expect(
      cb.exec(() => {
        called = true;
        return Promise.resolve(1);
      }),
    ).rejects.toBeInstanceOf(CircuitOpenError);
    expect(called).toBe(false);

    now = 999;
    expect(cb.state).toBe('open');
    now = 1000;
    expect(cb.state).toBe('half_open');

    // half_open success closes and resets
    await expect(cb.exec(() => Promise.resolve(42))).resolves.toBe(42);
    expect(cb.state).toBe('closed');

    // reset: one failure no longer opens (threshold 2)
    await expect(cb.exec(fail)).rejects.toThrow('upstream down');
    expect(cb.state).toBe('closed');
  });

  it('reopens when the half-open trial fails', async () => {
    let now = 0;
    const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 500, clock: () => now });

    await expect(cb.exec(fail)).rejects.toThrow('upstream down');
    expect(cb.state).toBe('open');

    now = 500;
    expect(cb.state).toBe('half_open');
    await expect(cb.exec(fail)).rejects.toThrow('upstream down');
    expect(cb.state).toBe('open');

    // full cooldown required again from the reopen time
    now = 999;
    expect(cb.state).toBe('open');
    now = 1000;
    expect(cb.state).toBe('half_open');
  });
});
