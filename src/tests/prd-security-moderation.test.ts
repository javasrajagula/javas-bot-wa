import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import prisma from '../db/client.js';
import { routeMessage, executePunishment } from '../commands/index.js';
import { parseFeatureFlags } from '../config/feature-flags.js';
import { stateStore } from '../services/state/state-store.js';
import { calculateRiskScore, getGradedCaptcha } from '../utils/security.util.js';

describe('PRD Batch 1C — Security & Moderation Features (F001-F006)', () => {
  const groupId = 'test-group-sec-mod@g.us';

  let mockAdapter: any;
  let sentMessages: { chatId: string; text: string; options?: any }[] = [];
  let deletedMessages: { chatId: string; id: string; senderId?: string }[] = [];
  let kickedParticipants: { groupId: string; participants: string[]; action: string }[] = [];
  let memberCount = 10;

  beforeAll(async () => {
    // Dynamic import to ensure commands are loaded in vitest registry
    await import('../commands/moderation/dynamic-security.command.js');

    // Clean up DB before run
    await prisma.groupConfig.deleteMany({ where: { groupId } });
    await prisma.customVariable.deleteMany({ where: { groupId } });
    await prisma.warning.deleteMany({ where: { groupId } });

    mockAdapter = {
      sock: {
        groupMetadata: async (jid: string) => {
          return {
            id: jid,
            participants: Array.from({ length: memberCount }, (_, i) => ({
              id: `62812${i}@s.whatsapp.net`
            }))
          };
        },
        groupParticipantsUpdate: async (jid: string, participants: string[], action: string) => {
          kickedParticipants.push({ groupId: jid, participants, action });
          return [];
        },
        profilePictureUrl: async (jid: string, type: string) => {
          if (jid.includes('nopic')) {
            throw new Error('no picture');
          }
          return 'https://example.com/pic.jpg';
        },
        contacts: {
          '628123456789@s.whatsapp.net': { name: 'Javas User', notify: 'Javas' }
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
    kickedParticipants = [];
    memberCount = 10;

    await prisma.groupConfig.upsert({
      where: { groupId },
      create: {
        groupId,
        featuresJson: JSON.stringify({
          antiflood: true,
          antifloodMode: 'delete',
          antilinkwhitelist: true,
          antiforward: true,
          antiforwardLimit: 3,
          antiforwardMode: 'delete',
          antijoin: true,
          antijoinRisk: 50,
          antijoinMode: 'kick',
          captcha2: true,
          muteprogressive: true
        })
      },
      update: {
        featuresJson: JSON.stringify({
          antiflood: true,
          antifloodMode: 'delete',
          antilinkwhitelist: true,
          antiforward: true,
          antiforwardLimit: 3,
          antiforwardMode: 'delete',
          antijoin: true,
          antijoinRisk: 50,
          antijoinMode: 'kick',
          captcha2: true,
          muteprogressive: true
        })
      }
    });

    await prisma.warning.deleteMany({ where: { groupId } });
    await prisma.customVariable.deleteMany({ where: { groupId } });
  });

  afterAll(async () => {
    await prisma.groupConfig.deleteMany({ where: { groupId } });
    await prisma.customVariable.deleteMany({ where: { groupId } });
    await prisma.warning.deleteMany({ where: { groupId } });
  });

  const getCtx = (body: string, sender: string, isForwarded: boolean = false): any => ({
    id: `msg-${Math.random()}`,
    chatId: groupId,
    senderId: sender,
    body,
    isGroup: true,
    isForwarded,
    command: {
      prefix: '/',
      rawCommandName: '',
      commandName: '',
      args: [],
      isCommand: false
    }
  });

  describe('F001: Adaptive Anti-Flood', () => {
    it('adapts limit to 5 messages/5s for small groups (< 50 members)', async () => {
      memberCount = 20;
      const user = '628120000001@s.whatsapp.net';

      // Send 5 messages quickly
      for (let i = 0; i < 5; i++) {
        await routeMessage(getCtx(`Test flood msg ${i}`, user), mockAdapter);
      }
      expect(deletedMessages.length).toBe(0);

      // The 6th message should trigger punishment
      await routeMessage(getCtx('Flood trigger', user), mockAdapter);
      expect(deletedMessages.length).toBe(1);
    });

    it('adapts limit to 4 messages/5s for medium groups (50 - 200 members)', async () => {
      memberCount = 100;
      const user = '628120000002@s.whatsapp.net';

      // Send 4 messages quickly
      for (let i = 0; i < 4; i++) {
        await routeMessage(getCtx(`Test flood msg ${i}`, user), mockAdapter);
      }
      expect(deletedMessages.length).toBe(0);

      // The 5th message should trigger punishment
      await routeMessage(getCtx('Flood trigger', user), mockAdapter);
      expect(deletedMessages.length).toBe(1);
    });

    it('adapts limit to 3 messages/5s for large groups (> 200 members)', async () => {
      memberCount = 250;
      const user = '628120000003@s.whatsapp.net';

      // Send 3 messages quickly
      for (let i = 0; i < 3; i++) {
        await routeMessage(getCtx(`Test flood msg ${i}`, user), mockAdapter);
      }
      expect(deletedMessages.length).toBe(0);

      // The 4th message should trigger punishment
      await routeMessage(getCtx('Flood trigger', user), mockAdapter);
      expect(deletedMessages.length).toBe(1);
    });
  });

  describe('F002: Multi-level Link Whitelisting', () => {
    it('allows default whitelisted domains', async () => {
      const user = '628120000004@s.whatsapp.net';
      await routeMessage(getCtx('Check link: https://google.com', user), mockAdapter);
      await routeMessage(getCtx('Check link: www.github.com', user), mockAdapter);
      expect(deletedMessages.length).toBe(0);
    });

    it('blocks non-whitelisted domains', async () => {
      const user = '628120000005@s.whatsapp.net';
      await routeMessage(getCtx('Check link: https://scam-site.ru', user), mockAdapter);
      expect(deletedMessages.length).toBe(1);
    });

    it('allows preset group mode category domains', async () => {
      const user = '628120000006@s.whatsapp.net';
      // Set group mode to 'sekolah'
      await prisma.customVariable.upsert({
        where: {
          groupId_userId_key: {
            groupId,
            userId: 'system',
            key: 'groupMode'
          }
        },
        create: {
          groupId,
          userId: 'system',
          key: 'groupMode',
          value: 'sekolah'
        },
        update: {
          value: 'sekolah'
        }
      });

      // Wikipedia is an educational domain in the sekolah mode whitelist
      await routeMessage(getCtx('Check link: https://wikipedia.org', user), mockAdapter);
      expect(deletedMessages.length).toBe(0);

      // Tokopedia is not, so it gets blocked
      await routeMessage(getCtx('Check link: https://tokopedia.com', user), mockAdapter);
      expect(deletedMessages.length).toBe(1);
    });

    it('allows domains registered in group custom whitelist', async () => {
      const user = '628120000007@s.whatsapp.net';
      // Register 'group-whitelist.net' to group
      await prisma.customVariable.create({
        data: {
          groupId,
          userId: 'group',
          key: 'whitelistdomain:group-whitelist.net',
          value: JSON.stringify({ category: 'work', reason: 'Official site' })
        }
      });

      await routeMessage(getCtx('Check link: https://group-whitelist.net', user), mockAdapter);
      expect(deletedMessages.length).toBe(0);
    });

    it('allows domains registered in global custom whitelist', async () => {
      const user = '628120000008@s.whatsapp.net';
      // Register 'global-whitelist.org' globally
      await prisma.customVariable.upsert({
        where: {
          groupId_userId_key: {
            groupId: 'global',
            userId: 'system',
            key: 'whitelistdomain:global-whitelist.org'
          }
        },
        create: {
          groupId: 'global',
          userId: 'system',
          key: 'whitelistdomain:global-whitelist.org',
          value: JSON.stringify({ category: 'general', reason: 'Universal' })
        },
        update: {
          value: JSON.stringify({ category: 'general', reason: 'Universal' })
        }
      });

      await routeMessage(getCtx('Check link: https://global-whitelist.org', user), mockAdapter);
      expect(deletedMessages.length).toBe(0);

      // Clean up global variable
      await prisma.customVariable.deleteMany({
        where: {
          groupId: 'global',
          userId: 'system',
          key: 'whitelistdomain:global-whitelist.org'
        }
      });
    });
  });

  describe('F003: Anti-Forward Spam', () => {
    it('enforces limit on forwarded messages', async () => {
      const user = '628120000009@s.whatsapp.net';
      // Send 3 forwarded messages
      for (let i = 0; i < 3; i++) {
        await routeMessage(getCtx(`Forward msg ${i}`, user, true), mockAdapter);
      }
      expect(deletedMessages.length).toBe(0);

      // The 4th forwarded message triggers deletion
      await routeMessage(getCtx('Forward trigger', user, true), mockAdapter);
      expect(deletedMessages.length).toBe(1);
    });
  });

  describe('F004: Anti-Join Bot Risk Profiling', () => {
    it('calculates risk score correctly based on attributes', async () => {
      const targetUser = '628123456789@s.whatsapp.net';
      // 1. Minimum risk: Indonesian phone, profile pic exists, JID length <= 13, name exists
      const socket = mockAdapter.sock;
      const scoreLow = await calculateRiskScore(targetUser, socket);
      expect(scoreLow).toBe(0); // All clean

      // 2. Maximum risk: Non-Indo (+40), no profile pic (+30), JID length > 13 (+20), no name (+10)
      const mockRiskSocket = {
        profilePictureUrl: async () => {
          throw new Error();
        },
        contacts: {}
      };
      // '15551234567890@s.whatsapp.net' phone length is 14
      const scoreHigh = await calculateRiskScore('15551234567890@s.whatsapp.net', mockRiskSocket);
      expect(scoreHigh).toBe(100);

      // 3. Partial risk: Indonesian number, no pic, normal length, has name
      const mockPartialSocket = {
        profilePictureUrl: async () => {
          throw new Error();
        },
        contacts: {
          [targetUser]: { name: 'Some Name' }
        }
      };
      const scorePartial = await calculateRiskScore(targetUser, mockPartialSocket);
      expect(scorePartial).toBe(30); // 0 + 30 + 0 + 0 = 30
    });
  });

  describe('F005: Graded Captcha Difficulty', () => {
    it('generates low difficulty captcha for risk < 30', () => {
      const captcha = getGradedCaptcha(20, '628123456');
      expect(captcha.captchaMsg).toContain('RISIKO RENDAH');
      // Simple math a + b answer is a number
      expect(isNaN(Number(captcha.answer))).toBe(false);
    });

    it('generates medium difficulty captcha for risk 30-59', () => {
      const captcha = getGradedCaptcha(40, '628123456');
      expect(captcha.captchaMsg).toContain('RISIKO SEDANG');
      // Reverse word spelling
      expect(isNaN(Number(captcha.answer))).toBe(true);
    });

    it('generates high difficulty captcha for risk >= 60', () => {
      const captcha = getGradedCaptcha(70, '628123456');
      expect(captcha.captchaMsg).toContain('RISIKO TINGGI');
      // Complex math answer (a * b) - c is a number
      expect(isNaN(Number(captcha.answer))).toBe(false);
    });
  });

  describe('F006: Progressive Warning Punishments', () => {
    it('applies progressive penalties: warn -> mute 5m -> mute 30m -> kick', async () => {
      const targetUser = '628129999999@s.whatsapp.net';

      // 1st warning
      await executePunishment(groupId, targetUser, 'warn', 'First offense', null, mockAdapter);
      let count = await prisma.warning.count({ where: { groupId, userId: targetUser } });
      expect(count).toBe(1);
      expect(sentMessages[0].text.toLowerCase()).toContain('peringatan pertama');

      // 2nd warning -> mute 5 minutes
      await executePunishment(groupId, targetUser, 'warn', 'Second offense', null, mockAdapter);
      count = await prisma.warning.count({ where: { groupId, userId: targetUser } });
      expect(count).toBe(2);
      expect(sentMessages[1].text.toLowerCase()).toContain('di-mute selama 5 menit');
      expect(await stateStore.get(`mute:${groupId}:${targetUser}`)).toBe(true);

      // Clear mute for test continuation
      await stateStore.delete(`mute:${groupId}:${targetUser}`);

      // 3rd warning -> mute 30 minutes
      await executePunishment(groupId, targetUser, 'warn', 'Third offense', null, mockAdapter);
      count = await prisma.warning.count({ where: { groupId, userId: targetUser } });
      expect(count).toBe(3);
      expect(sentMessages[2].text.toLowerCase()).toContain('di-mute selama 30 menit');
      expect(await stateStore.get(`mute:${groupId}:${targetUser}`)).toBe(true);

      // Clear mute for test continuation
      await stateStore.delete(`mute:${groupId}:${targetUser}`);

      // 4th warning -> kick
      await executePunishment(groupId, targetUser, 'warn', 'Fourth offense', null, mockAdapter);
      expect(sentMessages[3].text.toLowerCase()).toContain('mengeluarkan anda dari grup');
      expect(kickedParticipants.length).toBe(1);
      expect(kickedParticipants[0].participants).toContain(targetUser);

      // Warning records should be cleared after kick
      count = await prisma.warning.count({ where: { groupId, userId: targetUser } });
      expect(count).toBe(0);
    });
  });
});
