import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';

export class StickerCreativeCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // 1. /sfilter [vintage/sketch/cyber]
    if (cmd === 'sfilter') {
      const filterName = args[0] || 'vintage';
      await adapter.sendMessage(ctx.chatId, `🎭 *Filter Stiker: ${filterName.toUpperCase()}* 🎭\n\nBalas stiker dengan perintah \`/sfilter [efek]\` untuk memberikan filter artistik pada stiker.`, { quotedMessageId: ctx.id });
      return;
    }

    // 2. /smeme [teks]
    if (cmd === 'smeme') {
      const text = args.join(' ').trim();
      if (!text) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tentukan teks meme untuk stiker. Contoh: `/smeme Kaget | Aku terkejut`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⏳ Membuat stiker meme dengan penempatan teks otomatis...', { quotedMessageId: ctx.id });
      return;
    }

    // 3. /togif
    if (cmd === 'togif') {
      await adapter.sendMessage(ctx.chatId, '🎬 *Stiker ke Video/GIF* 🎬\n\nBalas stiker animasi dengan perintah \`/togif\` untuk mengonversinya menjadi video pendek format MP4 atau animasi GIF.', { quotedMessageId: ctx.id });
      return;
    }

    // 4. /emojimix [emoji1] [emoji2]
    if (cmd === 'emojimix') {
      const emoji1 = args[0];
      const emoji2 = args[1];

      if (!emoji1 || !emoji2) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/emojimix 😭 😂`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `💫 Menggabungkan emoji *${emoji1}* + *${emoji2}* menjadi stiker mashup...`, { quotedMessageId: ctx.id });
      return;
    }
  }
}

const stickerCreativeCmd = new StickerCreativeCommand();
registerCommand(['sfilter', 'smeme', 'togif', 'emojimix'], stickerCreativeCmd);
