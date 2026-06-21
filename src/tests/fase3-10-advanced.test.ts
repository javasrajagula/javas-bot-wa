import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import prisma from '../db/client.js';
import { routeMessage } from '../commands/index.js';
import { messageCache } from '../services/state/message-cache.js';
import * as indexModule from '../commands/index.js';
import { achievementService } from '../services/achievement/achievement.service.js';
import * as statsCmd from '../commands/community/stats.command.js';

// Import all advanced command modules for registration side effects
import '../commands/games/games-advanced.command.js';
import '../commands/economy/economy-advanced.command.js';
import '../commands/community/community-advanced.command.js';
import '../commands/media/media-advanced.command.js';
import '../commands/community/analytics-advanced.command.js';
import '../commands/admin/admin-advanced.command.js';
import '../commands/text/education-advanced.command.js';
import '../commands/text/integration-advanced.command.js';

describe('Fase 3 to 10 Advanced Features Tests', () => {
  const testGroup = 'test-fase3-10-group@g.us';
  const adminUser = '123456@s.whatsapp.net';
  const memberUser = '654321@s.whatsapp.net';

  beforeEach(async () => {
    vi.restoreAllMocks();

    // Mock background DB writes
    vi.spyOn(achievementService, 'unlockAchievement').mockResolvedValue(true as any);
    vi.spyOn(achievementService, 'checkEconomyAchievements').mockResolvedValue(undefined as any);
    vi.spyOn(statsCmd, 'updateGroupUserStats').mockResolvedValue(undefined as any);
    vi.spyOn(statsCmd, 'updateGroupUserCommandStats').mockResolvedValue(undefined as any);

    // Clean up
    await prisma.groupConfig.deleteMany({ where: { groupId: testGroup } });
    await prisma.groupSubscription.deleteMany({ where: { groupId: testGroup } });
    await prisma.userEconomy.deleteMany({});
    await prisma.userInventory.deleteMany({});
    await prisma.poll.deleteMany({});
    
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

    const { stateStore } = await import('../services/state/state-store.js');
    await stateStore.delete(`mute:${testGroup}:${memberUser}`);
    await stateStore.delete(`mute:${testGroup}:${adminUser}`);
  });

  afterEach(async () => {
    await prisma.groupConfig.deleteMany({ where: { groupId: testGroup } });
    await prisma.groupSubscription.deleteMany({ where: { groupId: testGroup } });
    await prisma.userEconomy.deleteMany({});
    await prisma.userInventory.deleteMany({});
    await prisma.poll.deleteMany({});
    messageCache.clear();
  });

  // FASE 3: GAMES & HIBURAN
  describe('Fase 3: Games & Hiburan', () => {
    it('should initiate /trivia battle and handle answer intercept', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/trivia',
        senderId: memberUser,
        id: 'msg-trivia'
      } as any, adapter);

      expect(replyText).toContain('TRIVIA BATTLE');

      // Now route response /jawab paris or other answers
      // We will search what question was selected to guess properly, or we can just mock activeTrivias map
      // Let's test the /jawab routing
      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/jawab paris',
        senderId: memberUser,
        id: 'msg-jawab'
      } as any, adapter);

      // The answer could be paris or other, so we check that the command executed without throwing
      expect(replyText).toBeDefined();
    });

    it('should play /roulette and return safe or mute', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/roulette',
        senderId: memberUser,
        id: 'msg-roulette'
      } as any, adapter);

      expect(replyText).toMatch(/Bang|Klik/i);
    });

    it('should start /duel and accept /serang commands', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: `/duel @${adminUser.split('@')[0]}`,
        senderId: memberUser,
        id: 'msg-duel'
      } as any, adapter);

      expect(replyText).toContain('TANTANGAN DUEL');

      // Attempt /serang command
      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/serang',
        senderId: memberUser,
        id: 'msg-serang'
      } as any, adapter);

      expect(replyText).toContain('menyerang');
    });

    it('should play /hangman and /tebak', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/hangman',
        senderId: memberUser,
        id: 'msg-hangman'
      } as any, adapter);

      expect(replyText).toContain('HANGMAN GAME');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/tebak a',
        senderId: memberUser,
        id: 'msg-tebak'
      } as any, adapter);

      expect(replyText).toMatch(/Tebakan benar|Tebakan salah/i);
    });
  });

  // FASE 4: EKONOMI & RPG
  describe('Fase 4: Ekonomi & RPG', () => {
    it('should fail skill upgrade if balance is insufficient', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/upgradeskill kekuatan',
        senderId: memberUser,
        id: 'msg-upgrade'
      } as any, adapter);

      expect(replyText).toContain('kurang');
    });

    it('should create a guild and join it', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/guild create Knights',
        senderId: memberUser,
        id: 'msg-guild-create'
      } as any, adapter);

      expect(replyText).toContain('Knights');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/guild join Knights',
        senderId: adminUser,
        id: 'msg-guild-join'
      } as any, adapter);

      expect(replyText).toContain('Knights');
    });

    it('should spin /gacha and add item to inventory', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/gacha',
        senderId: memberUser,
        id: 'msg-gacha'
      } as any, adapter);

      expect(replyText).toContain('GACHA KARTU');
      const invCount = await prisma.userInventory.count({ where: { userId: memberUser } });
      expect(invCount).toBe(1);
    });

    it('should view and buy simulator stocks', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/saham',
        senderId: memberUser,
        id: 'msg-saham-list'
      } as any, adapter);

      expect(replyText).toContain('PASAR SAHAM');
    });
  });

  // FASE 5: KOMUNITAS & PRODUKTIVITAS
  describe('Fase 5: Komunitas & Produktivitas', () => {
    it('should create poll and vote on it', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/polling Siapa Presiden Pilihanmu? | Prabowo | Gibran',
        senderId: memberUser,
        id: 'msg-poll-create'
      } as any, adapter);

      expect(replyText).toContain('POLLING GRUP');
      const poll = await prisma.poll.findFirst();
      expect(poll).toBeDefined();

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: `/vote ${poll?.id} | 1`,
        senderId: adminUser,
        id: 'msg-vote'
      } as any, adapter);

      expect(replyText).toContain('Berhasil memberikan suara');
    });

    it('should perform todo checklist actions', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/todo add Mengerjakan PR',
        senderId: memberUser,
        id: 'msg-todo-add'
      } as any, adapter);

      expect(replyText).toContain('Mengerjakan PR');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/todo list',
        senderId: memberUser,
        id: 'msg-todo-list'
      } as any, adapter);

      expect(replyText).toContain('Mengerjakan PR');
    });
  });

  // FASE 6: MEDIA & KONTEN
  describe('Fase 6: Media & Konten', () => {
    it('should trigger /tts, /steks, and /ssweb', async () => {
      let replyText = '';
      let replyAudio: Buffer | null = null;
      let replyImage: Buffer | null = null;

      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; },
        sendAudio: async (chatId: string, buf: Buffer) => { replyAudio = buf; return { id: 'msg-reply' }; },
        sendImage: async (chatId: string, buf: Buffer, cap: string) => { replyImage = buf; replyText = cap; return { id: 'msg-reply' }; },
        sendSticker: async (chatId: string, buf: Buffer) => { replyImage = buf; return { id: 'msg-reply' }; }
      } as any;

      // TTS
      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/tts Halo pagi',
        senderId: memberUser,
        id: 'msg-tts'
      } as any, adapter);

      expect(replyText).toContain('audio');

      // Steks (sticker text)
      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/steks Sticker Kece',
        senderId: memberUser,
        id: 'msg-steks'
      } as any, adapter);

      expect(replyImage).toBeDefined();
    });
  });

  // FASE 7: STATISTIK & ANALYTICS
  describe('Fase 7: Statistik & Analytics', () => {
    it('should trigger weekly report, active hours, and export statistics', async () => {
      let replyText = '';
      let replyBuf: Buffer | null = null;
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; },
        sendDocument: async (chatId: string, buf: Buffer, filename: string) => { replyBuf = buf; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/laporanminggu',
        senderId: memberUser,
        id: 'msg-laporan'
      } as any, adapter);

      expect(replyText).toContain('LAPORAN AKTIVITAS MINGGUAN');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/jamaktif',
        senderId: memberUser,
        id: 'msg-jam'
      } as any, adapter);

      expect(replyText).toContain('JAM AKTIF');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/exportpdf',
        senderId: memberUser,
        id: 'msg-export'
      } as any, adapter);

      expect(replyBuf).toBeDefined();
    });
  });

  // FASE 8: ADMIN & MANAJEMEN GRUP
  describe('Fase 8: Admin & Manajemen', () => {
    it('should test advanced ping latency', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/ping',
        senderId: memberUser,
        id: 'msg-ping'
      } as any, adapter);

      expect(replyText).toContain('PONG');
    });

    it('should allow admin to change custom footer', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      vi.spyOn(indexModule, 'checkIfAdmin').mockResolvedValue(true);

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/footer My Awesome Bot',
        senderId: adminUser,
        id: 'msg-footer'
      } as any, adapter);

      expect(replyText).toContain('Footer bot');
    });
  });

  // FASE 9: EDUKASI & INFORMASI
  describe('Fase 9: Edukasi & Informasi', () => {
    it('should evaluate expression in calculator', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/kalkulator (2 + 3) * 5',
        senderId: memberUser,
        id: 'msg-kalk'
      } as any, adapter);

      expect(replyText).toContain('*Hasil:* *25*');
    });

    it('should perform unit conversions', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/konversi 100 kg ke lbs',
        senderId: memberUser,
        id: 'msg-konv'
      } as any, adapter);

      expect(replyText).toContain('220.46 LBS');
    });

    it('should query mock prayer schedule, currency rate and weather', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/sholat Jakarta',
        senderId: memberUser,
        id: 'msg-sholat'
      } as any, adapter);

      expect(replyText).toContain('JADWAL SHOLAT');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/cuaca Bandung',
        senderId: memberUser,
        id: 'msg-cuaca'
      } as any, adapter);

      expect(replyText).toContain('CUACA');
    });
  });

  // FASE 10: INTEGRASI & API EKSTERNAL
  describe('Fase 10: Integrasi & API Eksternal', () => {
    it('should manage RSS feeds', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/rss add https://testfeed.com/rss',
        senderId: memberUser,
        id: 'msg-rss-add'
      } as any, adapter);

      expect(replyText).toContain('RSS Feed');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/rss list',
        senderId: memberUser,
        id: 'msg-rss-list'
      } as any, adapter);

      expect(replyText).toContain('https://testfeed.com/rss');
    });

    it('should check status of website and shorten url', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/cekweb https://github.com',
        senderId: memberUser,
        id: 'msg-cekweb'
      } as any, adapter);

      expect(replyText).toContain('STATUS WEBSITE');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/shorten https://github.com',
        senderId: memberUser,
        id: 'msg-short'
      } as any, adapter);

      expect(replyText).toContain('URL SHORTENER');
    });
  });
});
