import { Command, registerCommand, checkIfAdmin } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';

export class WarningRuleCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
    if (!isAdmin) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Otoritas ditolak. Hanya admin grup yang dapat mengakses command ini.', { quotedMessageId: ctx.id });
      return;
    }

    const cmd = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    if (cmd === 'addwarnrule') {
      const threshold = parseInt(args[0]);
      const action = args[1]?.toLowerCase();

      if (isNaN(threshold) || threshold <= 0 || !['kick', 'mute'].includes(action)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah.\nContoh: `/addwarnrule 3 kick` atau `/addwarnrule 2 mute`', { quotedMessageId: ctx.id });
        return;
      }

      try {
        // Upsert rule based on threshold for the group
        const existingRule = await prisma.warningRule.findFirst({
          where: { groupId: ctx.chatId, threshold }
        });

        if (existingRule) {
          await prisma.warningRule.update({
            where: { id: existingRule.id },
            data: { action }
          });
        } else {
          await prisma.warningRule.create({
            data: {
              groupId: ctx.chatId,
              threshold,
              action
            }
          });
        }

        await adapter.sendMessage(ctx.chatId, `✅ Berhasil mengatur aksi *${action.toUpperCase()}* ketika peringatan mencapai *${threshold}*.`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal mengatur warning rule: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    if (cmd === 'delwarnrule') {
      const threshold = parseInt(args[0]);
      if (isNaN(threshold) || threshold <= 0) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah.\nContoh: `/delwarnrule 3`', { quotedMessageId: ctx.id });
        return;
      }

      const deleted = await prisma.warningRule.deleteMany({
        where: { groupId: ctx.chatId, threshold }
      });

      if (deleted.count > 0) {
        await adapter.sendMessage(ctx.chatId, `✅ Berhasil menghapus rule untuk batas peringatan *${threshold}*.`, { quotedMessageId: ctx.id });
      } else {
        await adapter.sendMessage(ctx.chatId, `⚠️ Tidak ditemukan rule untuk batas peringatan *${threshold}*.`, { quotedMessageId: ctx.id });
      }
      return;
    }

    if (cmd === 'listwarnrule') {
      const rules = await prisma.warningRule.findMany({
        where: { groupId: ctx.chatId },
        orderBy: { threshold: 'asc' }
      });

      if (rules.length === 0) {
        await adapter.sendMessage(ctx.chatId, '📭 Grup ini tidak memiliki Warning Rules kustom.\n(Default: Kick setelah 3 peringatan)', { quotedMessageId: ctx.id });
        return;
      }

      const response = `📜 *DAFTAR WARNING RULES* 📜\n\n` + rules.map((r) => `Batas ${r.threshold} peringatan ➡️ *${r.action.toUpperCase()}*`).join('\n');
      await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
      return;
    }
  }
}

registerCommand(['addwarnrule', 'delwarnrule', 'listwarnrule'], new WarningRuleCommand());
