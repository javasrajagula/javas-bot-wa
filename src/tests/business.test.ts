import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import prisma from '../db/client.js';
import { BusinessCommand } from '../commands/community/business.command.js';
import * as permission from '../bot/permission.js';

describe('Business / Jual-Beli Commands', () => {
  const cmd = new BusinessCommand();
  const testGroup = 'test-business-group@g.us';
  const sellerUser = 'testbuyeruser@s.whatsapp.net';
  const otherUser = 'otheruser@s.whatsapp.net';

  beforeEach(async () => {
    // Cleanup
    await prisma.customVariable.deleteMany({});
    await prisma.blacklist.deleteMany({});
  });

  afterEach(async () => {
    // Cleanup
    await prisma.customVariable.deleteMany({});
    await prisma.blacklist.deleteMany({});
  });

  it('should allow user to sell items, list items, search items, mark as sold, and delete listing', async () => {
    const replies: string[] = [];
    const adapter = {
      sendMessage: async (chatId: string, text: string) => {
        replies.push(text);
      }
    } as any;

    // 1. Sell Item
    const ctxSell = {
      chatId: testGroup,
      isGroup: true,
      body: '/jual Laptop Asus Rog | 15000000 | Bekas mulus 95%, nego tipis.',
      senderId: sellerUser,
      id: 'msg-sell-1'
    } as any;

    await cmd.execute(ctxSell, ['Laptop', 'Asus', 'Rog', '|', '15000000', '|', 'Bekas', 'mulus', '95%,', 'nego', 'tipis.'], adapter);
    const sellSuccessMsg = replies[replies.length - 1];
    expect(sellSuccessMsg).toContain('PRODUK BERHASIL DIDAFTARKAN');
    expect(sellSuccessMsg).toContain('Laptop Asus Rog');
    expect(sellSuccessMsg).toContain('Rp 15.000.000');

    // Extract Product ID
    const matchId = sellSuccessMsg.match(/ID Produk:\*\s*`([A-Z0-9]+)`/);
    expect(matchId).not.toBeNull();
    const productId = matchId![1];

    // 2. List Items
    const ctxList = {
      chatId: testGroup,
      isGroup: true,
      body: '/listjual',
      senderId: otherUser,
      id: 'msg-list-1'
    } as any;

    await cmd.execute(ctxList, [], adapter);
    const listMsg = replies[replies.length - 1];
    expect(listMsg).toContain('DAFTAR PRODUK AKTIF DI GRUP');
    expect(listMsg).toContain(productId);
    expect(listMsg).toContain('Laptop Asus Rog');

    // 3. Search Items
    const ctxSearch = {
      chatId: testGroup,
      isGroup: true,
      body: '/cariitem asus',
      senderId: otherUser,
      id: 'msg-search-1'
    } as any;

    await cmd.execute(ctxSearch, ['asus'], adapter);
    const searchMsg = replies[replies.length - 1];
    expect(searchMsg).toContain('HASIL PENCARIAN PRODUK');
    expect(searchMsg).toContain('Laptop Asus Rog');

    // 4. Mark as Sold (by other user - should fail)
    const ctxSoldOther = {
      chatId: testGroup,
      isGroup: true,
      body: `/sold ${productId}`,
      senderId: otherUser,
      id: 'msg-sold-fail'
    } as any;

    await cmd.execute(ctxSoldOther, [productId], adapter);
    expect(replies[replies.length - 1]).toContain('Hanya penjual barang ini yang dapat menandainya');

    // 5. Mark as Sold (by seller - should succeed)
    const ctxSoldSeller = {
      chatId: testGroup,
      isGroup: true,
      body: `/sold ${productId}`,
      senderId: sellerUser,
      id: 'msg-sold-ok'
    } as any;

    await cmd.execute(ctxSoldSeller, [productId], adapter);
    expect(replies[replies.length - 1]).toContain('PRODUK TERJUAL');

    // Verify listjual now doesn't show the sold item
    await cmd.execute(ctxList, [], adapter);
    expect(replies[replies.length - 1]).toContain('Tidak ada produk aktif');

    // 6. Delete item
    // Create new item first
    replies.length = 0;
    await cmd.execute(ctxSell, ['Laptop', 'Asus', 'Rog', '|', '15000000', '|', 'Bekas', 'mulus', '95%'], adapter);
    const newProductMsg = replies[0];
    const newProductId = newProductMsg.match(/ID Produk:\*\s*`([A-Z0-9]+)`/)![1];

    // Delete as other user (should fail)
    const ctxDeleteOther = {
      chatId: testGroup,
      isGroup: true,
      body: `/hapusjual ${newProductId}`,
      senderId: otherUser,
      id: 'msg-del-fail'
    } as any;
    await cmd.execute(ctxDeleteOther, [newProductId], adapter);
    expect(replies[replies.length - 1]).toContain('Hanya penjual atau Admin grup yang dapat menghapus');

    // Delete as seller (should succeed)
    const ctxDeleteSeller = {
      chatId: testGroup,
      isGroup: true,
      body: `/hapusjual ${newProductId}`,
      senderId: sellerUser,
      id: 'msg-del-ok'
    } as any;
    await cmd.execute(ctxDeleteSeller, [newProductId], adapter);
    expect(replies[replies.length - 1]).toContain('berhasil dihapus dari listing jualan');
  });

  it('should block scam content and blacklisted sellers', async () => {
    const replies: string[] = [];
    const adapter = {
      sendMessage: async (chatId: string, text: string) => {
        replies.push(text);
      }
    } as any;

    // 1. Blacklisted user
    await prisma.blacklist.create({
      data: {
        userId: sellerUser,
        scope: 'global',
        reason: 'Penipu terverifikasi'
      }
    });

    const ctxSell = {
      chatId: testGroup,
      isGroup: true,
      body: '/jual Barang Bagus | 50000 | Deskripsi',
      senderId: sellerUser,
      id: 'msg-sell-fail-blacklist'
    } as any;

    await cmd.execute(ctxSell, ['Barang', 'Bagus', '|', '50000', '|', 'Deskripsi'], adapter);
    expect(replies[replies.length - 1]).toContain('Anda terdaftar di dalam blacklist database');

    // Clean up blacklist for next test
    await prisma.blacklist.deleteMany({});

    // 2. Scam keywords
    const ctxScam = {
      chatId: testGroup,
      isGroup: true,
      body: '/jual Trik Cepat Kaya Slot Gacor | 100000 | Garansi menang jackpot',
      senderId: sellerUser,
      id: 'msg-sell-fail-scam'
    } as any;

    await cmd.execute(ctxScam, ['Trik', 'Cepat', 'Kaya', 'Slot', 'Gacor', '|', '100000', '|', 'Garansi'], adapter);
    expect(replies[replies.length - 1]).toContain('Deskripsi mengandung kata-kata mencurigakan atau dilarang');
  });
});
