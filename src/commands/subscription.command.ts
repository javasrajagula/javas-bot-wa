import { Command, registerCommand } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import prisma from '../db/client.js';
import crypto from 'crypto';
import { isOwner } from '../bot/permission.js';
import { env } from '../config/env.js';

export class SubscriptionCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    // 1. /sewa
    if (cmd === 'sewa') {
      const response = `ℹ️ *INFORMASI SEWA JAVAS BOT WA*

Ingin menggunakan Javas Bot WA di grup Anda secara penuh?
Kami menyediakan paket sewa bulanan dengan harga terjangkau:

• *Basic Plan* - Rp 10.000 / bulan
  - Moderasi dasar (Anti-link, Anti-spam)
  - Fitur stiker & game ringan
  
• *Premium Plan* - Rp 25.000 / bulan
  - Seluruh fitur Basic Plan
  - Downloader (TikTok, Instagram)
  - Pengolah media lanjutan & HD rendering
  - Werewolf & Economy RPG Penuh

Silakan hubungi *Owner* untuk melakukan sewa dan aktivasi.
Ketik \`/fitursewa\` untuk membandingkan fitur lengkap.
Ketik \`/trial\` untuk mengaktifkan uji coba gratis (3 hari).
Ketik \`/invoice [basic|premium] [bulan]\` untuk membuat invoice tagihan.`;
      await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
      return;
    }

    // 2. /ceksewa
    if (cmd === 'ceksewa') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      const sub = await prisma.groupSubscription.findUnique({
        where: { groupId: ctx.chatId }
      });

      const plan = sub?.plan || 'free';
      const expiresAt = sub?.expiresAt;
      const isExpired = expiresAt && expiresAt.getTime() < Date.now();

      let response = `📊 *INFORMASI SEWA GRUP INI*\n\n`;
      response += `• *Grup ID:* ${ctx.chatId}\n`;
      response += `• *Paket:* ${plan.toUpperCase()}\n`;
      response += `• *Masa Aktif:* ${expiresAt ? expiresAt.toLocaleDateString('id-ID') : 'Lifetime (Tidak Terbatas)'}\n`;
      if (isExpired) {
        response += `⚠️ *Status:* Kedaluwarsa (Kembali ke paket FREE)`;
      } else {
        response += `🟢 *Status:* Aktif`;
      }

      await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
      return;
    }

    // 3. /fitursewa
    if (cmd === 'fitursewa') {
      const table = `📋 *PERBANDINGAN FITUR SEWA GRUP*

| Fitur | FREE | BASIC | PREMIUM |
| :--- | :---: | :---: | :---: |
| Fitur Stiker | ✅ | ✅ | ✅ |
| Moderasi Grup | ❌ | ✅ | ✅ |
| Game Werewolf | ❌ | ❌ | ✅ |
| Downloader | ❌ | ❌ | ✅ |
| HD & Media | ❌ | ❌ | ✅ |
| Custom Prefix | ❌ | ✅ | ✅ |

Ketik \`/sewa\` untuk panduan berlangganan.`;
      await adapter.sendMessage(ctx.chatId, table, { quotedMessageId: ctx.id });
      return;
    }

    // 4. /invoice [plan] [duration]
    if (cmd === 'invoice') {
      const plan = args[0]?.toLowerCase().trim();
      const durationStr = args[1]?.trim() || '1';
      const duration = parseInt(durationStr, 10);

      if (!plan || !['basic', 'premium'].includes(plan) || Number.isNaN(duration) || duration < 1 || duration > 12) {
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Format salah.\nGunakan: `/invoice [basic|premium] [jumlah_bulan]`\nContoh: `/invoice premium 3` (Diskon 10%)',
          { quotedMessageId: ctx.id }
        );
        return;
      }

      // Hitung total harga
      const basePrice = plan === 'premium' ? 25000 : 10000;
      let total = basePrice * duration;

      // Berikan diskon jika durasi >= 3 bulan atau >= 6 bulan
      let discountText = '';
      if (duration >= 6) {
        total = total * 0.8; // 20% discount
        discountText = ' (Diskon 20%)';
      } else if (duration >= 3) {
        total = total * 0.9; // 10% discount
        discountText = ' (Diskon 10%)';
      }

      const invoiceId = `INV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      // Simpan data invoice di CustomVariable
      const invoiceData = {
        groupId: ctx.isGroup ? ctx.chatId : 'private',
        userId: ctx.senderId,
        plan,
        durationMonths: duration,
        amount: total,
        status: 'pending',
        createdAt: Date.now()
      };

      await prisma.customVariable.upsert({
        where: {
          groupId_userId_key: {
            groupId: ctx.isGroup ? ctx.chatId : 'private',
            userId: ctx.senderId,
            key: `invoice:${invoiceId}`
          }
        },
        create: {
          groupId: ctx.isGroup ? ctx.chatId : 'private',
          userId: ctx.senderId,
          key: `invoice:${invoiceId}`,
          value: JSON.stringify(invoiceData)
        },
        update: {
          value: JSON.stringify(invoiceData)
        }
      });

      const response = `🧾 *INVOICE PEMBAYARAN JAVAS BOT* 🧾

