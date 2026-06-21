import prisma from '../db/client.js';
import { stateStore } from '../services/state/state-store.js';
import { safeDelete } from '../utils/file.util.js';
import fs from 'fs';
import path from 'path';

export async function runRetentionCleanup(): Promise<void> {
  console.log('[Retention Worker] Starting data retention cleanup sweep...');
  
  const policies = await prisma.dataRetentionPolicy.findMany({
    where: { enabled: true }
  });

  let logsDeleted = 0;
  let errorLogsDeleted = 0;
  let usageLogsDeleted = 0;
  let groupLogsDeleted = 0;

  for (const policy of policies) {
    const ms = durationToMs(policy.duration);
    if (!ms) continue;
    const cutoff = new Date(Date.now() - ms);

    if (policy.scope === 'logs') {
      // Clean AuditLogs
      const auditRes = await prisma.auditLog.deleteMany({
        where: {
          groupId: policy.groupId,
          createdAt: { lt: cutoff }
        }
      });
      logsDeleted += auditRes.count;

      // Clean ErrorLogs
      const errRes = await prisma.errorLog.deleteMany({
        where: {
          createdAt: { lt: cutoff }
        }
      });
      errorLogsDeleted += errRes.count;

      // Clean UsageLogs
      const usageRes = await prisma.usageLog.deleteMany({
        where: {
          groupId: policy.groupId,
          createdAt: { lt: cutoff }
        }
      });
      usageLogsDeleted += usageRes.count;

      // Clean GroupLogs
      const groupRes = await prisma.groupLog.deleteMany({
        where: {
          groupId: policy.groupId || undefined,
          createdAt: { lt: cutoff }
        }
      });
      groupLogsDeleted += groupRes.count;
    }

    if (policy.scope === 'media' || policy.scope === 'messages') {
      // Clean temporary state records
      await prisma.queueJobRecord.deleteMany({
        where: {
          groupId: policy.groupId,
          status: { in: ['completed', 'failed', 'cancelled'] },
          updatedAt: { lt: cutoff }
        }
      });
    }
  }

  // Always run global temp files cleanups
  const tempDir = path.join(process.cwd(), 'temp');
  const outputDir = path.join(process.cwd(), 'output');
  cleanDirectoryOlderThan(tempDir, 24 * 60 * 60 * 1000); // delete files older than 24h
  cleanDirectoryOlderThan(outputDir, 24 * 60 * 60 * 1000);

  const timestamp = Date.now();
  await stateStore.set('retention:last_cleanup', timestamp);

  console.log(
    `[Retention Worker] Cleanup finished. Deleted: ${logsDeleted} audit logs, ` +
    `${errorLogsDeleted} error logs, ${usageLogsDeleted} usage logs, ${groupLogsDeleted} group logs.`
  );

  // Write a summary audit log
  await prisma.auditLog.create({
    data: {
      action: 'retention_cleanup',
      target: 'system',
      metadataJson: JSON.stringify({
        timestamp,
        logsDeleted,
        errorLogsDeleted,
        usageLogsDeleted,
        groupLogsDeleted
      })
    }
  }).catch(() => {});
}

function durationToMs(duration: string): number | null {
  const match = duration.match(/^(\d+)(h|d)$/);
  if (!match) return null;
  const val = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === 'h') return val * 60 * 60 * 1000;
  if (unit === 'd') return val * 24 * 60 * 60 * 1000;
  return null;
}

function cleanDirectoryOlderThan(dirPath: string, ageMs: number): void {
  try {
    if (!fs.existsSync(dirPath)) return;
    const files = fs.readdirSync(dirPath);
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      if (stat.isFile() && now - stat.mtimeMs > ageMs) {
        safeDelete(filePath);
      }
    }
  } catch (err) {
    console.error(`[Retention Worker] Failed to clean directory ${dirPath}:`, err);
  }
}

export function startRetentionWorker(intervalMs = 60 * 60 * 1000): NodeJS.Timeout {
  console.log(`[Retention Worker] Initialized with interval of ${intervalMs / 1000}s`);
  
  // Run immediately on boot
  runRetentionCleanup().catch(err => {
    console.error('[Retention Worker] Boot cleanup failed:', err);
  });

  const interval = setInterval(() => {
    runRetentionCleanup().catch(err => {
      console.error('[Retention Worker] Scheduled cleanup failed:', err);
    });
  }, intervalMs);

  if (typeof interval.unref === 'function') {
    interval.unref();
  }
  return interval;
}
