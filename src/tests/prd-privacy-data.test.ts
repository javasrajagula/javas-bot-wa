import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import prisma from '../db/client.js';
import { routeMessage } from '../commands/index.js';
import { redactLogLine, redactText } from '../utils/mask.util.js';
import { env } from '../config/env.js';

describe('PRD Batch 1D — Privacy, Data & Compliance + Security (F008-F020)', () => {
  const groupId = 'test-privacy-group@g.us';
  const userId = '628129999999@s.whatsapp.net';
  const adminId = '628128888888@s.whatsapp.net';
  const ownerId = '628127777777@s.whatsapp.net';

  let mockAdapter: any;
  let sentMessages: { chatId: string; text: string; options?: any }[] = [];
  let deletedMessages: { chatId: string; id: string; senderId?: string }[] = [];

  beforeAll(async () => {
    // Set environment for owner check
    process.env.OWNER_IDS = '628127777777';
    env.OWNER_IDS = '628127777777';

    // Dynamically load command handlers
    await import('../commands/moderation/dynamic-security.command.js');
    await import('../commands/privacy/privacy-data.command.js');
    await import('../commands/text/ai.command.js');
    await import('../commands/economy.command.js');

    // Clean up DB
    await prisma.groupConfig.deleteMany({ where: { groupId } });
    await prisma.customVariable.deleteMany({ where: { groupId } });
    await prisma.customVariable.deleteMany({ where: { groupId: 'global' } });
    await prisma.warning.deleteMany({ where: { groupId } });
    await prisma.auditLog.deleteMany({ where: { groupId } });
    await prisma.auditLog.deleteMany({ where: { groupId: 'private' } });

    mockAdapter = {
      sock: {
        groupMetadata: async (jid: string) => {
          return {
            id: jid,
            participants: [
              { id: adminId, admin: 'admin' },
              { id: userId, admin: null }
            ]
          };
        },
        groupParticipantsUpdate: async (jid: string, participants: string[], action: string) => {
          return [];
        }
      },
      sendMessage: async (chatId: string, text: string, options?: any) => {
        sentMessages.push({ chatId, text, options });
        return { key: { id: 'mock-msg-' + Math.random() } };
      },
      deleteMessage: async (chatId: string, id: string, senderId?: string) => {
        deletedMessages.push({ chatId, id, senderId });
      }
    };
  });

  beforeEach(async () => {
    sentMessages = [];
    deletedMessages = [];

    // Clean up consent variables between runs
    await prisma.customVariable.deleteMany({
      where: { key: 'consent:ai' }
    });

    // Setup base group config with necessary flags enabled
    await prisma.groupConfig.upsert({
      where: { groupId },
      create: {
        groupId,
        botEnabled: true,
        featuresJson: JSON.stringify({
          antitagall: false,
          antitagallLimit: 5,
          antitagallMode: 'delete',
          anonanalytics: false,
          sensitivelog: false,
          consentai: false,
          privateguard: false,
          privacynotice: true,
          economy: true,
          prd_ai: true
        })
      },
      update: {
        botEnabled: true,
        featuresJson: JSON.stringify({
          antitagall: false,
          antitagallLimit: 5,
          antitagallMode: 'delete',
          anonanalytics: false,
          sensitivelog: false,
          consentai: false,
          privateguard: false,
          privacynotice: true,
          economy: true,
          prd_ai: true
        })
      }
    });

    // Seed mock user data for export/delete tests
    await prisma.userProfile.upsert({
      where: { userId },
      create: { userId, title: 'Banding Tester' },
      update: { title: 'Banding Tester' }
    });

    // Enable premium subscription to prevent FREE/BASIC block in router
    await prisma.groupSubscription.upsert({
      where: { groupId },
      create: {
        groupId,
        plan: 'premium',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      update: {
        plan: 'premium',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
  });

  // Helper to trigger message
  async function trigger(sender: string, body: string, isCommand = false, commandName = '', args: string[] = []) {
    const ctx = {
      id: 'msg-' + Math.random(),
      chatId: groupId,
      senderId: sender,
      body,
      isGroup: true,
      command: isCommand ? {
        prefix: '/',
        rawCommandName: commandName,
        commandName,
        args,
        isCommand: true
      } : null
    } as any;

    await routeMessage(ctx, mockAdapter);
  }

  // Helper to trigger direct message
  async function triggerPrivate(sender: string, body: string, isCommand = false, commandName = '', args: string[] = []) {
    const ctx = {
      id: 'msg-' + Math.random(),
      chatId: sender,
      senderId: sender,
      body,
      isGroup: false,
      command: isCommand ? {
        prefix: '/',
        rawCommandName: commandName,
        commandName,
        args,
        isCommand: true
      } : null
    } as any;

    await routeMessage(ctx, mockAdapter);
  }

  // F008: Anti-Tag-All Tests
  describe('F008: Anti-Tag-All', () => {
    it('should ignore tag-all if disabled', async () => {
      await trigger(userId, '@everyone hello');
      expect(deletedMessages.length).toBe(0);
    });

    it('should delete and punish when enabled and threshold is exceeded', async () => {
      // Enable feature
      await trigger(adminId, '/antitagall on', true, 'antitagall', ['on']);
      sentMessages = [];

      // Send tag-all trigger
      await trigger(userId, 'hello @everyone');
      expect(deletedMessages.length).toBe(1);
    });

    it('should exempt admin from anti-tag-all', async () => {
      await trigger(adminId, '/antitagall on', true, 'antitagall', ['on']);
      await trigger(adminId, 'mass ping @everyone');
      expect(deletedMessages.length).toBe(0);
    });

    it('should update configurations correctly via command', async () => {
      await trigger(adminId, '/antitagall limit 10', true, 'antitagall', ['limit', '10']);
      await trigger(adminId, '/antitagall mode warn', true, 'antitagall', ['mode', 'warn']);

      await trigger(adminId, '/antitagall', true, 'antitagall', []);
      const response = sentMessages.map(m => m.text).join('\n');
      expect(response).toContain('Batas Mention: *10*');
      expect(response).toContain('Aksi: *WARN*');
    });
  });

  // F009: Moderation Appeal
  describe('F009: Moderation Appeal', () => {
    it('should allow user to submit appeal and admin to manage it', async () => {
      // 1. User submits appeal
      await trigger(userId, '/appeal Saya berjanji akan mematuhi aturan.', true, 'appeal', ['Saya', 'berjanji', 'akan', 'mematuhi', 'aturan.']);
      const response1 = sentMessages.map(m => m.text).join('\n');
      expect(response1).toContain('Banding Anda telah dikirim');

      // Check DB
      const appealVar = await prisma.customVariable.findFirst({
        where: { groupId, userId, key: 'appeal' }
      });
      expect(appealVar).not.toBeNull();
      const appealData = JSON.parse(appealVar!.value);
      expect(appealData.status).toBe('pending');
      expect(appealData.reason).toBe('Saya berjanji akan mematuhi aturan.');

      // 2. Admin lists appeals
      sentMessages = [];
      await trigger(adminId, '/appeal list', true, 'appeal', ['list']);
      const response2 = sentMessages.map(m => m.text).join('\n');
      expect(response2).toContain('DAFTAR BANDING MODERASI');

      // 3. Admin approves appeal
      sentMessages = [];
      await trigger(adminId, `/appeal approve ${userId} Diterima dengan syarat.`, true, 'appeal', ['approve', userId, 'Diterima', 'dengan', 'syarat.']);
      const response3 = sentMessages.map(m => m.text).join('\n');
      expect(response3).toContain('telah *DITERIMA*');

      // Check DB updated
      const appealVarUpdated = await prisma.customVariable.findFirst({
        where: { groupId, userId, key: 'appeal' }
      });
      const updatedData = JSON.parse(appealVarUpdated!.value);
      expect(updatedData.status).toBe('approved');
      expect(updatedData.resolveReason).toBe('Diterima dengan syarat.');
    });
  });

  // F010: Safety Digest
  describe('F010: Safety Digest', () => {
    it('should generate digest of violations', async () => {
      // Add a couple of warnings in the DB
      await prisma.warning.create({
        data: {
          groupId,
          userId,
          reason: 'Spamming sticker',
          warnedBy: adminId
        }
      });
      await prisma.warning.create({
        data: {
          groupId,
          userId,
          reason: 'Toxic words',
          warnedBy: adminId
        }
      });

      // Run safetydigest
      await trigger(adminId, '/safetydigest', true, 'safetydigest', []);
      const response = sentMessages.map(m => m.text).join('\n');
      expect(response).toContain('SAFETY DIGEST GRUP');
      expect(response).toContain('Total Pelanggaran: *2*');
      expect(response).toContain('Spamming sticker');
      expect(response).toContain('Toxic words');
    });
  });

  // F011: Retention Mode
  describe('F011: Retention Mode', () => {
    it('should configure feature retention periods', async () => {
      await trigger(adminId, '/retentionmode set games 15', true, 'retentionmode', ['set', 'games', '15']);
      const response1 = sentMessages.map(m => m.text).join('\n');
      expect(response1).toContain('fitur *games* berhasil diset ke *15* hari');

      sentMessages = [];
      await trigger(adminId, '/retentionmode', true, 'retentionmode', []);
      const response2 = sentMessages.map(m => m.text).join('\n');
      expect(response2.toUpperCase()).toContain('KEBIJAKAN RETENSI DATA');
      expect(response2.toUpperCase()).toContain('*GAMES*: 15 HARI');
    });
  });

  // F012 & F013: Export & Delete Data
  describe('F012 & F013: Export & Delete Data', () => {
    it('should support export and deletion of personal data', async () => {
      // 1. Export Data
      await trigger(userId, '/exportdata', true, 'exportdata', []);
      const response1 = sentMessages.map(m => m.text).join('\n');
      expect(response1).toContain('EKSPOR DATA PENGGUNA');
      expect(response1).toContain(userId);

      // Verify audit log created
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'export_data', actorId: userId }
      });
      expect(audit).not.toBeNull();

      // 2. Delete Data confirm prompt
      sentMessages = [];
      await trigger(userId, '/deletedata', true, 'deletedata', []);
      const response2 = sentMessages.map(m => m.text).join('\n');
      expect(response2).toContain('HAPUS DATA BOT');

      // 3. Confirm Delete Data
      sentMessages = [];
      await trigger(userId, '/deletedata confirm', true, 'deletedata', ['confirm']);
      const response3 = sentMessages.map(m => m.text).join('\n');
      expect(response3).toContain('berhasil dihapus');

      // Verify personal profile is deleted
      const profile = await prisma.userProfile.findUnique({ where: { userId } });
      expect(profile).toBeNull();

      // Verify delete_data audit log
      const auditDelete = await prisma.auditLog.findFirst({
        where: { action: 'delete_data', actorId: userId }
      });
      expect(auditDelete).not.toBeNull();
    });
  });

  // F014: Anon Analytics
  describe('F014: Anon Analytics', () => {
    it('should toggle anonanalytics setting', async () => {
      await trigger(adminId, '/anonanalytics on', true, 'anonanalytics', ['on']);
      const response = sentMessages.map(m => m.text).join('\n');
      expect(response).toContain('Anonimisasi Analitik* berhasil diaktifkan');
    });
  });

  // F015: Sensitive Log Redaction
  describe('F015: Sensitive Log Redaction', () => {
    it('should redact sensitive patterns in logs', () => {
      const logLine1 = 'API request to OpenAI with key sk-1234567890abcdefghijklmnopqrstuvwxyz123456';
      const logLine2 = 'User logged in: +628123456789 with Slack token mockslack-1234567890-abcdefghijklmnopqrstuvwx';
      const logLine3 = 'Fetching URL http://admin:superSecretPassword@my-api-server.com/v1/users';

      expect(redactLogLine(logLine1)).toContain('[OPENAI_KEY_REDACTED]');
      expect(redactLogLine(logLine2)).toContain('[SLACK_TOKEN_REDACTED]');
      expect(redactLogLine(logLine3)).toContain(':[PASSWORD_REDACTED]@');
    });
  });

  // F016: AI Consent check
  describe('F016: AI Consent check', () => {
    it('should block AI command when consentai is enabled and user has not consented', async () => {
      // 1. Enable consentai flag
      await trigger(adminId, '/consentai status', true, 'consentai', []);
      
      // Let's modify featuresJson directly to enable consentai
      await prisma.groupConfig.update({
        where: { groupId },
        data: {
          featuresJson: JSON.stringify({
            consentai: true,
            prd_ai: true
          })
        }
      });

      // 2. Run an AI command (categorized under AI plugin)
      sentMessages = [];
      await trigger(userId, '/ai halo', true, 'ai', ['halo']);
      const response1 = sentMessages.map(m => m.text).join('\n');
      expect(response1).toContain('belum memberikan persetujuan (consent)');

      // 3. Give consent
      sentMessages = [];
      await trigger(userId, '/consentai yes', true, 'consentai', ['yes']);
      const response2 = sentMessages.map(m => m.text).join('\n');
      expect(response2).toContain('telah memberikan persetujuan');

      // 4. Try AI command again
      sentMessages = [];
      await trigger(userId, '/ai halo', true, 'ai', ['halo']);
      const response3 = sentMessages.map(m => m.text).join('\n');
      // Should not block it with consent prompt
      expect(response3).not.toContain('belum memberikan persetujuan (consent)');
    });
  });

  // F017 & F018: Data Classification & Private Guard
  describe('F017 & F018: Data Classification & Private Guard', () => {
    it('should label commands and block sensitive commands in groups if privateguard is on', async () => {
      // 1. Set command classification as sensitive
      await trigger(adminId, '/dataclassification set balance sensitive', true, 'dataclassification', ['set', 'balance', 'sensitive']);
      const response1 = sentMessages.map(m => m.text).join('\n');
      expect(response1).toContain('balance');
      expect(response1).toContain('SENSITIVE');

      // 2. Enable privateguard flag
      await prisma.groupConfig.update({
        where: { groupId },
        data: {
          featuresJson: JSON.stringify({
            privateguard: true,
            economy: true
          })
        }
      });

      // 3. Try to execute the sensitive command in group
      sentMessages = [];
      await trigger(userId, '/balance', true, 'balance', []);
      const response2 = sentMessages.map(m => m.text).join('\n');
      expect(response2).toContain('diblokir oleh Private Guard');

      // 4. Works fine in private chat (isGroup = false)
      sentMessages = [];
      await triggerPrivate(userId, '/balance', true, 'balance', []);
      const response3 = sentMessages.map(m => m.text).join('\n');
      expect(response3).not.toContain('diblokir oleh Private Guard');
    });
  });

  // F019: Privacy Notice
  describe('F019: Privacy Notice', () => {
    it('should send privacy explanation when sensitive features are enabled', async () => {
      // Enable antitagall with privacynotice active
      await trigger(adminId, '/antitagall on', true, 'antitagall', ['on']);
      
      // Should have sent the activation message AND the privacy notice
      const response = sentMessages.map(m => m.text).join('\n');
      expect(response).toContain('NOTIFIKASI PRIVASI');
      expect(response).toContain('Anti-Tag-All memantau jumlah mention');
    });
  });

  // F020: Audit Access
  describe('F020: Audit Access', () => {
    it('should allow owner to view and clear sensitive data access audit logs', async () => {
      // Ensure there are some audit logs
      await prisma.auditLog.create({
        data: {
          actorId: userId,
          groupId,
          action: 'export_data',
          target: userId
        }
      });

      // Non-owner gets blocked
      sentMessages = [];
      await trigger(adminId, '/auditaccess', true, 'auditaccess', []);
      const response1 = sentMessages.map(m => m.text).join('\n');
      expect(response1).toContain('khusus untuk Owner');

      // Owner can view logs
      sentMessages = [];
      await trigger(ownerId, '/auditaccess', true, 'auditaccess', []);
      const response2 = sentMessages.map(m => m.text).join('\n');
      expect(response2).toContain('LOG AUDIT AKSES DATA SENSITIF');

      // Owner can clear logs
      sentMessages = [];
      await trigger(ownerId, '/auditaccess clear', true, 'auditaccess', ['clear']);
      const response3 = sentMessages.map(m => m.text).join('\n');
      expect(response3).toContain('berhasil dikosongkan');

      const count = await prisma.auditLog.count();
      expect(count).toBe(0);
    });
  });
});
