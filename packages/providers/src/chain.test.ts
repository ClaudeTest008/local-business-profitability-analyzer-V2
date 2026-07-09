import { describe, expect, it } from 'vitest';
import { MemoryCacheStore } from './cache.js';
import { ProviderChain } from './chain.js';
import { CircuitBreaker } from './circuit-breaker.js';
import type { DataProvider } from './types.js';

type Req = { q: string };

const REQ: Req = { q: 'berlin' };

function makeProvider(
  id: string,
  impl: () => Promise<string>,
): DataProvider<Req, string> & {
  calls: number;
} {
  const provider = {
    id,
    calls: 0,
    fetch(): Promise<string> {
      provider.calls += 1;
      return impl();
    },
  };
  return provider;
}

function makeChain(overrides: {
  primary: DataProvider<Req, string>;
  fallbacks?: DataProvider<Req, string>[];
  cache?: MemoryCacheStore;
  clock?: () => number;
  breakerByProvider?: Map<string, CircuitBreaker>;
}) {
  return new ProviderChain<Req, string>({
    primary: overrides.primary,
    fallbacks: overrides.fallbacks ?? [],
    cache: overrides.cache ?? new MemoryCacheStore(),
    freshTtlMs: 1000,
    staleTtlMs: 10_000,
    clock: overrides.clock ?? (() => 1_000_000),
    retry: { attempts: 2, baseDelayMs: 1, factor: 2, maxDelayMs: 4, sleep: async () => {} },
  });
}

describe('ProviderChain.resolve', () => {
  it('primary success returns status primary and writes the cache', async () => {
    const primary = makeProvider('overpass', () => Promise.resolve('live-data'));
    const cache = new MemoryCacheStore();
    const chain = makeChain({ primary, cache });

    const outcome = await chain.resolve(REQ);
    expect(outcome).toEqual({
      status: 'primary',
      providerId: 'overpass',
      data: 'live-data',
      fetchedAt: new Date(1_000_000).toISOString(),
    });
    const entry = await cache.get(chain.cacheKey(REQ));
    expect(entry).toEqual({ value: 'live-data', fetchedAt: 1_000_000, providerId: 'overpass' });
  });

  it('fresh cache hit short-circuits without calling any provider', async () => {
    const primary = makeProvider('overpass', () => Promise.resolve('live-data'));
    const cache = new MemoryCacheStore();
    let now = 1_000_000;
    const chain = makeChain({ primary, cache, clock: () => now });

    await chain.resolve(REQ); // seeds cache
    now += 999; // still < freshTtlMs 1000
    const outcome = await chain.resolve(REQ);
    expect(outcome.status).toBe('cache');
    expect(outcome).toMatchObject({
      providerId: 'overpass',
      data: 'live-data',
      fetchedAt: new Date(1_000_000).toISOString(),
    });
    expect(primary.calls).toBe(1);
  });

  it('primary failure falls back with status fallback', async () => {
    const primary = makeProvider('overpass', () => Promise.reject(new Error('HTTP 504')));
    const fallback = makeProvider('fixture', () => Promise.resolve('fixture-data'));
    const chain = makeChain({ primary, fallbacks: [fallback] });

    const outcome = await chain.resolve(REQ);
    expect(outcome).toMatchObject({
      status: 'fallback',
      providerId: 'fixture',
      data: 'fixture-data',
    });
    expect(primary.calls).toBe(2); // retry attempts: 2
    expect(fallback.calls).toBe(1);
  });

  it('all providers fail with a stale entry returns stale_cache', async () => {
    let healthy = true;
    const primary = makeProvider('overpass', () =>
      healthy ? Promise.resolve('old-data') : Promise.reject(new Error('HTTP 504')),
    );
    const cache = new MemoryCacheStore();
    let now = 1_000_000;
    const chain = makeChain({ primary, cache, clock: () => now });

    await chain.resolve(REQ); // seeds cache at 1_000_000
    healthy = false;
    now += 5000; // past freshTtlMs 1000, within staleTtlMs 10_000
    const outcome = await chain.resolve(REQ);
    expect(outcome).toEqual({
      status: 'stale_cache',
      providerId: 'overpass',
      data: 'old-data',
      fetchedAt: new Date(1_000_000).toISOString(),
    });
  });

  it('all providers fail with no cache returns failure naming each provider', async () => {
    const primary = makeProvider('overpass', () => Promise.reject(new Error('HTTP 504')));
    const fallback = makeProvider('fixture', () => Promise.reject(new Error('disk corrupt')));
    const chain = makeChain({ primary, fallbacks: [fallback] });

    const outcome = await chain.resolve(REQ);
    expect(outcome.status).toBe('failure');
    if (outcome.status !== 'failure') throw new Error('unreachable');
    expect(outcome.providerId).toBe('overpass');
    expect(outcome.error).toContain('overpass: HTTP 504');
    expect(outcome.error).toContain('fixture: disk corrupt');
    expect(outcome.error).toContain('all 2 providers failed');
  });

  it('open breaker on primary skips straight to fallback without calling primary', async () => {
    const primary = makeProvider('overpass', () => Promise.resolve('never'));
    const fallback = makeProvider('fixture', () => Promise.resolve('fixture-data'));
    const breaker = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 60_000, clock: () => 0 });
    await expect(breaker.exec(() => Promise.reject(new Error('x')))).rejects.toThrow('x');
    expect(breaker.state).toBe('open');

    const chain = new ProviderChain<Req, string>({
      primary,
      fallbacks: [fallback],
      cache: new MemoryCacheStore(),
      freshTtlMs: 1000,
      staleTtlMs: 10_000,
      clock: () => 1_000_000,
      breakerByProvider: new Map([['overpass', breaker]]),
    });

    const outcome = await chain.resolve(REQ);
    expect(outcome).toMatchObject({ status: 'fallback', providerId: 'fixture' });
    expect(primary.calls).toBe(0);
    if (outcome.status === 'failure') throw new Error('unreachable');
  });
});

describe('MemoryCacheStore', () => {
  it('evicts the oldest entry (FIFO) once maxEntries is reached', async () => {
    const store = new MemoryCacheStore(2);
    await store.set('a', { value: 1, fetchedAt: 0, providerId: 'p' });
    await store.set('b', { value: 2, fetchedAt: 0, providerId: 'p' });
    await store.set('a', { value: 10, fetchedAt: 0, providerId: 'p' }); // overwrite, no eviction
    await store.set('c', { value: 3, fetchedAt: 0, providerId: 'p' }); // evicts 'a' (oldest)
    expect(await store.get('a')).toBeUndefined();
    expect((await store.get('b'))?.value).toBe(2);
    expect((await store.get('c'))?.value).toBe(3);
  });
});
