import { describe, expect, it } from 'vitest';
import { MemoryStateStore } from '../services/state/state-store.js';

describe('MemoryStateStore Operations', () => {
  it('should increment a key correctly', async () => {
    const store = new MemoryStateStore();
    expect(await store.incr('counter')).toBe(1);
    expect(await store.incr('counter')).toBe(2);
    expect(await store.get('counter')).toBe(2);
  });

  it('should return correct TTL in seconds', async () => {
    const store = new MemoryStateStore();
    await store.set('temp', 'value', 10);
    const ttl = await store.ttl('temp');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(10);

    const infiniteTtl = await store.ttl('counter'); // counter doesn't exist yet, returns -2
    expect(infiniteTtl).toBe(-2);

    await store.set('permanent', 'value');
    const permanentTtl = await store.ttl('permanent');
    expect(permanentTtl).toBe(-1);
  });

  it('should perform list operations correctly', async () => {
    const store = new MemoryStateStore();
    await store.listPush('mylist', 'item1');
    await store.listPush('mylist', 'item2');
    await store.listPush('mylist', 'item3');

    const list = await store.listRange('mylist', 0, -1);
    expect(list).toEqual(['item1', 'item2', 'item3']);

    const slice = await store.listRange('mylist', 1, 2);
    expect(slice).toEqual(['item2', 'item3']);
  });

  it('should perform setex correctly', async () => {
    const store = new MemoryStateStore();
    await store.setex('foo', 5, 'bar');
    expect(await store.get('foo')).toBe('bar');
    const ttl = await store.ttl('foo');
    expect(ttl).toBeGreaterThan(0);
  });
});
