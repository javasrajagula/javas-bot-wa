import crypto from 'crypto';

export interface RecentErrorRecord {
  id: string;
  scope: string;
  feature: string;
  message: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

const recentErrors = new Map<string, RecentErrorRecord>();
const MAX_RECENT_ERRORS = 100;

export function createErrorId(): string {
  return `ERR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export function rememberError(record: RecentErrorRecord): void {
  recentErrors.set(record.id, record);
  while (recentErrors.size > MAX_RECENT_ERRORS) {
    const first = recentErrors.keys().next().value;
    if (!first) break;
    recentErrors.delete(first);
  }
}

export function getRecentError(errorId: string): RecentErrorRecord | undefined {
  return recentErrors.get(errorId);
}

export function listRecentErrors(): RecentErrorRecord[] {
  return [...recentErrors.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function clearRecentErrors(): void {
  recentErrors.clear();
}

export function getErrorStats(): {
  total: number;
  byScope: Record<string, number>;
  byFeature: Record<string, number>;
} {
  const records = [...recentErrors.values()];
  const byScope: Record<string, number> = {};
  const byFeature: Record<string, number> = {};

  for (const record of records) {
    byScope[record.scope] = (byScope[record.scope] || 0) + 1;
    byFeature[record.feature] = (byFeature[record.feature] || 0) + 1;
  }

  return {
    total: records.length,
    byScope,
    byFeature
  };
}
