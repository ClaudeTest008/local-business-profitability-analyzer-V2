export interface RetryOpts {
  attempts: number;
  baseDelayMs: number;
  factor: number;
  maxDelayMs: number;
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retries fn on any rejection. Delay before retry n (1-based) is
 * min(baseDelayMs * factor^(n-1), maxDelayMs) — exponential backoff, NO jitter,
 * so the delay sequence is fully deterministic. After the final attempt the
 * original (last) error is rethrown.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOpts): Promise<T> {
  if (opts.attempts < 1) throw new Error(`withRetry: attempts must be >= 1, got ${opts.attempts}`);
  const sleep = opts.sleep ?? realSleep;
  let lastError: unknown;
  for (let attempt = 0; attempt < opts.attempts; attempt++) {
    if (attempt > 0) {
      await sleep(Math.min(opts.baseDelayMs * opts.factor ** (attempt - 1), opts.maxDelayMs));
    }
    try {
      return await fn();
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}
