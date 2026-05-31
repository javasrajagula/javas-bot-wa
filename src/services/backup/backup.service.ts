import fs from 'fs';
import path from 'path';
import prisma from '../../db/client.js';
import { env } from '../../config/env.js';

export type BackupKind = 'db' | 'config';

export interface BackupInfo {
  id: string;
  kind: BackupKind;
  fileName: string;
  filePath: string;
  size: number;
  createdAt: Date;
}

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const pendingRestore = new Map<string, { backupId: string; expiresAt: number }>();

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function resolveSqlitePath(): string {
  const url = env.DATABASE_URL;
  if (!url.startsWith('file:')) {
    throw new Error('Backup database otomatis saat ini hanya mendukung SQLite file database.');
  }

  const dbPath = url.replace(/^file:/, '');
  if (path.isAbsolute(dbPath)) return dbPath;

  const prismaRelative = path.resolve(process.cwd(), 'prisma', dbPath);
  if (fs.existsSync(prismaRelative)) return prismaRelative;

  return path.resolve(process.cwd(), dbPath);
}

function isBackupFile(fileName: string) {
  return /^(db|config)-\d{4}-\d{2}-\d{2}T/.test(fileName);
}

export class BackupService {
  public get backupDir() {
    ensureBackupDir();
    return BACKUP_DIR;
  }

  public async createDatabaseBackup(): Promise<BackupInfo> {
    ensureBackupDir();
    const source = resolveSqlitePath();
    if (!fs.existsSync(source)) {
      throw new Error(`Database file tidak ditemukan: ${source}`);
    }

    const fileName = `db-${timestamp()}.db`;
    const filePath = path.join(BACKUP_DIR, fileName);
    await fs.promises.copyFile(source, filePath);
    await this.cleanupOldBackups();
    return this.infoFromFile(fileName);
  }

  public async createConfigBackup(): Promise<BackupInfo> {
    ensureBackupDir();
    const [
      groups,
      subscriptions,
      premiumUsers,
      warningRules,
      shopItems,
      achievements
    ] = await Promise.all([
      prisma.groupConfig.findMany(),
      prisma.groupSubscription.findMany(),
      prisma.premiumUser.findMany(),
      prisma.warningRule.findMany(),
      prisma.shopItem.findMany(),
      prisma.achievement.findMany()
    ]);

    const payload = {
      version: 1,
      createdAt: new Date().toISOString(),
      groups,
      subscriptions,
      premiumUsers,
      warningRules,
      shopItems,
      achievements
    };

    const fileName = `config-${timestamp()}.json`;
    const filePath = path.join(BACKUP_DIR, fileName);
    await fs.promises.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    await this.cleanupOldBackups();
    return this.infoFromFile(fileName);
  }

  public async createFullBackup(): Promise<BackupInfo[]> {
    const db = await this.createDatabaseBackup();
    const config = await this.createConfigBackup();
    return [db, config];
  }

