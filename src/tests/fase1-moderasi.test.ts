import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import prisma from '../db/client.js';
import { routeMessage } from '../commands/index.js';
import { stateStore } from '../services/state/state-store.js';
import { BaileysAdapter } from '../bot/baileys.adapter.js';
import { AntiRaidCommand } from '../commands/moderation/antiraid.command.js';
import { BackupConfigCommand } from '../commands/moderation/backup-config.command.js';
import { ModerationSuiteCommand } from '../commands/moderation/moderation.command.js';
import * as indexModule from '../commands/index.js';
import { addWatermarkToImage } from '../utils/watermark.util.js';

vi.mock('@whiskeysockets/baileys', async () => {
  const actual = await vi.importActual<any>('@whiskeysockets/baileys');
  return {
    ...actual,
    default: vi.fn().mockImplementation(() => {
      return {
        ev: {
          on: vi.fn(),
          removeAllListeners: vi.fn(),
        },
        groupMetadata: vi.fn().mockResolvedValue({ participants: [] }),
        groupFetchAllParticipating: vi.fn().mockResolvedValue({}),
      };
    }),
    useMultiFileAuthState: vi.fn().mockImplementation(async () => {
      return {
        state: { creds: {} },
        saveCreds: vi.fn(),
      };
    }),
    fetchLatestBaileysVersion: vi.fn().mockImplementation(async () => {
      return {
        version: [4, 0, 0],
        isLatest: true,
      };
    }),
  };
});

