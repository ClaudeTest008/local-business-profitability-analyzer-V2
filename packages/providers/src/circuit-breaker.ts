import type { Clock } from './types.js';

export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

export type CircuitState = 'closed' | 'open' | 'half_open';

/**
 * closed → (failureThreshold consecutive failures) → open → (cooldownMs elapsed) →
 * half_open → one trial: success closes and resets, failure reopens.
 */
export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  private internalState: 'closed' | 'open' = 'closed';

  constructor(
    private readonly opts: { failureThreshold: number; cooldownMs: number; clock: Clock },
  ) {}

  get state(): CircuitState {
    if (
      this.internalState === 'open' &&
      this.opts.clock() - this.openedAt >= this.opts.cooldownMs
    ) {
      return 'half_open';
    }
    return this.internalState;
  }

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    const state = this.state;
    if (state === 'open') {
      throw new CircuitOpenError(
        `circuit open after ${this.failures} consecutive failures; retry after ${this.opts.cooldownMs}ms cooldown`,
      );
    }
    // ponytail: concurrent half_open trials are not serialized; the chain resolves sequentially.
    try {
      const result = await fn();
      this.internalState = 'closed';
      this.failures = 0;
      return result;
    } catch (e) {
      this.failures += 1;
      if (state === 'half_open' || this.failures >= this.opts.failureThreshold) {
        this.internalState = 'open';
        this.openedAt = this.opts.clock();
      }
      throw e;
    }
  }
}
