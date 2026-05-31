import { describe, expect, it, beforeEach } from 'vitest';
import prisma from '../db/client.js';
import { getOrCreateGroupConfig } from '../services/system/default-record.service.js';
import { updateGroupUserStats } from '../commands/community/stats.command.js';

describe('Concurrency & Idempotency Tests', () => {
  const testGroupId = 'concurrency-group@g.us';
  const testUserId = 'concurrency-user@s.whatsapp.net';

  beforeEach(async () => {
    // Clean up test data
    await prisma.groupConfig.deleteMany({ where: { groupId: testGroupId } });
    await prisma.groupUserStats.deleteMany({
      where: {
        groupId: testGroupId,
        userId: testUserId
      }
    });
  });

  it('should initialize GroupConfig atomically under concurrent calls without throwing P2002', async () => {
    // Trigger 20 parallel initialization calls for the same groupId
    const calls = Array.from({ length: 20 }, () => getOrCreateGroupConfig(testGroupId));
    
    // They should resolve successfully without throwing unique constraint violations
    const results = await Promise.all(calls);
    
    expect(results.length).toBe(20);
    results.forEach(res => {
      expect(res.groupId).toBe(testGroupId);
    });

    // Check count in database, should be exactly 1
    const count = await prisma.groupConfig.count({
      where: { groupId: testGroupId }
    });
    expect(count).toBe(1);
  });

  it('should increment messageCount atomically under parallel updates without throwing P2002', async () => {
    // Trigger 20 parallel stats increments
    const calls = Array.from({ length: 20 }, () => updateGroupUserStats(testGroupId, testUserId));
    
    await Promise.all(calls);

    // Retrieve stats
    const stats = await prisma.groupUserStats.findUnique({
      where: {
        groupId_userId: {
          groupId: testGroupId,
          userId: testUserId
        }
      }
    });

    expect(stats).not.toBeNull();
    expect(stats?.messageCount).toBe(20);
  });
});
