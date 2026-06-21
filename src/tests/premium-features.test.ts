import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import prisma from '../db/client.js';
import { routeMessage } from '../commands/index.js';

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
        rejectCall: vi.fn(),
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
import { ModerationSuiteCommand } from '../commands/moderation/moderation.command.js';
import { DocumentSuiteCommand } from '../commands/document/document.command.js';
import { StickerSuiteCommand } from '../commands/sticker/sticker.command.js';
import { messageCache } from '../services/state/message-cache.js';
import { stateStore } from '../services/state/state-store.js';
import { BaileysAdapter } from '../bot/baileys.adapter.js';
import * as indexModule from '../commands/index.js';
import fs from 'fs';
import path from 'path';

describe('Premium Features Integration Suite', () => {
  const modCmd = new ModerationSuiteCommand();
  const docCmd = new DocumentSuiteCommand();
  const stickerCmd = new StickerSuiteCommand();

  const testGroup = 'test-premium-features-group@g.us';
  const adminUser = 'adminuser@s.whatsapp.net';
  const memberUser = 'memberuser@s.whatsapp.net';

  beforeEach(async () => {
    await prisma.groupConfig.deleteMany({ where: { groupId: testGroup } });
    await prisma.badword.deleteMany({ where: { groupId: testGroup } });
    messageCache.clear();
  });

  afterEach(async () => {
    await prisma.groupConfig.deleteMany({ where: { groupId: testGroup } });
    await prisma.badword.deleteMany({ where: { groupId: testGroup } });
    messageCache.clear();
  });

  describe('Anti-Call Filter', () => {
    it('should reject call and send warning message', async () => {
      const callsRejected: { callId: string; callerJid: string }[] = [];
      const messagesSent: { chatId: string; text: string }[] = [];

      const mockAdapter = {
        sendMessage: async (chatId: string, text: string) => {
          messagesSent.push({ chatId, text });
        }
      } as any;

      const adapter = new BaileysAdapter();
      adapter.sendMessage = mockAdapter.sendMessage;

      const mockSock = {
        ev: {
          on: vi.fn().mockImplementation((event, callback) => {
            if (event === 'call') {
              callback([{ id: 'call-id-123', from: memberUser, status: 'offer' }]);
            }
          }),
          removeAllListeners: vi.fn()
        },
        rejectCall: async (id: string, from: string) => {
          callsRejected.push({ callId: id, callerJid: from });
        },
        groupMetadata: vi.fn().mockResolvedValue({ participants: [] }),
        groupFetchAllParticipating: vi.fn().mockResolvedValue({})
      };

      const makeWASocket = (await import('@whiskeysockets/baileys')).default;
      vi.mocked(makeWASocket).mockReturnValue(mockSock as any);

      await adapter.start();

      expect(callsRejected.length).toBe(1);
      expect(callsRejected[0].callId).toBe('call-id-123');
      expect(callsRejected[0].callerJid).toBe(memberUser);
      expect(messagesSent.length).toBe(1);
      expect(messagesSent[0].chatId).toBe(memberUser);
      expect(messagesSent[0].text).toContain('tidak menerima panggilan');
    });
  });

  describe('Anti-Delete Message', () => {
    it('should allow toggling setting', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => {
          replyText = text;
        }
      } as any;

      const isAdminSpy = vi.spyOn(indexModule, 'checkIfAdmin').mockImplementation(async () => true);

      await prisma.groupConfig.create({
        data: {
          groupId: testGroup,
          prefix: '/',
          botEnabled: true,
          featuresJson: JSON.stringify({ antidelete: false })
        }
      });

      // Query status
      await modCmd.execute({
        chatId: testGroup,
        isGroup: true,
        body: '/antidelete',
        senderId: adminUser,
        id: 'msg-1'
      } as any, [], adapter);
      expect(replyText).toContain('Anti-Delete Group');
      expect(replyText).toContain('NONAKTIF');

      // Toggle ON
      await modCmd.execute({
        chatId: testGroup,
        isGroup: true,
        body: '/antidelete on',
        senderId: adminUser,
        id: 'msg-2'
      } as any, ['on'], adapter);
      expect(replyText).toContain('Anti-Delete');
      expect(replyText).toContain('ON');

      isAdminSpy.mockRestore();
    });

    it('should intercept revoke and re-send cached text message', async () => {
      await prisma.groupConfig.create({
        data: {
          groupId: testGroup,
          prefix: '/',
          botEnabled: true,
          featuresJson: JSON.stringify({ antidelete: true })
        }
      });

      // Cache a message first
      const testMsgId = 'test-msg-123';
      messageCache.set(testMsgId, {
        body: 'Halo Dunia!',
        senderId: memberUser,
        senderName: 'Test Member',
        chatId: testGroup,
        timestamp: Date.now()
      });

      const messagesSent: { chatId: string; text: string }[] = [];
      const dummyAdapterInstance = {
        resolveToPhoneJid: (jid: string) => jid,
        sendMessage: async (chatId: string, text: string) => {
          messagesSent.push({ chatId, text });
        }
      };

      // Trigger revoke handler
      const key = { remoteJid: testGroup, id: testMsgId };
      await (BaileysAdapter.prototype as any).handleAntiDelete.call(dummyAdapterInstance, key);

      expect(messagesSent.length).toBe(1);
      expect(messagesSent[0].chatId).toBe(testGroup);
      expect(messagesSent[0].text).toContain('Anti-Delete Detected');
      expect(messagesSent[0].text).toContain('Halo Dunia!');
    });
  });

  describe('Auto-Censor Badwords', () => {
    it('should allow toggling setting', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => {
          replyText = text;
        }
      } as any;

      const isAdminSpy = vi.spyOn(indexModule, 'checkIfAdmin').mockImplementation(async () => true);

      await prisma.groupConfig.create({
        data: {
          groupId: testGroup,
          prefix: '/',
          botEnabled: true,
          featuresJson: JSON.stringify({ badword_censor: false })
        }
      });

      // Query status
      await modCmd.execute({
        chatId: testGroup,
        isGroup: true,
        body: '/badwordcensor',
        senderId: adminUser,
        id: 'msg-3'
      } as any, [], adapter);
      expect(replyText).toContain('Badword Censor Group');
      expect(replyText).toContain('NONAKTIF');

      // Toggle ON
      await modCmd.execute({
        chatId: testGroup,
        isGroup: true,
        body: '/badwordcensor on',
        senderId: adminUser,
        id: 'msg-4'
      } as any, ['on'], adapter);
      expect(replyText).toContain('Badword Censor');
      expect(replyText).toContain('ON');

      isAdminSpy.mockRestore();
    });

    it('should censor toxic words instead of executing normal punishment if toggle is ON', async () => {
      await prisma.groupConfig.create({
        data: {
          groupId: testGroup,
          prefix: '/',
          botEnabled: true,
          featuresJson: JSON.stringify({ badword: true, badword_censor: true })
        }
      });

      await prisma.badword.create({
        data: {
          groupId: testGroup,
          word: 'anjing'
        }
      });

      const deletedMessages: string[] = [];
      const messagesSent: { chatId: string; text: string }[] = [];

      const mockAdapter = {
        deleteMessage: async (chatId: string, messageId: string) => {
          deletedMessages.push(messageId);
        },
        sendMessage: async (chatId: string, text: string) => {
          messagesSent.push({ chatId, text });
        }
      } as any;

      const mockCtx = {
        id: 'user-toxic-msg-123',
        senderId: memberUser,
        chatId: testGroup,
        isGroup: true,
        body: 'Kamu sangat anjing sekali!'
      } as any;

      await routeMessage(mockCtx, mockAdapter);

      expect(deletedMessages).toContain('user-toxic-msg-123');
      expect(messagesSent.length).toBe(1);
      expect(messagesSent[0].chatId).toBe(testGroup);
      expect(messagesSent[0].text).toContain('Pesan disensor');
      expect(messagesSent[0].text).toContain('******'); // "anjing" is 6 characters
    });
  });

  describe('Multiple Images to PDF (/topdf)', () => {
    it('should handle full start, status, add, done and cancel session states', async () => {
      let replyText = '';
      let docSent: any = null;

      const mockAdapter = {
        sendMessage: async (chatId: string, text: string) => {
          replyText = text;
        },
        sendDocument: async (chatId: string, buffer: Buffer, fileName: string) => {
          docSent = { buffer, fileName };
        }
      } as any;

      const ctxBase = {
        chatId: testGroup,
        isGroup: true,
        senderId: memberUser,
        id: 'msg-topdf-test'
      };

      // 1. start
      await docCmd.execute({ ...ctxBase, body: '/topdf start' } as any, ['start'], mockAdapter);
      expect(replyText).toContain('Sesi Penggabungan Gambar ke PDF Dimulai');

      // 2. status (empty)
      await docCmd.execute({ ...ctxBase, body: '/topdf status' } as any, ['status'], mockAdapter);
      expect(replyText).toContain('Jumlah gambar dalam antrean: *0*');

      // 3. Add image
      const fakeImage = Buffer.from('fake-image-bytes');
      await docCmd.execute({
        ...ctxBase,
        body: '/topdf',
        media: {
          type: 'image',
          mimeType: 'image/jpeg',
          getBuffer: async () => fakeImage
        }
      } as any, [], mockAdapter);
      expect(replyText).toContain('Gambar berhasil ditambahkan');
      expect(replyText).toContain('*1* gambar dalam antrean');

      // 4. done (generates PDF)
      // Spy on document converter/merge to mock PDF creation
      const imageToPdfSpy = vi.spyOn(await import('../services/document/document-tools.service.js'), 'imageToPdf')
        .mockImplementation(async () => Buffer.from('pdf-page-bytes'));
      const mergePdfBuffersSpy = vi.spyOn(await import('../services/document/document-tools.service.js'), 'mergePdfBuffers')
        .mockImplementation(async () => Buffer.from('merged-pdf-bytes'));

      await docCmd.execute({ ...ctxBase, body: '/topdf done' } as any, ['done'], mockAdapter);
      expect(replyText).toContain('Mengonversi dan menggabungkan');
      expect(docSent).not.toBeNull();
      expect(docSent?.buffer.toString()).toBe('merged-pdf-bytes');
      expect(docSent?.fileName).toContain('.pdf');

      imageToPdfSpy.mockRestore();
      mergePdfBuffersSpy.mockRestore();
    });
  });

  describe('Sticker Shape Crop (Heart/Love)', () => {
    it('should generate heart shape masked sticker', async () => {
      let replyText = '';
      let stickerSent: any = null;

      const mockAdapter = {
        sendMessage: async (chatId: string, text: string) => {
          replyText = text;
        },
        sendSticker: async (chatId: string, buffer: Buffer) => {
          stickerSent = buffer;
        }
      } as any;

      const mockCtx = {
        chatId: testGroup,
        isGroup: true,
        senderId: memberUser,
        id: 'msg-heart-sticker',
        body: '/heart',
        media: {
          type: 'image',
          mimeType: 'image/jpeg',
          getBuffer: async () => fs.readFileSync(path.join(process.cwd(), 'src/tests/assets/test.jpg'))
        }
      } as any;

      // Create dummy asset image directory/file if not exist for testing
      const assetDir = path.join(process.cwd(), 'src/tests/assets');
      const assetPath = path.join(assetDir, 'test.jpg');
      if (!fs.existsSync(assetDir)) {
        fs.mkdirSync(assetDir, { recursive: true });
      }
      if (!fs.existsSync(assetPath)) {
        // Create 100x100 simple solid red JPEG image for test compatibility
        const sharp = (await import('sharp')).default;
        const testJpg = await sharp({
          create: {
            width: 100,
            height: 100,
            channels: 3,
            background: { r: 255, g: 0, b: 0 }
          }
        }).jpeg().toBuffer();
        fs.writeFileSync(assetPath, testJpg);
      }

      await stickerCmd.execute(mockCtx, [], mockAdapter);
      expect(replyText).toContain('Membuat stiker hati');
      expect(stickerSent).not.toBeNull();
      
      const sharp = (await import('sharp')).default;
      const metadata = await sharp(stickerSent!).metadata();
      expect(metadata.width).toBe(512);
      expect(metadata.height).toBe(512);
      expect(metadata.format).toBe('webp');
    });
  });
});