describe('Fase 1 Moderation & Security Tests', () => {
  const antiraidCmd = new AntiRaidCommand();
  const backupCmd = new BackupConfigCommand();
  const modCmd = new ModerationSuiteCommand();

  const testGroup = 'test-fase1-group@g.us';
  const adminUser = 'adminuser@s.whatsapp.net';
  const memberUser = 'memberuser@s.whatsapp.net';

  beforeEach(async () => {
    await prisma.groupConfig.deleteMany({ where: { groupId: testGroup } });
    await prisma.autoReply.deleteMany({ where: { groupId: testGroup } });
    await prisma.badword.deleteMany({ where: { groupId: testGroup } });
    await prisma.warningRule.deleteMany({ where: { groupId: testGroup } });
    await prisma.commandAlias.deleteMany({ where: { groupId: testGroup } });
    await prisma.blacklist.deleteMany({ where: { groupId: testGroup } });
  });

  afterEach(async () => {
    await prisma.groupConfig.deleteMany({ where: { groupId: testGroup } });
    await prisma.autoReply.deleteMany({ where: { groupId: testGroup } });
    await prisma.badword.deleteMany({ where: { groupId: testGroup } });
    await prisma.warningRule.deleteMany({ where: { groupId: testGroup } });
    await prisma.commandAlias.deleteMany({ where: { groupId: testGroup } });
    await prisma.blacklist.deleteMany({ where: { groupId: testGroup } });
  });

  describe('Anti-Raid Shield & Lockdown', () => {
    it('should allow configuring antiraid limit and duration', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; }
      } as any;

      vi.spyOn(indexModule, 'checkIfAdmin').mockResolvedValue(true);

      // Read status
      await antiraidCmd.execute({
        chatId: testGroup,
        isGroup: true,
        body: '/antiraid',
        senderId: adminUser,
        id: 'msg-1'
      } as any, [], adapter);
      expect(replyText).toContain('ANTI-RAID SHIELD CONFIG');

      // Set limit
      await antiraidCmd.execute({
        chatId: testGroup,
        isGroup: true,
        body: '/antiraid limit 5',
        senderId: adminUser,
        id: 'msg-2'
      } as any, ['limit', '5'], adapter);
      expect(replyText).toContain('Batas join Anti-Raid berhasil diubah menjadi: *5*');

      // Set duration
      await antiraidCmd.execute({
        chatId: testGroup,
        isGroup: true,
        body: '/antiraid duration 30',
        senderId: adminUser,
        id: 'msg-3'
      } as any, ['duration', '30'], adapter);
      expect(replyText).toContain('Durasi deteksi Anti-Raid berhasil diubah menjadi: *30* detik.');
    });

    it('should lock group via /lockdown', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; }
      } as any;

      const mockSock = {
        groupSettingUpdate: vi.fn()
      };
      (adapter as any).sock = mockSock;

      vi.spyOn(indexModule, 'checkIfAdmin').mockResolvedValue(true);

      await antiraidCmd.execute({
        chatId: testGroup,
        isGroup: true,
        body: '/lockdown on',
        senderId: adminUser,
        id: 'msg-1',
        command: { commandName: 'lockdown', args: ['on'] }
      } as any, ['on'], adapter);

      expect(mockSock.groupSettingUpdate).toHaveBeenCalledWith(testGroup, 'announcement');
      expect(replyText).toContain('Lockdown diaktifkan');
    });
  });

  describe('Backup & Restore Konfigurasi Grup', () => {
    it('should generate a backup file and restore from it', async () => {
      let sentDoc: Buffer | null = null;
      let sentFileName = '';

      const adapter = {
        sendMessage: vi.fn(),
        sendDocument: async (chatId: string, doc: Buffer, fileName: string) => {
          sentDoc = doc;
          sentFileName = fileName;
        }
      } as any;

      vi.spyOn(indexModule, 'checkIfAdmin').mockResolvedValue(true);

      await prisma.groupConfig.create({
        data: {
          groupId: testGroup,
          prefix: '!',
          featuresJson: JSON.stringify({ antiraid: true })
        }
      });
      await prisma.badword.create({
        data: {
          groupId: testGroup,
          word: 'kasar',
          createdBy: adminUser
        }
      });

      // Run backup
      await backupCmd.execute({
        chatId: testGroup,
        isGroup: true,
        body: '/backupconfig',
        senderId: adminUser,
        id: 'msg-1',
        command: { commandName: 'backupconfig', args: [] }
      } as any, [], adapter);

      expect(sentDoc).not.toBeNull();
      expect(sentFileName).toContain('config-group');

      const payload = JSON.parse(sentDoc!.toString('utf-8'));
      expect(payload.config.prefix).toBe('!');
      expect(payload.badwords[0].word).toBe('kasar');

      // Modify original db state
      await prisma.groupConfig.update({
        where: { groupId: testGroup },
        data: { prefix: '/' }
      });
      await prisma.badword.deleteMany({ where: { groupId: testGroup } });

      let replyMsg = '';
      const mockRestoreAdapter = {
        sendMessage: async (chatId: string, text: string) => { replyMsg = text; }
      } as any;

      // Run restore
      await backupCmd.execute({
        chatId: testGroup,
        isGroup: true,
        body: '/restoreconfig',
        senderId: adminUser,
        id: 'msg-2',
        command: { commandName: 'restoreconfig', args: [] },
        quotedMessage: {
          id: 'msg-1',
          senderId: adminUser,
          body: '',
          media: {
            type: 'document',
            mimeType: 'application/json',
            getBuffer: async () => sentDoc!
          }
        }
      } as any, [], mockRestoreAdapter);

      expect(replyMsg).toContain('berhasil dipulihkan');

      const restoredConfig = await prisma.groupConfig.findUnique({ where: { groupId: testGroup } });
      expect(restoredConfig?.prefix).toBe('!');

      const restoredBadword = await prisma.badword.findMany({ where: { groupId: testGroup } });
      expect(restoredBadword.length).toBe(1);
      expect(restoredBadword[0].word).toBe('kasar');
    });
  });

  describe('Allowed Message Types', () => {
    it('should delete forbidden message types for non-admins', async () => {
      const messagesDeleted: string[] = [];
      const adapter = {
        sendMessage: vi.fn(),
        deleteMessage: async (chatId: string, msgId: string) => {
          messagesDeleted.push(msgId);
        }
      } as any;

      vi.spyOn(indexModule, 'checkIfAdmin').mockResolvedValue(false);

      await prisma.groupConfig.create({
        data: {
          groupId: testGroup,
          prefix: '/',
          featuresJson: JSON.stringify({ allowed_message_types: 'text_only' })
        }
      });

      // Send image (forbidden)
      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '',
        senderId: memberUser,
        id: 'msg-forbidden-image',
        media: {
          type: 'image',
          mimeType: 'image/jpeg',
          getBuffer: async () => Buffer.from('dummy')
        }
      } as any, adapter);

      expect(messagesDeleted).toContain('msg-forbidden-image');

      // Send text (allowed)
      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: 'Hello text',
        senderId: memberUser,
        id: 'msg-allowed-text'
      } as any, adapter);

      expect(messagesDeleted).not.toContain('msg-allowed-text');
    });
  });

  describe('Temp Ban & Blacklist Verification', () => {
    it('should place a user in blacklist temporarily and block them', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; }
      } as any;

      const mockSock = {
        groupParticipantsUpdate: vi.fn()
      };
      (adapter as any).sock = mockSock;

      vi.spyOn(indexModule, 'checkIfAdmin').mockResolvedValue(true);

      // Ban member temporarily for 500ms
      await modCmd.execute({
        chatId: testGroup,
        isGroup: true,
        body: `/tempban @${memberUser.split('@')[0]} 500ms Melanggar`,
        senderId: adminUser,
        id: 'msg-ban-1',
        command: { commandName: 'tempban', args: [`@${memberUser.split('@')[0]}`, '500ms', 'Melanggar'] }
      } as any, [`@${memberUser.split('@')[0]}`, '500ms', 'Melanggar'], adapter);

      expect(mockSock.groupParticipantsUpdate).toHaveBeenCalledWith(testGroup, [memberUser], 'remove');
      expect(replyText).toContain('Banned Sementara');

      // Check validation throws when active
      const { requireNotBlacklisted } = await import('../validators/permission.validator.js');
      await expect(requireNotBlacklisted(testGroup, memberUser)).rejects.toThrow('Akses ditolak');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 600));

      // Check validation passes after expiration
      await expect(requireNotBlacklisted(testGroup, memberUser)).resolves.not.toThrow();
    });
  });

  describe('Watermark Utility', () => {
    it('should composite text watermark to image buffer', async () => {
      const dummyPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      const watermarked = await addWatermarkToImage(dummyPng, 'Test Group');
      expect(watermarked.length).toBeGreaterThan(0);
      expect(watermarked).not.toEqual(dummyPng);
    });
  });

  describe('Profil Risiko Anggota', () => {
    it('should calculate risk profile correctly', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; }
      } as any;

      // Check risk for member user
      await modCmd.execute({
        chatId: testGroup,
        isGroup: true,
        body: `/risk @${memberUser.split('@')[0]}`,
        senderId: adminUser,
        id: 'msg-risk-1',
        command: { commandName: 'risk', args: [`@${memberUser.split('@')[0]}`] }
      } as any, [`@${memberUser.split('@')[0]}`], adapter);

      expect(replyText).toContain('PROFIL RISIKO ANGGOTA');
      expect(replyText).toContain('Skor Risiko: *0/100*');
      expect(replyText).toContain('AMAN');
    });
  });
});
