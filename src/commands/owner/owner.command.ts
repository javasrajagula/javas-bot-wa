import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import { isOwner } from '../../bot/permission.js';
import prisma from '../../db/client.js';
import crypto from 'crypto';
import { hdQueue, downloaderQueue, generalQueue } from '../../queues/queue.js';
import { pluginManager } from '../../config/plugins.js';
import { logError } from '../../utils/logger.js';

export let isMaintenanceMode = false;

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

    const commandType = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    // 1. /maintenance <on/off>
    if (commandType === 'maintenance') {
      const mode = args[0]?.toLowerCase();
      if (mode === 'on') {
        isMaintenanceMode = true;
        await adapter.sendMessage(ctx.chatId, '⚙️ Mode maintenance aktif. Hanya Owner yang bisa berinteraksi dengan bot sekarang.', { quotedMessageId: ctx.id });
      } else if (mode === 'off') {
        isMaintenanceMode = false;
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
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/premium <add|remove> @user [hari]`', { quotedMessageId: ctx.id });
        return;
      }

      const targetUserId = rawUser.includes('@') 
        ? rawUser.replace('@', '').trim() + '@s.whatsapp.net'
        : rawUser.trim();

      try {
        if (action === 'add') {
          const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
          await prisma.premiumUser.upsert({
            where: { userId: targetUserId },
            create: { userId: targetUserId, expiresAt },
            update: { expiresAt }
          });
          await adapter.sendMessage(ctx.chatId, `✅ Berhasil menambahkan Premium untuk @${targetUserId.split('@')[0]} selama ${days} hari (Hingga ${expiresAt.toLocaleDateString()}).`, { quotedMessageId: ctx.id });
        } else {
          await prisma.premiumUser.deleteMany({
            where: { userId: targetUserId }
          });
          await adapter.sendMessage(ctx.chatId, `✅ Berhasil menghapus status Premium untuk @${targetUserId.split('@')[0]}.`, { quotedMessageId: ctx.id });
        }
      } catch (err: any) {
        await logError('OwnerCommand', 'premium', err, { targetUserId, action });
        await adapter.sendMessage(ctx.chatId, `❌ Gagal mengatur premium: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 3. /broadcast <pesan> with confirmation
    if (commandType === 'broadcast') {
      const action = args[0]?.toLowerCase();

      if (action === 'confirm') {
        const now = Date.now();
        if (!pendingBroadcast || pendingBroadcast.senderId !== ctx.senderId || now - pendingBroadcast.timestamp > 30000) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada broadcast yang menunggu konfirmasi atau konfirmasi kedaluwarsa (maks 30 detik).', { quotedMessageId: ctx.id });
          return;
        }

        const text = pendingBroadcast.text;
        pendingBroadcast = null; // clear

        await adapter.sendMessage(ctx.chatId, '📣 Memulai pengiriman broadcast ke semua grup...', { quotedMessageId: ctx.id });

        try {
          const configs = await prisma.groupConfig.findMany({
            select: { groupId: true }
          });

          let successCount = 0;
          for (const config of configs) {
            try {
              await adapter.sendMessage(config.groupId, `📢 *BROADCAST OWNER*\n\n${text}`);
              successCount++;
              await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit 1s
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

      const text = args.join(' ').trim();
      if (!text) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/broadcast <pesan>`', { quotedMessageId: ctx.id });
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

        const queueLength = hdQueue.getLength() + downloaderQueue.getLength() + generalQueue.getLength();

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
  }
}

const ownerSuite = new OwnerSuiteCommand();
registerCommand(
  ['maintenance', 'premium', 'broadcast', 'stats', 'limit', 'apikey', 'revokeapikey', 'plugin'],
  ownerSuite
);
