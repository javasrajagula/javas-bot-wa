import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import prisma from '../db/client.js';
import { ResellerCommand } from '../commands/owner/reseller.command.js';
import * as permission from '../bot/permission.js';

describe('Reseller System commands', () => {
  const cmd = new ResellerCommand();
  const testGroup = 'test-reseller-group@g.us';
  const testReseller = 'testreselleruser@s.whatsapp.net';
  const testOwner = 'testresellerowner@s.whatsapp.net';

  beforeEach(async () => {
    // Cleanup
    await prisma.customVariable.deleteMany({});
    await prisma.groupSubscription.deleteMany({});
  });

  afterEach(async () => {
    // Cleanup
    await prisma.customVariable.deleteMany({});
    await prisma.groupSubscription.deleteMany({});
  });

  it('should allow owner to add reseller, topup balance, and reseller to place order', async () => {
    const replies: string[] = [];
    const adapter = {
      sendMessage: async (chatId: string, text: string) => {
        replies.push(text);
      }
    } as any;

    const ctx = {
      chatId: testGroup,
      isGroup: true,
      body: `/addreseller @${testReseller.split('@')[0]} 100000`,
      senderId: testOwner,
      id: 'msg-reseller-add-1'
    } as any;

    // Mock owner check
    const isOwnerSpy = vi.spyOn(permission, 'isOwner').mockImplementation((userId) => userId === testOwner);

    // 1. Add Reseller
    await cmd.execute(ctx, [`@${testReseller.split('@')[0]}`, '100000'], adapter);
    expect(replies[replies.length - 1]).toContain('RESELLER BARU BERHASIL DIAKTIFKAN');
    expect(replies[replies.length - 1]).toContain('Rp 100.000');

    // 2. Check Reseller Balance (as testReseller)
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: '/reseller balance',
      senderId: testReseller,
      id: 'msg-reseller-bal-1'
    } as any, ['balance'], adapter);
    expect(replies[replies.length - 1]).toContain('SALDO DEPOSIT RESELLER ANDA');
    expect(replies[replies.length - 1]).toContain('Rp 100.000');

    // 3. Top Up Reseller Balance (by Owner)
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: `/reseller balance topup @${testReseller.split('@')[0]} 50000`,
      senderId: testOwner,
      id: 'msg-reseller-topup-1'
    } as any, ['balance', 'topup', `@${testReseller.split('@')[0]}`, '50000'], adapter);
    expect(replies[replies.length - 1]).toContain('PENGISIAN SALDO RESELLER SUKSES');
    expect(replies[replies.length - 1]).toContain('Rp 150.000');

    // 4. Place Order (as testReseller)
    const targetGroup = 'target-client-group@g.us';
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: `/reseller order premium ${targetGroup} 3`,
      senderId: testReseller,
      id: 'msg-reseller-order-1'
    } as any, ['order', 'premium', targetGroup, '3'], adapter);

    // Order sewa memanggil sendMessage dua kali (response sukses dan notifikasi grup target)
    // Kita pastikan ada pesan sukses order
    const orderSuccessMsg = replies.find(r => r.includes('ORDER SEWA RESELLER SUKSES'));
    expect(orderSuccessMsg).toBeDefined();
    expect(orderSuccessMsg).toContain('Rp 52.500');
    expect(orderSuccessMsg).toContain('Rp 97.500'); // 150000 - 52500 = 97500

    // Verify DB group subscription update
    const sub = await prisma.groupSubscription.findUnique({ where: { groupId: targetGroup } });
    expect(sub?.plan).toBe('premium');

    // 5. Check Reseller Panel
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: '/reseller panel',
      senderId: testReseller,
      id: 'msg-reseller-panel-1'
    } as any, ['panel'], adapter);

    expect(replies[replies.length - 1]).toContain('PANEL KEMITRAAN RESELLER');
    expect(replies[replies.length - 1]).toContain('Total Order Selesai:* 1 transaksi');
    expect(replies[replies.length - 1]).toContain('Rp 97.500');

    isOwnerSpy.mockRestore();
  });
});
