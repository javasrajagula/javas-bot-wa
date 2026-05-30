import crypto from 'crypto';
import { stateStore } from '../state/state-store.js';

export interface PrdEntry {
  id: string;
  type: string;
  scope: string;
  ownerId: string;
  text: string;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const COLLECTION_KEY = 'prd:entries';

async function allEntries(): Promise<PrdEntry[]> {
  return (await stateStore.get<PrdEntry[]>(COLLECTION_KEY)) || [];
}

async function saveEntries(entries: PrdEntry[]): Promise<void> {
  await stateStore.set(COLLECTION_KEY, entries);
}

export const prdStateService = {
  async create(input: Omit<PrdEntry, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: string }): Promise<PrdEntry> {
    const now = new Date().toISOString();
    const entry: PrdEntry = {
      ...input,
      id: crypto.randomBytes(4).toString('hex'),
      status: input.status || 'active',
      createdAt: now,
      updatedAt: now
    };
    const entries = await allEntries();
    entries.push(entry);
    await saveEntries(entries);
    return entry;
  },

  async list(type: string, scope: string): Promise<PrdEntry[]> {
    const entries = await allEntries();
    return entries
      .filter((entry) => entry.type === type && entry.scope === scope)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async updateStatus(type: string, scope: string, id: string, status: string): Promise<PrdEntry | undefined> {
    const entries = await allEntries();
    const entry = entries.find((item) => item.type === type && item.scope === scope && item.id === id);
    if (!entry) return undefined;
    entry.status = status;
    entry.updatedAt = new Date().toISOString();
    await saveEntries(entries);
    return entry;
  },

  async remove(type: string, scope: string, id: string): Promise<boolean> {
    const entries = await allEntries();
    const next = entries.filter((entry) => !(entry.type === type && entry.scope === scope && entry.id === id));
    await saveEntries(next);
    return next.length !== entries.length;
  },

  async clearByOwner(ownerId: string): Promise<number> {
    const entries = await allEntries();
    const next = entries.filter((entry) => entry.ownerId !== ownerId);
    await saveEntries(next);
    return entries.length - next.length;
  }
};
