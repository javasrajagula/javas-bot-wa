import { describe, it, expect } from 'vitest';
import { rateLimiter } from '../utils/rate-limit.util.js';
import { isValidUrl } from '../services/downloader/downloader.service.js';
import { werewolfEngine, Player } from '../services/werewolf/werewolf.engine.js';

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
      // "62899" is not in owner list usually, unless env is set.
      // Let's assume standard behavior or mock it.
      expect(isOwner('some-non-owner-id')).toBe(false);
    });

    it('should identify premium users correctly', async () => {
      const { isPremium } = await import('../bot/permission.js');
      const prisma = (await import('../db/client.js')).default;
      
      const testUserId = 'test-premium-user@s.whatsapp.net';
      
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
      const prisma = (await import('../db/client.js')).default;

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
      const { addXpAndBalance, getXpNeededForNextLevel } = await import('../commands/economy.command.js');
      const prisma = (await import('../db/client.js')).default;

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
});
