import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import { isOwner } from '../../bot/permission.js';
import { getAllQueues } from '../../queues/queue.js';

export class QueueSuiteCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const commandType = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();
    const queues = getAllQueues();

    // 1. /queue or /queue mine
    if (commandType === 'queue') {
      const sub = args[0]?.toLowerCase();

      if (sub === 'mine') {
        // List user's queued jobs
        let msg = `📥 *PEKERJAAN ANTRIAN ANDA*\n\n`;
        let found = false;

        for (const queue of queues) {
          const waiting = await queue.list();
          const active = queue.getActiveJobs();
          const failed = queue.getFailedJobs();
          const completed = queue.getCompletedJobs();

          const filterUser = (jobs: any[]) => jobs.filter(j => j.data?.userId === ctx.senderId);

          const myWaiting = filterUser(waiting);
          const myActive = filterUser(active);
          const myFailed = filterUser(failed);
          const myCompleted = filterUser(completed);

          if (myActive.length > 0 || myWaiting.length > 0 || myFailed.length > 0 || myCompleted.length > 0) {
            found = true;
            msg += `*Antrian: ${queue.getName()}*\n`;
            if (myActive.length > 0) {
              msg += `🟢 *Aktif:*\n` + myActive.map(j => `  - ID: ${j.id}\n    Data: ${JSON.stringify(j.data)}`).join('\n') + '\n';
            }
            if (myWaiting.length > 0) {
              msg += `⏳ *Menunggu:*\n` + myWaiting.map(j => `  - ID: ${j.id}\n    Data: ${JSON.stringify(j.data)}`).join('\n') + '\n';
            }
            if (myFailed.length > 0) {
              msg += `🔴 *Gagal:*\n` + myFailed.map(j => `  - ID: ${j.id}\n    Retries: ${j.retries}`).join('\n') + '\n';
            }
            if (myCompleted.length > 0) {
              msg += `✅ *Selesai:*\n` + myCompleted.map(j => `  - ID: ${j.id}`).join('\n') + '\n';
            }
            msg += '\n';
          }
        }

        if (!found) {
          await adapter.sendMessage(ctx.chatId, 'ℹ️ Anda tidak memiliki pekerjaan dalam antrian.', { quotedMessageId: ctx.id });
          return;
        }

        await adapter.sendMessage(ctx.chatId, msg.trim(), { quotedMessageId: ctx.id });
        return;
      }

      // Rest of /queue options are owner-only
      if (!isOwner(ctx.senderId)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya dapat diakses oleh Owner bot.', { quotedMessageId: ctx.id });
        return;
      }

      // Owner dashboard queue list
      let msg = `📊 *MONITORING ANTRIAN SISTEM*\n\n`;
      for (const queue of queues) {
        msg += `📦 *Antrian: ${queue.getName()}* [${queue.isQueuePaused() ? '⏸️ PAUSED' : '▶️ RUNNING'}]\n` +
          `• Menunggu: ${queue.getLength()} pekerjaan\n` +
          `• Aktif: ${queue.getActiveJobs().length} pekerjaan\n` +
          `• Gagal: ${queue.getFailedJobs().length} pekerjaan\n` +
          `• Selesai: ${queue.getCompletedJobs().length} pekerjaan\n\n`;
      }
      await adapter.sendMessage(ctx.chatId, msg.trim(), { quotedMessageId: ctx.id });
      return;
    }

    // 2. /canceljob <id>
    if (commandType === 'canceljob') {
      const jobId = args[0]?.trim();
      if (!jobId) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/canceljob <id>`', { quotedMessageId: ctx.id });
        return;
      }

      let cancelled = false;
      let targetJobOwner = '';

      // Find job first to check ownership
      for (const queue of queues) {
        const waiting = await queue.list();
        const job = waiting.find(j => j.id === jobId);
        if (job) {
          targetJobOwner = job.data?.userId;
          if (isOwner(ctx.senderId) || targetJobOwner === ctx.senderId) {
            cancelled = await queue.cancel(jobId);
            if (cancelled) break;
          }
        }
      }

      if (cancelled) {
        await adapter.sendMessage(ctx.chatId, `✅ Pekerjaan *${jobId}* berhasil dibatalkan dari antrian.`, { quotedMessageId: ctx.id });
      } else {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal membatalkan pekerjaan *${jobId}*. Mungkin pekerjaan tidak ada, sudah berjalan, atau Anda tidak memiliki izin.`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 3. /job <id>
    if (commandType === 'job') {
      const jobId = args[0]?.trim();
      if (!jobId) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/job <id>`', { quotedMessageId: ctx.id });
        return;
      }

      let status = 'not_found';
      let foundJob: any = null;

      for (const queue of queues) {
        const jobStatus = await queue.status(jobId);
        if (jobStatus !== 'not_found') {
          status = jobStatus;
          const waiting = await queue.list();
          const active = queue.getActiveJobs();
          const failed = queue.getFailedJobs();
          const completed = queue.getCompletedJobs();
          foundJob = waiting.find(j => j.id === jobId) ||
                     active.find(j => j.id === jobId) ||
                     failed.find(j => j.id === jobId) ||
                     completed.find(j => j.id === jobId);
          break;
        }
      }

      if (status === 'not_found' || !foundJob) {
        await adapter.sendMessage(ctx.chatId, `❌ Pekerjaan dengan ID *${jobId}* tidak ditemukan.`, { quotedMessageId: ctx.id });
        return;
      }

      // Check permissions: Owner or job owner
      if (!isOwner(ctx.senderId) && foundJob.data?.userId !== ctx.senderId) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Anda tidak memiliki akses untuk melihat detail pekerjaan ini.', { quotedMessageId: ctx.id });
        return;
      }

      const statusMap: Record<string, string> = {
        active: '🟢 Aktif / Sedang Berjalan',
        waiting: '⏳ Menunggu dalam Antrian',
        failed: '🔴 Gagal',
        completed: '✅ Selesai'
      };

      const msg = `ℹ️ *STATUS PEKERJAAN ANTRIAN*\n\n` +
        `• *ID:* ${foundJob.id}\n` +
        `• *Status:* ${statusMap[status] || status}\n` +
        `• *Retries:* ${foundJob.retries || 0}\n` +
        `• *Data:* ${JSON.stringify(foundJob.data || {})}`;

      await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      return;
    }
  }
}

const queueSuite = new QueueSuiteCommand();
registerCommand(['queue', 'canceljob', 'job'], queueSuite);
