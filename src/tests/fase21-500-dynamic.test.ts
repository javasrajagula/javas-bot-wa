import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import prisma from '../db/client.js';
import { routeMessage } from '../commands/index.js';
import { messageCache } from '../services/state/message-cache.js';
import { achievementService } from '../services/achievement/achievement.service.js';
import * as statsCmd from '../commands/community/stats.command.js';

// Import dynamic commands to trigger side-effect registration in Vitest env
import '../commands/text/dynamic-ai.command.js';
import '../commands/moderation/dynamic-security.command.js';
import '../commands/games/dynamic-games.command.js';
import '../commands/document/dynamic-utility.command.js';
import '../commands/text/dynamic-integration.command.js';

describe('Fase 21: 500 Dynamic Unified Architecture Commands Tests', () => {
  const testGroup = 'test-fase21-group@g.us';
  const adminUser = '123456@s.whatsapp.net';
  const memberUser = '654321@s.whatsapp.net';

  beforeEach(async () => {
    vi.restoreAllMocks();

    // Mock background DB actions to keep test isolated
    vi.spyOn(achievementService, 'unlockAchievement').mockResolvedValue(true as any);
    vi.spyOn(achievementService, 'checkEconomyAchievements').mockResolvedValue(undefined as any);
    vi.spyOn(statsCmd, 'updateGroupUserStats').mockResolvedValue(undefined as any);
    vi.spyOn(statsCmd, 'updateGroupUserCommandStats').mockResolvedValue(undefined as any);

    // Clean databases
    await prisma.groupConfig.deleteMany({ where: { groupId: testGroup } });
    await prisma.groupSubscription.deleteMany({ where: { groupId: testGroup } });
    await prisma.userEconomy.deleteMany({});
    
    // Seed Premium Subscription
    await prisma.groupSubscription.upsert({
      where: { groupId: testGroup },
      create: {
        groupId: testGroup,
        plan: 'premium',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      update: {
        plan: 'premium',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    // Seed Config
    await prisma.groupConfig.upsert({
      where: { groupId: testGroup },
      create: {
        groupId: testGroup,
        prefix: '/',
        botEnabled: true,
        featuresJson: JSON.stringify({})
      },
      update: {
        prefix: '/',
        botEnabled: true,
        featuresJson: JSON.stringify({})
      }
    });

    messageCache.clear();
  });

  afterEach(async () => {
    await prisma.groupConfig.deleteMany({ where: { groupId: testGroup } });
    await prisma.groupSubscription.deleteMany({ where: { groupId: testGroup } });
    await prisma.userEconomy.deleteMany({});
    messageCache.clear();
  });

  describe('1. AI & Creative Dynamic Commands', () => {
    it('should handle /setpersona, /draw, and /sfilter correctly', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/draw futuristic cat',
        senderId: memberUser,
        id: 'msg-dynamic-draw'
      } as any, adapter);

      expect(replyText).toContain('GENERASI VISUAL AI');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/setpersona santai',
        senderId: memberUser,
        id: 'msg-dynamic-persona'
      } as any, adapter);

      expect(replyText).toContain('MULTI-PERSONA AI');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/sfilter vintage',
        senderId: memberUser,
        id: 'msg-dynamic-filter'
      } as any, adapter);

      expect(replyText).toContain('CREATIVE STICKER SUITE');
    });
  });

  describe('2. Security & Moderation Dynamic Commands', () => {
    it('should handle /join-captcha and /linkdecode correctly', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/join-captcha',
        senderId: memberUser,
        id: 'msg-dynamic-captcha'
      } as any, adapter);

      expect(replyText).toContain('CAPTCHA JOIN');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/linkdecode https://bit.ly/1234',
        senderId: memberUser,
        id: 'msg-dynamic-decode'
      } as any, adapter);

      expect(replyText).toContain('DECODE LINK SHORTENER');
    });
  });

  describe('3. RPG & Games Dynamic Commands', () => {
    it('should handle /mancing and /raid correctly', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/mancing',
        senderId: memberUser,
        id: 'msg-dynamic-mancing'
      } as any, adapter);

      expect(replyText).toContain('FISHING LAUT DALAM');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/raid',
        senderId: memberUser,
        id: 'msg-dynamic-raid'
      } as any, adapter);

      expect(replyText).toContain('BOSS RAID MULTIPLAYER');
    });
  });

  describe('4. Utility & Analytics Dynamic Commands', () => {
    it('should handle /catat and /wordcloud correctly', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/catat pengeluaran 100000',
        senderId: memberUser,
        id: 'msg-dynamic-catat'
      } as any, adapter);

      expect(replyText).toContain('PENCATATAN KEUANGAN');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/wordcloud',
        senderId: memberUser,
        id: 'msg-dynamic-wc'
      } as any, adapter);

      expect(replyText).toContain('WORD CLOUD');
    });
  });

  describe('5. Integration & API Dynamic Commands', () => {
    it('should handle /sholat and /cekresi correctly', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/sholat Surabaya',
        senderId: memberUser,
        id: 'msg-dynamic-sholat'
      } as any, adapter);

      expect(replyText).toContain('JADWAL SHOLAT UNTUK KOTA');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/cekresi JNE12345',
        senderId: memberUser,
        id: 'msg-dynamic-resi'
      } as any, adapter);

      expect(replyText).toContain('PELACAKAN RESI');
    });
  });
});
