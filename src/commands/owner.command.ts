import { Command, registerCommand } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import { isOwner } from '../bot/permission.js';
import prisma from '../db/client.js';

export let isMaintenanceMode = false;

export class OwnerCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!isOwner(ctx.senderId)) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya dapat diakses oleh Owner bot.', { quotedMessageId: ctx.id });
      return;
    }

    const commandType = ctx.body.split(/\s+/)[0].slice(1).toLowerCase();

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

      // Resolve user ID format
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
          // remove
          await prisma.premiumUser.deleteMany({
            where: { userId: targetUserId }
          });
          await adapter.sendMessage(ctx.chatId, `✅ Berhasil menghapus status Premium untuk @${targetUserId.split('@')[0]}.`, { quotedMessageId: ctx.id });
        }
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal mengatur premium: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 3. /broadcast <pesan>
    if (commandType === 'broadcast') {
      const text = args.join(' ').trim();
      if (!text) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/broadcast <pesan>`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '📣 Memulai pengiriman broadcast ke semua grup...', { quotedMessageId: ctx.id });

      try {
        // Query all groups from DB configs
        const configs = await prisma.groupConfig.findMany({
          select: { groupId: true }
        });

        let successCount = 0;
        for (const config of configs) {
          try {
            await adapter.sendMessage(config.groupId, `📢 *BROADCAST OWNER*\n\n${text}`);
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit 1s between chats
          } catch (err) {
            console.error(`Failed to send broadcast to group ${config.groupId}:`, err);
          }
        }

        await adapter.sendMessage(ctx.chatId, `✅ Broadcast selesai dikirim ke ${successCount}/${configs.length} grup.`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal mengirim broadcast: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }
  }
}

// Register commands
const ownerCmd = new OwnerCommand();
registerCommand(['maintenance', 'premium', 'broadcast'], ownerCmd);
