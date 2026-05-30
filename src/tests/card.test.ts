import { describe, it, expect } from 'vitest';
import { renderRankCard, renderProfileCard, renderLeaderboardCard } from '../services/media/card.service.js';

describe('Card Rendering Service', () => {
  it('should successfully render a rank card image buffer', async () => {
    const buffer = await renderRankCard({
      username: 'TestUser',
      userId: 'test@s.whatsapp.net',
      level: 5,
      xp: 120,
      xpNeeded: 1000,
      balance: 1500,
      rankGlobal: 3,
      rankGrup: 1,
      title: 'Dungeon Master',
      badges: ['👑', '⚔️'],
      isPremium: true
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should successfully render a profile card image buffer', async () => {
    const buffer = await renderProfileCard({
      username: 'ProfileTester',
      userId: 'test_prof@s.whatsapp.net',
      level: 12,
      xp: 450,
      xpNeeded: 2400,
      balance: 9999,
      rankGlobal: 1,
      rankGrup: 1,
      title: 'Top Admin',
      badges: ['🛡️', '⭐', '🔥'],
      totalCommands: 142,
      joinDate: '29 May 2026',
      isPremium: false
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should successfully render a leaderboard card image buffer', async () => {
    const topUsers = [
      { name: 'Alice', level: 15, balance: 5000, userId: 'alice@s.whatsapp.net', isPremium: true },
      { name: 'Bob', level: 10, balance: 2500, userId: 'bob@s.whatsapp.net', isPremium: false },
      { name: 'Charlie', level: 8, balance: 1200, userId: 'charlie@s.whatsapp.net', isPremium: false }
    ];

    const buffer = await renderLeaderboardCard(topUsers, 'Test Group');

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
