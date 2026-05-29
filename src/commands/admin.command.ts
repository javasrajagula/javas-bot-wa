import { Command, registerCommand, checkIfAdmin, cooldownOverrides } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import prisma from '../db/client.js';

export class AdminCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
    if (!isAdmin) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang memiliki otoritas untuk command ini.', { quotedMessageId: ctx.id });
      return;
    }

    const commandType = ctx.body.split(/\s+/)[0].slice(1).toLowerCase();

    // 1. /bot off
    if (commandType === 'bot') {
      const action = args[0]?.toLowerCase();
      if (action === 'off') {
        await prisma.groupConfig.update({
          where: { groupId: ctx.chatId },
          data: { botEnabled: false }
        });
        await adapter.sendMessage(ctx.chatId, '✅ Bot dinonaktifkan di grup ini. Ketik `/bot on` untuk mengaktifkan kembali.', { quotedMessageId: ctx.id });
        return;
      }
      await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/bot off`', { quotedMessageId: ctx.id });
      return;
    }

    // 2. /feature <fitur> <on/off>
    if (commandType === 'feature') {
      const feature = args[0]?.toLowerCase();
      const status = args[1]?.toLowerCase();

      if (!feature || (status !== 'on' && status !== 'off')) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/feature <sticker|hd|downloader|werewolf> <on|off>`', { quotedMessageId: ctx.id });
        return;
      }

      const isEnabled = status === 'on';
      const updateData: any = {};

      if (feature === 'sticker') updateData.stickerEnabled = isEnabled;
      else if (feature === 'hd') updateData.hdEnabled = isEnabled;
      else if (feature === 'downloader') updateData.downloaderEnabled = isEnabled;
      else if (feature === 'werewolf') updateData.werewolfEnabled = isEnabled;
      else {
        await adapter.sendMessage(ctx.chatId, `⚠️ Fitur "${feature}" tidak valid.`, { quotedMessageId: ctx.id });
        return;
      }

      await prisma.groupConfig.update({
        where: { groupId: ctx.chatId },
        data: updateData
      });

      await adapter.sendMessage(ctx.chatId, `✅ Fitur "${feature}" berhasil diubah menjadi: *${status.toUpperCase()}*.`, { quotedMessageId: ctx.id });
      return;
    }

    // 3. /setprefix <prefix>
    if (commandType === 'setprefix') {
      const prefix = args[0];
      if (!prefix) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/setprefix <prefix>` (Contoh: `/setprefix !`)', { quotedMessageId: ctx.id });
        return;
      }

      await prisma.groupConfig.update({
        where: { groupId: ctx.chatId },
        data: { prefix }
      });

      await adapter.sendMessage(ctx.chatId, `✅ Prefix grup berhasil diubah menjadi: *${prefix}*`, { quotedMessageId: ctx.id });
      return;
    }

    // 4. /setcooldown <fitur> <detik>
    if (commandType === 'setcooldown') {
      const feature = args[0]?.toLowerCase();
      const seconds = parseInt(args[1], 10);

      if (!feature || isNaN(seconds)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/setcooldown <sticker|hd|downloader|werewolf|brat> <detik>`', { quotedMessageId: ctx.id });
        return;
      }

      const validFeatures = ['sticker', 'hd', 'downloader', 'werewolf', 'brat'];
      if (!validFeatures.includes(feature)) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Fitur "${feature}" tidak valid.`, { quotedMessageId: ctx.id });
        return;
      }

      // Save custom cooldown override
      cooldownOverrides[feature] = seconds;

      await adapter.sendMessage(ctx.chatId, `✅ Cooldown fitur "${feature}" berhasil diubah menjadi: *${seconds} detik*.`, { quotedMessageId: ctx.id });
      return;
    }
  }
}

// Register admin commands
const adminCmd = new AdminCommand();
registerCommand(['bot', 'feature', 'setprefix', 'setcooldown'], adminCmd);
