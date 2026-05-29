import { Command, registerCommand } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import { downloadMedia, isValidUrl } from '../services/downloader/downloader.service.js';
import { downloaderQueue } from '../queues/queue.js';
import { safeDelete } from '../utils/file.util.js';
import fs from 'fs';

export class DownloaderCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const url = args[0]?.trim();
    if (!url) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/tt <url>` atau `/ig <url>`', { quotedMessageId: ctx.id });
      return;
    }

    if (!isValidUrl(url)) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Link tidak valid. Kirim link TikTok/Instagram publik.', { quotedMessageId: ctx.id });
      return;
    }

    // Send loading feedback
    await adapter.sendMessage(ctx.chatId, '⏳ Sedang mengunduh media...', { quotedMessageId: ctx.id });

    const jobId = `downloader-${ctx.id}`;

    await downloaderQueue.add({
      id: jobId,
      data: { url },
      process: async () => {
        const result = await downloadMedia(url);
        
        try {
          if (result.type === 'video') {
            const file = result.files[0];
            const buffer = fs.readFileSync(file.path);
            await adapter.sendVideo(ctx.chatId, buffer, result.title, { quotedMessageId: ctx.id });
          } else {
            // Images / Slideshow
            for (let i = 0; i < result.files.length; i++) {
              const file = result.files[i];
              const buffer = fs.readFileSync(file.path);
              const caption = result.files.length > 1 ? `${result.title} (${i + 1}/${result.files.length})` : result.title;
              await adapter.sendImage(ctx.chatId, buffer, caption, { quotedMessageId: ctx.id });
            }
          }
        } finally {
          // Auto clean up temporary files immediately after sending
          for (const file of result.files) {
            safeDelete(file.path);
          }
        }
      },
      onFailure: async (err) => {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal mengunduh media: ${err.message || 'Terjadi kesalahan sistem.'}`, { quotedMessageId: ctx.id });
      }
    });
  }
}

// Register commands
const downloaderCmd = new DownloaderCommand();
registerCommand(['tt', 'tiktok', 'ig', 'instagram'], downloaderCmd);
