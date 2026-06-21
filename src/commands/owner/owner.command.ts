import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import { isOwner } from '../../bot/permission.js';
import prisma from '../../db/client.js';
import crypto from 'crypto';
import { hdQueue, downloaderQueue, generalQueue } from '../../queues/queue.js';
import { pluginManager } from '../../config/plugins.js';
import { logError } from '../../utils/logger.js';
import { backupService } from '../../services/backup/backup.service.js';
import fs from 'fs';
import { stateStore } from '../../services/state/state-store.js';
import path from 'path';
import { env } from '../../config/env.js';

export let isMaintenanceMode = false;

export async function getMaintenanceMode(): Promise<boolean> {
  const cached = await stateStore.get<boolean>('bot:setting:maintenance');
  if (cached !== null && cached !== undefined) {
    isMaintenanceMode = cached;
    return cached;
  }
  const setting = await prisma.botSetting.findUnique({
    where: { key: 'maintenance' }
  });
  const value = setting ? JSON.parse(setting.valueJson).enabled === true : false;
  await stateStore.set('bot:setting:maintenance', value, 300);
  isMaintenanceMode = value;
  return value;
}

export async function setMaintenanceMode(enabled: boolean): Promise<void> {
  await prisma.botSetting.upsert({
    where: { key: 'maintenance' },
    create: { key: 'maintenance', valueJson: JSON.stringify({ enabled }) },
    update: { valueJson: JSON.stringify({ enabled }) }
  });
  await stateStore.set('bot:setting:maintenance', enabled, 300);
  isMaintenanceMode = enabled;
}

interface PendingBroadcast {
  text: string;
  senderId: string;
  timestamp: number;
}
let pendingBroadcast: PendingBroadcast | null = null;

