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
