import { Command, registerCommand } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import { generateBratSticker } from '../services/media/brat.service.js';

export class BratCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const text = args.join(' ').trim();
    if (!text) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/brat aku sigma`', { quotedMessageId: ctx.id });
      return;
    }

    if (text.length > 80) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Teks terlalu panjang (maksimal 80 karakter).', { quotedMessageId: ctx.id });
      return;
    }

    try {
      const stickerBuffer = await generateBratSticker(text);
      await adapter.sendSticker(ctx.chatId, stickerBuffer, { quotedMessageId: ctx.id });
    } catch (err: any) {
      console.error('Failed to generate brat sticker:', err);
      await adapter.sendMessage(ctx.chatId, `❌ Gagal memproses stiker brat: ${err.message || err}`, { quotedMessageId: ctx.id });
    }
  }
}

// Register command
const bratCmd = new BratCommand();
registerCommand(['brat'], bratCmd);
