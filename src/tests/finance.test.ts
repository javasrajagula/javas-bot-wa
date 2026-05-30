import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import prisma from '../db/client.js';
import { FinanceCommand } from '../commands/community/finance.command.js';
import * as indexModule from '../commands/index.js';

describe('Finance / Kas, Split Bill & Personal Finance Commands', () => {
  const cmd = new FinanceCommand();
  const testGroup = 'test-finance-group@g.us';
  const creatorUser = 'creatoruser@s.whatsapp.net';
  const targetUser = 'targetuser@s.whatsapp.net';
  const otherUser = 'otheruser@s.whatsapp.net';

  beforeEach(async () => {
    await prisma.customVariable.deleteMany({});
  });

  afterEach(async () => {
    await prisma.customVariable.deleteMany({});
  });

  it('should handle Kas masuk, keluar, saldo, and laporan', async () => {
    const replies: string[] = [];
    const adapter = {
      sendMessage: async (chatId: string, text: string) => {
        replies.push(text);
      }
    } as any;

    // Mock admin check (creatorUser & admin is true)
    const isAdminSpy = vi.spyOn(indexModule, 'checkIfAdmin').mockImplementation(async (groupId, userId) => {
      return userId === creatorUser;
    });

    // 1. Kas Masuk (by Admin creatorUser)
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: `/kas masuk 100000 @${targetUser.split('@')[0]}`,
      senderId: creatorUser,
      id: 'msg-kas-in-1'
    } as any, ['masuk', '100000', `@${targetUser.split('@')[0]}`], adapter);

    expect(replies[replies.length - 1]).toContain('KAS MASUK BERHASIL');
    expect(replies[replies.length - 1]).toContain('Rp 100.000');

    // 2. Kas Masuk (by non-Admin - should fail)
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: `/kas masuk 50000 @${targetUser.split('@')[0]}`,
      senderId: otherUser,
      id: 'msg-kas-in-fail'
    } as any, ['masuk', '50000', `@${targetUser.split('@')[0]}`], adapter);

    expect(replies[replies.length - 1]).toContain('Hanya Admin grup (Bendahara) yang dapat mengelola');

    // 3. Kas Keluar (by Admin)
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: `/kas keluar 40000 Konsumsi rapat`,
      senderId: creatorUser,
      id: 'msg-kas-out-1'
    } as any, ['keluar', '40000', 'Konsumsi', 'rapat'], adapter);

    expect(replies[replies.length - 1]).toContain('KAS KELUAR BERHASIL');
    expect(replies[replies.length - 1]).toContain('Rp 40.000');

    // 4. Check Saldo
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: `/kas saldo`,
      senderId: otherUser,
      id: 'msg-kas-saldo'
    } as any, ['saldo'], adapter);

    expect(replies[replies.length - 1]).toContain('SALDO KAS GRUP');
    expect(replies[replies.length - 1]).toContain('Rp 60.000'); // 100000 - 40000 = 60000

    isAdminSpy.mockRestore();
  });

  it('should handle Split Bill creation, status, and done', async () => {
    const replies: string[] = [];
    const adapter = {
      sendMessage: async (chatId: string, text: string) => {
        replies.push(text);
      }
    } as any;

    const isAdminSpy = vi.spyOn(indexModule, 'checkIfAdmin').mockImplementation(async (groupId, userId) => {
      return userId === creatorUser;
    });

    // 1. Create Split Bill
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: `/split 90000 @${targetUser.split('@')[0]} @${otherUser.split('@')[0]}`,
      senderId: creatorUser,
      id: 'msg-split-create'
    } as any, ['90000', `@${targetUser.split('@')[0]}`, `@${otherUser.split('@')[0]}`], adapter);

    const splitMsg = replies[replies.length - 1];
    expect(splitMsg).toContain('TAGIHAN SPLIT BILL DIBUAT');
    expect(splitMsg).toContain('Rp 45.000'); // 90000 / 2 = 45000

    // Extract Split ID
    const match = splitMsg.match(/ID Tagihan:\*\s*`([A-Z0-9-]+)`/);
    expect(match).not.toBeNull();
    const splitId = match![1];

    // 2. Check Split Status
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: `/splitstatus`,
      senderId: otherUser,
      id: 'msg-split-status'
    } as any, [], adapter);

    expect(replies[replies.length - 1]).toContain('STATUS SPLIT BILL AKTIF');
    expect(replies[replies.length - 1]).toContain(splitId);

    // 3. Mark Split as Done for targetUser (by creator)
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: `/splitdone @${targetUser.split('@')[0]}`,
      senderId: creatorUser,
      id: 'msg-split-done'
    } as any, [`@${targetUser.split('@')[0]}`], adapter);

    expect(replies[replies.length - 1]).toContain('ditandai telah melunasi bagian tagihannya');

    isAdminSpy.mockRestore();
  });

  it('should handle Personal Finance logs and budgeting', async () => {
    const replies: string[] = [];
    const adapter = {
      sendMessage: async (chatId: string, text: string) => {
        replies.push(text);
      }
    } as any;

    // 1. Add Budget Limit
    await cmd.execute({
      chatId: creatorUser,
      isGroup: false,
      body: `/budget add Jajan 50000`,
      senderId: creatorUser,
      id: 'msg-budget-add'
    } as any, ['add', 'Jajan', '50000'], adapter);

    expect(replies[replies.length - 1]).toContain('BATAS BUDGET DITETAPKAN');
    expect(replies[replies.length - 1]).toContain('Rp 50.000');

    // 2. Add Personal Expense (within budget)
    await cmd.execute({
      chatId: creatorUser,
      isGroup: false,
      body: `/catat 20000 Jajan`,
      senderId: creatorUser,
      id: 'msg-catat-1'
    } as any, ['20000', 'Jajan'], adapter);

    expect(replies[replies.length - 1]).toContain('PENCATATAN PENGELUARAN BERHASIL');
    expect(replies[replies.length - 1]).toContain('Rp 20.000');

    // 3. Add Personal Expense (over budget)
    await cmd.execute({
      chatId: creatorUser,
      isGroup: false,
      body: `/catat 40000 Jajan`,
      senderId: creatorUser,
      id: 'msg-catat-2'
    } as any, ['40000', 'Jajan'], adapter);

    expect(replies[replies.length - 1]).toContain('PERINGATAN BUDGET BULANAN');
    expect(replies[replies.length - 1]).toContain('telah melebihi batas limit bulanan');

    // 4. View Pengeluaran
    await cmd.execute({
      chatId: creatorUser,
      isGroup: false,
      body: `/pengeluaran hariini`,
      senderId: creatorUser,
      id: 'msg-view-expense'
    } as any, ['hariini'], adapter);

    expect(replies[replies.length - 1]).toContain('LAPORAN PENGELUARAN PRIBADI');
    expect(replies[replies.length - 1]).toContain('Rp 60.000'); // 20000 + 40000 = 60000
  });

  it('should handle Tagihan suite', async () => {
    const replies: string[] = [];
    const adapter = {
      sendMessage: async (chatId: string, text: string) => {
        replies.push(text);
      }
    } as any;

    const isAdminSpy = vi.spyOn(indexModule, 'checkIfAdmin').mockImplementation(async () => true);

    // 1. Create Tagihan
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: `/tagihan add @${targetUser.split('@')[0]} Iuran Kebersihan | 25000`,
      senderId: creatorUser,
      id: 'msg-tagihan-add'
    } as any, ['add', `@${targetUser.split('@')[0]}`, 'Iuran', 'Kebersihan', '|', '25000'], adapter);

    const billMsg = replies[replies.length - 1];
    expect(billMsg).toContain('TAGIHAN BARU DIBUAT');
    expect(billMsg).toContain('Iuran Kebersihan');
    expect(billMsg).toContain('Rp 25.000');

    const billId = billMsg.match(/ID Tagihan:\*\s*`([A-Z0-9-]+)`/)![1];

    // 2. List Tagihan
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: `/tagihan list`,
      senderId: otherUser,
      id: 'msg-tagihan-list'
    } as any, ['list'], adapter);

    expect(replies[replies.length - 1]).toContain('DAFTAR TAGIHAN BELUM DIBAYAR');
    expect(replies[replies.length - 1]).toContain(billId);

    // 3. Mark Tagihan as Done
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: `/tagihan done ${billId}`,
      senderId: targetUser,
      id: 'msg-tagihan-done'
    } as any, ['done', billId], adapter);

    expect(replies[replies.length - 1]).toContain('TAGIHAN LUNAS');

    isAdminSpy.mockRestore();
  });

  it('should handle Arisan kocokan', async () => {
    const replies: string[] = [];
    const adapter = {
      sendMessage: async (chatId: string, text: string) => {
        replies.push(text);
      }
    } as any;

    const isAdminSpy = vi.spyOn(indexModule, 'checkIfAdmin').mockImplementation(async () => true);

    // 1. Join Arisan
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: `/arisan join 50000`,
      senderId: creatorUser,
      id: 'msg-arisan-join-1'
    } as any, ['join', '50000'], adapter);

    expect(replies[replies.length - 1]).toContain('berhasil bergabung arisan');

    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: `/arisan join 50000`,
      senderId: targetUser,
      id: 'msg-arisan-join-2'
    } as any, ['join', '50000'], adapter);

    // 2. List Arisan
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: `/arisan list`,
      senderId: otherUser,
      id: 'msg-arisan-list'
    } as any, ['list'], adapter);

    expect(replies[replies.length - 1]).toContain('DAFTAR PESERTA ARISAN GRUP');

    // 3. Undi Arisan
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: `/arisan undi`,
      senderId: creatorUser,
      id: 'msg-arisan-undi'
    } as any, ['undi'], adapter);

    expect(replies[replies.length - 1]).toContain('KOCOKAN ARISAN TELAH DIUNDI');
    expect(replies[replies.length - 1]).toContain('Total Hadiah Dibawa Pulang');

    isAdminSpy.mockRestore();
  });

  it('should handle Escrow / Rekber simulation', async () => {
    const replies: string[] = [];
    const adapter = {
      sendMessage: async (chatId: string, text: string) => {
        replies.push(text);
      }
    } as any;

    // 1. Create Escrow
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: `/escrow create @${creatorUser.split('@')[0]} @${targetUser.split('@')[0]} 150000`,
      senderId: otherUser,
      id: 'msg-escrow-create'
    } as any, ['create', `@${creatorUser.split('@')[0]}`, `@${targetUser.split('@')[0]}`, '150000'], adapter);

    const escrowMsg = replies[replies.length - 1];
    expect(escrowMsg).toContain('TRANSAKSI ESCROW (REKBER) DI-CREATE');
    expect(escrowMsg).toContain('Rp 150.000');

    const escrowId = escrowMsg.match(/ID Rekber:\*\s*`([A-Z0-9-]+)`/)![1];

    // 2. Buyer sets escrow as paid
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: `/escrow paid ${escrowId}`,
      senderId: targetUser,
      id: 'msg-escrow-paid'
    } as any, ['paid', escrowId], adapter);

    expect(replies[replies.length - 1]).toContain('KLAIM DANA MASUK REKBER');

    // 3. Buyer releases escrow to seller
    await cmd.execute({
      chatId: testGroup,
      isGroup: true,
      body: `/escrow release ${escrowId}`,
      senderId: targetUser,
      id: 'msg-escrow-release'
    } as any, ['release', escrowId], adapter);

    expect(replies[replies.length - 1]).toContain('DANA ESCROW DI-RELEASE');
  });

  it('should handle CRM customer and order', async () => {
    const replies: string[] = [];
    const adapter = {
      sendMessage: async (chatId: string, text: string) => {
        replies.push(text);
      }
    } as any;

    // 1. CRM Add Customer
    await cmd.execute({
      chatId: creatorUser,
      isGroup: false,
      body: `/customer add @${targetUser.split('@')[0]}`,
      senderId: creatorUser,
      id: 'msg-crm-cust-add'
    } as any, ['add', `@${targetUser.split('@')[0]}`], adapter);

    expect(replies[replies.length - 1]).toContain('ke dalam CRM Customer Anda');

    // 2. CRM Add Order
    await cmd.execute({
      chatId: creatorUser,
      isGroup: false,
      body: `/order add @${targetUser.split('@')[0]} Web App Dev | 5000000`,
      senderId: creatorUser,
      id: 'msg-crm-order-add'
    } as any, ['add', `@${targetUser.split('@')[0]}`, 'Web', 'App', 'Dev', '|', '5000000'], adapter);

    expect(replies[replies.length - 1]).toContain('ORDER CRM DI-CREATE');
    expect(replies[replies.length - 1]).toContain('Rp 5.000.000');

    // 3. CRM View Order Status
    await cmd.execute({
      chatId: creatorUser,
      isGroup: false,
      body: `/order status`,
      senderId: creatorUser,
      id: 'msg-crm-order-status'
    } as any, ['status'], adapter);

    expect(replies[replies.length - 1]).toContain('DAFTAR ORDER CRM ANDA');
    expect(replies[replies.length - 1]).toContain('Web App Dev');
  });
});
