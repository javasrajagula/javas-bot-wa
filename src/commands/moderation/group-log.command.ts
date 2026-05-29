import { Command, registerCommand, checkIfAdmin } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';

export class GroupLogCommand implements Command {
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

    if (cmd === 'clearlog') {
      const deleted = await prisma.groupLog.deleteMany({
        where: { groupId: ctx.chatId }
      });
      await adapter.sendMessage(ctx.chatId, `✅ Berhasil menghapus ${deleted.count} entri log grup.`, { quotedMessageId: ctx.id });
      return;
    }

    if (cmd === 'log') {
      const filter = args[0]?.toLowerCase();
      let whereClause: any = { groupId: ctx.chatId };

      if (filter) {
        if (filter === 'today') {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          whereClause.createdAt = { gte: today };
        } else {
          whereClause.type = filter;
        }
      }

      const logs = await prisma.groupLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: 20
      });

      if (logs.length === 0) {
        await adapter.sendMessage(ctx.chatId, '📭 Tidak ada catatan log terbaru untuk grup ini.', { quotedMessageId: ctx.id });
        return;
      }

      let response = `📜 *AUDIT LOG GRUP* 📜\n_Menampilkan max 20 log terakhir_\n\n`;
      logs.forEach((log, index) => {
        const time = log.createdAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const date = log.createdAt.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
        const userStr = log.userId ? `@${log.userId.split('@')[0]}` : 'Sistem';
        response += `*${index + 1}. [${date} ${time}] - ${log.type.toUpperCase()}*\n`;
        response += `User: ${userStr}\n`;
        if (log.action) response += `Aksi: ${log.action}\n`;
        if (log.message) response += `Detail: ${log.message}\n`;
        response += `\n`;
      });

      // Extract all unique user IDs to mention them properly (or we can just skip mentions to avoid pinging everyone)
      await adapter.sendMessage(ctx.chatId, response.trim());
      return;
    }
  }
}

registerCommand(['log', 'clearlog'], new GroupLogCommand());