• *Invoice ID:* \`${invoiceId}\`
• *Pelanggan:* @${ctx.senderId.split('@')[0]}
• *Paket Sewa:* *${plan.toUpperCase()} Plan*
• *Durasi:* ${duration} Bulan${discountText}
• *Total Tagihan:* *Rp ${total.toLocaleString('id-ID')}*

*=================================*
💡 *METODE PEMBAYARAN:*
• ${env.PREMIUM_PAYMENT_METHOD || 'GoPay'}: *${env.PREMIUM_PAYMENT_NUMBER || '085338123425'}*
• Batas Waktu Pembayaran: *24 Jam*

ℹ️ Setelah melakukan pembayaran simulasi, gunakan perintah:
\`/sewaconfirm ${invoiceId}\` (Khusus Owner/Admin untuk menyetujui transaksi)`;

      await adapter.sendMessage(ctx.chatId, response, { mentions: [ctx.senderId], quotedMessageId: ctx.id });
      return;
    }

    // 5. /sewaconfirm [invoiceId] (Khusus Owner)
    if (cmd === 'sewaconfirm') {
      if (!isOwner(ctx.senderId)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Owner bot yang dapat mengonfirmasi pembayaran invoice.', { quotedMessageId: ctx.id });
        return;
      }

      const invoiceId = args[0]?.trim();
      if (!invoiceId) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Harap masukkan Invoice ID.\nContoh: `/sewaconfirm INV-XXXXXX`', { quotedMessageId: ctx.id });
        return;
      }

      // Cari invoice di CustomVariable
      const rawInvoices = await prisma.customVariable.findMany({
        where: {
          key: `invoice:${invoiceId}`
        }
      });

      if (rawInvoices.length === 0) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Invoice tidak ditemukan di sistem database.', { quotedMessageId: ctx.id });
        return;
      }

      const dbInvoice = rawInvoices[0];
      const data = JSON.parse(dbInvoice.value);

      if (data.status === 'paid') {
        await adapter.sendMessage(ctx.chatId, '⚠️ Invoice ini sudah lunas sebelumnya.', { quotedMessageId: ctx.id });
        return;
      }

      // Tandai invoice lunas
      data.status = 'paid';
      data.paidAt = Date.now();
      await prisma.customVariable.update({
        where: { id: dbInvoice.id },
        data: { value: JSON.stringify(data) }
      });

      // Aktifkan / Perpanjang masa sewa grup
      const targetGroup = data.groupId;
      const targetDuration = data.durationMonths;
      const targetPlan = data.plan;

      if (targetGroup !== 'private') {
        const currentSub = await prisma.groupSubscription.findUnique({
          where: { groupId: targetGroup }
        });

        let newExpiresAt = new Date();
        if (currentSub && currentSub.expiresAt && currentSub.expiresAt.getTime() > Date.now()) {
          newExpiresAt = new Date(currentSub.expiresAt.getTime());
        }
        newExpiresAt.setMonth(newExpiresAt.getMonth() + targetDuration);

        await prisma.groupSubscription.upsert({
          where: { groupId: targetGroup },
          create: {
            groupId: targetGroup,
            plan: targetPlan,
            expiresAt: newExpiresAt
          },
          update: {
            plan: targetPlan,
            expiresAt: newExpiresAt
          }
        });

        await adapter.sendMessage(
          ctx.chatId,
          `✅ *Invoice ${invoiceId} BERHASIL DIKONFIRMASI!* \n\nMasa sewa grup \`${targetGroup}\` telah diaktifkan / diperpanjang:\n• Paket: *${targetPlan.toUpperCase()}*\n• Durasi tambahan: *${targetDuration} Bulan*\n• Expired Baru: *${newExpiresAt.toLocaleDateString('id-ID')}*`,
          { quotedMessageId: ctx.id }
        );

        // Jika diproses dari chat selain grup target, kirim notifikasi ke grup target
        if (ctx.chatId !== targetGroup) {
          await adapter.sendMessage(
            targetGroup,
            `🎉 *SEWA GRUP BERHASIL DIAKTIFKAN!* \n\nInvoice \`${invoiceId}\` dikonfirmasi oleh Owner:\n• Paket: *${targetPlan.toUpperCase()}*\n• Masa aktif baru: *${newExpiresAt.toLocaleDateString('id-ID')}*`
          ).catch(() => {});
        }
      } else {
        // Jika invoice privat (misalnya sewa user premium)
        const expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + targetDuration);

        await prisma.premiumUser.upsert({
          where: { userId: data.userId },
          create: {
            userId: data.userId,
            expiresAt
          },
          update: {
            expiresAt
          }
        });

        await adapter.sendMessage(
          ctx.chatId,
          `✅ *Invoice ${invoiceId} BERHASIL DIKONFIRMASI!* \n\nMasa aktif Premium User @${data.userId.split('@')[0]} ditambahkan selama *${targetDuration} Bulan*.`,
          { mentions: [data.userId], quotedMessageId: ctx.id }
        );
      }
      return;
    }

    // 6. /trial (Trial sewa gratis 3 hari)
    if (cmd === 'trial') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      // Cek apakah grup ini sudah pernah klaim trial
      const trialCheck = await prisma.customVariable.findFirst({
        where: {
          groupId: ctx.chatId,
          userId: 'group_trial',
          key: 'trial_claimed'
        }
      });

      if (trialCheck) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Grup Anda sudah pernah mengklaim jatah Trial gratis sebelumnya.', { quotedMessageId: ctx.id });
        return;
      }

      // Tandai trial diklaim
      await prisma.customVariable.create({
        data: {
          groupId: ctx.chatId,
          userId: 'group_trial',
          key: 'trial_claimed',
          value: 'true'
        }
      });

      // Berikan Paket Basic gratis 3 hari
      const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      await prisma.groupSubscription.upsert({
        where: { groupId: ctx.chatId },
        create: {
          groupId: ctx.chatId,
          plan: 'basic',
          expiresAt
        },
        update: {
          plan: 'basic',
          expiresAt
        }
      });

      const response = `🎉 *TRIAL GRUP BERHASIL DIAKTIFKAN!* 🎉

Grup Anda berhak menggunakan *BASIC PLAN* selama 3 hari gratis.
• *Berlaku sampai:* ${expiresAt.toLocaleDateString('id-ID')}
• *Status:* Aktif (Trial)

Ketik \`/fitursewa\` untuk melihat perbandingan fitur.`;
      await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
      return;
    }
  }
}

const subCommand = new SubscriptionCommand();
registerCommand(['sewa', 'ceksewa', 'fitursewa', 'invoice', 'sewaconfirm', 'trial'], subCommand);
