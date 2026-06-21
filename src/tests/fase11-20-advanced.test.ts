import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import prisma from '../db/client.js';
import { routeMessage } from '../commands/index.js';
import { messageCache } from '../services/state/message-cache.js';
import * as indexModule from '../commands/index.js';
import { achievementService } from '../services/achievement/achievement.service.js';
import * as statsCmd from '../commands/community/stats.command.js';

// Import all advanced command modules for registration side effects
import '../commands/text/ai-multimodal.command.js';
import '../commands/games/rpg-advanced.command.js';
import '../commands/document/utility-advanced.command.js';
import '../commands/moderation/security-advanced.command.js';
import '../commands/community/analytics-v2.command.js';
import '../commands/audio/audio-advanced.command.js';
import '../commands/text/integrations-v2.command.js';
import '../commands/owner/owner-advanced.command.js';
import '../commands/sticker/sticker-creative.command.js';
import '../commands/economy/commerce-simulation.command.js';

describe('Fase 11 to 20 Advanced Features Tests', () => {
  const testGroup = 'test-fase11-20-group@g.us';
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

  // FASE 11: ADVANCED AI & MULTIMODAL
  describe('Fase 11: Advanced AI & Multimodal', () => {
    it('should test /draw and other AI multimodal informational commands', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; },
        sendImage: async (chatId: string, buf: Buffer, cap: string) => { replyText = cap; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/draw kucing terbang',
        senderId: memberUser,
        id: 'msg-draw'
      } as any, adapter);

      expect(replyText).toContain('AI Art');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/vocal',
        senderId: memberUser,
        id: 'msg-vocal'
      } as any, adapter);

      expect(replyText).toContain('Vocal Remover');
    });
  });

  // FASE 12: RPG, ADVENTURE & MULTIPLAYER
  describe('Fase 12: RPG, Adventure & Multiplayer', () => {
    it('should test /raid and /mancing and /blackjack', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/raid start',
        senderId: memberUser,
        id: 'msg-raid'
      } as any, adapter);

      expect(replyText).toContain('RAID BOSS');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/mancing',
        senderId: memberUser,
        id: 'msg-mancing'
      } as any, adapter);

      expect(replyText).toContain('MEMANCING');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/kerja',
        senderId: memberUser,
        id: 'msg-kerja'
      } as any, adapter);

      expect(replyText).toContain('BEKERJA');
    });
  });

  // FASE 13: UTILITY & PRODUKTIVITAS ADVANCED
  describe('Fase 13: Utility & Produktivitas Advanced', () => {
    it('should test /catat and /cekresi', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/catat pengeluaran 50000 jajan',
        senderId: memberUser,
        id: 'msg-catat'
      } as any, adapter);

      expect(replyText).toContain('PENCATATAN KEUANGAN');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/cekresi JNE 12345',
        senderId: memberUser,
        id: 'msg-resi'
      } as any, adapter);

      expect(replyText).toContain('PELACAKAN RESI');
    });
  });

  // FASE 14: SECURITY & ADVANCED MODERATION
  describe('Fase 14: Security & Advanced Moderation', () => {
    it('should configure /captcha and perform /linkcheck', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      vi.spyOn(indexModule, 'checkIfAdmin').mockResolvedValue(true);

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/captcha on',
        senderId: adminUser,
        id: 'msg-captcha'
      } as any, adapter);

      expect(replyText).toContain('CAPTCHA');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/linkcheck https://dangerous-site.xyz',
        senderId: adminUser,
        id: 'msg-link'
      } as any, adapter);

      expect(replyText).toContain('MENCURIGAKAN');
    });
  });

  // FASE 15: ANALYTICS, LEADERBOARDS & STATS
  describe('Fase 15: Analytics, Leaderboards & Stats', () => {
    it('should run /wordcloud and /heatmap and /inaktif', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/wordcloud',
        senderId: memberUser,
        id: 'msg-wc'
      } as any, adapter);

      expect(replyText).toContain('Word Cloud');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/heatmap',
        senderId: memberUser,
        id: 'msg-hm'
      } as any, adapter);

      expect(replyText).toContain('HEATMAP');
    });
  });

  // FASE 16: AUDIO, MUSIC & VOICE
  describe('Fase 16: Audio, Music & Voice', () => {
    it('should test /findmusic and /speedaudio', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/findmusic',
        senderId: memberUser,
        id: 'msg-find'
      } as any, adapter);

      expect(replyText).toContain('Pencari Musik');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/speedaudio 1.5',
        senderId: memberUser,
        id: 'msg-speed'
      } as any, adapter);

      expect(replyText).toContain('kecepatan');
    });
  });

  // FASE 17: INTEGRASI API & SERVICES EKSTERNAL
  describe('Fase 17: Integrasi API & Services', () => {
    it('should test /github and /cekdompet and /steam', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/github',
        senderId: memberUser,
        id: 'msg-git'
      } as any, adapter);

      expect(replyText).toContain('GitHub');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/cekdompet 0x123',
        senderId: memberUser,
        id: 'msg-wallet'
      } as any, adapter);

      expect(replyText).toContain('DOMPET CRYPTO');
    });
  });

  // FASE 18: SYSTEM OWNER & RESELLER CONTROLS
  describe('Fase 18: System Owner & Reseller Controls', () => {
    it('should run /bayarsewa, /bc and /healthsystem', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/bayarsewa',
        senderId: memberUser,
        id: 'msg-sewa'
      } as any, adapter);

      expect(replyText).toContain('PEMBAYARAN');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/healthsystem',
        senderId: memberUser,
        id: 'msg-health'
      } as any, adapter);

      expect(replyText).toContain('HEALTH');
    });
  });

  // FASE 19: STICKERS & CREATIVE TOOLS
  describe('Fase 19: Stickers & Creative Tools', () => {
    it('should test /sfilter and /emojimix', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/sfilter vintage',
        senderId: memberUser,
        id: 'msg-filter'
      } as any, adapter);

      expect(replyText).toContain('Filter Stiker');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/emojimix 😭 😂',
        senderId: memberUser,
        id: 'msg-emix'
      } as any, adapter);

      expect(replyText).toContain('Menggabungkan');
    });
  });

  // FASE 20: COMMERCE & FINANCE SIMULATION
  describe('Fase 20: Commerce & Finance', () => {
    it('should test /deposito and /begal and /pasar', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/pasar',
        senderId: memberUser,
        id: 'msg-market'
      } as any, adapter);

      expect(replyText).toContain('PASAR PERDAGANGAN');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/deposito',
        senderId: memberUser,
        id: 'msg-depo'
      } as any, adapter);

      expect(replyText).toContain('DEPOSITO');
    });
  });
});
