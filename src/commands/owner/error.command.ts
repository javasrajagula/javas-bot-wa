import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import { isOwner } from '../../bot/permission.js';
import prisma from '../../db/client.js';
import { getRecentError, getErrorStats, clearRecentErrors } from '../../utils/error-id.util.js';

export class ErrorSuiteCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!isOwner(ctx.senderId)) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya dapat diakses oleh Owner bot.', { quotedMessageId: ctx.id });
      return;
    }

    const commandType = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    // 1. /error <errorId>
    if (commandType === 'error') {
      const errorId = args[0]?.trim();
      if (!errorId) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/error <errorId>`', { quotedMessageId: ctx.id });
        return;
      }

      // Check recent errors in-memory first
      let record = getRecentError(errorId);
      let details = '';

      if (record) {
        details = `⚠️ *DETAIL ERROR (In-Memory)*\n\n` +
          `• *ID:* ${record.id}\n` +
          `• *Scope:* ${record.scope}\n` +
          `• *Feature:* ${record.feature}\n` +
          `• *Time:* ${record.createdAt.toLocaleString()}\n` +
          `• *Message:* ${record.message}\n` +
          `• *Metadata:* ${JSON.stringify(record.metadata || {}, null, 2)}`;
      } else {
        // Look up in database
        try {
          const dbLog = await prisma.errorLog.findUnique({
            where: { errorId }
          });

          if (dbLog) {
            details = `⚠️ *DETAIL ERROR (Database)*\n\n` +
              `• *ID:* ${dbLog.errorId}\n` +
              `• *Scope:* ${dbLog.scope || 'N/A'}\n` +
              `• *Feature:* ${dbLog.feature || 'N/A'}\n` +
              `• *Time:* ${dbLog.createdAt.toLocaleString()}\n` +
              `• *Message:* ${dbLog.message}\n` +
              `• *Stack:* ${dbLog.stack ? dbLog.stack.substring(0, 1000) : 'N/A'}\n` +
              `• *Metadata:* ${dbLog.metadataJson}`;
          } else {
            await adapter.sendMessage(ctx.chatId, `❌ Error ID *${errorId}* tidak ditemukan di memory maupun database.`, { quotedMessageId: ctx.id });
            return;
          }
        } catch (dbErr: any) {
          await adapter.sendMessage(ctx.chatId, `❌ Gagal mengambil detail error dari database: ${dbErr.message}`, { quotedMessageId: ctx.id });
          return;
        }
      }

      await adapter.sendMessage(ctx.chatId, details, { quotedMessageId: ctx.id });
      return;
    }

    // 2. /errorstats
    if (commandType === 'errorstats') {
      try {
        const stats = getErrorStats();
        const totalDbErrors = await prisma.errorLog.count();

        // Get count per scope from database
        const dbStatsRaw = await prisma.errorLog.groupBy({
          by: ['scope'],
          _count: {
            id: true
          }
        });

        const dbScopeStr = dbStatsRaw
          .map(item => `  - ${item.scope || 'N/A'}: ${item._count.id}x`)
          .join('\n') || '  - Tidak ada data.';

        const inMemoryScopeStr = Object.entries(stats.byScope)
          .map(([scope, count]) => `  - ${scope}: ${count}x`)
          .join('\n') || '  - Tidak ada data.';

        const inMemoryFeatureStr = Object.entries(stats.byFeature)
          .map(([feature, count]) => `  - ${feature}: ${count}x`)
          .join('\n') || '  - Tidak ada data.';

        const statsMsg = `📊 *STATISTIK ERROR SISTEM*

🌐 *Database logs:*
• Total logs: ${totalDbErrors}
• Breakdown by Scope:
${dbScopeStr}

⚡ *In-Memory (Recent 100):*
• Total in-memory: ${stats.total}
• Breakdown by Scope:
${inMemoryScopeStr}
• Breakdown by Feature:
${inMemoryFeatureStr}`;

        await adapter.sendMessage(ctx.chatId, statsMsg, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal mengambil statistik error: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 3. /clearerrors
    if (commandType === 'clearerrors') {
      try {
        clearRecentErrors();
        await adapter.sendMessage(ctx.chatId, '✅ Berhasil membersihkan daftar error recent di memory.', { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal membersihkan error: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }
  }
}

const errorSuite = new ErrorSuiteCommand();
registerCommand(['error', 'errorstats', 'clearerrors'], errorSuite);
