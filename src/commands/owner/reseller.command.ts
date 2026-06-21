import { normalizeJid } from '../../utils/jid.util.js';
import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';
import { isOwner } from '../../bot/permission.js';

export class ResellerCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // Helper untuk mengecek apakah user adalah reseller aktif
    const checkIsReseller = async (userId: string): Promise<boolean> => {
      const res = await prisma.customVariable.findFirst({
        where: {
          groupId: 'global',
          userId,
          key: 'reseller:status'
        }
      });
      return res?.value === 'true';
    };

    // Helper untuk mengambil saldo reseller
    const getResellerBalance = async (userId: string): Promise<number> => {
      const res = await prisma.customVariable.findFirst({
        where: {
          groupId: 'global',
          userId,
          key: 'reseller:balance'
        }
      });
      return res ? parseInt(res.value, 10) : 0;
    };

    // Helper untuk mengupdate saldo reseller
    const updateResellerBalance = async (userId: string, newBalance: number): Promise<void> => {
      await prisma.customVariable.upsert({
        where: {
          groupId_userId_key: {
            groupId: 'global',
            userId,
            key: 'reseller:balance'
          }
        },
        create: {
          groupId: 'global',
          userId,
          key: 'reseller:balance',
          value: String(newBalance)
        },
        update: {
          value: String(newBalance)
        }
      });
    };

    // --- 1. /addreseller <@user> [saldo_awal] ---
    if (cmd === 'addreseller') {
      if (!isOwner(ctx.senderId)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Owner bot yang dapat menambah reseller baru.', { quotedMessageId: ctx.id });
        return;
      }

      // Ambil target user dari mention atau args
      let targetUser = args[0]?.trim();
      if (ctx.quotedMessage?.senderId) {
        targetUser = ctx.quotedMessage.senderId;
      } else if (targetUser && targetUser.startsWith('@')) {
        targetUser = normalizeJid(targetUser);
      }

      const initialBalanceStr = args[1]?.trim() || '0';
      const initialBalance = parseInt(initialBalanceStr, 10);

      if (!targetUser || Number.isNaN(initialBalance) || initialBalance < 0) {
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Format salah.\nGunakan: `/addreseller [@user] [saldo_awal]`\nContoh: `/addreseller @user 100000` atau reply pesan user dengan `/addreseller 100000`',
          { quotedMessageId: ctx.id }
        );
        return;
      }

      // Set status reseller aktif
      await prisma.customVariable.upsert({
        where: {
          groupId_userId_key: {
            groupId: 'global',
            userId: targetUser,
            key: 'reseller:status'
          }
        },
        create: {
          groupId: 'global',
          userId: targetUser,
          key: 'reseller:status',
          value: 'true'
        },
        update: {
          value: 'true'
        }
      });

      // Set saldo awal
      await updateResellerBalance(targetUser, initialBalance);

      const response = `✅ *RESELLER BARU BERHASIL DIAKTIFKAN!* 🤝\n\n• *User:* @${targetUser.split('@')[0]}\n• *Status:* Reseller Aktif\n• *Saldo Awal:* Rp ${initialBalance.toLocaleString('id-ID')}`;
      await adapter.sendMessage(ctx.chatId, response, { mentions: [targetUser], quotedMessageId: ctx.id });
      return;
    }

    // --- 2. /reseller <sub_command> ---
    if (cmd === 'reseller') {
      const sub = args[0]?.toLowerCase().trim();

      if (!sub) {
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Masukkan sub-command reseller.\nGunakan:\n• `/reseller balance` — Cek saldo deposit Anda\n• `/reseller order [basic|premium] [groupId] [bulan]` — Order sewa untuk grup\n• `/reseller panel` — Lihat riwayat transaksi order',
          { quotedMessageId: ctx.id }
        );
        return;
      }

      const isReseller = await checkIsReseller(ctx.senderId);
      const isUserOwner = isOwner(ctx.senderId);

      if (!isReseller && !isUserOwner) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Anda bukan reseller terdaftar. Hubungi Owner untuk menjadi partner.', { quotedMessageId: ctx.id });
        return;
      }

      // SUB-COMMAND: balance (info / topup)
      if (sub === 'balance') {
        const action = args[1]?.toLowerCase().trim();

        // /reseller balance topup @user <amount> (Khusus Owner)
        if (action === 'topup') {
          if (!isUserOwner) {
            await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Owner bot yang dapat mengisi saldo reseller.', { quotedMessageId: ctx.id });
            return;
          }

          let targetUser = args[2]?.trim();
          if (targetUser && targetUser.startsWith('@')) {
            targetUser = normalizeJid(targetUser);
          }

          const amountStr = args[3]?.trim();
          const amount = parseInt(amountStr || '0', 10);

          if (!targetUser || Number.isNaN(amount) || amount <= 0) {
            await adapter.sendMessage(
              ctx.chatId,
              '⚠️ Format salah.\nGunakan: `/reseller balance topup [@user] [nominal]`\nContoh: `/reseller balance topup @user 150000`',
              { quotedMessageId: ctx.id }
            );
            return;
          }

          const currentBal = await getResellerBalance(targetUser);
          const newBal = currentBal + amount;
          await updateResellerBalance(targetUser, newBal);

          const response = `✅ *PENGISIAN SALDO RESELLER SUKSES!* 🪙\n\n• *Target:* @${targetUser.split('@')[0]}\n• *Top Up:* Rp ${amount.toLocaleString('id-ID')}\n• *Total Saldo Sekarang:* Rp ${newBal.toLocaleString('id-ID')}`;
          await adapter.sendMessage(ctx.chatId, response, { mentions: [targetUser], quotedMessageId: ctx.id });
          return;
        }

        // Default: Cek saldo sendiri
        const bal = await getResellerBalance(ctx.senderId);
        await adapter.sendMessage(
          ctx.chatId,
          `🪙 *SALDO DEPOSIT RESELLER ANDA*\n\n• *Pengguna:* @${ctx.senderId.split('@')[0]}\n• *Saldo:* *Rp ${bal.toLocaleString('id-ID')}*`,
          { mentions: [ctx.senderId], quotedMessageId: ctx.id }
        );
        return;
      }

      // SUB-COMMAND: order [basic|premium] [groupId] [duration_months]
      if (sub === 'order') {
        const plan = args[1]?.toLowerCase().trim();
        const groupId = args[2]?.trim();
        const durationStr = args[3]?.trim() || '1';
        const duration = parseInt(durationStr, 10);

        if (!plan || !['basic', 'premium'].includes(plan) || !groupId || Number.isNaN(duration) || duration < 1 || duration > 12) {
          await adapter.sendMessage(
            ctx.chatId,
            '⚠️ Format salah.\nGunakan: `/reseller order [basic|premium] [groupId] [durasi_bulan]`\nContoh: `/reseller order premium 123456@g.us 3`',
            { quotedMessageId: ctx.id }
          );
          return;
        }

        // Harga diskon reseller (diskon 30% dari harga reguler)
        // Reguler: Basic 10k, Premium 25k
        const resellerPrice = plan === 'premium' ? 17500 : 7000;
        const totalCost = resellerPrice * duration;

        const currentBal = await getResellerBalance(ctx.senderId);

        if (currentBal < totalCost) {
          await adapter.sendMessage(
            ctx.chatId,
            `❌ *Saldo deposit reseller tidak mencukupi!*\n\n• Saldo Anda: *Rp ${currentBal.toLocaleString('id-ID')}*\n• Kebutuhan: *Rp ${totalCost.toLocaleString('id-ID')}*\n• Kurang: *Rp ${(totalCost - currentBal).toLocaleString('id-ID')}*`,
            { quotedMessageId: ctx.id }
          );
          return;
        }

        // Potong saldo reseller
        const newBal = currentBal - totalCost;
        await updateResellerBalance(ctx.senderId, newBal);

        // Aktifkan / perpanjang masa sewa grup target
        const currentSub = await prisma.groupSubscription.findUnique({
          where: { groupId }
        });

        let newExpiresAt = new Date();
        if (currentSub && currentSub.expiresAt && currentSub.expiresAt.getTime() > Date.now()) {
          newExpiresAt = new Date(currentSub.expiresAt.getTime());
        }
        newExpiresAt.setMonth(newExpiresAt.getMonth() + duration);

        await prisma.groupSubscription.upsert({
          where: { groupId },
          create: {
            groupId,
            plan,
            expiresAt: newExpiresAt
          },
          update: {
            plan,
            expiresAt: newExpiresAt
          }
        });

        // Catat log transaksi order reseller di CustomVariable (reseller:logs)
        const dbLogs = await prisma.customVariable.findFirst({
          where: {
            groupId: 'global',
            userId: ctx.senderId,
            key: 'reseller:logs'
          }
        });

        const logs = dbLogs ? JSON.parse(dbLogs.value) : [];
        const newLog = {
          groupId,
          plan,
          durationMonths: duration,
          cost: totalCost,
          timestamp: Date.now()
        };
        logs.unshift(newLog);

        await prisma.customVariable.upsert({
          where: {
            groupId_userId_key: {
              groupId: 'global',
              userId: ctx.senderId,
              key: 'reseller:logs'
            }
          },
          create: {
            groupId: 'global',
            userId: ctx.senderId,
            key: 'reseller:logs',
            value: JSON.stringify(logs)
          },
          update: {
            value: JSON.stringify(logs)
          }
        });

        const response = `🎉 *ORDER SEWA RESELLER SUKSES!* 🎉\n\n• *Grup ID:* \`${groupId}\`\n• *Paket:* *${plan.toUpperCase()} Plan*\n• *Durasi:* ${duration} Bulan\n• *Potongan Saldo:* Rp ${totalCost.toLocaleString('id-ID')}\n• *Sisa Saldo Reseller:* Rp ${newBal.toLocaleString('id-ID')}\n• *Masa Aktif Baru:* *${newExpiresAt.toLocaleDateString('id-ID')}*`;
        await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });

        // Kirim notifikasi ke grup target jika bot berada di grup tersebut
        await adapter.sendMessage(
          groupId,
          `🎉 *SEWA GRUP TELAH PERPANJANG!* 🎉\n\nSewa grup ini telah berhasil diperpanjang oleh partner reseller:\n• Paket: *${plan.toUpperCase()} Plan*\n• Masa aktif baru: *${newExpiresAt.toLocaleDateString('id-ID')}*`
        ).catch(() => {});
        return;
      }

      // SUB-COMMAND: panel (dashboard / logs)
      if (sub === 'panel') {
        const bal = await getResellerBalance(ctx.senderId);

        const dbLogs = await prisma.customVariable.findFirst({
          where: {
            groupId: 'global',
            userId: ctx.senderId,
            key: 'reseller:logs'
          }
        });

        const logs = dbLogs ? JSON.parse(dbLogs.value) : [];

        let response = `📊 *PANEL KEMITRAAN RESELLER* 📊\n\n`;
        response += `• *Status:* 🟢 Reseller Aktif\n`;
        response += `• *Saldo Deposit:* Rp ${bal.toLocaleString('id-ID')}\n`;
        response += `• *Total Order Selesai:* ${logs.length} transaksi\n\n`;
        response += `*5 Riwayat Transaksi Terakhir:*\n`;

        if (logs.length === 0) {
          response += `_Belum ada transaksi order._\n`;
        } else {
          logs.slice(0, 5).forEach((log: any, index: number) => {
            const date = new Date(log.timestamp).toLocaleDateString('id-ID');
            response += `${index + 1}. [${date}] Grup: \`${log.groupId.split('@')[0]}\`\n`;
            response += `   Paket: *${log.plan.toUpperCase()}* (${log.durationMonths} Bulan) - Rp ${log.cost.toLocaleString('id-ID')}\n`;
          });
        }

        await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
        return;
      }
    }
  }
}

const resellerCmd = new ResellerCommand();
registerCommand(['addreseller', 'reseller'], resellerCmd);
