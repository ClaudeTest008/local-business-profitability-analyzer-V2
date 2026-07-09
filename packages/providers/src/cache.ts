export interface CacheEntry {
  value: unknown;
  /** Epoch ms of the underlying fetch. */
  fetchedAt: number;
  providerId: string;
}

export interface CacheStore {
  get(key: string): Promise<CacheEntry | undefined>;
  set(key: string, entry: CacheEntry): Promise<void>;
}

/** Bounded in-memory store with FIFO eviction (Map preserves insertion order). */
export class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(private readonly maxEntries = 500) {}

  get(key: string): Promise<CacheEntry | undefined> {
    return Promise.resolve(this.entries.get(key));
  }

  set(key: string, entry: CacheEntry): Promise<void> {
    if (!this.entries.has(key) && this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, entry);
    return Promise.resolve();
  }
}
