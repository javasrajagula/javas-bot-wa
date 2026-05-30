import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import prisma from '../db/client.js';
import { SubscriptionCommand } from '../commands/subscription.command.js';
import * as permission from '../bot/permission.js';

describe('Subscription & Rental commands', () => {
  const cmd = new SubscriptionCommand();
  const testGroup = 'test-rental-group@g.us';
  const testUser = 'test-rental-user@s.whatsapp.net';

  beforeEach(async () => {
    // Cleanup
    await prisma.groupSubscription.deleteMany({ where: { groupId: testGroup } });
    await prisma.customVariable.deleteMany({ where: { groupId: testGroup } });
    await prisma.customVariable.deleteMany({ where: { userId: testUser } });
    await prisma.premiumUser.deleteMany({ where: { userId: testUser } });
  });

  afterEach(async () => {
    // Cleanup
    await prisma.groupSubscription.deleteMany({ where: { groupId: testGroup } });
    await prisma.customVariable.deleteMany({ where: { groupId: testGroup } });
    await prisma.customVariable.deleteMany({ where: { userId: testUser } });
    await prisma.premiumUser.deleteMany({ where: { userId: testUser } });
  });

  it('should handle /sewa and /fitursewa info', async () => {
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
      id: 'msg-sewa-1'
    } as any;

    await cmd.execute(ctx, [], adapter);
    expect(replyText).toContain('INFORMASI SEWA JAVAS BOT WA');

    await cmd.execute({ ...ctx, body: '/fitursewa' }, [], adapter);
    expect(replyText).toContain('PERBANDINGAN FITUR SEWA GRUP');
  });

  it('should allow user to request trial once and reject subsequent claims', async () => {
    let replyText = '';
    const adapter = {
      sendMessage: async (chatId: string, text: string) => {
        replyText = text;
      }
    } as any;

    const ctx = {
      chatId: testGroup,
      isGroup: true,
      body: '/trial',
      senderId: testUser,
      id: 'msg-trial-1'
    } as any;

    // Claim first time: success
    await cmd.execute(ctx, [], adapter);
    expect(replyText).toContain('TRIAL GRUP BERHASIL');

    const sub = await prisma.groupSubscription.findUnique({ where: { groupId: testGroup } });
    expect(sub).not.toBeNull();
    expect(sub?.plan).toBe('basic');
    expect(sub?.expiresAt).toBeDefined();

    // Claim second time: rejected
    await cmd.execute(ctx, [], adapter);
    expect(replyText).toContain('sudah pernah mengklaim jatah Trial');
  });

  it('should generate an invoice and allow owner to confirm it', async () => {
    let replyText = '';
    const adapter = {
      sendMessage: async (chatId: string, text: string) => {
        replyText = text;
      }
    } as any;

    const ctx = {
      chatId: testGroup,
      isGroup: true,
      body: '/invoice premium 3',
      senderId: testUser,
      id: 'msg-inv-1'
    } as any;

    // Generate invoice
    await cmd.execute(ctx, ['premium', '3'], adapter);
    expect(replyText).toContain('INVOICE PEMBAYARAN JAVAS BOT');
    expect(replyText).toContain('Total Tagihan:* *Rp 67.500*'); // 25000 * 3 * 0.9 = 67500 (10% discount)

    // Extract Invoice ID from output
    const match = replyText.match(/INV-[A-F0-9]+/);
    expect(match).not.toBeNull();
    const invoiceId = match![0];

    // Confirm by Owner (testUser is owner)
    const isOwnerSpy = vi.spyOn(permission, 'isOwner').mockImplementation((userId) => userId === testUser);

    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: `/sewaconfirm ${invoiceId}`,
      senderId: testUser,
      id: 'msg-confirm-1'
    } as any, [invoiceId], adapter);

    expect(replyText).toContain('BERHASIL DIKONFIRMASI');
    expect(replyText).toContain('PREMIUM');

    const updatedSub = await prisma.groupSubscription.findUnique({ where: { groupId: testGroup } });
    expect(updatedSub?.plan).toBe('premium');

    isOwnerSpy.mockRestore();
  });
});
