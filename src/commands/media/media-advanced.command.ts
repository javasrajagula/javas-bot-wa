import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import axios from 'axios';

export class MediaAdvancedCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // 1. /tts <teks>
    if (cmd === 'tts') {
      const text = args.join(' ').trim();
      if (!text) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan teks yang ingin diubah menjadi suara. Contoh: `/tts Halo selamat pagi`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⏳ Mengonversi teks ke audio...', { quotedMessageId: ctx.id });
      try {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=id&client=tw-ob&q=${encodeURIComponent(text)}`;
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 });
        await adapter.sendAudio(ctx.chatId, Buffer.from(res.data), { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal memproses TTS: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 2. /ssweb <url>
    if (cmd === 'ssweb') {
      let url = args[0]?.trim();
      if (!url) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan URL website. Contoh: `/ssweb https://google.com`', { quotedMessageId: ctx.id });
        return;
      }

      if (!url.startsWith('http')) {
        url = 'https://' + url;
      }

      await adapter.sendMessage(ctx.chatId, `⏳ Mengambil tangkapan layar website *${url}*...`, { quotedMessageId: ctx.id });
      try {
        const ssUrl = `https://image.thum.io/get/width/1024/crop/800/${url}`;
        const res = await axios.get(ssUrl, { responseType: 'arraybuffer', timeout: 15000 });
        await adapter.sendImage(ctx.chatId, Buffer.from(res.data), `📸 *Tangkapan Layar Web:* ${url}`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal mengambil screenshot: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 3. /steks <teks>
    if (cmd === 'steks') {
      const text = args.join(' ').trim();
      if (!text) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan teks untuk dijadikan stiker. Contoh: `/steks Halo Kawan`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⏳ Membuat stiker teks...', { quotedMessageId: ctx.id });
      try {
        const svgText = `
          <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
            <style>
              .text { font-family: sans-serif; font-size: 55px; font-weight: bold; fill: #ffffff; stroke: #000000; stroke-width: 6px; text-anchor: middle; dominant-baseline: middle; }
            </style>
            <text x="256" y="256" class="text">${text}</text>
          </svg>
        `;
        const sharp = (await import('sharp')).default;
        const buffer = await sharp(Buffer.from(svgText)).webp().toBuffer();
        await adapter.sendSticker(ctx.chatId, buffer, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal membuat stiker teks: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 4. /audioeffect
    if (cmd === 'audioeffect') {
      await adapter.sendMessage(ctx.chatId, '⚙️ *Efek Suara Audio* ⚙️\n\nBalas voice note/audio dengan \`/audioeffect reverb\` atau \`/audioeffect bass\`.', { quotedMessageId: ctx.id });
      return;
    }


    // 6. /collage
    if (cmd === 'collage') {
      await adapter.sendMessage(ctx.chatId, '🖼️ *Kolase Foto* 🖼️\n\nKirim beberapa foto secara berurutan lalu gunakan perintah \`/collage\` untuk menggabungkannya.', { quotedMessageId: ctx.id });
      return;
    }

    // 7. /convert
    if (cmd === 'convert') {
      await adapter.sendMessage(ctx.chatId, '🔄 *Konversi Media* 🔄\n\nBalas media (gambar/stiker) dengan \`/convert\` untuk melakukan konversi format media.', { quotedMessageId: ctx.id });
      return;
    }
  }
}

const mediaAdvancedCmd = new MediaAdvancedCommand();
registerCommand(
  ['tts', 'ssweb', 'steks', 'audioeffect', 'collage', 'convert'],
  mediaAdvancedCmd
);
