import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';
import { isPremium } from '../../bot/permission.js';

export class QuotaCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    // 1. /credit (Melihat saldo kredit)
    if (cmd === 'credit') {
      const dbCredit = await prisma.customVariable.findUnique({
        where: {
          groupId_userId_key: {
            groupId: 'global',
            userId: ctx.senderId,
            key: 'credits'
          }
        }
      });

      const credits = dbCredit ? parseInt(dbCredit.value, 10) : 0;

      const response = `🪙 *SALDO KREDIT ANDA* 🪙

• *Pengguna:* @${ctx.senderId.split('@')[0]}
• *Kredit:* *${credits.toLocaleString('id-ID')}* Koin Kredit

💡 Kredit digunakan untuk memanggil fitur premium bot (seperti AI lanjutan). 
Ketik \`/buycredit [jumlah]\` untuk membeli kredit menggunakan saldo balance RPG Anda.
(Kurs: 1 Kredit = 10 Koin RPG)`;

      await adapter.sendMessage(ctx.chatId, response, { mentions: [ctx.senderId], quotedMessageId: ctx.id });
      return;
    }

    // 2. /buycredit [jumlah] (Membeli kredit dengan uang ekonomi)
    if (cmd === 'buycredit') {
      const amountStr = args[0]?.trim();
      const amount = parseInt(amountStr, 10);

      if (!amountStr || Number.isNaN(amount) || amount <= 0) {
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Format salah.\nGunakan: `/buycredit [jumlah_kredit]`\nContoh: `/buycredit 50` (Membutuhkan 500 koin RPG)',
          { quotedMessageId: ctx.id }
        );
        return;
      }

      const cost = amount * 10; // Kurs 1 Kredit = 10 Koin RPG

      // Ambil balance user
      const economy = await prisma.userEconomy.findUnique({
        where: { userId: ctx.senderId }
      });

      if (!economy || economy.balance < cost) {
        const userBal = economy ? economy.balance : 0;
        await adapter.sendMessage(
          ctx.chatId,
          `❌ *Saldo RPG tidak cukup!*\n\n• Saldo Anda: *${userBal.toLocaleString('id-ID')}* Koin\n• Kebutuhan: *${cost.toLocaleString('id-ID')}* Koin\n\nKumpulkan saldo dengan bermain game, bekerja (\`/work\`), atau klaim harian (\`/daily\`).`,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      // Potong saldo ekonomi
      const newBalance = economy.balance - cost;
      await prisma.userEconomy.update({
        where: { userId: ctx.senderId },
        data: { balance: newBalance }
      });

      // Tambahkan saldo kredit di CustomVariable
      const dbCredit = await prisma.customVariable.findUnique({
        where: {
          groupId_userId_key: {
            groupId: 'global',
            userId: ctx.senderId,
            key: 'credits'
          }
        }
      });

      const currentCredits = dbCredit ? parseInt(dbCredit.value, 10) : 0;
      const newCredits = currentCredits + amount;

      await prisma.customVariable.upsert({
        where: {
          groupId_userId_key: {
            groupId: 'global',
            userId: ctx.senderId,
            key: 'credits'
          }
        },
        create: {
          groupId: 'global',
          userId: ctx.senderId,
          key: 'credits',
          value: String(newCredits)
        },
        update: {
          value: String(newCredits)
        }
      });

      // Log transaksi
      await prisma.economyTransaction.create({
        data: {
          userId: ctx.senderId,
          groupId: ctx.isGroup ? ctx.chatId : null,
          type: 'buy_credit',
          amount: -cost,
          metadataJson: JSON.stringify({ creditsPurchased: amount })
        }
      });

      const response = `✅ *PEMBELIAN KREDIT BERHASIL!* 🎉

• *Kredit Dibeli:* +${amount.toLocaleString('id-ID')} Kredit
• *Potongan RPG:* -${cost.toLocaleString('id-ID')} Koin RPG
• *Sisa Balance RPG:* ${newBalance.toLocaleString('id-ID')} Koin RPG
• *Total Kredit Sekarang:* *${newCredits.toLocaleString('id-ID')}* Kredit`;

      await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
      return;
    }

    // 3. /quota (Melihat kuota penggunaan harian)
    if (cmd === 'quota') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      if (ctx.isGroup) {
        let groupPlan = 'free';
        const sub = await prisma.groupSubscription.findUnique({
          where: { groupId: ctx.chatId }
        });
        if (sub) {
          const expired = sub.expiresAt && sub.expiresAt.getTime() < Date.now();
          if (!expired) {
            groupPlan = sub.plan || 'free';
          }
        }

        const maxCmd = groupPlan === 'free' ? 50 : groupPlan === 'basic' ? 200 : 999999;
        const usageCount = await prisma.usageLog.count({
          where: {
            groupId: ctx.chatId,
            createdAt: { gte: startOfDay }
          }
        });

        const limitDisplay = groupPlan === 'premium' ? 'Tanpa Batas' : `${maxCmd} perintah`;
        const remains = groupPlan === 'premium' ? 'Tanpa Batas' : `${Math.max(0, maxCmd - usageCount)} perintah`;

        let response = `📊 *KUOTA HARIAN GRUP (CHAT)* 📊\n\n`;
        response += `• *Grup ID:* ${ctx.chatId}\n`;
        response += `• *Paket Sewa:* *${groupPlan.toUpperCase()}*\n`;
        response += `• *Perintah Hari Ini:* ${usageCount} digunakan\n`;
        response += `• *Batas Kuota:* ${limitDisplay}\n`;
        response += `• *Sisa Kuota:* *${remains}*\n\n`;
        response += `💡 _Sewa paket PREMIUM untuk mendapatkan kuota tidak terbatas dan membuka semua fitur premium bot! Ketik \`/sewa\` untuk panduan._`;

        await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
      } else {
        // Private chat quota check
        const isUserPremium = await isPremium(ctx.senderId);
        const maxCmd = isUserPremium ? 999999 : 20;

        const usageCount = await prisma.usageLog.count({
          where: {
            userId: ctx.senderId,
            groupId: null,
            createdAt: { gte: startOfDay }
          }
        });

        const limitDisplay = isUserPremium ? 'Tanpa Batas' : `${maxCmd} perintah`;
        const remains = isUserPremium ? 'Tanpa Batas' : `${Math.max(0, maxCmd - usageCount)} perintah`;

        let response = `📊 *KUOTA HARIAN CHAT PRIBADI* 📊\n\n`;
        response += `• *Pengguna:* @${ctx.senderId.split('@')[0]}\n`;
        response += `• *Status User:* *${isUserPremium ? 'PREMIUM' : 'REGULER'}*\n`;
        response += `• *Perintah Hari Ini:* ${usageCount} digunakan\n`;
        response += `• *Batas Kuota:* ${limitDisplay}\n`;
        response += `• *Sisa Kuota:* *${remains}*\n\n`;
        response += `💡 _Upgrade ke PREMIUM User untuk mendapatkan kuota tak terbatas di chat pribadi. Ketik \`/sewa\` untuk melihat harga langganan._`;

        await adapter.sendMessage(ctx.chatId, response, { mentions: [ctx.senderId], quotedMessageId: ctx.id });
      }
      return;
    }

    // 4. /usage (Melihat statistik penggunaan fitur)
    if (cmd === 'usage') {
      const limit = 5;
      
      // Ambil log penggunaan dari database
      const userLogs = await prisma.usageLog.groupBy({
        by: ['feature'],
        _count: {
          feature: true
        },
        where: {
          userId: ctx.senderId,
          groupId: ctx.isGroup ? ctx.chatId : null
        },
        orderBy: {
          _count: {
            feature: 'desc'
          }
        },
        take: limit
      });

      const totalCount = await prisma.usageLog.count({
        where: {
          userId: ctx.senderId,
          groupId: ctx.isGroup ? ctx.chatId : null
        }
      });

      let response = `📈 *STATISTIK PENGGUNAAN FITUR ANDA* 📈\n\n`;
      response += `• *Total Pemanggilan:* ${totalCount} kali\n\n`;
      response += `*Fitur Paling Sering Digunakan:*\n`;

      if (userLogs.length === 0) {
        response += `_Belum ada riwayat penggunaan fitur._\n`;
      } else {
        userLogs.forEach((log, index) => {
          response += `${index + 1}. *${log.feature.toUpperCase()}*: ${log._count.feature} kali\n`;
        });
      }

      await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
      return;
    }
  }
}

const quotaCmd = new QuotaCommand();
registerCommand(['quota', 'credit', 'buycredit', 'usage'], quotaCmd);
