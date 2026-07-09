import type { ProviderOutcome } from '@lboa/types';
import { stableStringify } from '@lboa/shared';
import type { CacheStore } from './cache.js';
import type { CircuitBreaker } from './circuit-breaker.js';
import type { TokenBucketRateLimiter } from './rate-limiter.js';
import { withRetry } from './retry.js';
import type { RetryOpts } from './retry.js';
import type { Clock, DataProvider } from './types.js';

export interface ProviderChainOpts<Req, Res> {
  primary: DataProvider<Req, Res>;
  fallbacks: DataProvider<Req, Res>[];
  cache: CacheStore;
  freshTtlMs: number;
  staleTtlMs: number;
  clock: Clock;
  retry?: RetryOpts;
  breakerByProvider?: Map<string, CircuitBreaker>;
  rateLimiter?: TokenBucketRateLimiter;
}

const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Resolution order: fresh cache → primary → fallbacks (in order) → stale cache → failure.
 * Every provider call goes through breaker(retry(rate-limited fetch)) where each layer is
 * configured; an open breaker fails instantly so the chain moves straight to the next provider.
 */
export class ProviderChain<Req, Res> {
  constructor(private readonly opts: ProviderChainOpts<Req, Res>) {}

  cacheKey(req: Req): string {
    return `${this.opts.primary.id}:${stableStringify(req)}`;
  }

  async resolve(req: Req): Promise<ProviderOutcome<Res>> {
    const key = this.cacheKey(req);
    const entry = await this.opts.cache.get(key);
    const now = this.opts.clock();

    if (entry && now - entry.fetchedAt < this.opts.freshTtlMs) {
      return {
        status: 'cache',
        providerId: entry.providerId,
        data: entry.value as Res,
        fetchedAt: new Date(entry.fetchedAt).toISOString(),
      };
    }

    const providers = [this.opts.primary, ...this.opts.fallbacks];
    const errors: string[] = [];
    for (const provider of providers) {
      try {
        const data = await this.fetchVia(provider, req);
        const fetchedAt = this.opts.clock();
        await this.opts.cache.set(key, { value: data, fetchedAt, providerId: provider.id });
        return {
          status: provider.id === this.opts.primary.id ? 'primary' : 'fallback',
          providerId: provider.id,
          data,
          fetchedAt: new Date(fetchedAt).toISOString(),
        };
      } catch (e) {
        errors.push(`${provider.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (entry && now - entry.fetchedAt < this.opts.staleTtlMs) {
      return {
        status: 'stale_cache',
        providerId: entry.providerId,
        data: entry.value as Res,
        fetchedAt: new Date(entry.fetchedAt).toISOString(),
      };
    }

    return {
      status: 'failure',
      providerId: this.opts.primary.id,
      error: `all ${providers.length} providers failed — ${errors.join('; ')}`,
    };
  }

  private fetchVia(provider: DataProvider<Req, Res>, req: Req): Promise<Res> {
    const { rateLimiter, retry } = this.opts;
    const call = async (): Promise<Res> => {
      if (rateLimiter) await rateLimiter.acquire(retry?.sleep ?? realSleep);
      return provider.fetch(req);
    };
    const retried = retry ? () => withRetry(call, retry) : call;
    const breaker = this.opts.breakerByProvider?.get(provider.id);
    return breaker ? breaker.exec(retried) : retried();
  }
}
