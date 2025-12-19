type CacheEntry<T> =
  | { expiresAt: number; value: T }
  | { expiresAt: number; promise: Promise<T> };

const DEFAULT_MAX_ENTRIES = 1000;

export class TtlCache {
  private map = new Map<string, CacheEntry<any>>();
  private maxEntries: number;

  constructor(maxEntries = DEFAULT_MAX_ENTRIES) {
    this.maxEntries = maxEntries;
  }

  get<T>(key: string): T | undefined {
    const entry = this.map.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    if ("value" in entry) return entry.value;
    return undefined;
  }

  async getOrSet<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const existing = this.map.get(key) as CacheEntry<T> | undefined;

    if (existing && now < existing.expiresAt) {
      if ("value" in existing) return existing.value;
      return existing.promise;
    }

    const promise = factory();
    const expiresAt = now + Math.max(0, ttlMs);
    this.map.set(key, { expiresAt, promise });
    this.evictIfNeeded();

    try {
      const value = await promise;
      // If another call overwrote the key, don't clobber it.
      const current = this.map.get(key) as CacheEntry<T> | undefined;
      if (current && "promise" in current && current.promise === promise) {
        this.map.set(key, { expiresAt, value });
      }
      return value;
    } catch (err) {
      const current = this.map.get(key) as CacheEntry<T> | undefined;
      if (current && "promise" in current && current.promise === promise) {
        this.map.delete(key);
      }
      throw err;
    }
  }

  private evictIfNeeded() {
    if (this.map.size <= this.maxEntries) return;
    const overflow = this.map.size - this.maxEntries;
    const keys = this.map.keys();
    for (let i = 0; i < overflow; i++) {
      const k = keys.next();
      if (k.done) break;
      this.map.delete(k.value);
    }
  }
}

export const sharedTtlCache = new TtlCache();
