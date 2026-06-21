import fs from 'fs';
import path from 'path';
import Redis from 'ioredis';
import { env } from '../../config/env.js';

export interface StateStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix?: string): Promise<string[]>;
  incr(key: string): Promise<number>;
  ttl(key: string): Promise<number>;
  listPush(key: string, value: string): Promise<void>;
  listRange(key: string, start: number, stop: number): Promise<string[]>;
  setex(key: string, ttlSeconds: number, value: string): Promise<void>;
}

interface StoredValue {
  value: unknown;
  expiresAt?: number;
}

export class MemoryStateStore implements StateStore {
  protected values = new Map<string, StoredValue>();

  async get<T>(key: string): Promise<T | undefined> {
    const item = this.values.get(key);
    if (!item) return undefined;
    if (item.expiresAt && item.expiresAt <= Date.now()) {
      this.values.delete(key);
      return undefined;
    }
    return item.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.values.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined
    });
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }

  async keys(prefix = ''): Promise<string[]> {
    const allKeys = [...this.values.keys()];
    return prefix ? allKeys.filter((key) => key.startsWith(prefix)) : allKeys;
  }

  async incr(key: string): Promise<number> {
    const current = await this.get<number>(key);
    const nextVal = (typeof current === 'number' ? current : 0) + 1;
    await this.set(key, nextVal);
    return nextVal;
  }

  async ttl(key: string): Promise<number> {
    const item = this.values.get(key);
    if (!item) return -2;
    if (item.expiresAt && item.expiresAt <= Date.now()) {
      this.values.delete(key);
      return -2;
    }
    if (!item.expiresAt) return -1;
    return Math.max(0, Math.ceil((item.expiresAt - Date.now()) / 1000));
  }

  async listPush(key: string, value: string): Promise<void> {
    const current = await this.get<string[]>(key) || [];
    current.push(value);
    await this.set(key, current);
  }

  async listRange(key: string, start: number, stop: number): Promise<string[]> {
    const current = await this.get<string[]>(key) || [];
    const normalizedStart = start < 0 ? current.length + start : start;
    const normalizedStop = stop < 0 ? current.length + stop : stop;
    return current.slice(normalizedStart, normalizedStop + 1);
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    await this.set(key, value, ttlSeconds);
  }
}

export class FileStateStore extends MemoryStateStore {
  private writeQueue: Promise<void> = Promise.resolve();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private readonly filePath = path.join(process.cwd(), 'data', 'state.json')) {
    super();
    this.load();
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), 5 * 60 * 1000);
    if (typeof this.cleanupInterval.unref === 'function') {
      this.cleanupInterval.unref();
    }
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) as Record<string, StoredValue>;
      this.values = new Map(Object.entries(raw));
      this.cleanupExpired();
    } catch (err) {
      console.error('[StateStore] Failed to load state file:', err);
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    let changed = false;
    for (const [key, item] of this.values.entries()) {
      if (item.expiresAt && item.expiresAt <= now) {
        this.values.delete(key);
        changed = true;
      }
    }
    if (changed) {
      this.persistAsync();
    }
  }

  private persistAsync(): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
        const data = JSON.stringify(Object.fromEntries(this.values), null, 2);
        await fs.promises.writeFile(this.filePath, data, 'utf-8');
      } catch (err) {
        console.error('[StateStore] Failed to write state file asynchronously:', err);
      }
    });
    return this.writeQueue;
  }

  override async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await super.set(key, value, ttlSeconds);
    await this.persistAsync();
  }

  override async delete(key: string): Promise<void> {
    await super.delete(key);
    await this.persistAsync();
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

export class RedisStateStore implements StateStore {
  private client: Redis;

  constructor(private readonly redisUrl: string) {
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    });
    this.client.on('error', (err) => {
      console.error('[RedisStateStore] Redis Connection Error:', err);
    });
  }

  get connectionString(): string {
    return this.redisUrl;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const data = await this.client.get(key);
    if (!data) return undefined;
    try {
      return JSON.parse(data) as T;
    } catch {
      return data as unknown as T;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const stringified = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, stringified);
    } else {
      await this.client.set(key, stringified);
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async keys(prefix = ''): Promise<string[]> {
    const pattern = prefix ? `${prefix}*` : '*';
    let cursor = '0';
    const keys: string[] = [];
    do {
      const [nextCursor, scanKeys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...scanKeys);
    } while (cursor !== '0');
    return keys;
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async listPush(key: string, value: string): Promise<void> {
    await this.client.rpush(key, value);
  }

  async listRange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.lrange(key, start, stop);
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    await this.client.setex(key, ttlSeconds, value);
  }
}

let storeInstance: StateStore;
if (env.USE_REDIS) {
  console.log('[StateStore] Initializing RedisStateStore with URL:', env.REDIS_URL);
  storeInstance = new RedisStateStore(env.REDIS_URL);
} else {
  storeInstance = new FileStateStore();
}

export const stateStore = storeInstance;
