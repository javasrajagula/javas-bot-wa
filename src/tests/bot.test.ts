import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rateLimiter } from '../utils/rate-limit.util.js';
import { isValidUrl } from '../services/downloader/downloader.service.js';
import { werewolfEngine, Player } from '../services/werewolf/werewolf.engine.js';
import prisma from '../db/client.js';

describe('WhatsApp Bot System Tests', () => {
  
  describe('Rate Limiter', () => {
    it('should limit request after exceeding limit', () => {
      const userKey = 'test-user-sticker';
      const feature = 'sticker';
      const config = rateLimiter.getLimitConfig(feature);
      
      if (!config) return;

      // Fill up the quota
      for (let i = 0; i < config.maxRequests; i++) {
        const result = rateLimiter.isRateLimited(userKey, feature);
        expect(result.limited).toBe(false);
      }

      // Next request must be limited
      const limitedResult = rateLimiter.isRateLimited(userKey, feature);
      expect(limitedResult.limited).toBe(true);
      expect(limitedResult.retryAfterSeconds).toBeGreaterThan(0);
    });
  });

  describe('URL Validator', () => {
    it('should validate TikTok and Instagram URLs correctly', () => {
      expect(isValidUrl('https://www.tiktok.com/@user/video/1234567890')).toBe(true);
      expect(isValidUrl('https://vt.tiktok.com/ZS123456/')).toBe(true);
      expect(isValidUrl('https://www.instagram.com/reel/C123456/')).toBe(true);
      expect(isValidUrl('https://instagram.com/p/C123456/')).toBe(true);
      expect(isValidUrl('https://google.com')).toBe(false);
      expect(isValidUrl('invalid-url')).toBe(false);
    });
  });

  describe('Werewolf Engine', () => {
    it('should determine win conditions correctly', () => {
      // 1. Villagers win (no werewolves left)
      const players1: Player[] = [
        { id: '1', name: 'A', isAlive: true, role: 'Villager' },
        { id: '2', name: 'B', isAlive: true, role: 'Doctor' },
        { id: '3', name: 'C', isAlive: false, role: 'Werewolf' }
      ];
      expect(werewolfEngine.checkWinCondition(players1)).toBe(true);

      // 2. Werewolves win (equal or more werewolves than citizens)
      const players2: Player[] = [
        { id: '1', name: 'A', isAlive: true, role: 'Villager' },
        { id: '2', name: 'B', isAlive: true, role: 'Werewolf' },
        { id: '3', name: 'C', isAlive: false, role: 'Doctor' }
      ];
      expect(werewolfEngine.checkWinCondition(players2)).toBe(true);

      // 3. Game continues
      const players3: Player[] = [
        { id: '1', name: 'A', isAlive: true, role: 'Villager' },
        { id: '2', name: 'B', isAlive: true, role: 'Doctor' },
        { id: '3', name: 'C', isAlive: true, role: 'Werewolf' }
      ];
      expect(werewolfEngine.checkWinCondition(players3)).toBe(false);
    });
  });

  describe('Permissions system', () => {
    it('should identify owner correctly', async () => {
      const { isOwner } = await import('../bot/permission.js');
      expect(isOwner('some-non-owner-id')).toBe(false);
    });

    it('should identify premium users correctly', async () => {
      const { isPremium } = await import('../bot/permission.js');
      const testUserId = '1234567890@s.whatsapp.net';
      
      // Clean up first
      await prisma.premiumUser.deleteMany({ where: { userId: testUserId } });

      expect(await isPremium(testUserId)).toBe(false);

      // Add to premium
      await prisma.premiumUser.create({
        data: {
          userId: testUserId,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
        }
      });

      expect(await isPremium(testUserId)).toBe(true);

      // Clean up
      await prisma.premiumUser.deleteMany({ where: { userId: testUserId } });
    });
  });

  describe('Feature Flags', () => {
    it('should set and parse feature flags correctly', async () => {
      const { setGroupFeature, getGroupFeatures } = await import('../config/feature-flags.js');
      const testGroupId = 'test-group-id@g.us';

      // Clean up first
      await prisma.groupConfig.deleteMany({ where: { groupId: testGroupId } });

      const defaultFlags = await getGroupFeatures(testGroupId);
      expect(defaultFlags.welcome).toBe(false);
      expect(defaultFlags.antilink).toBe(false);

      // Turn on welcome
      await setGroupFeature(testGroupId, 'welcome', true);

      const updatedFlags = await getGroupFeatures(testGroupId);
      expect(updatedFlags.welcome).toBe(true);

      // Clean up
      await prisma.groupConfig.deleteMany({ where: { groupId: testGroupId } });
    });
  });

  describe('Economy and Leveling', () => {
    it('should add XP and balance and level up correctly', async () => {
      const { addXpAndBalance } = await import('../commands/economy.command.js');
      const testUser = 'test-eco-user@s.whatsapp.net';
      await prisma.userEconomy.deleteMany({ where: { userId: testUser } });

      // First addition
      const { newLevel, economy } = await addXpAndBalance(testUser, 100, 500);
      expect(newLevel).toBeNull();
      expect(economy.xp).toBe(100);
      expect(economy.balance).toBe(500);
      expect(economy.level).toBe(1);

      // Add more to level up (XP needed for lvl 1 is 1 * 200 = 200)
      const res = await addXpAndBalance(testUser, 150, 200);
      expect(res.newLevel).toBe(2);
      expect(res.economy.level).toBe(2);
      expect(res.economy.xp).toBe(50); // 100 + 150 - 200 = 50
      expect(res.economy.balance).toBe(700);

      // Clean up
      await prisma.userEconomy.deleteMany({ where: { userId: testUser } });
    });

    it('should calculate next level XP requirement', async () => {
      const { getXpNeededForNextLevel } = await import('../commands/economy.command.js');
      expect(getXpNeededForNextLevel(1)).toBe(200);
      expect(getXpNeededForNextLevel(2)).toBe(400);
      expect(getXpNeededForNextLevel(5)).toBe(1000);
    });
  });

  describe('Owner Tools & Plugin System', () => {
    it('should toggle plugins correctly', async () => {
      const { pluginManager } = await import('../config/plugins.js');

      // Ensure clean state before test regardless of parallel test execution
      pluginManager.setPluginStatus('sticker', true);

      expect(pluginManager.isCommandEnabled('stiker')).toBe(true);

      pluginManager.setPluginStatus('sticker', false);
      expect(pluginManager.isCommandEnabled('stiker')).toBe(false);

      pluginManager.setPluginStatus('sticker', true);
      expect(pluginManager.isCommandEnabled('stiker')).toBe(true);
    });

    it('should generate and hash api keys correctly', async () => {
      const crypto = await import('crypto');
      const testUser = 'test-api-user@s.whatsapp.net';
      await prisma.apiKey.deleteMany({ where: { userId: testUser } });

      const rawKey = 'javas_key_test_123456';
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      const apiKey = await prisma.apiKey.create({
        data: {
          userId: testUser,
          keyHash
        }
      });

      expect(apiKey).toBeDefined();
      expect(apiKey.keyHash).toBe(keyHash);

      const found = await prisma.apiKey.findUnique({
        where: { keyHash }
      });
      expect(found).not.toBeNull();
      expect(found?.userId).toBe(testUser);

      await prisma.apiKey.deleteMany({ where: { userId: testUser } });
    });
  });

  describe('Command Registry', () => {
    it('should retrieve commands and resolve aliases correctly', async () => {
      await import('../commands/sticker/sticker.command.js');
      const { commandRegistry } = await import('../commands/registry/command-registry.js');
      const stikerCmd = commandRegistry.get('stiker');
      expect(stikerCmd).toBeDefined();
      expect(stikerCmd?.metadata.name).toBe('stiker');
      expect(stikerCmd?.metadata.aliases).toContain('s');
      expect(stikerCmd?.metadata.plugin).toBe('sticker');

      const sCmd = commandRegistry.get('s');
      expect(sCmd).toBeDefined();
      expect(sCmd?.metadata.name).toBe('stiker'); // resolves alias to primary command
    });
  });

  describe('Error Logging', () => {
    it('should log error to database and send safe message', async () => {
      const { safeReplyError } = await import('../utils/logger.js');
      
      const mockAdapter = {
        sendMessage: async (chatId: string, text: string) => {
          expect(text).toContain('Terjadi kesalahan sistem');
        }
      } as any;

      const testError = new Error('Test validation error');
      const testChatId = 'test-error-log-chat@g.us';

      // Clean up first
      await prisma.errorLog.deleteMany({ where: { message: 'Test validation error' } });

      await safeReplyError(testChatId, testError, mockAdapter, {
        scope: 'testSuite',
        feature: 'testing'
      });

      const logs = await prisma.errorLog.findMany({
        where: { message: 'Test validation error' }
      });
      expect(logs.length).toBe(1);
      expect(logs[0].scope).toBe('testSuite');
      expect(logs[0].feature).toBe('testing');
      expect(logs[0].stack).not.toBeNull();

      // Clean up
      await prisma.errorLog.deleteMany({ where: { message: 'Test validation error' } });
    });
  });

  describe('Media Validator', () => {
    it('should validate timestamps correctly', async () => {
      const { validateTimestamp } = await import('../validators/media.validator.js');
      expect(validateTimestamp('00:00:01')).toBe(true);
      expect(validateTimestamp('05:12')).toBe(true);
      expect(validateTimestamp('15')).toBe(true);
      expect(validateTimestamp('15.5')).toBe(true);
      expect(validateTimestamp('abc')).toBe(false);
      expect(validateTimestamp('00:00:00:01')).toBe(false);
    });

    it('should parse time formats to seconds correctly', async () => {
      const { parseTimeToSeconds } = await import('../validators/media.validator.js');
      expect(parseTimeToSeconds('00:00:01')).toBe(1);
      expect(parseTimeToSeconds('05:12')).toBe(312);
      expect(parseTimeToSeconds('15')).toBe(15);
      expect(parseTimeToSeconds('15.5')).toBe(15.5);
    });

    it('should enforce watermark text limits', async () => {
      const { validateWatermarkText } = await import('../validators/media.validator.js');
      expect(() => validateWatermarkText('A short watermark')).not.toThrow();
      expect(() => validateWatermarkText('A very very very very long watermark text that exceeds 30 characters')).toThrow(/terlalu panjang/);
    });

    it('should enforce speed limits', async () => {
      const { validateSpeed } = await import('../validators/media.validator.js');
      expect(() => validateSpeed(1.5)).not.toThrow();
      expect(() => validateSpeed(0.5)).not.toThrow();
      expect(() => validateSpeed(2.0)).not.toThrow();
      expect(() => validateSpeed(0.4)).toThrow(/Harus berada di rentang/);
      expect(() => validateSpeed(2.1)).toThrow(/Harus berada di rentang/);
      expect(() => validateSpeed(NaN)).toThrow(/Harus berada di rentang/);
    });

    it('should run ffmpeg command successfully', async () => {
      const { runFfmpeg } = await import('../services/ffmpeg/ffmpeg.service.js');
      // Running ffmpeg with no args or help should output/resolve or reject safely
      // Let's run a safe, quick flag '-version'
      await expect(runFfmpeg(['-version'])).resolves.not.toThrow();
    });
  });

  describe('Group Subscription System', () => {
    const testGroupId = 'test-subscription-group@g.us';

    it('should default to free plan if not registered', async () => {
      const sub = await prisma.groupSubscription.findUnique({
        where: { groupId: testGroupId }
      });
      expect(sub).toBeNull();
    });

    it('should create and retrieve subscription correctly', async () => {
      // Clean up first
      await prisma.groupSubscription.deleteMany({ where: { groupId: testGroupId } });

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const created = await prisma.groupSubscription.create({
        data: {
          groupId: testGroupId,
          plan: 'premium',
          expiresAt
        }
      });

      expect(created.plan).toBe('premium');
      expect(created.expiresAt).not.toBeNull();

      const retrieved = await prisma.groupSubscription.findUnique({
        where: { groupId: testGroupId }
      });
      expect(retrieved?.plan).toBe('premium');

      // Clean up
      await prisma.groupSubscription.deleteMany({ where: { groupId: testGroupId } });
    });
  });

  describe('Time Parser', () => {
    it('should parse relative time strings correctly', async () => {
      const { parseRelativeOrAbsoluteTime } = await import('../utils/time-parser.js');
      const baseDate = new Date('2026-05-30T10:00:00Z');

      // 10m
      const tenMins = parseRelativeOrAbsoluteTime('10m', baseDate);
      expect(tenMins?.toISOString()).toBe('2026-05-30T10:10:00.000Z');

      // 2h
      const twoHours = parseRelativeOrAbsoluteTime('2h', baseDate);
      expect(twoHours?.toISOString()).toBe('2026-05-30T12:00:00.000Z');

      // 1d
      const oneDay = parseRelativeOrAbsoluteTime('1d', baseDate);
      expect(oneDay?.toISOString()).toBe('2026-05-31T10:00:00.000Z');
    });

    it('should parse absolute time strings correctly', async () => {
      const { parseRelativeOrAbsoluteTime } = await import('../utils/time-parser.js');
      
      const baseDateMorning = new Date('2026-05-30T08:00:00.000Z');
      // Set to 8:00 AM local time
      baseDateMorning.setHours(8, 0, 0, 0);

      const parsedTime = parseRelativeOrAbsoluteTime('09:30', baseDateMorning);
      expect(parsedTime?.getHours()).toBe(9);
      expect(parsedTime?.getMinutes()).toBe(30);

      const parsedPassedTime = parseRelativeOrAbsoluteTime('07:30', baseDateMorning);
      // It should be the next day
      const expectedTomorrow = new Date(baseDateMorning);
      expectedTomorrow.setDate(expectedTomorrow.getDate() + 1);
      expect(parsedPassedTime?.getDate()).toBe(expectedTomorrow.getDate());
      expect(parsedPassedTime?.getHours()).toBe(7);
      expect(parsedPassedTime?.getMinutes()).toBe(30);
    });

    it('should parse relative day prefixes correctly', async () => {
      const { parseRelativeOrAbsoluteTime } = await import('../utils/time-parser.js');
      const baseDate = new Date('2026-05-30T10:00:00.000Z');

      const besok = parseRelativeOrAbsoluteTime('besok 07:00', baseDate);
      const expectedTomorrow = new Date(baseDate);
      expectedTomorrow.setDate(expectedTomorrow.getDate() + 1);
      expect(besok?.getDate()).toBe(expectedTomorrow.getDate());
      expect(besok?.getHours()).toBe(7);

      const lusa = parseRelativeOrAbsoluteTime('lusa 14:30', baseDate);
      const expectedLusa = new Date(baseDate);
      expectedLusa.setDate(expectedLusa.getDate() + 2);
      expect(lusa?.getDate()).toBe(expectedLusa.getDate());
      expect(lusa?.getHours()).toBe(14);
      expect(lusa?.getMinutes()).toBe(30);
    });
  });

  describe('Epic 12 Economy Expansion', () => {
    const testUser = 'test-eco-user-epic12@s.whatsapp.net';
    const testUser2 = 'test-eco-user-epic12-2@s.whatsapp.net';

    beforeEach(async () => {
      await prisma.groupConfig.upsert({
        where: { groupId: 'test-chat@g.us' },
        create: {
          groupId: 'test-chat@g.us',
          featuresJson: JSON.stringify({ economy: true, rpg: true })
        },
        update: {
          featuresJson: JSON.stringify({ economy: true, rpg: true })
        }
      });
    });

    afterEach(async () => {
      await prisma.groupConfig.deleteMany({ where: { groupId: 'test-chat@g.us' } });
    });

    it('should handle pet training correctly', async () => {
      // Setup pet
      await prisma.pet.deleteMany({ where: { userId: testUser } });
      await prisma.userEconomy.deleteMany({ where: { userId: testUser } });

      await prisma.userEconomy.create({
        data: { userId: testUser, balance: 100 }
      });
      
      await prisma.pet.create({
        data: { userId: testUser, name: 'KochengTest', type: 'Kucing', hunger: 100, level: 1 }
      });

      // Import command and test execute for pet train
      const { PetCommand } = await import('../commands/economy.command.js');
      const cmd = new PetCommand();

      const mockAdapter = {
        sendMessage: async (chatId: string, text: string) => {
          expect(text).toContain('KochengTest');
          expect(text).toContain('berlatih');
        }
      } as any;

      const mockContext = {
        senderId: testUser,
        senderName: 'TestUser',
        chatId: 'test-chat@g.us',
        isGroup: true,
        body: '/pet train',
        id: 'msg-id'
      } as any;

      await cmd.execute(mockContext, ['train'], mockAdapter);

      // Verify DB state
      const updatedPet = await prisma.pet.findUnique({ where: { userId: testUser } });
      expect(updatedPet?.hunger).toBe(85);
      expect(updatedPet?.xp).toBe(30);

      const updatedEco = await prisma.userEconomy.findUnique({ where: { userId: testUser } });
      expect(updatedEco?.balance).toBe(50); // 100 - 50 cost

      // Clean up
      await prisma.pet.deleteMany({ where: { userId: testUser } });
      await prisma.userEconomy.deleteMany({ where: { userId: testUser } });
    });

    it('should handle crafting items correctly', async () => {
      await prisma.userInventory.deleteMany({ where: { userId: testUser } });

      // Add ingredients
      await prisma.userInventory.createMany({
        data: [
          { userId: testUser, itemId: 'besi', quantity: 5 },
          { userId: testUser, itemId: 'emas', quantity: 1 }
        ]
      });

      const { CraftCommand } = await import('../commands/economy.command.js');
      const cmd = new CraftCommand();

      const mockAdapter = {
        sendMessage: async (chatId: string, text: string) => {
          expect(text).toContain('merakit');
          expect(text).toContain('rod pancing premium');
        }
      } as any;

      const mockContext = {
        senderId: testUser,
        chatId: 'test-chat@g.us',
        isGroup: true,
        body: '/craft rod pancing premium',
        id: 'msg-id'
      } as any;

      await cmd.execute(mockContext, ['rod', 'pancing', 'premium'], mockAdapter);

      // Verify materials are deducted and item is crafted
      const besiCount = await prisma.userInventory.count({ where: { userId: testUser, itemId: 'besi' } });
      const emasCount = await prisma.userInventory.count({ where: { userId: testUser, itemId: 'emas' } });
      const craftedItem = await prisma.userInventory.findFirst({ where: { userId: testUser, itemId: 'rod pancing premium' } });

      expect(besiCount).toBe(0);
      expect(emasCount).toBe(0);
      expect(craftedItem).toBeDefined();

      await prisma.userInventory.deleteMany({ where: { userId: testUser } });
    });

    it('should handle market listings correctly', async () => {
      await prisma.marketListing.deleteMany({});
      await prisma.userInventory.deleteMany({ where: { userId: testUser } });
      await prisma.userInventory.deleteMany({ where: { userId: testUser2 } });
      await prisma.userEconomy.deleteMany({ where: { userId: testUser } });
      await prisma.userEconomy.deleteMany({ where: { userId: testUser2 } });

      // Setup seller with item and buyer with money
      await prisma.userInventory.create({ data: { userId: testUser, itemId: 'emas', quantity: 1 } });
      await prisma.userEconomy.create({ data: { userId: testUser2, balance: 1000 } });

      const { MarketCommand } = await import('../commands/economy.command.js');
      const cmd = new MarketCommand();

      // Test listing item
      const mockAdapter1 = {
        sendMessage: async (chatId: string, text: string) => {
          expect(text).toContain('emas');
          expect(text).toContain('ke pasar');
        }
      } as any;

      const mockContext1 = {
        senderId: testUser,
        chatId: 'test-chat@g.us',
        isGroup: true,
        body: '/market sell emas 500',
        id: 'msg-id'
      } as any;

      await cmd.execute(mockContext1, ['sell', 'emas', '500'], mockAdapter1);

      // Verify listed in DB
      const listing = await prisma.marketListing.findFirst({ where: { sellerId: testUser } });
      expect(listing).not.toBeNull();
      expect(listing?.itemId).toBe('emas');
      expect(listing?.price).toBe(500);

      // Test buying item
      const mockAdapter2 = {
        sendMessage: async (chatId: string, text: string) => {
          expect(text).toContain('membeli');
          expect(text).toContain('emas');
        }
      } as any;

      const mockContext2 = {
        senderId: testUser2,
        chatId: 'test-chat@g.us',
        isGroup: true,
        body: `/market buy ${listing!.id.slice(0, 8)}`,
        id: 'msg-id'
      } as any;

      await cmd.execute(mockContext2, ['buy', listing!.id.slice(0, 8)], mockAdapter2);

      // Verify ownership change & balances
      const listingAfter = await prisma.marketListing.findFirst({ where: { id: listing!.id } });
      expect(listingAfter).toBeNull();

      const sellerEco = await prisma.userEconomy.findUnique({ where: { userId: testUser } });
      const buyerEco = await prisma.userEconomy.findUnique({ where: { userId: testUser2 } });
      expect(sellerEco?.balance).toBe(500);
      expect(buyerEco?.balance).toBe(500);

      const buyerItem = await prisma.userInventory.findFirst({ where: { userId: testUser2, itemId: 'emas' } });
      expect(buyerItem).toBeDefined();

      // Clean up
      await prisma.userInventory.deleteMany({ where: { userId: testUser } });
      await prisma.userInventory.deleteMany({ where: { userId: testUser2 } });
      await prisma.userEconomy.deleteMany({ where: { userId: testUser } });
      await prisma.userEconomy.deleteMany({ where: { userId: testUser2 } });
    });
  });
});
