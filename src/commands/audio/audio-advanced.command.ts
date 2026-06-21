import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';

export class AudioAdvancedCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // 1. /findmusic
    if (cmd === 'findmusic') {
      await adapter.sendMessage(ctx.chatId, '🎙️ *Pencari Musik Shazam* 🎙️\n\nBalas rekaman audio/VN musik dengan perintah \`/findmusic\` untuk mencari detail judul lagunya.', { quotedMessageId: ctx.id });
      return;
    }

    // 2. /cutaudio [mulai] [durasi]
    if (cmd === 'cutaudio') {
      const start = args[0];
      const dur = args[1];

      if (!start || !dur) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/cutaudio 00:30 15` (potong mulai detik 30 selama 15 detik)', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `✂️ Memotong audio dari menit/detik *${start}* selama *${dur} detik*...`, { quotedMessageId: ctx.id });
      return;
    }

    // 3. /speedaudio [kecepatan]
    if (cmd === 'speedaudio') {
      const speed = parseFloat(args[0]) || 1.5;
      if (speed < 0.5 || speed > 2.0) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Batas kecepatan audio adalah antara 0.5x hingga 2.0x.', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `⚡ Mengubah kecepatan pemutaran berkas audio menjadi *${speed}x*...`, { quotedMessageId: ctx.id });
      return;
    }

    // 4. /mergeaudio
    if (cmd === 'mergeaudio') {
      await adapter.sendMessage(ctx.chatId, '🎙️ *Audio Merger* 🎙️\n\nKirim beberapa pesan suara secara berurutan lalu gunakan perintah \`/mergeaudio\` untuk menggabungkannya menjadi satu VN utuh.', { quotedMessageId: ctx.id });
      return;
    }

    // 5. /wave
    if (cmd === 'wave') {
      await adapter.sendMessage(ctx.chatId, '📽️ *Audio to Waveform* 📽️\n\nBalas berkas audio dengan perintah \`/wave\` untuk membuat animasi video gelombang gelombang suara (waveform).', { quotedMessageId: ctx.id });
      return;
    }
  }
}

const audioAdvancedCmd = new AudioAdvancedCommand();
registerCommand(['findmusic', 'cutaudio', 'speedaudio', 'mergeaudio', 'wave'], audioAdvancedCmd);
