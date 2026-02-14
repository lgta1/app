import { createClient } from "redis";

type CacheEntry<T> =
  | { expiresAt: number; value: T }
  | { expiresAt: number; promise: Promise<T> };

const DEFAULT_MAX_ENTRIES = 1000;

let redisClient: ReturnType<typeof createClient> | null = null;
let redisReady = false;
let redisInitAttempted = false;

const getRedisClient = async () => {
  if (redisReady && redisClient) return redisClient;

  const redisUrl = (process.env.REDIS_URL || "").trim();
  if (!redisUrl) return null;
  if (redisInitAttempted && !redisReady) return null;

  redisInitAttempted = true;
  try {
    if (!redisClient) {
      redisClient = createClient({ url: redisUrl, socket: { connectTimeout: 1000 } });
      redisClient.on("error", () => {
        redisReady = false;
      });
    }

    if (!redisClient.isOpen) {
      await redisClient.connect();
    }

    redisReady = true;
    return redisClient;
  } catch {
    redisReady = false;
    return null;
  }
};

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
    const redis = await getRedisClient();

    if (redis) {
      const redisKey = `ww:${key}`;
      const cached = await redis.get(redisKey);
      if (cached !== null) {
        return JSON.parse(cached) as T;
      }
    }

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

      if (redis) {
        const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
        await redis.set(`ww:${key}`, JSON.stringify(value), { EX: ttlSec });
      }

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
