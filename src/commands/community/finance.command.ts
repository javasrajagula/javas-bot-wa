import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import { checkIfAdmin } from '../index.js';
import prisma from '../../db/client.js';
import crypto from 'crypto';

export class FinanceCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    // Helper untuk mengambil/mengupdate CustomVariable global/grup
    const getGroupVariable = async (groupId: string, key: string): Promise<any | null> => {
      const record = await prisma.customVariable.findFirst({
        where: { groupId, key }
      });
      if (!record) return null;
      try {
        return JSON.parse(record.value);
      } catch {
        return null;
      }
    };

    const setGroupVariable = async (groupId: string, key: string, value: any): Promise<void> => {
      const existing = await prisma.customVariable.findFirst({
        where: { groupId, key }
      });

      if (existing) {
        await prisma.customVariable.update({
          where: { id: existing.id },
          data: { value: JSON.stringify(value) }
        });
      } else {
        await prisma.customVariable.create({
          data: {
            groupId,
            userId: 'system',
            key,
            value: JSON.stringify(value)
          }
        });
      }
    };

    // Helper personal finance
    const getUserVariable = async (userId: string, key: string): Promise<any | null> => {
      const record = await prisma.customVariable.findFirst({
        where: { groupId: 'private', userId, key }
      });
      if (!record) return null;
      try {
        return JSON.parse(record.value);
      } catch {
        return null;
      }
    };

    const setUserVariable = async (userId: string, key: string, value: any): Promise<void> => {
      const existing = await prisma.customVariable.findFirst({
        where: { groupId: 'private', userId, key }
      });

      if (existing) {
        await prisma.customVariable.update({
          where: { id: existing.id },
          data: { value: JSON.stringify(value) }
        });
      } else {
        await prisma.customVariable.create({
          data: {
            groupId: 'private',
            userId,
            key,
            value: JSON.stringify(value)
          }
        });
      }
    };

    // --- 1. KAS GRUP SUITE ---
    if (['kas', 'iuran'].includes(cmd)) {
      const sub = args[0]?.toLowerCase().trim();

      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur Kas hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      if (!sub) {
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Masukkan sub-command Kas.\nGunakan:\n' +
          '• `/kas masuk [jumlah] [@user]` — Mencatat kas masuk\n' +
          '• `/kas keluar [jumlah] [alasan]` — Mencatat kas keluar\n' +
          '• `/kas saldo` — Cek saldo kas grup\n' +
          '• `/kas laporan` — Laporan transaksi kas terakhir\n' +
          '• `/kas export` — Ekspor laporan kas format teks',
          { quotedMessageId: ctx.id }
        );
        return;
      }

      // Pastikan Admin / Bendahara / Owner
      const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      const isWriteAction = ['masuk', 'keluar', 'export'].includes(sub);

      if (isWriteAction && !isAdmin) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Admin grup (Bendahara) yang dapat mengelola mutasi kas.', { quotedMessageId: ctx.id });
        return;
      }

      const kasData = (await getGroupVariable(ctx.chatId, 'finance:kas')) || { transactions: [] };

      // /kas masuk <jumlah> @user
      if (sub === 'masuk') {
        const amountStr = args[1]?.replace(/[^0-9]/g, '') || '';
        const amount = parseInt(amountStr, 10);
        let targetUser = args[2]?.trim();

        if (ctx.quotedMessage?.senderId) {
          targetUser = ctx.quotedMessage.senderId;
        } else if (targetUser && targetUser.startsWith('@')) {
          targetUser = targetUser.replace('@', '') + '@s.whatsapp.net';
        }

        if (Number.isNaN(amount) || amount <= 0 || !targetUser) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah.\nGunakan: `/kas masuk [jumlah] [@user]` atau reply pesan user dengan `/kas masuk [jumlah]`', { quotedMessageId: ctx.id });
          return;
        }

        const txId = `TX-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const newTx = {
          id: txId,
          type: 'masuk',
          amount,
          user: targetUser,
          creatorId: ctx.senderId,
          timestamp: Date.now()
        };

        kasData.transactions.push(newTx);
        await setGroupVariable(ctx.chatId, 'finance:kas', kasData);

        // Hitung total saldo
        let saldo = 0;
        kasData.transactions.forEach((t: any) => {
          if (t.type === 'masuk') saldo += t.amount;
          else if (t.type === 'keluar') saldo -= t.amount;
        });

        const response = `✅ *PENCATATAN KAS MASUK BERHASIL!* 🪙\n\n• *ID Transaksi:* \`${txId}\`\n• *Penyetor:* @${targetUser.split('@')[0]}\n• *Nominal:* Rp ${amount.toLocaleString('id-ID')}\n• *Total Saldo Kas:* *Rp ${saldo.toLocaleString('id-ID')}*\n• *Dicatat oleh:* @${ctx.senderId.split('@')[0]}`;
        await adapter.sendMessage(ctx.chatId, response, { mentions: [targetUser, ctx.senderId], quotedMessageId: ctx.id });
        return;
      }

      // /kas keluar <jumlah> <alasan>
      if (sub === 'keluar') {
        const amountStr = args[1]?.replace(/[^0-9]/g, '') || '';
        const amount = parseInt(amountStr, 10);
        const reason = args.slice(2).join(' ').trim();

        if (Number.isNaN(amount) || amount <= 0 || !reason) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah.\nGunakan: `/kas keluar [jumlah] [alasan/keperluan]`\nContoh: `/kas keluar 150000 Beli sapu & ember`', { quotedMessageId: ctx.id });
          return;
        }

        // Hitung saldo saat ini
        let saldoBefore = 0;
        kasData.transactions.forEach((t: any) => {
          if (t.type === 'masuk') saldoBefore += t.amount;
          else if (t.type === 'keluar') saldoBefore -= t.amount;
        });

        if (saldoBefore < amount) {
          await adapter.sendMessage(ctx.chatId, `❌ *Saldo kas tidak mencukupi!*\n\n• Saldo saat ini: *Rp ${saldoBefore.toLocaleString('id-ID')}*\n• Pengeluaran: *Rp ${amount.toLocaleString('id-ID')}*`, { quotedMessageId: ctx.id });
          return;
        }

        const txId = `TX-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const newTx = {
          id: txId,
          type: 'keluar',
          amount,
          reason,
          creatorId: ctx.senderId,
          timestamp: Date.now()
        };

        kasData.transactions.push(newTx);
        await setGroupVariable(ctx.chatId, 'finance:kas', kasData);

        const saldoAfter = saldoBefore - amount;
        const response = `💸 *PENCATATAN KAS KELUAR BERHASIL!* 💸\n\n• *ID Transaksi:* \`${txId}\`\n• *Keperluan:* ${reason}\n• *Nominal:* Rp ${amount.toLocaleString('id-ID')}\n• *Sisa Saldo Kas:* *Rp ${saldoAfter.toLocaleString('id-ID')}*\n• *Dicatat oleh:* @${ctx.senderId.split('@')[0]}`;
        await adapter.sendMessage(ctx.chatId, response, { mentions: [ctx.senderId], quotedMessageId: ctx.id });
        return;
      }

      // /kas saldo
      if (sub === 'saldo') {
        let saldo = 0;
        let totalMasuk = 0;
        let totalKeluar = 0;

        kasData.transactions.forEach((t: any) => {
          if (t.type === 'masuk') {
            saldo += t.amount;
            totalMasuk += t.amount;
          } else if (t.type === 'keluar') {
            saldo -= t.amount;
            totalKeluar += t.amount;
          }
        });

        const response = `💰 *SALDO KAS GRUP* 💰\n\n• *Total Pemasukan:* Rp ${totalMasuk.toLocaleString('id-ID')}\n• *Total Pengeluaran:* Rp ${totalKeluar.toLocaleString('id-ID')}\n• *Saldo Bersih:* *Rp ${saldo.toLocaleString('id-ID')}*`;
        await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
        return;
      }

      // /kas laporan
      if (sub === 'laporan' || sub === 'rekap') {
        let saldo = 0;
        kasData.transactions.forEach((t: any) => {
          if (t.type === 'masuk') saldo += t.amount;
          else if (t.type === 'keluar') saldo -= t.amount;
        });

        let response = `📋 *LAPORAN MUTASI KAS GRUP* 📋\n\n`;
        response += `• *Saldo Kas Saat Ini:* *Rp ${saldo.toLocaleString('id-ID')}*\n`;
        response += `• *Jumlah Transaksi:* ${kasData.transactions.length} mutasi\n\n`;
        response += `*5 Transaksi Terakhir:*\n`;

        if (kasData.transactions.length === 0) {
          response += `_Belum ada transaksi kas._\n`;
        } else {
          const mentions: string[] = [];
          const last5 = kasData.transactions.slice(-5).reverse();
          last5.forEach((t: any, i: number) => {
            const date = new Date(t.timestamp).toLocaleDateString('id-ID');
            if (t.type === 'masuk') {
              response += `${i + 1}. [${date}] 🟢 Kas Masuk: *Rp ${t.amount.toLocaleString('id-ID')}* dari @${t.user.split('@')[0]} (ID: \`${t.id}\`)\n`;
              mentions.push(t.user);
            } else {
              response += `${i + 1}. [${date}] 🔴 Kas Keluar: *Rp ${t.amount.toLocaleString('id-ID')}* - ${t.reason} (ID: \`${t.id}\`)\n`;
            }
          });
          await adapter.sendMessage(ctx.chatId, response, { mentions, quotedMessageId: ctx.id });
          return;
        }

        await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
        return;
      }

      // /kas export
      if (sub === 'export') {
        let saldo = 0;
        let text = `======= LAPORAN KAS GRUP =======\n`;
        text += `Grup ID: ${ctx.chatId}\n`;
        text += `Tanggal Ekspor: ${new Date().toLocaleDateString('id-ID')}\n`;
        text += `================================\n\n`;

        kasData.transactions.forEach((t: any, index: number) => {
          const date = new Date(t.timestamp).toLocaleDateString('id-ID');
          if (t.type === 'masuk') {
            saldo += t.amount;
            text += `${index + 1}. [${date}] [MASUK] Rp ${t.amount.toLocaleString('id-ID')} (Penyetor: ${t.user.split('@')[0]}) - ID: ${t.id}\n`;
          } else {
            saldo -= t.amount;
            text += `${index + 1}. [${date}] [KELUAR] Rp ${t.amount.toLocaleString('id-ID')} (Keperluan: ${t.reason}) - ID: ${t.id}\n`;
          }
        });

        text += `\n================================\n`;
        text += `SALDO AKHIR KAS: Rp ${saldo.toLocaleString('id-ID')}\n`;
        text += `================================`;

        await adapter.sendMessage(ctx.chatId, text, { quotedMessageId: ctx.id });
        return;
      }
    }

    // --- 2. SPLIT BILL ---
    if (cmd === 'split' || cmd === 'splitadd' || cmd === 'splitdone' || cmd === 'splitstatus') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur Split Bill hanya dapat digunakan di grup.', { quotedMessageId: ctx.id });
        return;
      }

      // /split <amount> @user1 @user2 ...
      if (cmd === 'split') {
        const amountStr = args[0]?.replace(/[^0-9]/g, '') || '';
        const amount = parseInt(amountStr, 10);

        // Cari mentions
        const mentions = ctx.body.match(/@[a-zA-Z0-9_.-]+/g) || [];
        const participantIds = mentions.map(m => m.replace('@', '') + '@s.whatsapp.net');

        if (Number.isNaN(amount) || amount <= 0 || participantIds.length === 0) {
          await adapter.sendMessage(
            ctx.chatId,
            '⚠️ Format salah.\nGunakan: `/split [total_nominal] @user1 @user2 @user3`\nContoh: `/split 90000 @user1 @user2 @user3` (Masing-masing Rp 30.000)',
            { quotedMessageId: ctx.id }
          );
          return;
        }

        const amountPerPerson = Math.round(amount / participantIds.length);
        const splitId = `SB-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

        const splitData = {
          id: splitId,
          creatorId: ctx.senderId,
          totalAmount: amount,
          amountPerPerson,
          status: 'active',
          participants: participantIds.map(userId => ({ userId, paid: false })),
          createdAt: Date.now()
        };

        await setGroupVariable(ctx.chatId, `split:${splitId}`, splitData);

        let response = `🧾 *TAGIHAN SPLIT BILL DIBUAT!* 🧾\n\n`;
        response += `• *ID Tagihan:* \`${splitId}\`\n`;
        response += `• *Total Tagihan:* Rp ${amount.toLocaleString('id-ID')}\n`;
        response += `• *Bagi Rata:* Rp ${amountPerPerson.toLocaleString('id-ID')} / orang\n`;
        response += `• *Jumlah Peserta:* ${participantIds.length} orang\n\n`;
        response += `*Daftar Tagihan:*\n`;

        participantIds.forEach(pId => {
          response += `- ❌ @${pId.split('@')[0]} (Belum Lunas)\n`;
        });

        response += `\n💡 Pembuat tagihan (@${ctx.senderId.split('@')[0]}) atau Admin dapat menandai lunas menggunakan perintah:\n\`/splitdone @user\``;
        await adapter.sendMessage(ctx.chatId, response, { mentions: [ctx.senderId, ...participantIds], quotedMessageId: ctx.id });
        return;
      }

      // /splitstatus
      if (cmd === 'splitstatus') {
        try {
          const dbSplits = await prisma.customVariable.findMany({
            where: {
              groupId: ctx.chatId,
              key: { startsWith: 'split:' }
            }
          });

          const activeSplits: any[] = [];
          for (const sp of dbSplits) {
            try {
              const parsed = JSON.parse(sp.value);
              if (parsed.status === 'active') {
                activeSplits.push(parsed);
              }
            } catch {}
          }

          if (activeSplits.length === 0) {
            await adapter.sendMessage(ctx.chatId, 'ℹ️ Tidak ada tagihan Split Bill yang aktif di grup ini.', { quotedMessageId: ctx.id });
            return;
          }

          let response = `📋 *STATUS SPLIT BILL AKTIF* 📋\n\n`;
          const mentions: string[] = [];

          activeSplits.forEach((sp) => {
            response += `*Tagihan: [ID: ${sp.id}]*\n`;
            response += `• Total: Rp ${sp.totalAmount.toLocaleString('id-ID')} (Masing-masing Rp ${sp.amountPerPerson.toLocaleString('id-ID')})\n`;
            response += `• Progress: ${sp.participants.filter((p: any) => p.paid).length}/${sp.participants.length} Lunas\n`;
            response += `• *Peserta:*\n`;

            sp.participants.forEach((p: any) => {
              response += `  ${p.paid ? '🟢' : '❌'} @${p.userId.split('@')[0]}\n`;
              mentions.push(p.userId);
            });
            response += `\n`;
          });

          await adapter.sendMessage(ctx.chatId, response, { mentions, quotedMessageId: ctx.id });
        } catch (err: any) {
          await adapter.sendMessage(ctx.chatId, `❌ Gagal mengambil status split: ${err.message}`, { quotedMessageId: ctx.id });
        }
        return;
      }

      // /splitdone @user
      if (cmd === 'splitdone') {
        let targetUser = args[0]?.trim();
        if (ctx.quotedMessage?.senderId) {
          targetUser = ctx.quotedMessage.senderId;
        } else if (targetUser && targetUser.startsWith('@')) {
          targetUser = targetUser.replace('@', '') + '@s.whatsapp.net';
        }

        if (!targetUser) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Silakan tag user yang sudah membayar bagian split bill-nya.', { quotedMessageId: ctx.id });
          return;
        }

        try {
          const dbSplits = await prisma.customVariable.findMany({
            where: {
              groupId: ctx.chatId,
              key: { startsWith: 'split:' }
            }
          });

          let updated = false;
          let targetSplit: any = null;

          for (const sp of dbSplits) {
            const parsed = JSON.parse(sp.value);
            if (parsed.status === 'active') {
              const participantIdx = parsed.participants.findIndex((p: any) => p.userId === targetUser);
              if (participantIdx !== -1) {
                const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
                const isCreator = parsed.creatorId === ctx.senderId;

                if (!isCreator && !isAdmin) {
                  await adapter.sendMessage(ctx.chatId, '⚠️ Hanya pembuat tagihan Split Bill atau Admin grup yang dapat memperbarui status pembayaran.', { quotedMessageId: ctx.id });
                  return;
                }

                parsed.participants[participantIdx].paid = true;
                targetSplit = parsed;

                // Cek apakah semua sudah lunas
                const allPaid = parsed.participants.every((p: any) => p.paid);
                if (allPaid) {
                  parsed.status = 'closed';
                }

                await prisma.customVariable.update({
                  where: { id: sp.id },
                  data: { value: JSON.stringify(parsed) }
                });
                updated = true;
                break;
              }
            }
          }

          if (updated && targetSplit) {
            let msg = `✅ @${targetUser.split('@')[0]} ditandai telah melunasi bagian tagihannya sebesar *Rp ${targetSplit.amountPerPerson.toLocaleString('id-ID')}* pada Tagihan \`${targetSplit.id}\`.`;
            if (targetSplit.status === 'closed') {
              msg += `\n\n🎉 *TAGIHAN SPLIT BILL [ID: ${targetSplit.id}] SELESAI / LUNAS SEPENUHNYA!*`;
            }
            await adapter.sendMessage(ctx.chatId, msg, { mentions: [targetUser], quotedMessageId: ctx.id });
          } else {
            await adapter.sendMessage(ctx.chatId, '⚠️ User tersebut tidak terdaftar di tagihan split bill aktif mana pun di grup ini.', { quotedMessageId: ctx.id });
          }
        } catch (err: any) {
          await adapter.sendMessage(ctx.chatId, `❌ Gagal memproses splitdone: ${err.message}`, { quotedMessageId: ctx.id });
        }
        return;
      }
    }

    // --- 3. PERSONAL FINANCE (CATAT, PENGELUARAN, BUDGET) ---
    if (cmd === 'catat' || cmd === 'pengeluaran' || cmd === 'budget') {
      const financeStore = (await getUserVariable(ctx.senderId, 'finance:personal')) || { records: [], budgets: [] };

      // /catat <nominal> <kategori>
      if (cmd === 'catat') {
        const amountStr = args[0]?.replace(/[^0-9]/g, '') || '';
        const amount = parseInt(amountStr, 10);
        const category = args.slice(1).join(' ').trim() || 'Lain-lain';

        if (Number.isNaN(amount) || amount <= 0) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah.\nGunakan: `/catat [nominal] [kategori]`\nContoh: `/catat 20000 Jajan Sore`', { quotedMessageId: ctx.id });
          return;
        }

        const newRecord = {
          id: `REC-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
          amount,
          category,
          timestamp: Date.now()
        };

        financeStore.records.push(newRecord);
        await setUserVariable(ctx.senderId, 'finance:personal', financeStore);

        // Check budget warning
        const budgetLimit = financeStore.budgets.find((b: any) => b.category.toLowerCase() === category.toLowerCase());
        let warningText = '';
        if (budgetLimit) {
          // Hitung pengeluaran kategori ini di bulan berjalan
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
          let totalSpentThisMonth = 0;

          financeStore.records.forEach((r: any) => {
            if (r.category.toLowerCase() === category.toLowerCase() && r.timestamp >= startOfMonth) {
              totalSpentThisMonth += r.amount;
            }
          });

          if (totalSpentThisMonth > budgetLimit.limitAmount) {
            warningText = `\n\n⚠️ *PERINGATAN BUDGET BULANAN!* Kategori *${category}* telah melebihi batas limit bulanan Anda!\nLimit: Rp ${budgetLimit.limitAmount.toLocaleString('id-ID')}\nPengeluaran saat ini: Rp ${totalSpentThisMonth.toLocaleString('id-ID')}`;
          }
        }

        await adapter.sendMessage(
          ctx.chatId,
          `📝 *PENCATATAN PENGELUARAN BERHASIL!* 📝\n\n• *Nominal:* Rp ${amount.toLocaleString('id-ID')}\n• *Kategori:* ${category}\n• *Waktu:* ${new Date().toLocaleString('id-ID')}${warningText}`,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      // /pengeluaran [hariini|bulanini]
      if (cmd === 'pengeluaran') {
        const type = args[0]?.toLowerCase().trim() || 'hariini';
        const now = new Date();

        let startTime = 0;
        let label = '';

        if (type === 'hariini' || type === 'hari') {
          startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          label = 'Hari Ini';
        } else if (type === 'bulanini' || type === 'bulan') {
          startTime = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
          label = 'Bulan Ini';
        } else {
          await adapter.sendMessage(ctx.chatId, '⚠️ Sub-command tidak dikenal. Gunakan `/pengeluaran hariini` atau `/pengeluaran bulanini`.', { quotedMessageId: ctx.id });
          return;
        }

        const filtered = financeStore.records.filter((r: any) => r.timestamp >= startTime);

        if (filtered.length === 0) {
          await adapter.sendMessage(ctx.chatId, `ℹ️ Belum ada pengeluaran pribadi yang dicatat untuk periode *${label}*.`, { quotedMessageId: ctx.id });
          return;
        }

        let total = 0;
        const byCategory: { [key: string]: number } = {};

        filtered.forEach((r: any) => {
          total += r.amount;
          byCategory[r.category] = (byCategory[r.category] || 0) + r.amount;
        });

        let response = `📊 *LAPORAN PENGELUARAN PRIBADI (${label.toUpperCase()})* 📊\n\n`;
        response += `• *Total Pengeluaran:* *Rp ${total.toLocaleString('id-ID')}*\n\n`;
        response += `*Rincian per Kategori:*\n`;

        Object.keys(byCategory).forEach((cat) => {
          response += `- *${cat}:* Rp ${byCategory[cat].toLocaleString('id-ID')}\n`;
        });

        await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
        return;
      }

      // /budget [add|status] [kategori] [nominal]
      if (cmd === 'budget') {
        const action = args[0]?.toLowerCase().trim();

        if (action === 'add') {
          const category = args[1]?.trim();
          const limitStr = args[2]?.replace(/[^0-9]/g, '') || '';
          const limitAmount = parseInt(limitStr, 10);

          if (!category || Number.isNaN(limitAmount) || limitAmount <= 0) {
            await adapter.sendMessage(ctx.chatId, '⚠️ Format salah.\nGunakan: `/budget add [kategori] [limit_nominal]`\nContoh: `/budget add Jajan 300000`', { quotedMessageId: ctx.id });
            return;
          }

          const existingIdx = financeStore.budgets.findIndex((b: any) => b.category.toLowerCase() === category.toLowerCase());
          if (existingIdx !== -1) {
            financeStore.budgets[existingIdx].limitAmount = limitAmount;
          } else {
            financeStore.budgets.push({ category, limitAmount });
          }

          await setUserVariable(ctx.senderId, 'finance:personal', financeStore);

          await adapter.sendMessage(ctx.chatId, `✅ *BATAS BUDGET DITETAPKAN!* 🎯\n\n• *Kategori:* ${category}\n• *Batas Bulanan:* Rp ${limitAmount.toLocaleString('id-ID')}`, { quotedMessageId: ctx.id });
          return;
        }

        if (action === 'status' || !action) {
          if (financeStore.budgets.length === 0) {
            await adapter.sendMessage(ctx.chatId, 'ℹ️ Anda belum menyusun limit budget kategori keuangan.', { quotedMessageId: ctx.id });
            return;
          }

          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

          let response = `🎯 *STATUS BUDGET BULAN INI* 🎯\n\n`;

          financeStore.budgets.forEach((b: any) => {
            let spent = 0;
            financeStore.records.forEach((r: any) => {
              if (r.category.toLowerCase() === b.category.toLowerCase() && r.timestamp >= startOfMonth) {
                spent += r.amount;
              }
            });

            const percentage = Math.round((spent / b.limitAmount) * 100);
            const statusEmoji = spent > b.limitAmount ? '🚨 Over' : percentage > 80 ? '⚠️ Warning' : '🟢 Aman';

            response += `*Kategori: ${b.category}*\n`;
            response += `• Limit: Rp ${b.limitAmount.toLocaleString('id-ID')}\n`;
            response += `• Terpakai: Rp ${spent.toLocaleString('id-ID')} (${percentage}%)\n`;
            response += `• Status: *${statusEmoji}*\n\n`;
          });

          await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
          return;
        }
      }
    }

    // --- 4. BILLS & TAGIHAN SUITE ---
    if (cmd === 'tagihan') {
      const sub = args[0]?.toLowerCase().trim();

      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Perintah tagihan hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'add') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Admin grup yang dapat membuat tagihan.', { quotedMessageId: ctx.id });
          return;
        }

        // /tagihan add @user Nama Tagihan | nominal
        let targetUser = args[1]?.trim();
        if (ctx.quotedMessage?.senderId) {
          targetUser = ctx.quotedMessage.senderId;
        } else if (targetUser && targetUser.startsWith('@')) {
          targetUser = targetUser.replace('@', '') + '@s.whatsapp.net';
        }

        const remainingContent = args.slice(ctx.quotedMessage?.senderId ? 1 : 2).join(' ');
        const parts = remainingContent.split('|');
        const nameStr = parts[0]?.trim();
        const amountStr = parts[1]?.trim().replace(/[^0-9]/g, '') || '';
        const amount = parseInt(amountStr, 10);

        if (!targetUser || !nameStr || Number.isNaN(amount) || amount <= 0) {
          await adapter.sendMessage(
            ctx.chatId,
            '⚠️ Format salah.\nGunakan: `/tagihan add @user Nama Tagihan | [nominal]`\nContoh: `/tagihan add @user Kas Bulanan | 15000`',
            { quotedMessageId: ctx.id }
          );
          return;
        }

        const billId = `BILL-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const billData = {
          id: billId,
          targetUser,
          name: nameStr,
          amount,
          creatorId: ctx.senderId,
          status: 'pending',
          createdAt: Date.now()
        };

        await setGroupVariable(ctx.chatId, `tagihan:${billId}`, billData);

        const response = `🔔 *TAGIHAN BARU DIBUAT!* 🔔\n\n• *ID Tagihan:* \`${billId}\`\n• *Tagihan untuk:* @${targetUser.split('@')[0]}\n• *Keterangan:* ${nameStr}\n• *Nominal:* *Rp ${amount.toLocaleString('id-ID')}*\n\nBayar dan konfirmasi dengan mengetik:\n\`/tagihan done ${billId}\``;
        await adapter.sendMessage(ctx.chatId, response, { mentions: [targetUser], quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'list') {
        try {
          const dbBills = await prisma.customVariable.findMany({
            where: {
              groupId: ctx.chatId,
              key: { startsWith: 'tagihan:' }
            }
          });

          const activeBills: any[] = [];
          for (const b of dbBills) {
            try {
              const parsed = JSON.parse(b.value);
              if (parsed.status === 'pending') {
                activeBills.push(parsed);
              }
            } catch {}
          }

          if (activeBills.length === 0) {
            await adapter.sendMessage(ctx.chatId, 'ℹ️ Tidak ada tagihan pending yang belum dibayar di grup ini.', { quotedMessageId: ctx.id });
            return;
          }

          let response = `📋 *DAFTAR TAGIHAN BELUM DIBAYAR* 📋\n\n`;
          const mentions: string[] = [];

          activeBills.forEach((b, idx) => {
            response += `${idx + 1}. *[ID: ${b.id}]* *${b.name}*\n`;
            response += `   • Tagihan ke: @${b.targetUser.split('@')[0]}\n`;
            response += `   • Nominal: Rp ${b.amount.toLocaleString('id-ID')}\n\n`;
            mentions.push(b.targetUser);
          });

          await adapter.sendMessage(ctx.chatId, response, { mentions, quotedMessageId: ctx.id });
        } catch (err: any) {
          await adapter.sendMessage(ctx.chatId, `❌ Gagal mengambil tagihan: ${err.message}`, { quotedMessageId: ctx.id });
        }
        return;
      }

      if (sub === 'done') {
        const billId = args[1]?.trim().toUpperCase();
        if (!billId) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan ID tagihan. Contoh: `/tagihan done BILL-ABC`', { quotedMessageId: ctx.id });
          return;
        }

        try {
          const dbBill = await prisma.customVariable.findFirst({
            where: {
              groupId: ctx.chatId,
              key: `tagihan:${billId}`
            }
          });

          if (!dbBill) {
            await adapter.sendMessage(ctx.chatId, '⚠️ Tagihan tidak ditemukan.', { quotedMessageId: ctx.id });
            return;
          }

          const parsed = JSON.parse(dbBill.value);
          const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);

          if (parsed.targetUser !== ctx.senderId && !isAdmin) {
            await adapter.sendMessage(ctx.chatId, '⚠️ Hanya pembayar tagihan atau Admin grup yang dapat melunasi tagihan ini.', { quotedMessageId: ctx.id });
            return;
          }

          parsed.status = 'paid';
          parsed.paidAt = Date.now();

          await prisma.customVariable.update({
            where: { id: dbBill.id },
            data: { value: JSON.stringify(parsed) }
          });

          await adapter.sendMessage(ctx.chatId, `✅ *TAGIHAN LUNAS!* 🎉\n\nTagihan \`${billId}\` (*${parsed.name}* - Rp ${parsed.amount.toLocaleString('id-ID')}) telah ditandai lunas oleh @${ctx.senderId.split('@')[0]}.`, { mentions: [ctx.senderId], quotedMessageId: ctx.id });
        } catch (err: any) {
          await adapter.sendMessage(ctx.chatId, `❌ Gagal memperbarui tagihan: ${err.message}`, { quotedMessageId: ctx.id });
        }
        return;
      }

      if (sub === 'remind') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Admin grup yang dapat memicu notifikasi tagihan.', { quotedMessageId: ctx.id });
          return;
        }

        try {
          const dbBills = await prisma.customVariable.findMany({
            where: {
              groupId: ctx.chatId,
              key: { startsWith: 'tagihan:' }
            }
          });

          const activeBills: any[] = [];
          for (const b of dbBills) {
            try {
              const parsed = JSON.parse(b.value);
              if (parsed.status === 'pending') {
                activeBills.push(parsed);
              }
            } catch {}
          }

          if (activeBills.length === 0) {
            await adapter.sendMessage(ctx.chatId, 'ℹ️ Tidak ada tagihan pending yang membutuhkan pengingat.', { quotedMessageId: ctx.id });
            return;
          }

          let response = `🚨 *PENGINGAT PEMBAYARAN TAGIHAN GRUP* 🚨\n\nKepada seluruh nama di bawah ini, mohon segera melunasi tagihannya:\n\n`;
          const mentions: string[] = [];

          activeBills.forEach((b) => {
            response += `• @${b.targetUser.split('@')[0]} - *${b.name}* (Rp ${b.amount.toLocaleString('id-ID')}) [ID: \`${b.id}\`]\n`;
            mentions.push(b.targetUser);
          });

          response += `\n💡 Lunasi tagihan dengan perintah:\n\`/tagihan done [ID]\``;
          await adapter.sendMessage(ctx.chatId, response, { mentions, quotedMessageId: ctx.id });
        } catch (err: any) {
          await adapter.sendMessage(ctx.chatId, `❌ Gagal mengirim pengingat: ${err.message}`, { quotedMessageId: ctx.id });
        }
        return;
      }
    }

    // --- 5. ARISAN GRUP ---
    if (cmd === 'arisan') {
      const sub = args[0]?.toLowerCase().trim();

      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur Arisan hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      if (!sub) {
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Masukkan sub-command Arisan.\nGunakan:\n' +
          '• `/arisan join [nominal]` — Bergabung dalam arisan\n' +
          '• `/arisan list` — Menampilkan daftar peserta arisan\n' +
          '• `/arisan undi` — Mengocok dan mengundi pemenang arisan (Admin Only)',
          { quotedMessageId: ctx.id }
        );
        return;
      }

      const arisanSession = (await getGroupVariable(ctx.chatId, 'arisan:session')) || { amount: 0, participants: [] };

      if (sub === 'join') {
        const amountStr = args[1]?.replace(/[^0-9]/g, '') || '';
        const amount = parseInt(amountStr, 10);

        if (Number.isNaN(amount) || amount <= 0) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Tentukan nominal arisan. Contoh: `/arisan join 50000`', { quotedMessageId: ctx.id });
          return;
        }

        // Check if user is already in arisan
        const isExists = arisanSession.participants.some((p: any) => p.userId === ctx.senderId);
        if (isExists) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Anda sudah terdaftar dalam arisan grup ini.', { quotedMessageId: ctx.id });
          return;
        }

        arisanSession.amount = amount; // update / lock amount
        arisanSession.participants.push({ userId: ctx.senderId, won: false });
        await setGroupVariable(ctx.chatId, 'arisan:session', arisanSession);

        await adapter.sendMessage(ctx.chatId, `✅ @${ctx.senderId.split('@')[0]} berhasil bergabung arisan dengan nominal *Rp ${amount.toLocaleString('id-ID')}*.`, { mentions: [ctx.senderId], quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'list') {
        if (arisanSession.participants.length === 0) {
          await adapter.sendMessage(ctx.chatId, 'ℹ️ Belum ada peserta arisan terdaftar di grup ini.', { quotedMessageId: ctx.id });
          return;
        }

        let response = `🎟️ *DAFTAR PESERTA ARISAN GRUP* 🎟️\n\n`;
        response += `• *Nominal Arisan:* Rp ${arisanSession.amount.toLocaleString('id-ID')}\n`;
        response += `• *Total Peserta:* ${arisanSession.participants.length} orang\n\n`;

        const mentions: string[] = [];
        arisanSession.participants.forEach((p: any, idx: number) => {
          response += `${idx + 1}. ${p.won ? '🏆' : '⏳'} @${p.userId.split('@')[0]} ${p.won ? '(Sudah Menang)' : '(Menunggu Kocokan)'}\n`;
          mentions.push(p.userId);
        });

        await adapter.sendMessage(ctx.chatId, response, { mentions, quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'undi') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Admin grup yang dapat mengundi arisan.', { quotedMessageId: ctx.id });
          return;
        }

        const eligible = arisanSession.participants.filter((p: any) => !p.won);
        if (eligible.length === 0) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada peserta tersisa yang belum memenangkan kocokan arisan.', { quotedMessageId: ctx.id });
          return;
        }

        const winnerIdx = Math.floor(Math.random() * eligible.length);
        const winner = eligible[winnerIdx];

        // Update status won di list utama
        const origIdx = arisanSession.participants.findIndex((p: any) => p.userId === winner.userId);
        arisanSession.participants[origIdx].won = true;
        arisanSession.participants[origIdx].wonAt = Date.now();

        await setGroupVariable(ctx.chatId, 'arisan:session', arisanSession);

        const totalPrize = arisanSession.amount * arisanSession.participants.length;

        const response = `🎉 *🏆 KOCOKAN ARISAN TELAH DIUNDI! 🏆* 🎉\n\nSelamat kepada pemenang arisan kali ini:\n\n👉 @${winner.userId.split('@')[0]} 👈\n\n• *Nominal Penarikan:* Rp ${arisanSession.amount.toLocaleString('id-ID')}\n• *Total Hadiah Dibawa Pulang:* *Rp ${totalPrize.toLocaleString('id-ID')}*\n\nSelamat kepada pemenang! Gelombang berikutnya akan diundi nanti.`;
        await adapter.sendMessage(ctx.chatId, response, { mentions: [winner.userId], quotedMessageId: ctx.id });
        return;
      }
    }

    // --- 6. ESCROW SIMPLE (SIMULASI REKBER) ---
    if (cmd === 'escrow') {
      const sub = args[0]?.toLowerCase().trim();

      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur Escrow (Rekber) hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      if (!sub) {
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Masukkan sub-command Escrow.\nGunakan:\n' +
          '• `/escrow create @seller @buyer [nominal]` — Membuat transaksi rekber baru\n' +
          '• `/escrow paid [escrowId]` — Pembeli menandai sudah membayar uang\n' +
          '• `/escrow release [escrowId]` — Pembeli mengonfirmasi barang diterima dan melepas dana ke penjual\n' +
          '• `/escrow dispute [escrowId]` — Membuka sengketa transaksi rekber',
          { quotedMessageId: ctx.id }
        );
        return;
      }

      if (sub === 'create') {
        const targetSeller = args[1]?.trim();
        const targetBuyer = args[2]?.trim();
        const amountStr = args[3]?.replace(/[^0-9]/g, '') || '';
        const amount = parseInt(amountStr, 10);

        let sellerId = '';
        let buyerId = '';

        if (targetSeller && targetSeller.startsWith('@')) {
          sellerId = targetSeller.replace('@', '') + '@s.whatsapp.net';
        }
        if (targetBuyer && targetBuyer.startsWith('@')) {
          buyerId = targetBuyer.replace('@', '') + '@s.whatsapp.net';
        }

        if (!sellerId || !buyerId || Number.isNaN(amount) || amount <= 0) {
          await adapter.sendMessage(
            ctx.chatId,
            '⚠️ Format salah.\nGunakan: `/escrow create @penjual @pembeli [nominal]`\nContoh: `/escrow create @seller @buyer 250000`',
            { quotedMessageId: ctx.id }
          );
          return;
        }

        const escrowId = `ESC-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const escrowData = {
          id: escrowId,
          sellerId,
          buyerId,
          amount,
          status: 'pending_payment',
          createdAt: Date.now()
        };

        await setGroupVariable(ctx.chatId, `escrow:${escrowId}`, escrowData);

        const response = `🤝 *TRANSAKSI ESCROW (REKBER) DI-CREATE!* 🤝\n\n• *ID Rekber:* \`${escrowId}\`\n• *Penjual:* @${sellerId.split('@')[0]}\n• *Pembeli:* @${buyerId.split('@')[0]}\n• *Nominal Dana:* Rp ${amount.toLocaleString('id-ID')}\n• *Status:* ⏳ Menunggu Pembayaran dari Pembeli\n\n👉 *Langkah berikutnya:* Pembeli transfer dana ke pengelola rekber grup, lalu ketik:\n\`/escrow paid ${escrowId}\``;
        await adapter.sendMessage(ctx.chatId, response, { mentions: [sellerId, buyerId], quotedMessageId: ctx.id });
        return;
      }

      const escrowId = args[1]?.trim().toUpperCase();
      if (!escrowId) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Silakan sertakan ID Escrow. Contoh: `/escrow paid ESC-ABC`', { quotedMessageId: ctx.id });
        return;
      }

      const escrowData = await getGroupVariable(ctx.chatId, `escrow:${escrowId}`);
      if (!escrowData) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Transaksi Rekber tidak ditemukan.', { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'paid') {
        if (escrowData.buyerId !== ctx.senderId) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Pembeli terdaftar yang dapat menandai bahwa dana sudah dikirim.', { quotedMessageId: ctx.id });
          return;
        }

        escrowData.status = 'paid';
        await setGroupVariable(ctx.chatId, `escrow:${escrowId}`, escrowData);

        const response = `🪙 *KLAIM DANA MASUK REKBER [ID: ${escrowId}]* 🪙\n\n• Pembeli @${escrowData.buyerId.split('@')[0]} mengonfirmasi telah mengirim dana sebesar Rp ${escrowData.amount.toLocaleString('id-ID')}.\n• *Status:* 📦 Penjual dapat mengirimkan barang sekarang.\n\nKetik \`/escrow release ${escrowId}\` jika pembeli sudah menerima barang dengan baik.`;
        await adapter.sendMessage(ctx.chatId, response, { mentions: [escrowData.buyerId], quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'release') {
        if (escrowData.buyerId !== ctx.senderId) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Pembeli terdaftar yang dapat melepas dana escrow ke Penjual.', { quotedMessageId: ctx.id });
          return;
        }

        escrowData.status = 'released';
        await setGroupVariable(ctx.chatId, `escrow:${escrowId}`, escrowData);

        const response = `✅ *DANA ESCROW DI-RELEASE!* ✅\n\n• Transaksi Rekber \`${escrowId}\` Sukses!\n• Dana sebesar Rp ${escrowData.amount.toLocaleString('id-ID')} telah dilepas ke penjual @${escrowData.sellerId.split('@')[0]}.\n• Terima kasih telah bertransaksi dengan aman menggunakan Rekber Bot.`;
        await adapter.sendMessage(ctx.chatId, response, { mentions: [escrowData.sellerId], quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'dispute') {
        if (escrowData.buyerId !== ctx.senderId && escrowData.sellerId !== ctx.senderId) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Pembeli atau Penjual terdaftar yang dapat membuka sengketa (dispute) pada transaksi rekber ini.', { quotedMessageId: ctx.id });
          return;
        }

        escrowData.status = 'disputed';
        await setGroupVariable(ctx.chatId, `escrow:${escrowId}`, escrowData);

        const response = `🚨 *SENGKETA TRANSAKSI REKBER [ID: ${escrowId}] DIBUKA!* 🚨\n\n• Status transaksi saat ini bermasalah / disengketakan.\n• Dana sebesar Rp ${escrowData.amount.toLocaleString('id-ID')} akan ditahan sementara oleh Rekber Bot.\n• Mohon Admin grup memediasi pembeli @${escrowData.buyerId.split('@')[0]} dan penjual @${escrowData.sellerId.split('@')[0]}.`;
        await adapter.sendMessage(ctx.chatId, response, { mentions: [escrowData.buyerId, escrowData.sellerId], quotedMessageId: ctx.id });
        return;
      }
    }

    // --- 7. INVOICE SUITE (CRM & CRM ORDER) ---
    if (cmd === 'invoice' || cmd === 'kontrak' || cmd === 'customer' || cmd === 'order') {
      // /kontrak [jualbeli|jasa desain|sewa bot]
      if (cmd === 'kontrak') {
        const type = args[0]?.toLowerCase().trim();
        if (!type) {
          await adapter.sendMessage(
            ctx.chatId,
            '⚠️ Silakan tentukan tipe kontrak. Contoh:\n• `/kontrak jualbeli`\n• `/kontrak jasa desain`\n• `/kontrak sewa bot`',
            { quotedMessageId: ctx.id }
          );
          return;
        }

        let draft = '';
        if (type === 'jualbeli') {
          draft = `📄 *DRAFT KONTRAK JUAL BELI BARANG* 📄\n\nPada hari ini, pembeli & penjual sepakat mengadakan perjanjian jual beli barang dengan ketentuan:\n1. Penjual menyerahkan barang dalam kondisi baik.\n2. Pembeli membayar lunas nominal sesuai harga kesepakatan.\n3. Hak milik barang berpindah penuh setelah pelunasan.`;
        } else if (type === 'jasa' || type === 'desain') {
          draft = `📄 *DRAFT PERJANJIAN JASA DESAIN KREATIF* 📄\n\nKetentuan kerja sama:\n1. Desainer mengerjakan desain sesuai brief.\n2. Klien berhak atas revisi maksimal 3 kali.\n3. Pembayaran DP 50% di muka, pelunasan setelah draf final disetujui.\n4. Hak cipta desain resmi menjadi milik klien setelah lunas.`;
        } else if (type === 'sewa' || type === 'sewa bot') {
          draft = `📄 *KONTRAK LAYANAN SEWA JAVAS BOT* 📄\n\nKetentuan berlangganan:\n1. Layanan bot aktif selama masa sewa (bulanan/tahunan).\n2. Dilarang menyalahgunakan bot untuk spam/konten ilegal.\n3. Pelanggar aturan bot akan ditutup layanannya tanpa pengembalian uang.`;
        } else {
          draft = `⚠️ Tipe kontrak tidak dikenali. Pilih jualbeli, jasa, atau sewa.`;
        }

        await adapter.sendMessage(ctx.chatId, draft, { quotedMessageId: ctx.id });
        return;
      }

      // CRM CUSTOMER & ORDER
      const crmStore = (await getUserVariable(ctx.senderId, 'crm:store')) || { customers: [], orders: [], invoices: [] };

      // /customer add @user
      if (cmd === 'customer') {
        const action = args[0]?.toLowerCase().trim();
        if (action === 'add') {
          let targetUser = args[1]?.trim();
          if (ctx.quotedMessage?.senderId) {
            targetUser = ctx.quotedMessage.senderId;
          } else if (targetUser && targetUser.startsWith('@')) {
            targetUser = targetUser.replace('@', '') + '@s.whatsapp.net';
          }

          if (!targetUser) {
            await adapter.sendMessage(ctx.chatId, '⚠️ Silakan tentukan customer yang ingin ditambahkan. Contoh: `/customer add @user`', { quotedMessageId: ctx.id });
            return;
          }

          const exists = crmStore.customers.some((c: any) => c.userId === targetUser);
          if (exists) {
            await adapter.sendMessage(ctx.chatId, 'ℹ️ Customer tersebut sudah terdaftar di database CRM Anda.', { quotedMessageId: ctx.id });
            return;
          }

          crmStore.customers.push({ userId: targetUser, registeredAt: Date.now() });
          await setUserVariable(ctx.senderId, 'crm:store', crmStore);

          await adapter.sendMessage(ctx.chatId, `✅ Berhasil menambahkan @${targetUser.split('@')[0]} ke dalam CRM Customer Anda.`, { mentions: [targetUser], quotedMessageId: ctx.id });
          return;
        }

        await adapter.sendMessage(ctx.chatId, '⚠️ Sub-command tidak dikenal. Gunakan `/customer add @user`', { quotedMessageId: ctx.id });
        return;
      }

      // /order add @user <produk> <harga>
      // /order status
      if (cmd === 'order') {
        const action = args[0]?.toLowerCase().trim();

        if (action === 'add') {
          let targetUser = args[1]?.trim();
          if (ctx.quotedMessage?.senderId) {
            targetUser = ctx.quotedMessage.senderId;
          } else if (targetUser && targetUser.startsWith('@')) {
            targetUser = targetUser.replace('@', '') + '@s.whatsapp.net';
          }

          const remaining = args.slice(ctx.quotedMessage?.senderId ? 1 : 2).join(' ');
          const parts = remaining.split('|');
          const product = parts[0]?.trim();
          const priceStr = parts[1]?.trim().replace(/[^0-9]/g, '') || '';
          const price = parseInt(priceStr, 10);

          if (!targetUser || !product || Number.isNaN(price) || price <= 0) {
            await adapter.sendMessage(
              ctx.chatId,
              '⚠️ Format salah.\nGunakan: `/order add @user Nama Produk | [nominal]`\nContoh: `/order add @user Jasa Desain Kaos | 150000`',
              { quotedMessageId: ctx.id }
            );
            return;
          }

          const orderId = `ORD-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
          const newOrder = {
            id: orderId,
            customer: targetUser,
            product,
            price,
            status: 'pending',
            createdAt: Date.now()
          };

          crmStore.orders.push(newOrder);
          await setUserVariable(ctx.senderId, 'crm:store', crmStore);

          await adapter.sendMessage(ctx.chatId, `✅ *ORDER CRM DI-CREATE!* 📦\n\n• *ID Order:* \`${orderId}\`\n• *Customer:* @${targetUser.split('@')[0]}\n• *Layanan:* ${product}\n• *Harga:* Rp ${price.toLocaleString('id-ID')}\n• *Status:* ⏳ Pending`, { mentions: [targetUser], quotedMessageId: ctx.id });
          return;
        }

        if (action === 'status' || !action) {
          if (crmStore.orders.length === 0) {
            await adapter.sendMessage(ctx.chatId, 'ℹ️ Anda belum mencatat data order apa pun di CRM Anda.', { quotedMessageId: ctx.id });
            return;
          }

          let response = `📦 *DAFTAR ORDER CRM ANDA* 📦\n\n`;
          const mentions: string[] = [];

          crmStore.orders.slice(-5).reverse().forEach((ord: any, idx: number) => {
            response += `${idx + 1}. *[ID: ${ord.id}]* ${ord.product}\n`;
            response += `   • Customer: @${ord.customer.split('@')[0]}\n`;
            response += `   • Harga: Rp ${ord.price.toLocaleString('id-ID')} (${ord.status.toUpperCase()})\n\n`;
            mentions.push(ord.customer);
          });

          await adapter.sendMessage(ctx.chatId, response, { mentions, quotedMessageId: ctx.id });
          return;
        }
      }
    }
  }
}

const financeCmd = new FinanceCommand();
registerCommand(['kas', 'iuran', 'split', 'splitadd', 'splitdone', 'splitstatus', 'catat', 'pengeluaran', 'budget', 'tagihan', 'arisan', 'escrow', 'kontrak', 'customer', 'order'], financeCmd);
