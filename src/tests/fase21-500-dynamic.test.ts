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

    it('should handle new utility commands correctly', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      const axios = (await import('axios')).default;
      const getSpy = vi.spyOn(axios, 'get').mockImplementation(async (url: string) => {
        if (url.includes('geocoding-api')) {
          return { data: { results: [{ latitude: -6.9175, longitude: 107.6191, name: 'Bandung' }] } };
        }
        if (url.includes('api.open-meteo.com')) {
          return { data: { current_weather: { temperature: 25.5, windspeed: 12, weathercode: 0, time: '2026-06-22T12:00' } } };
        }
        if (url.includes('is.gd')) {
          return { data: { shorturl: 'https://is.gd/xyz' } };
        }
        return { data: {} };
      });

      // 1. /bmkgweather
      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/bmkgweather Bandung',
        senderId: memberUser,
        id: 'msg-bmkgweather'
      } as any, adapter);
      expect(replyText).toContain('PRAKIRAAN CUACA');
      expect(replyText).toContain('Bandung');

      // 2. /shorten
      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/shorten https://google.com',
        senderId: memberUser,
        id: 'msg-shorten'
      } as any, adapter);
      expect(replyText).toContain('SHORTEN');
      expect(replyText).toContain('https://is.gd/xyz');

      // 3. /holiday
      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/holiday juni',
        senderId: memberUser,
        id: 'msg-holiday'
      } as any, adapter);
      expect(replyText).toContain('HARI LIBUR NASIONAL');
      expect(replyText).toContain('JUNI');

      // 4. /base64encode
      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/base64encode Hello World',
        senderId: memberUser,
        id: 'msg-b64enc'
      } as any, adapter);
      expect(replyText).toContain('BASE64 ENCODE');
      expect(replyText).toContain('SGVsbG8gV29ybGQ=');

      // 5. /base64decode
      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/base64decode SGVsbG8gV29ybGQ=',
        senderId: memberUser,
        id: 'msg-b64dec'
      } as any, adapter);
      expect(replyText).toContain('BASE64 DECODE');
      expect(replyText).toContain('Hello World');

      // 6. /jsonformat
      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/jsonformat {"a":1}',
        senderId: memberUser,
        id: 'msg-jsonformat'
      } as any, adapter);
      expect(replyText).toContain('JSON FORMATTER');
      expect(replyText).toContain('"a": 1');

      // 7. /wordcount
      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/wordcount Hello World from Javas Bot',
        senderId: memberUser,
        id: 'msg-wordcount'
      } as any, adapter);
      expect(replyText).toContain('WORD COUNTER');
      expect(replyText).toContain('5 kata');

      getSpy.mockRestore();
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