export class OwnerSuiteCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!isOwner(ctx.senderId)) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya dapat diakses oleh Owner bot.', { quotedMessageId: ctx.id });
      return;
    }

    const commandType = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // 1. /maintenance <on/off>
    if (commandType === 'maintenance') {
      const mode = args[0]?.toLowerCase();
      if (mode === 'on') {
        await setMaintenanceMode(true);
        await adapter.sendMessage(ctx.chatId, '⚙️ Mode maintenance aktif. Hanya Owner yang bisa berinteraksi dengan bot sekarang.', { quotedMessageId: ctx.id });
      } else if (mode === 'off') {
        await setMaintenanceMode(false);
        await adapter.sendMessage(ctx.chatId, '⚙️ Mode maintenance dinonaktifkan. Bot dapat digunakan kembali oleh warga.', { quotedMessageId: ctx.id });
      } else {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/maintenance <on|off>`', { quotedMessageId: ctx.id });
      }
      return;
    }

    // 2. /premium <add/remove> @user <days>
    if (commandType === 'premium') {
      const action = args[0]?.toLowerCase();
      let rawUser = args[1];
      const days = parseInt(args[2] || '30', 10);

      if (!action || !rawUser || (action !== 'add' && action !== 'remove')) {
        await adapter.sendMessage(ctx.chatId,
          '⚠️ Format salah.\n\n' +
          '📋 *Cara penggunaan:*\n' +
          '• `/premium add 628xxxxxxxxx [hari]` — Tambah premium via nomor HP\n' +
          '• `/premium remove 628xxxxxxxxx` — Hapus premium\n\n' +
          '⚠️ *PENTING:* Gunakan nomor HP langsung (628xxx), bukan @mention.',
          { quotedMessageId: ctx.id });
        return;
      }

      // Warn if user passed a mention (@tag) which might be LID
      if (rawUser.startsWith('@') && rawUser.includes('@') === false) {
        // This is just @number style, should be fine
      }

      try {
        const { addPremiumUser, removePremiumUser } = await import('../../services/premium/premium.service.js');
        if (action === 'add') {
          const res = await addPremiumUser(rawUser, days, ctx.senderId);
          await adapter.sendMessage(ctx.chatId,
            `✅ *Premium berhasil ditambahkan!*\n\n` +
            `• *User ID tersimpan:* ${res.userId}\n` +
            `• *Nomor:* ${res.userId.split('@')[0]}\n` +
            `• *Durasi:* ${days} hari\n` +
            `• *Expired:* ${res.expiresAt.toLocaleDateString('id-ID')}\n\n` +
            `💡 Pastikan nomor di atas sesuai dengan nomor HP user.`,
            { quotedMessageId: ctx.id });
        } else {
          await removePremiumUser(rawUser, ctx.senderId);
          await adapter.sendMessage(ctx.chatId, `✅ Berhasil menghapus status Premium untuk ${rawUser.replace(/^@/, '').split('@')[0]}.`, { quotedMessageId: ctx.id });
        }
      } catch (err: any) {
        await logError('OwnerCommand', 'premium', err, { rawUser, action });
        await adapter.sendMessage(ctx.chatId,
          `❌ Gagal mengatur premium: ${err.message}\n\n` +
          `💡 *Tips:* Gunakan nomor HP langsung (tanpa @), misal:\n` +
          `\`/premium add 628123456789 30\``,
          { quotedMessageId: ctx.id });
      }
      return;
    }

    // 2b. /cekpremium @user
    if (commandType === 'cekpremium') {
      const targetUser = args[0];
      if (!targetUser) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Harap masukkan user. Contoh: `/cekpremium 628xxxxxxxxx`', { quotedMessageId: ctx.id });
        return;
      }
      try {
        const { getPremiumStatus, normalizePremiumUserId } = await import('../../services/premium/premium.service.js');
        const status = await getPremiumStatus(targetUser);
        let normalizedId = 'N/A';
        try { normalizedId = normalizePremiumUserId(targetUser); } catch {}
        let msg = `💎 *STATUS PREMIUM USER* 💎\n\n`;
        msg += `• *Input:* ${targetUser}\n`;
        msg += `• *ID di DB:* ${normalizedId}\n`;
        msg += `• *Status:* ${status.isPremium ? '🟢 PREMIUM AKTIF' : '🔴 FREE'}\n`;
        if (status.isPremium) {
          msg += `• *Expired:* ${status.expiresAt ? status.expiresAt.toLocaleDateString('id-ID') : 'Lifetime (Owner)'}\n`;
          msg += `• *Sisa Hari:* ${status.daysLeft} hari\n`;
        }
        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal mengecek premium: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 2c. /listpremium
    if (commandType === 'listpremium') {
      try {
        const activePremium = await prisma.premiumUser.findMany({
          where: { expiresAt: { gt: new Date() } }
        });
        if (activePremium.length === 0) {
          await adapter.sendMessage(ctx.chatId, 'ℹ️ Tidak ada user premium aktif.', { quotedMessageId: ctx.id });
          return;
        }
        let msg = `📋 *DAFTAR USER PREMIUM AKTIF* 📋\n\n`;
        activePremium.forEach((pu, index) => {
          msg += `${index + 1}. @${pu.userId.split('@')[0]} (s.d. ${pu.expiresAt.toLocaleDateString('id-ID')})\n`;
        });
        const mentions = activePremium.map(pu => pu.userId);
        await adapter.sendMessage(ctx.chatId, msg, { mentions, quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal memuat daftar premium: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 2d. /fixpremiumids
    if (commandType === 'fixpremiumids') {
      try {
        const { normalizePremiumRecords } = await import('../../services/premium/premium.service.js');
        const res = await normalizePremiumRecords();
        await adapter.sendMessage(ctx.chatId, `✅ Normalisasi selesai. Berhasil menyinkronkan & menggabungkan ${res.updatedCount} record premium user.`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal menormalisasi JID premium: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 2d2. /fixpremiumlid <nomor_hp> — Migrate @lid record to phone number
    if (commandType === 'fixpremiumlid') {
      const newPhone = args[0];
      try {
        // Find all @lid records
        const allRecords = await prisma.premiumUser.findMany();
        const lidRecords = allRecords.filter(r => r.userId.endsWith('@lid'));

        if (lidRecords.length === 0) {
          await adapter.sendMessage(ctx.chatId,
            `ℹ️ *Tidak ada record @lid* yang perlu diperbaiki.\n\nSemua data premium sudah dalam format yang benar.`,
            { quotedMessageId: ctx.id });
          return;
        }

        if (!newPhone) {
          // Show what's in the database
          let msg = `⚠️ *Ditemukan ${lidRecords.length} record premium dengan format @lid (SALAH):*\n\n`;
          lidRecords.forEach((r, i) => {
            const expired = r.expiresAt.getTime() < Date.now();
            msg += `${i + 1}. \`${r.userId}\`\n`;
            msg += `   • Expired: ${r.expiresAt.toLocaleDateString('id-ID')}\n`;
            msg += `   • Status: ${expired ? '❌ Sudah expired' : '✅ Masih aktif'}\n\n`;
          });
          msg += `💡 *Cara perbaiki:*\n`;
          msg += `\`/fixpremiumlid 628xxxxxxxxx\`\n\n`;
          msg += `Ganti \`628xxxxxxxxx\` dengan nomor HP yang sebenarnya dari user premium.`;
          await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
          return;
        }

        // Migrate LID record to phone number
        const { normalizePremiumUserId, addPremiumUser } = await import('../../services/premium/premium.service.js');
        const newUserId = normalizePremiumUserId(newPhone);

        // Find the best (longest expiry) active LID record
        const bestRecord = lidRecords.reduce((best, curr) =>
          curr.expiresAt.getTime() > best.expiresAt.getTime() ? curr : best
        , lidRecords[0]);

        const daysLeft = Math.ceil((bestRecord.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

        // Delete all LID records
        await prisma.premiumUser.deleteMany({ where: { userId: { endsWith: '@lid' } } });

        // Create new record with phone number
        await prisma.premiumUser.upsert({
          where: { userId: newUserId },
          create: { userId: newUserId, expiresAt: bestRecord.expiresAt },
          update: { expiresAt: bestRecord.expiresAt }
        });

        await prisma.userProfile.upsert({
          where: { userId: newUserId },
          create: { userId: newUserId, isPremium: true, premiumUntil: bestRecord.expiresAt },
          update: { isPremium: true, premiumUntil: bestRecord.expiresAt }
        });

        await prisma.auditLog.create({
          data: {
            actorId: ctx.senderId,
            action: 'fix_premium_lid',
            target: newUserId,
            metadataJson: JSON.stringify({ oldLid: bestRecord.userId, newUserId, daysLeft })
          }
        });

        await adapter.sendMessage(ctx.chatId,
          `✅ *Migrasi premium berhasil!*\n\n` +
          `• *Dari:* \`${bestRecord.userId}\` (format LID)\n` +
          `• *Ke:* \`${newUserId}\` (format HP)\n` +
          `• *Nomor:* ${newUserId.split('@')[0]}\n` +
          `• *Expired:* ${bestRecord.expiresAt.toLocaleDateString('id-ID')} (${daysLeft > 0 ? daysLeft + ' hari lagi' : 'sudah expired'})`,
          { quotedMessageId: ctx.id });

      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal memperbaiki LID premium: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 2e1. /aktifgrup [groupId] [basic|premium] [bulan]
    if (commandType === 'aktifgrup') {
      const targetGroupId = args[0]?.trim();
      const plan = args[1]?.toLowerCase() || 'premium';
      const months = parseInt(args[2] || '1', 10);

      if (!targetGroupId || !['basic', 'premium'].includes(plan) || isNaN(months) || months < 1) {
        // Show current group info if no args
        if (!targetGroupId && ctx.isGroup) {
          const sub = await prisma.groupSubscription.findUnique({ where: { groupId: ctx.chatId } });
          const now = new Date();
          const isExpired = sub?.expiresAt && sub.expiresAt <= now;
          const activePlan = (!sub?.expiresAt || !isExpired) ? (sub?.plan || 'free') : 'free';
          let msg = `📊 *INFO SEWA GRUP INI*\n\n`;
          msg += `• *Grup ID:* \`${ctx.chatId}\`\n`;
          msg += `• *Paket:* ${activePlan.toUpperCase()}\n`;
          msg += `• *Expired:* ${sub?.expiresAt ? sub.expiresAt.toLocaleDateString('id-ID') : '-'}\n`;
          msg += `• *Status:* ${activePlan === 'free' ? '🔴 FREE' : '🟢 AKTIF'}\n\n`;
          msg += `💡 *Untuk aktifkan/perpanjang:*\n\`/aktifgrup ${ctx.chatId} premium 1\``;
          await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
          return;
        }
        await adapter.sendMessage(ctx.chatId,
          `⚠️ Format salah.\n\n📋 *Cara penggunaan:*\n` +
          `• \`/aktifgrup <groupId> [basic|premium] [bulan]\`\n\n` +
          `*Contoh:*\n` +
          `\`/aktifgrup 120363429514459735@g.us premium 1\`\n\n` +
          `💡 Jika digunakan di dalam grup target, cukup ketik:\n` +
          `\`/aktifgrup\` untuk melihat info atau dapatkan Group ID dari \`/ceksewa\``,
          { quotedMessageId: ctx.id });
        return;
      }

      try {
        const currentSub = await prisma.groupSubscription.findUnique({ where: { groupId: targetGroupId } });
        const now = new Date();

        let newExpiresAt = new Date(now);
        if (currentSub?.expiresAt && currentSub.expiresAt > now) {
          // Perpanjang dari tanggal expired yang ada
          newExpiresAt = new Date(currentSub.expiresAt);
        }
        newExpiresAt.setMonth(newExpiresAt.getMonth() + months);

        await prisma.groupSubscription.upsert({
          where: { groupId: targetGroupId },
          create: { groupId: targetGroupId, plan, expiresAt: newExpiresAt },
          update: { plan, expiresAt: newExpiresAt }
        });

        await prisma.auditLog.create({
          data: {
            actorId: ctx.senderId,
            action: currentSub ? 'extend_group_sub' : 'add_group_sub',
            target: targetGroupId,
            groupId: targetGroupId,
            metadataJson: JSON.stringify({ plan, months, expiresAt: newExpiresAt })
          }
        });

        const isExtended = !!(currentSub?.expiresAt && currentSub.expiresAt > now);
        await adapter.sendMessage(ctx.chatId,
          `✅ *Sewa grup ${isExtended ? 'diperpanjang' : 'diaktifkan'}!*\n\n` +
          `• *Grup ID:* \`${targetGroupId}\`\n` +
          `• *Paket:* ${plan.toUpperCase()}\n` +
          `• *Durasi:* +${months} Bulan\n` +
          `• *Expired Baru:* ${newExpiresAt.toLocaleDateString('id-ID')}`,
          { quotedMessageId: ctx.id });

        // Notify the group if different from current chat
        if (ctx.chatId !== targetGroupId) {
          adapter.sendMessage(targetGroupId,
            `🎉 *SEWA GRUP BERHASIL ${isExtended ? 'DIPERPANJANG' : 'DIAKTIFKAN'}!*\n\n` +
            `• Paket: *${plan.toUpperCase()}*\n` +
            `• Masa aktif sampai: *${newExpiresAt.toLocaleDateString('id-ID')}*`
          ).catch(() => {});
        }
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal mengaktifkan sewa grup: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 2e2. /listgrup — List all active group subscriptions
    if (commandType === 'listgrup') {
      try {
        const now = new Date();
        const allSubs = await prisma.groupSubscription.findMany({
          orderBy: { expiresAt: 'desc' }
        });

        if (allSubs.length === 0) {
          await adapter.sendMessage(ctx.chatId, 'ℹ️ Belum ada grup yang berlangganan.', { quotedMessageId: ctx.id });
          return;
        }

        const activeSubs = allSubs.filter(s => !s.expiresAt || s.expiresAt > now);
        const expiredSubs = allSubs.filter(s => s.expiresAt && s.expiresAt <= now);

        let msg = `📋 *DAFTAR SEWA GRUP*\n\n`;
        msg += `🟢 *Aktif (${activeSubs.length} grup):*\n`;
        activeSubs.forEach((s, i) => {
          const daysLeft = s.expiresAt ? Math.ceil((s.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : 9999;
          msg += `${i + 1}. \`${s.groupId.split('@')[0]}\`\n`;
          msg += `   Paket: ${s.plan.toUpperCase()} | Sisa: ${daysLeft > 9000 ? '∞' : daysLeft + ' hari'}\n`;
        });

        if (expiredSubs.length > 0) {
          msg += `\n🔴 *Expired (${expiredSubs.length} grup):*\n`;
          expiredSubs.slice(0, 5).forEach((s, i) => {
            msg += `${i + 1}. \`${s.groupId.split('@')[0]}\` — expired ${s.expiresAt?.toLocaleDateString('id-ID')}\n`;
          });
          if (expiredSubs.length > 5) msg += `  ...dan ${expiredSubs.length - 5} lagi\n`;
        }

        msg += `\n💡 Untuk aktifkan grup: \`/aktifgrup <groupId> premium 1\``;
        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal memuat daftar grup: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 2f. /dbinfo
    if (commandType === 'dbinfo') {
      try {
        const url = env.DATABASE_URL;

        const provider = url.startsWith('file:') ? 'SQLite' : 'Postgres/MySQL';
        let dbPath = url;
        let sizeText = 'N/A';

        if (url.startsWith('file:')) {
          const relativePath = url.replace('file:', '');
          const absolutePath = path.resolve(process.cwd(), relativePath);
          dbPath = absolutePath;
          if (fs.existsSync(absolutePath)) {
            const stats = fs.statSync(absolutePath);
            const sizeKb = Math.ceil(stats.size / 1024);
            sizeText = `${sizeKb} KB`;
          }
        }

        let msg = `🗄️ *DATABASE PATH INFO* 🗄️\n\n`;
        msg += `• *Provider:* ${provider}\n`;
        msg += `• *Database Path:* \`${dbPath}\`\n`;
        msg += `• *Ukuran Database:* ${sizeText}\n`;
        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal mengambil info database: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 3. /broadcast <pesan> or /broadcast template <name>
    if (commandType === 'broadcast' || commandType === 'bcaddtemplate' || commandType === 'bcdeltemplate' || commandType === 'bclisttemplate') {
      
      // bcaddtemplate
      if (commandType === 'bcaddtemplate') {
        const fullText = args.join(' ');
        const parts = fullText.split('=');
        if (parts.length < 2) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/bcaddtemplate <nama> = <pesan>`', { quotedMessageId: ctx.id });
          return;
        }
        const name = parts[0].trim().toLowerCase();
        const body = parts.slice(1).join('=').trim();
        if (!name || !body) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Nama atau isi template tidak boleh kosong.', { quotedMessageId: ctx.id });
          return;
        }

        await prisma.broadcastTemplate.upsert({
          where: { name },
          create: { name, body, createdBy: ctx.senderId },
          update: { body, createdBy: ctx.senderId }
        });
        await adapter.sendMessage(ctx.chatId, `✅ Template broadcast *"${name}"* berhasil disimpan.`, { quotedMessageId: ctx.id });
        return;
      }

      // bcdeltemplate
      if (commandType === 'bcdeltemplate') {
        const name = args[0]?.trim().toLowerCase();
        if (!name) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/bcdeltemplate <nama>`', { quotedMessageId: ctx.id });
          return;
        }
        const deleted = await prisma.broadcastTemplate.deleteMany({
          where: { name }
        });
        if (deleted.count > 0) {
          await adapter.sendMessage(ctx.chatId, `✅ Template broadcast *"${name}"* berhasil dihapus.`, { quotedMessageId: ctx.id });
        } else {
          await adapter.sendMessage(ctx.chatId, `⚠️ Template broadcast *"${name}"* tidak ditemukan.`, { quotedMessageId: ctx.id });
        }
        return;
      }

      // bclisttemplate
      if (commandType === 'bclisttemplate') {
        const list = await prisma.broadcastTemplate.findMany();
        if (list.length === 0) {
          await adapter.sendMessage(ctx.chatId, 'ℹ️ Tidak ada template broadcast terdaftar.', { quotedMessageId: ctx.id });
          return;
        }
        const textList = list.map((t, i) => `${i + 1}. *${t.name}*\n   ${t.body.slice(0, 100)}${t.body.length > 100 ? '...' : ''}`).join('\n\n');
        await adapter.sendMessage(ctx.chatId, `📋 *DAFTAR TEMPLATE BROADCAST*\n\n${textList}`, { quotedMessageId: ctx.id });
        return;
      }

      // /broadcast template <name>
      let text = args.join(' ').trim();
      if (args[0]?.toLowerCase() === 'template') {
        const templateName = args[1]?.trim().toLowerCase();
        if (!templateName) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/broadcast template <nama>`', { quotedMessageId: ctx.id });
          return;
        }
        const template = await prisma.broadcastTemplate.findUnique({
          where: { name: templateName }
        });
        if (!template) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Template broadcast *"${templateName}"* tidak ditemukan.`, { quotedMessageId: ctx.id });
          return;
        }
        text = template.body;
      }

      if (!text) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/broadcast <pesan>` atau `/broadcast template <nama>`', { quotedMessageId: ctx.id });
        return;
      }

      if (args[0]?.toLowerCase() === 'confirm') {
        const now = Date.now();
        if (!pendingBroadcast || pendingBroadcast.senderId !== ctx.senderId || now - pendingBroadcast.timestamp > 30000) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada broadcast yang menunggu konfirmasi atau konfirmasi kedaluwarsa (maks 30 detik).', { quotedMessageId: ctx.id });
          return;
        }

        const bText = pendingBroadcast.text;
        pendingBroadcast = null;

        if (ctx.isGroup) {
          const config = await prisma.groupConfig.findUnique({ where: { groupId: ctx.chatId } });
          const features = config ? JSON.parse(config.featuresJson || '{}') : {};
          if (features.approvalBroadcast) {
            const approvalId = Math.random().toString(36).substring(2, 8).toUpperCase();
            const { stateStore } = await import('../../services/state/state-store.js');
            await stateStore.set(`approval:request:${approvalId}`, {
              id: approvalId,
              groupId: ctx.chatId,
              action: 'broadcast',
              target: 'all groups',
              actorId: ctx.senderId,
              data: { text: bText },
              expiresAt: Date.now() + 15 * 60 * 1000
            }, 900);

            await adapter.sendMessage(
              ctx.chatId,
              `⏳ *MEMINTA PERSETUJUAN BROADCAST* ⏳\n\n` +
              `Tindakan *BROADCAST* oleh @${ctx.senderId.split('@')[0]} membutuhkan persetujuan Admin/Owner lain.\n\n` +
              `Ketik:\n` +
              `👉 */approve ${approvalId}* (Setujui)\n` +
              `👉 */reject ${approvalId}* (Tolak)`,
              { mentions: [ctx.senderId] }
            );
            return;
          }
        }

        await adapter.sendMessage(ctx.chatId, '📣 Memulai pengiriman broadcast ke semua grup...', { quotedMessageId: ctx.id });

        try {
          const configs = await prisma.groupConfig.findMany({ select: { groupId: true } });
          let successCount = 0;
          for (const config of configs) {
            try {
              await adapter.sendMessage(config.groupId, `📢 *SIARAN RESMI OWNER*\n\n${bText}`);
              successCount++;
              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (err) {
              console.error(`Failed to send broadcast to group ${config.groupId}:`, err);
            }
          }
          await adapter.sendMessage(ctx.chatId, `✅ Broadcast selesai dikirim ke ${successCount}/${configs.length} grup.`, { quotedMessageId: ctx.id });
        } catch (err: any) {
          await logError('OwnerCommand', 'broadcast', err);
          await adapter.sendMessage(ctx.chatId, `❌ Gagal mengirim broadcast: ${err.message}`, { quotedMessageId: ctx.id });
        }
        return;
      }

      pendingBroadcast = {
        text,
        senderId: ctx.senderId,
        timestamp: Date.now()
      };

      const confirmMsg = `📣 *KONFIRMASI BROADCAST*\n\n*Pesan:*\n"${text}"\n\n⚠️ *Perhatian:* Pesan di atas akan dikirimkan ke seluruh grup WhatsApp yang terdaftar.\n\nKetik \`/broadcast confirm\` dalam waktu *30 detik* untuk melanjutkan pengiriman.`;
      await adapter.sendMessage(ctx.chatId, confirmMsg, { quotedMessageId: ctx.id });
      return;
    }

    // 4. /stats
    if (['backup', 'backupdb', 'backupconfig', 'listbackup', 'restorebackup', 'exportconfig', 'importconfig'].includes(commandType)) {
      try {
        if (commandType === 'backup') {
          const backups = await backupService.createFullBackup();
          const text = backups
            .map(backup => `- ${backup.fileName} (${Math.ceil(backup.size / 1024)} KB)`)
            .join('\n');
          await adapter.sendMessage(ctx.chatId, `✅ Backup lengkap berhasil dibuat:\n${text}`, { quotedMessageId: ctx.id });
          return;
        }

        if (commandType === 'backupdb') {
          const backup = await backupService.createDatabaseBackup();
          const buffer = await fs.promises.readFile(backup.filePath);
          await adapter.sendDocument(ctx.chatId, buffer, backup.fileName, 'application/octet-stream', { quotedMessageId: ctx.id });
          return;
        }

        if (commandType === 'backupconfig' || commandType === 'exportconfig') {
          const buffer = await backupService.exportConfigBuffer();
          await adapter.sendDocument(ctx.chatId, buffer, `config-export-${Date.now()}.json`, 'application/json', { quotedMessageId: ctx.id });
          return;
        }

        if (commandType === 'listbackup') {
          const backups = backupService.listBackups();
          if (backups.length === 0) {
            await adapter.sendMessage(ctx.chatId, 'ℹ️ Belum ada backup lokal.', { quotedMessageId: ctx.id });
            return;
          }

          const list = backups.slice(0, 20)
            .map((backup, index) => `${index + 1}. *${backup.id}* [${backup.kind}] ${Math.ceil(backup.size / 1024)} KB`)
            .join('\n');
          await adapter.sendMessage(ctx.chatId, `📦 *DAFTAR BACKUP*\n\n${list}`, { quotedMessageId: ctx.id });
          return;
        }

        if (commandType === 'restorebackup') {
          const first = args[0];
          if (!first) {
            await adapter.sendMessage(ctx.chatId, '⚠️ Format: `/restorebackup <id>` lalu ikuti instruksi konfirmasi.', { quotedMessageId: ctx.id });
            return;
          }

          if (first.toLowerCase() === 'confirm') {
            const confirmation = args.slice(1).join(' ').trim();
            const restored = await backupService.confirmRestore(ctx.senderId, confirmation);
            await adapter.sendMessage(ctx.chatId, `✅ Database berhasil direstore dari *${restored.fileName}*. Restart bot disarankan.`, { quotedMessageId: ctx.id });
            return;
          }

          if (args[1]?.toLowerCase() === 'confirm') {
            const restored = await backupService.confirmRestore(ctx.senderId, `RESTORE ${first}`);
            await adapter.sendMessage(ctx.chatId, `✅ Database berhasil direstore dari *${restored.fileName}*. Restart bot disarankan.`, { quotedMessageId: ctx.id });
            return;
          }

          const phrase = backupService.requestRestore(ctx.senderId, first);
          await adapter.sendMessage(
            ctx.chatId,
            `⚠️ *KONFIRMASI RESTORE DATABASE*\n\nRestore akan menimpa database aktif. Safety backup akan dibuat otomatis.\n\nKetik persis:\n/restorebackup confirm ${phrase}\n\nBerlaku 60 detik.`,
            { quotedMessageId: ctx.id }
          );
          return;
        }

        if (commandType === 'importconfig') {
          const media = ctx.media || ctx.quotedMessage?.media;
          if (!media || media.type !== 'document') {
            await adapter.sendMessage(ctx.chatId, '⚠️ Reply file JSON hasil `/exportconfig` dengan command `/importconfig`.', { quotedMessageId: ctx.id });
            return;
          }

          const result = await backupService.importConfigFromBuffer(await media.getBuffer());
          await adapter.sendMessage(ctx.chatId, [
            `✅ *Config berhasil diimport!*`,
            ``,
            `📋 *Ringkasan Import:*`,
            `• Grup: ${result.groups}`,
            `• Sewa/Subscription: ${result.subscriptions}`,
            `• Premium Users: ${result.premiumUsers}`,
            `• Warning Rules: ${result.warningRules}`,
            `• Shop Items: ${result.shopItems}`,
            `• Achievements: ${result.achievements}`
          ].join('\n'), { quotedMessageId: ctx.id });
          return;
        }
      } catch (err: any) {
        await logError('OwnerCommand', commandType, err);
        await adapter.sendMessage(ctx.chatId, `❌ Gagal menjalankan ${commandType}: ${err.message}`, { quotedMessageId: ctx.id });
        return;
      }
    }

    // 4. /stats
    if (commandType === 'stats') {
      try {
        const totalUsers = await prisma.userProfile.count();
        const totalGroups = await prisma.groupConfig.count();

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const usageToday = await prisma.usageLog.count({
          where: { createdAt: { gte: startOfToday } }
        });

        // Top features used today
        const logsToday = await prisma.usageLog.findMany({
          where: { createdAt: { gte: startOfToday } },
          select: { feature: true }
        });

        const counts: Record<string, number> = {};
        for (const log of logsToday) {
          counts[log.feature] = (counts[log.feature] || 0) + 1;
        }
        const topFeatures = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([feat, cnt], idx) => `${idx + 1}. ${feat}: ${cnt}x`)
          .join('\n');

        const activePremium = await prisma.premiumUser.count({
          where: { expiresAt: { gt: new Date() } }
        });

        const queueLength = (await hdQueue.getLength()) + (await downloaderQueue.getLength()) + (await generalQueue.getLength());

        const lastErrors = await prisma.errorLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 3
        });
        const errorsStr = lastErrors.length > 0
          ? lastErrors.map(e => `- [${e.createdAt.toLocaleTimeString()}] [${e.scope || 'N/A'}] ${e.message}`).join('\n')
          : 'Tidak ada error tercatat.';

        const statsMsg = `📊 *JAVAS BOT WA STATS*

👥 Total User Terdaftar: ${totalUsers}
🏢 Total Grup Terdaftar: ${totalGroups}
⚡ Premium User Aktif: ${activePremium}
📥 Queue Length: ${queueLength}

📈 Command Hari Ini: ${usageToday}
🔥 Fitur Terpopuler Hari Ini:
${topFeatures || 'Belum ada data.'}

⚠️ Error Terakhir:
${errorsStr}`;

        await adapter.sendMessage(ctx.chatId, statsMsg, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await logError('OwnerCommand', 'stats', err);
        await adapter.sendMessage(ctx.chatId, `❌ Gagal mengambil statistik: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 5. /limit
    if (commandType === 'limit') {
      const bypassOwner = process.env.OWNER_BYPASS_RATE_LIMIT !== 'false';
      const bypassPrivate = process.env.PRIVATE_CHAT_BYPASS_RATE_LIMIT !== 'false';

      const limitMsg = `📊 *LIMIT & RATE LIMIT CONFIGURATION*

Stiker: Max 10 requests / 1 menit
HD: Max 3 requests / 10 menit
Downloader: Max 5 requests / 10 minutes
Werewolf: Max 30 requests / 1 minute
Brat: Max 10 requests / 1 minute

⚡ *Bypass Status:*
• Owner Bypass: ${bypassOwner ? 'Aktif (Tanpa limit)' : 'Nonaktif'}
• Private Chat Bypass: ${bypassPrivate ? 'Aktif (Tanpa limit)' : 'Nonaktif'}`;

      await adapter.sendMessage(ctx.chatId, limitMsg, { quotedMessageId: ctx.id });
      return;
    }

    // 6. /apikey
    if (commandType === 'apikey') {
      if (ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Untuk alasan keamanan, pembuatan API Key hanya dapat dilakukan melalui Private Chat (PC) dengan bot.', { quotedMessageId: ctx.id });
        return;
      }
      try {
        const rawKey = 'javas_key_' + crypto.randomBytes(24).toString('hex');
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

        await prisma.apiKey.create({
          data: {
            userId: ctx.senderId,
            keyHash
          }
        });

        const keyMsg = `🔑 *API KEY BARU ANDA*

\`${rawKey}\`

⚠️ *Perhatian:* Catat API Key ini baik-baik. API Key ini hanya akan ditampilkan *satu kali* untuk keamanan.`;
        await adapter.sendMessage(ctx.chatId, keyMsg, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await logError('OwnerCommand', 'apikey', err);
        await adapter.sendMessage(ctx.chatId, `❌ Gagal menghasilkan API Key: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 7. /revokeapikey
    if (commandType === 'revokeapikey') {
      try {
        await prisma.apiKey.updateMany({
          where: {
            userId: ctx.senderId,
            revokedAt: null
          },
          data: {
            revokedAt: new Date()
          }
        });
        await adapter.sendMessage(ctx.chatId, '✅ Semua API Key aktif milik Anda berhasil dinonaktifkan (revoked).', { quotedMessageId: ctx.id });
      } catch (err: any) {
        await logError('OwnerCommand', 'revokeapikey', err);
        await adapter.sendMessage(ctx.chatId, `❌ Gagal mencabut API Key: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 8. /plugin <list / on / off>
    if (commandType === 'plugin') {
      const action = args[0]?.toLowerCase();
      const name = args[1]?.toLowerCase();

      if (action === 'list') {
        const plugins = pluginManager.listPlugins();
        const pList = plugins.map(p => `• *${p.name}* (${p.category}): ${p.enabled ? '🟢 ON' : '🔴 OFF'} (${p.commands.length} cmds)`).join('\n');
        await adapter.sendMessage(ctx.chatId, `🔌 *LIST PLUGIN SYSTEM*\n\n${pList}`, { quotedMessageId: ctx.id });
        return;
      }

      if (action === 'on' || action === 'off') {
        if (!name) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tentukan nama plugin. Contoh: `/plugin on games`', { quotedMessageId: ctx.id });
          return;
        }

        const isEnabled = action === 'on';
        const success = pluginManager.setPluginStatus(name, isEnabled);

        if (success) {
          await adapter.sendMessage(ctx.chatId, `✅ Plugin *${name}* berhasil di${isEnabled ? 'aktifkan' : 'nonaktifkan'}.`, { quotedMessageId: ctx.id });
        } else {
          await adapter.sendMessage(ctx.chatId, `⚠️ Plugin *${name}* tidak ditemukan.`, { quotedMessageId: ctx.id });
        }
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan:\n• `/plugin list`\n• `/plugin on <name>`\n• `/plugin off <name>`', { quotedMessageId: ctx.id });
      return;
    }

    // 9. /addsewa <groupId|current> <hari> <plan>
    if (commandType === 'addsewa') {
      let groupId = args[0];
      const days = parseInt(args[1] || '30', 10);
      const plan = args[2]?.toLowerCase() || 'basic';

      if (!groupId && ctx.isGroup) groupId = 'current';
      if (groupId === 'current') groupId = ctx.chatId;

      if (groupId && groupId !== 'current') {
        const { normalizeJid } = await import('../../utils/jid.util.js');
        groupId = normalizeJid(groupId);
      }

      if (!groupId || !['free', 'basic', 'premium'].includes(plan)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/addsewa <groupId|current> [hari] [plan]`', { quotedMessageId: ctx.id });
        return;
      }

      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      await prisma.groupSubscription.upsert({
        where: { groupId },
        create: { groupId, plan, expiresAt },
        update: { plan, expiresAt }
      });

      await adapter.sendMessage(ctx.chatId, `✅ Sewa grup *${groupId}* berhasil ditambahkan dengan plan *${plan.toUpperCase()}* selama ${days} hari (hingga ${expiresAt.toLocaleDateString()}).`, { quotedMessageId: ctx.id });
      return;
    }

    // 10. /delsewa <groupId|current>
    if (commandType === 'delsewa') {
      let groupId = args[0];
      if (!groupId && ctx.isGroup) groupId = 'current';
      if (groupId === 'current') groupId = ctx.chatId;

      if (groupId && groupId !== 'current') {
        const { normalizeJid } = await import('../../utils/jid.util.js');
        groupId = normalizeJid(groupId);
      }

      if (!groupId) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/delsewa <groupId|current>`', { quotedMessageId: ctx.id });
        return;
      }

      await prisma.groupSubscription.deleteMany({ where: { groupId } });
      await adapter.sendMessage(ctx.chatId, `✅ Berhasil menghapus sewa untuk grup *${groupId}*.`, { quotedMessageId: ctx.id });
      return;
    }

    // 11. /listsewa
    if (commandType === 'listsewa') {
      const subscriptions = await prisma.groupSubscription.findMany();
      if (subscriptions.length === 0) {
        await adapter.sendMessage(ctx.chatId, 'ℹ️ Tidak ada sewa aktif di database.', { quotedMessageId: ctx.id });
        return;
      }

      let msg = '📋 *DAFTAR SEWA GRUP AKTIF*\n\n';
      for (const sub of subscriptions) {
        const expired = sub.expiresAt && sub.expiresAt.getTime() < Date.now();
        msg += `• *ID:* ${sub.groupId}\n  *Plan:* ${sub.plan.toUpperCase()}\n  *Exp:* ${sub.expiresAt ? sub.expiresAt.toLocaleDateString() : 'Lifetime'} ${expired ? '⚠️ (EXPIRED)' : ''}\n\n`;
      }
      await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      return;
    }

    // 12. /extendsewa <groupId|current> <hari>
    if (commandType === 'extendsewa') {
      let groupId = args[0];
      const days = parseInt(args[1] || '30', 10);

      if (!groupId && ctx.isGroup) groupId = 'current';
      if (groupId === 'current') groupId = ctx.chatId;

      if (groupId && groupId !== 'current') {
        const { normalizeJid } = await import('../../utils/jid.util.js');
        groupId = normalizeJid(groupId);
      }

      if (!groupId || isNaN(days)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/extendsewa <groupId|current> <hari>`', { quotedMessageId: ctx.id });
        return;
      }

      const sub = await prisma.groupSubscription.findUnique({ where: { groupId } });
      if (!sub) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Grup ini belum memiliki sewa aktif. Gunakan `/addsewa` terlebih dahulu.', { quotedMessageId: ctx.id });
        return;
      }

      const currentExp = sub.expiresAt && sub.expiresAt.getTime() > Date.now() ? sub.expiresAt.getTime() : Date.now();
      const newExp = new Date(currentExp + days * 24 * 60 * 60 * 1000);

      await prisma.groupSubscription.update({
        where: { groupId },
        data: { expiresAt: newExp }
      });

      await adapter.sendMessage(ctx.chatId, `✅ Sewa grup *${groupId}* diperpanjang ${days} hari (Hingga ${newExp.toLocaleDateString()}).`, { quotedMessageId: ctx.id });
      return;
    }

    // 13. /setplan <groupId|current> <free|basic|premium>
    if (commandType === 'setplan') {
      let groupId = args[0];
      const plan = args[1]?.toLowerCase();

      if (!groupId && ctx.isGroup) groupId = 'current';
      if (groupId === 'current') groupId = ctx.chatId;

      if (groupId && groupId !== 'current') {
        const { normalizeJid } = await import('../../utils/jid.util.js');
        groupId = normalizeJid(groupId);
      }

      if (!groupId || !['free', 'basic', 'premium'].includes(plan || '')) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/setplan <groupId|current> <free|basic|premium>`', { quotedMessageId: ctx.id });
        return;
      }

      await prisma.groupSubscription.upsert({
        where: { groupId },
        create: { groupId, plan },
        update: { plan }
      });

      await adapter.sendMessage(ctx.chatId, `✅ Plan sewa grup *${groupId}* diubah menjadi *${plan?.toUpperCase()}*.`, { quotedMessageId: ctx.id });
      return;
    }
  }
}

const ownerSuite = new OwnerSuiteCommand();
registerCommand(
  ['maintenance', 'premium', 'broadcast', 'bcaddtemplate', 'bcdeltemplate', 'bclisttemplate', 'stats', 'limit', 'apikey', 'revokeapikey', 'plugin', 'addsewa', 'delsewa', 'listsewa', 'extendsewa', 'setplan', 'backup', 'backupdb', 'backupconfig', 'listbackup', 'restorebackup', 'exportconfig', 'importconfig', 'cekpremium', 'listpremium', 'fixpremiumids', 'fixpremiumlid', 'aktifgrup', 'listgrup', 'dbinfo'],
  ownerSuite
);
