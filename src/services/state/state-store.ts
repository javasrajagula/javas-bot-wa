import fs from 'fs';
import path from 'path';

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
  constructor(private readonly filePath = path.join(process.cwd(), 'data', 'state.json')) {
    super();
    this.load();
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) as Record<string, StoredValue>;
      this.values = new Map(Object.entries(raw));
    } catch (err) {
      console.error('[StateStore] Failed to load state file:', err);
    }
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(Object.fromEntries(this.values), null, 2), 'utf-8');
  }

  override async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await super.set(key, value, ttlSeconds);
    this.persist();
  }

  override async delete(key: string): Promise<void> {
    await super.delete(key);
    this.persist();
  }
}

export class RedisStateStore extends MemoryStateStore {
  constructor(private readonly redisUrl: string) {
    super();
  }

  get connectionString(): string {
    return this.redisUrl;
  }
}

export const stateStore = new FileStateStore();