  public listBackups(): BackupInfo[] {
    ensureBackupDir();
    return fs.readdirSync(BACKUP_DIR)
      .filter(isBackupFile)
      .map(fileName => this.infoFromFile(fileName))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public getBackup(id: string): BackupInfo | undefined {
    return this.listBackups().find(backup => backup.id === id || backup.fileName === id);
  }

  public requestRestore(ownerId: string, backupId: string): string {
    const backup = this.getBackup(backupId);
    if (!backup) {
      throw new Error(`Backup "${backupId}" tidak ditemukan.`);
    }
    if (backup.kind !== 'db') {
      throw new Error('Restore database hanya menerima backup jenis db.');
    }

    pendingRestore.set(ownerId, {
      backupId: backup.id,
      expiresAt: Date.now() + 60_000
    });
    return `RESTORE ${backup.id}`;
  }

  public async confirmRestore(ownerId: string, confirmation: string): Promise<BackupInfo> {
    const pending = pendingRestore.get(ownerId);
    if (!pending || pending.expiresAt < Date.now()) {
      pendingRestore.delete(ownerId);
      throw new Error('Tidak ada restore yang menunggu konfirmasi atau sudah kedaluwarsa.');
    }

    const expected = `RESTORE ${pending.backupId}`;
    if (confirmation.trim() !== expected) {
      throw new Error(`Konfirmasi salah. Ketik persis: ${expected}`);
    }

    const backup = this.getBackup(pending.backupId);
    if (!backup) {
      throw new Error('File backup tidak ditemukan saat restore.');
    }

    const target = resolveSqlitePath();
    const safetyBackup = await this.createDatabaseBackup();
    await fs.promises.copyFile(backup.filePath, target);
    pendingRestore.delete(ownerId);
    console.log(`[Backup] Database restored from ${backup.fileName}. Safety backup: ${safetyBackup.fileName}`);
    return backup;
  }

  public async exportConfigBuffer(): Promise<Buffer> {
    const backup = await this.createConfigBackup();
    return fs.promises.readFile(backup.filePath);
  }

  public async importConfigFromBuffer(buffer: Buffer): Promise<{ groups: number; subscriptions: number; premiumUsers: number; warningRules: number; shopItems: number; achievements: number }> {
    const payload = JSON.parse(buffer.toString('utf-8'));
    if (!payload || payload.version !== 1) {
      throw new Error('Format backup config tidak dikenali.');
    }

    const groups = Array.isArray(payload.groups) ? payload.groups : [];
    const subscriptions = Array.isArray(payload.subscriptions) ? payload.subscriptions : [];
    const premiumUsers = Array.isArray(payload.premiumUsers) ? payload.premiumUsers : [];
    const warningRules = Array.isArray(payload.warningRules) ? payload.warningRules : [];
    const shopItems = Array.isArray(payload.shopItems) ? payload.shopItems : [];
    const achievements = Array.isArray(payload.achievements) ? payload.achievements : [];

    for (const group of groups) {
      await prisma.groupConfig.upsert({
        where: { groupId: group.groupId },
        create: {
          groupId: group.groupId,
          prefix: group.prefix || '/',
          botEnabled: group.botEnabled ?? true,
          featuresJson: group.featuresJson || '{}',
          welcomeMessage: group.welcomeMessage || null,
          goodbyeMessage: group.goodbyeMessage || null
        },
        update: {
          prefix: group.prefix || '/',
          botEnabled: group.botEnabled ?? true,
          featuresJson: group.featuresJson || '{}',
          welcomeMessage: group.welcomeMessage || null,
          goodbyeMessage: group.goodbyeMessage || null
        }
      });
    }

    for (const sub of subscriptions) {
      await prisma.groupSubscription.upsert({
        where: { groupId: sub.groupId },
        create: {
          groupId: sub.groupId,
          plan: sub.plan || 'free',
          expiresAt: sub.expiresAt ? new Date(sub.expiresAt) : null,
          maxDailyCmd: sub.maxDailyCmd || null,
          featuresJson: sub.featuresJson || '{}'
        },
        update: {
          plan: sub.plan || 'free',
          expiresAt: sub.expiresAt ? new Date(sub.expiresAt) : null,
          maxDailyCmd: sub.maxDailyCmd || null,
          featuresJson: sub.featuresJson || '{}'
        }
      });
    }

    const { normalizePremiumUserId } = await import('../premium/premium.service.js');
    for (const pu of premiumUsers) {
      if (!pu.userId) continue;
      try {
        const normalizedUserId = normalizePremiumUserId(pu.userId);
        await prisma.premiumUser.upsert({
          where: { userId: normalizedUserId },
          create: { userId: normalizedUserId, expiresAt: pu.expiresAt ? new Date(pu.expiresAt) : new Date(0) },
          update: { expiresAt: pu.expiresAt ? new Date(pu.expiresAt) : new Date(0) }
        });
      } catch (err) {
        console.warn(`[Backup Service] Skipping invalid premium user import for: ${pu.userId}`);
      }
    }

    for (const wr of warningRules) {
      if (!wr.groupId) continue;
      // Insert new rule — clearing duplicates would require groupId+threshold unique which doesn't exist
      await prisma.warningRule.create({
        data: {
          groupId: wr.groupId,
          threshold: wr.threshold ?? 3,
          action: wr.action || 'kick',
          duration: wr.duration ?? null
        }
      }).catch(() => { /* Skip duplicates */ });
    }

    for (const item of shopItems) {
      if (!item.name) continue;
      await prisma.shopItem.upsert({
        where: { name: item.name },
        create: {
          name: item.name,
          type: item.type || 'misc',
          price: item.price ?? 0,
          metadataJson: item.metadataJson || '{}',
          enabled: item.enabled ?? true
        },
        update: {
          type: item.type || 'misc',
          price: item.price ?? 0,
          metadataJson: item.metadataJson || '{}',
          enabled: item.enabled ?? true
        }
      });
    }

    for (const ach of achievements) {
      if (!ach.key) continue;
      await prisma.achievement.upsert({
        where: { key: ach.key },
        create: {
          key: ach.key,
          name: ach.name || ach.key,
          description: ach.description || '',
          rarity: ach.rarity || 'common',
          rewardJson: ach.rewardJson || '{}'
        },
        update: {
          name: ach.name || ach.key,
          description: ach.description || '',
          rarity: ach.rarity || 'common',
          rewardJson: ach.rewardJson || '{}'
        }
      });
    }

    console.log(`[Backup] Import selesai: ${groups.length} grup, ${subscriptions.length} sewa, ${premiumUsers.length} premium, ${warningRules.length} warning rules, ${shopItems.length} shop items, ${achievements.length} achievements.`);

    return {
      groups: groups.length,
      subscriptions: subscriptions.length,
      premiumUsers: premiumUsers.length,
      warningRules: warningRules.length,
      shopItems: shopItems.length,
      achievements: achievements.length
    };
  }

  public async cleanupOldBackups(): Promise<void> {
    ensureBackupDir();
    const maxAgeMs = Math.max(1, env.BACKUP_RETENTION_DAYS) * 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const backup of this.listBackups()) {
      if (now - backup.createdAt.getTime() > maxAgeMs) {
        await fs.promises.unlink(backup.filePath).catch(() => undefined);
      }
    }
  }

  public startAutoBackup(intervalMs = 24 * 60 * 60 * 1000): NodeJS.Timeout | null {
    if (!env.AUTO_BACKUP_ENABLED) return null;

    const run = () => {
      this.createFullBackup().catch(err => console.error('[Backup] Auto backup failed:', err));
    };

    setTimeout(run, 30_000);
    return setInterval(run, intervalMs);
  }

  private infoFromFile(fileName: string): BackupInfo {
    const filePath = path.join(BACKUP_DIR, fileName);
    const stat = fs.statSync(filePath);
    const kind = fileName.startsWith('db-') ? 'db' : 'config';
    const id = fileName.replace(/\.(db|json)$/i, '');
    return {
      id,
      kind,
      fileName,
      filePath,
      size: stat.size,
      createdAt: stat.birthtime
    };
  }
}

export const backupService = new BackupService();
