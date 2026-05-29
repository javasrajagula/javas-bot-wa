import { Command, registerCommand } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import { enhanceImage } from '../services/hd/hd.service.js';
import { hdQueue } from '../queues/queue.js';

export class HDCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    let media = ctx.media;
    if (!media && ctx.quotedMessage && ctx.quotedMessage.media) {
      media = ctx.quotedMessage.media;
    }

    if (!media || (media.type !== 'image' && media.type !== 'sticker')) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Reply/kirim gambar dulu, lalu pakai command ini.', { quotedMessageId: ctx.id });
      return;
    }

    // Default scale: 2x
    let scale: 2 | 4 = 2;
    if (args[0] === '4x') {
      scale = 4;
    }

    // Send immediate loading message
    await adapter.sendMessage(ctx.chatId, '🔄 Sedang meningkatkan kualitas gambar...', { quotedMessageId: ctx.id });

    // Enqueue the heavy job
    const jobId = `hd-${ctx.id}`;
    
    // Capture buffer outside the async job scope
    let imgBuffer: Buffer;
    try {
      imgBuffer = await media.getBuffer();
    } catch (err) {
      await adapter.sendMessage(ctx.chatId, '❌ Gagal mengunduh gambar dari chat.', { quotedMessageId: ctx.id });
      return;
    }

    await hdQueue.add({
      id: jobId,
      data: { scale },
      process: async () => {
        const enhanced = await enhanceImage(imgBuffer, { scale });
        await adapter.sendImage(ctx.chatId, enhanced, `Image enhanced ${scale}x.`, { quotedMessageId: ctx.id });
      },
      onFailure: async (err) => {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal memproses gambar: ${err.message || 'Terjadi kesalahan sistem.'}`, { quotedMessageId: ctx.id });
      }
    });
  }
}

// Register command
const hdCmd = new HDCommand();
registerCommand(['hd'], hdCmd);
