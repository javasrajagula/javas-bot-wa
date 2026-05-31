import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import prisma from '../db/client.js';
import { QuotaCommand } from '../commands/owner/quota.command.js';
import { routeMessage } from '../commands/index.js';

describe('Quota & Credit commands', () => {
  const cmd = new QuotaCommand();
  const testGroup = 'test-quota-group@g.us';
  const testUser = 'test-quota-user@s.whatsapp.net';

  beforeEach(async () => {
    // Cleanup
    await prisma.customVariable.deleteMany({ where: { userId: testUser } });
    await prisma.userEconomy.deleteMany({ where: { userId: testUser } });
    await prisma.usageLog.deleteMany({ where: { groupId: testGroup } });
    await prisma.usageLog.deleteMany({ where: { userId: testUser } });
    await prisma.groupSubscription.deleteMany({ where: { groupId: testGroup } });
  });

  afterEach(async () => {
    // Cleanup
    await prisma.customVariable.deleteMany({ where: { userId: testUser } });
    await prisma.userEconomy.deleteMany({ where: { userId: testUser } });
    await prisma.usageLog.deleteMany({ where: { groupId: testGroup } });
    await prisma.usageLog.deleteMany({ where: { userId: testUser } });
    await prisma.groupSubscription.deleteMany({ where: { groupId: testGroup } });
  });

  it('should view credits and reject purchase if balance is insufficient', async () => {
    let replyText = '';
    const adapter = {
      sendMessage: async (chatId: string, text: string) => {
        replyText = text;
      }
    } as any;

    const ctx = {
      chatId: testGroup,
      isGroup: true,
      body: '/credit',
      senderId: testUser,
      id: 'msg-credit-1'
    } as any;

    // 1. Check credits (defaults to 0)
    await cmd.execute(ctx, [], adapter);
    expect(replyText).toContain('Kredit:* *0*');

    // 2. Buy credit with 0 RPG balance -> rejected
    await cmd.execute({ ...ctx, body: '/buycredit 10' }, ['10'], adapter);
    expect(replyText).toContain('Saldo RPG tidak cukup');
  });

  it('should allow purchasing credit when RPG balance is sufficient', async () => {
    // Setup balance RPG
    await prisma.userEconomy.create({
      data: {
        userId: testUser,
        balance: 500
      }
    });

    let replyText = '';
    const adapter = {
      sendMessage: async (chatId: string, text: string) => {
        replyText = text;
      }
    } as any;

    const ctx = {
      chatId: testGroup,
      isGroup: true,
      body: '/buycredit 10',
      senderId: testUser,
      id: 'msg-buy-1'
    } as any;

    // Buy 10 credits (cost: 100 koin RPG)
    await cmd.execute(ctx, ['10'], adapter);
    expect(replyText).toContain('PEMBELIAN KREDIT BERHASIL');
    expect(replyText).toContain('Total Kredit Sekarang:* *10*');

    // Verify balance reduced in DB
    const eco = await prisma.userEconomy.findUnique({ where: { userId: testUser } });
    expect(eco?.balance).toBe(400); // 500 - 100 = 400
  });

  it('should show group quota stats', async () => {
    let replyText = '';
    const adapter = {
      sendMessage: async (chatId: string, text: string) => {
        replyText = text;
      }
    } as any;

    const ctx = {
      chatId: testGroup,
      isGroup: true,
      body: '/quota',
      senderId: testUser,
      id: 'msg-quota-1'
    } as any;

    await cmd.execute(ctx, [], adapter);
    expect(replyText).toContain('KUOTA HARIAN GRUP');
    expect(replyText).toContain('FREE');
    expect(replyText).toContain('50 perintah');
  });

  it('should block command execution if group daily quota is exceeded', async () => {
    // Setup group plan to basic (which allows economy/general commands like /quota)
    await prisma.groupSubscription.create({
      data: {
        groupId: testGroup,
        plan: 'basic',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      }
    });

    // Add 200 usage logs for today
    const logsData = Array.from({ length: 200 }).map(() => ({
      userId: testUser,
      groupId: testGroup,
      feature: 'general'
    }));

    await prisma.usageLog.createMany({
      data: logsData
    });

    let replyText = '';
    const adapter = {
      sendMessage: async (chatId: string, text: string) => {
        replyText = text;
      }
    } as any;

    // Try routing a command (e.g. /quota)
    const ctx = {
      chatId: testGroup,
      isGroup: true,
      body: '/quota',
      senderId: testUser,
      id: 'msg-quota-test-1'
    } as any;

    await routeMessage(ctx, adapter);

    expect(replyText).toContain('KUOTA HARIAN GRUP HABIS');
  });

  it('should not block command execution for bypass commands even if group daily quota is exceeded', async () => {
    await prisma.groupSubscription.create({
      data: {
        groupId: testGroup,
        plan: 'basic',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      }
    });

    const logsData = Array.from({ length: 200 }).map(() => ({
      userId: testUser,
      groupId: testGroup,
      feature: 'general'
    }));

    await prisma.usageLog.createMany({
      data: logsData
    });

    let replyText = '';
    const adapter = {
      sendMessage: async (chatId: string, text: string) => {
        replyText = text;
      }
    } as any;

    const ctx = {
      chatId: testGroup,
      isGroup: true,
      body: '/sewa',
      senderId: testUser,
      id: 'msg-sewa-test-1'
    } as any;

    await import('../commands/subscription.command.js');

    await routeMessage(ctx, adapter);

    expect(replyText).not.toContain('KUOTA HARIAN GRUP HABIS');
  });
});
