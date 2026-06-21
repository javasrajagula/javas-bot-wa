import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import prisma from '../db/client.js';
import { ModerationSuiteCommand } from '../commands/moderation/moderation.command.js';
import { routeMessage } from '../commands/index.js';
import { setGroupFeature, getGroupFeatures } from '../config/feature-flags.js';
import * as indexModule from '../commands/index.js';
import { BaileysAdapter } from '../bot/baileys.adapter.js';

describe('Anti-ViewOnce Feature', () => {
  const cmd = new ModerationSuiteCommand();
  const testGroup = 'test-antiviewonce-group@g.us';
  const adminUser = 'adminuser@s.whatsapp.net';
  const memberUser = 'memberuser@s.whatsapp.net';

  beforeEach(async () => {
    await prisma.groupConfig.deleteMany({ where: { groupId: testGroup } });
  });

  afterEach(async () => {
    await prisma.groupConfig.deleteMany({ where: { groupId: testGroup } });
  });

  describe('Command Toggling', () => {
    it('should show error if used in private chat', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => {
          replyText = text;
        }
      } as any;

      await cmd.execute({
        chatId: memberUser,
        isGroup: false,
        body: '/antiviewonce',
        senderId: memberUser,
        id: 'msg-1'
      } as any, [], adapter);

      expect(replyText).toContain('hanya bisa digunakan di dalam grup');
    });

    it('should deny non-admin users', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => {
          replyText = text;
        }
      } as any;

      const isAdminSpy = vi.spyOn(indexModule, 'checkIfAdmin').mockImplementation(async () => false);

      await cmd.execute({
        chatId: testGroup,
        isGroup: true,
        body: '/antiviewonce on',
        senderId: memberUser,
        id: 'msg-2'
      } as any, ['on'], adapter);

      expect(replyText).toContain('Otoritas ditolak');
      isAdminSpy.mockRestore();
    });

    it('should allow admin to turn on/off and query status', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => {
          replyText = text;
        }
      } as any;

      const isAdminSpy = vi.spyOn(indexModule, 'checkIfAdmin').mockImplementation(async () => true);

      // Create initial group config
      await prisma.groupConfig.create({
        data: {
          groupId: testGroup,
          prefix: '/',
          botEnabled: true,
          featuresJson: JSON.stringify({ antiviewonce: false })
        }
      });

      // 1. Query status
      await cmd.execute({
        chatId: testGroup,
        isGroup: true,
        body: '/antiviewonce',
        senderId: adminUser,
        id: 'msg-3'
      } as any, [], adapter);
      expect(replyText).toContain('Anti View-Once Group');
      expect(replyText).toContain('NONAKTIF');

      // 2. Turn ON
      await cmd.execute({
        chatId: testGroup,
        isGroup: true,
        body: '/antiviewonce on',
        senderId: adminUser,
        id: 'msg-4'
      } as any, ['on'], adapter);
      expect(replyText).toContain('Anti View-Once');
      expect(replyText).toContain('ON');

      let features = await getGroupFeatures(testGroup);
      expect(features.antiviewonce).toBe(true);

      // 3. Turn OFF
      await cmd.execute({
        chatId: testGroup,
        isGroup: true,
        body: '/antiviewonce off',
        senderId: adminUser,
        id: 'msg-5'
      } as any, ['off'], adapter);
      expect(replyText).toContain('Anti View-Once');
      expect(replyText).toContain('OFF');

      features = await getGroupFeatures(testGroup);
      expect(features.antiviewonce).toBe(false);

      isAdminSpy.mockRestore();
    });
  });

  describe('Message Parsing', () => {
    it('should correctly parse view-once image message', async () => {
      const mockMsg = {
        key: {
          remoteJid: testGroup,
          id: 'test-msg-id',
          participant: memberUser,
        },
        message: {
          viewOnceMessage: {
            message: {
              imageMessage: {
                caption: 'My ViewOnce Image',
                mimetype: 'image/jpeg',
              }
            }
          }
        }
      };

      const dummyAdapter = {
        resolveToPhoneJid: (jid: string) => jid,
        sock: {
          contacts: {}
        },
        messageKeyCache: new Map()
      };

      const parsed = await (BaileysAdapter.prototype as any).parseMessage.call(dummyAdapter, mockMsg);
      expect(parsed).not.toBeNull();
      expect(parsed.isViewOnce).toBe(true);
      expect(parsed.body).toBe('My ViewOnce Image');
      expect(parsed.media).toBeDefined();
      expect(parsed.media.type).toBe('image');
      expect(parsed.media.mimeType).toBe('image/jpeg');
    });

    it('should correctly parse view-once video message', async () => {
      const mockMsg = {
        key: {
          remoteJid: testGroup,
          id: 'test-msg-id-2',
          participant: memberUser,
        },
        message: {
          viewOnceMessageV2: {
            message: {
              videoMessage: {
                caption: 'My ViewOnce Video',
                mimetype: 'video/mp4',
              }
            }
          }
        }
      };

      const dummyAdapter = {
        resolveToPhoneJid: (jid: string) => jid,
        sock: {
          contacts: {}
        },
        messageKeyCache: new Map()
      };

      const parsed = await (BaileysAdapter.prototype as any).parseMessage.call(dummyAdapter, mockMsg);
      expect(parsed).not.toBeNull();
      expect(parsed.isViewOnce).toBe(true);
      expect(parsed.body).toBe('My ViewOnce Video');
      expect(parsed.media).toBeDefined();
      expect(parsed.media.type).toBe('video');
      expect(parsed.media.mimeType).toBe('video/mp4');
    });
  });

  describe('Router Interception', () => {
    it('should not intercept if feature is disabled', async () => {
      // Create group config with feature off
      await prisma.groupConfig.create({
        data: {
          groupId: testGroup,
          prefix: '/',
          botEnabled: true,
          featuresJson: JSON.stringify({ antiviewonce: false })
        }
      });

      const sentImages: any[] = [];
      const mockAdapter = {
        sendImage: async (chatId: string, buffer: Buffer, caption: string) => {
          sentImages.push({ chatId, buffer, caption });
        }
      } as any;

      const mockCtx = {
        id: 'msg-viewonce-disabled',
        senderId: memberUser,
        chatId: testGroup,
        isGroup: true,
        body: 'Confidential message',
        isViewOnce: true,
        media: {
          type: 'image',
          mimeType: 'image/jpeg',
          getBuffer: async () => Buffer.from('fake-image-bytes')
        }
      } as any;

      await routeMessage(mockCtx, mockAdapter);
      expect(sentImages.length).toBe(0);
    });

    it('should intercept and re-send view-once media if feature is enabled', async () => {
      // Create group config with feature on
      await prisma.groupConfig.create({
        data: {
          groupId: testGroup,
          prefix: '/',
          botEnabled: true,
          featuresJson: JSON.stringify({ antiviewonce: true })
        }
      });

      const sentImages: any[] = [];
      const mockAdapter = {
        sendImage: async (chatId: string, buffer: Buffer, caption: string, options?: any) => {
          sentImages.push({ chatId, buffer, caption, options });
        }
      } as any;

      const mockCtx = {
        id: 'msg-viewonce-enabled',
        senderId: memberUser,
        chatId: testGroup,
        isGroup: true,
        body: 'Confidential message',
        isViewOnce: true,
        media: {
          type: 'image',
          mimeType: 'image/jpeg',
          getBuffer: async () => Buffer.from('fake-image-bytes')
        }
      } as any;

      await routeMessage(mockCtx, mockAdapter);
      expect(sentImages.length).toBe(1);
      expect(sentImages[0].chatId).toBe(testGroup);
      expect(sentImages[0].caption).toContain('Anti View-Once');
      expect(sentImages[0].caption).toContain(memberUser.split('@')[0]);
      expect(sentImages[0].caption).toContain('Confidential message');
      expect(sentImages[0].options.mentions).toContain(memberUser);
    });
  });
});
