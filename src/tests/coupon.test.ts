import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import prisma from '../db/client.js';
import { CouponCommand } from '../commands/owner/coupon.command.js';
import * as permission from '../bot/permission.js';

describe('Coupon & Referral commands', () => {
  const cmd = new CouponCommand();
  const testGroup = 'test-coupon-group@g.us';
  const testUser = 'testcouponuser@s.whatsapp.net';
  const testOwner = 'testcouponowner@s.whatsapp.net';

  beforeEach(async () => {
    // Cleanup
    await prisma.redeemCode.deleteMany({});
    await prisma.customVariable.deleteMany({});
    await prisma.userEconomy.deleteMany({});
    await prisma.premiumUser.deleteMany({});
  });

  afterEach(async () => {
    // Cleanup
    await prisma.redeemCode.deleteMany({});
    await prisma.customVariable.deleteMany({});
    await prisma.userEconomy.deleteMany({});
    await prisma.premiumUser.deleteMany({});
  });

  it('should allow owner to create coupon and users to redeem it', async () => {
    let replyText = '';
    const adapter = {
      sendMessage: async (chatId: string, text: string) => {
        replyText = text;
      }
    } as any;

    const ctx = {
      chatId: testGroup,
      isGroup: true,
      body: '/coupon create MYCODE credits:50 5',
      senderId: testOwner,
      id: 'msg-coupon-create-1'
    } as any;

    // Mock owner check to return true for testOwner
    const isOwnerSpy = vi.spyOn(permission, 'isOwner').mockImplementation((userId) => userId === testOwner);

    // 1. Create Coupon
    await cmd.execute(ctx, ['create', 'MYCODE', 'credits:50', '5'], adapter);
    expect(replyText).toContain('KUPON BERHASIL DIBUAT');
    expect(replyText).toContain('50 Kredit');

    // Verify DB entry
    const coupon = await prisma.redeemCode.findUnique({ where: { code: 'MYCODE' } });
    expect(coupon).not.toBeNull();
    expect(coupon?.maxUses).toBe(5);

    // 2. Use Coupon by regular user (testUser)
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: '/coupon use MYCODE',
      senderId: testUser,
      id: 'msg-coupon-use-1'
    } as any, ['use', 'MYCODE'], adapter);

    expect(replyText).toContain('KLAIM KUPON BERHASIL');
    expect(replyText).toContain('+50 Kredit Premium');

    // Verify credits added in CustomVariable
    const dbCredit = await prisma.customVariable.findUnique({
      where: {
        groupId_userId_key: {
          groupId: 'global',
          userId: testUser,
          key: 'credits'
        }
      }
    });
    expect(dbCredit?.value).toBe('50');

    // Verify usedCount incremented in DB
    const updatedCoupon = await prisma.redeemCode.findUnique({ where: { code: 'MYCODE' } });
    expect(updatedCoupon?.usedCount).toBe(1);

    isOwnerSpy.mockRestore();
  });

  it('should generate referral codes and allow referrals claiming', async () => {
    let replyText = '';
    const adapter = {
      sendMessage: async (chatId: string, text: string) => {
        replyText = text;
      }
    } as any;

    // 1. Generate referral code for owner user (testOwner)
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: '/referral',
      senderId: testOwner,
      id: 'msg-ref-1'
    } as any, [], adapter);

    expect(replyText).toContain('PROGRAM REFERRAL JAVAS BOT');
    const match = replyText.match(/REF-[A-Z0-9]+/);
    expect(match).not.toBeNull();
    const refCode = match![0];

    // 2. Regular user (testUser) claims the referral code
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: `/refclaim ${refCode}`,
      senderId: testUser,
      id: 'msg-refclaim-1'
    } as any, [refCode], adapter);

    expect(replyText).toContain('KLAIM REFERRAL BERHASIL');
    expect(replyText).toContain('+200'); // Claimer gets 200
    expect(replyText).toContain('+500'); // Owner gets 500

    // Verify economy records are updated
    const claimerEco = await prisma.userEconomy.findUnique({ where: { userId: testUser } });
    expect(claimerEco?.balance).toBe(200);

    const ownerEco = await prisma.userEconomy.findUnique({ where: { userId: testOwner } });
    expect(ownerEco?.balance).toBe(500);

    // Verify referral count updated for owner
    const dbCount = await prisma.customVariable.findUnique({
      where: {
        groupId_userId_key: {
          groupId: 'global',
          userId: testOwner,
          key: 'referral_count'
        }
      }
    });
    expect(dbCount?.value).toBe('1');
  });
});
