import type { Redis } from 'ioredis';
import { MemoryCacheStore } from '@lboa/providers';
import type { CacheEntry, CacheStore } from '@lboa/providers';
import type { Env } from './env.js';

export { MemoryCacheStore };

export const FRESH_TTL_MS = 60 * 60 * 1000; // 1h
export const STALE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7d

const KEY_PREFIX = 'lboa:cache:';

/** Adapts the @lboa/providers CacheStore contract onto Redis (JSON-serialized entries). */
export class RedisCacheStore implements CacheStore {
  constructor(
    private readonly redis: Redis,
    private readonly ttlMs: number = STALE_TTL_MS,
  ) {}

  async get(key: string): Promise<CacheEntry | undefined> {
    const raw = await this.redis.get(KEY_PREFIX + key);
    return raw === null ? undefined : (JSON.parse(raw) as CacheEntry);
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    await this.redis.set(KEY_PREFIX + key, JSON.stringify(entry), 'PX', this.ttlMs);
  }
}

/** Redis when REDIS_URL is set, in-memory otherwise. ioredis is imported lazily so no connection is ever attempted without REDIS_URL. */
export async function selectCache(env: Env): Promise<CacheStore> {
  if (env.REDIS_URL) {
    const { default: RedisCtor } = await import('ioredis');
    return new RedisCacheStore(new RedisCtor(env.REDIS_URL), STALE_TTL_MS);
  }
  return new MemoryCacheStore();
}
