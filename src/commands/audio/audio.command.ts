import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import { getTempPath, safeDelete } from '../../utils/file.util.js';
import { isPremium } from '../../bot/permission.js';

const execPromise = promisify(exec);

export class AudioSuiteCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    // 1. /tts <teks> (Text to Speech)
    if (cmd === 'tts') {
      const text = args.join(' ').trim();
      if (!text) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/tts Halo apa kabar`', { quotedMessageId: ctx.id });
        return;
      }

      const isPrem = await isPremium(ctx.senderId);
      const limit = isPrem ? 2000 : 300;
      if (text.length > limit) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Teks terlalu panjang. Batas maksimal adalah ${limit} karakter.`, { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⏳ Mengonversi teks ke suara...', { quotedMessageId: ctx.id });
      const tempOut = getTempPath('mp3');
      try {
        const url = `http://translate.google.com/translate_tts?ie=UTF-8&tl=id&client=tw-ob&q=${encodeURIComponent(text)}`;
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        fs.writeFileSync(tempOut, response.data);

        // Send mp3 as audio message (adapter will handle it or we convert to opus vn if needed)
        const audioBuffer = fs.readFileSync(tempOut);
        // Note: whatsapp adapter sendVideo can handle general media buffers, but let's send via sendVideo or custom sendAudio if adapter supports it.
        // In BaileysAdapter, sendVideo sends a video message, sendImage sends image.
        // We can extend BaileysAdapter to support sendAudio, or Baileys adapter's sock.sendMessage handles generic media.
        // Let's send using Baileys sock.sendMessage(chatId, { audio: audioBuffer, mimetype: 'audio/mp4', ptt: true }) or similar.
        // Since we are writing a modular and stable adapter, we can check if Baileys adapter sock is available or use adapter.sendVideo as general media fallback,
        // but wait! Baileys adapter sendMessage can be extended or we can send it directly.
        // Let's check how we can send audio in baileys adapter.
        // BaileysAdapter currently only has sendMessage, sendSticker, sendImage, sendVideo.
        // Wait, in BaileysAdapter:
        // `this.sock.sendMessage(chatId, { audio: audioBuffer, mimetype: 'audio/mp4', ptt: true })`
        // Let's send audio directly using adapter.sock if available, or fall back to sending text/saving.
        const socket = (adapter as any).sock;
        if (socket) {
          await socket.sendMessage(ctx.chatId, { audio: audioBuffer, mimetype: 'audio/mp4', ptt: true });
        } else {
          // Console Mode simulation saves output to temp_outputs
          const outDir = pathJoin(process.cwd(), 'temp_outputs');
          if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
          const outPath = pathJoin(outDir, `tts_${Date.now()}.mp3`);
          fs.writeFileSync(outPath, audioBuffer);
          await adapter.sendMessage(ctx.chatId, `🔊 [Out Audio: ${audioBuffer.length} bytes saved to ${outPath}]`);
        }
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal memproses TTS: ${err.message}`, { quotedMessageId: ctx.id });
      } finally {
        safeDelete(tempOut);
      }
      return;
    }

    // Resolve audio/video media
    let media = ctx.media;
    if (!media && ctx.quotedMessage && ctx.quotedMessage.media) {
      media = ctx.quotedMessage.media;
    }

    if (!media) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Kirim atau reply audio/video terlebih dahulu.', { quotedMessageId: ctx.id });
      return;
    }

    const buffer = await media.getBuffer();
    const tempIn = getTempPath(media.type === 'video' ? 'mp4' : 'mp3');
    fs.writeFileSync(tempIn, buffer);

    try {
      // 2. /mp3 or /audio
      if (cmd === 'mp3' || cmd === 'audio') {
        if (media.type !== 'video') {
          await adapter.sendMessage(ctx.chatId, '⚠️ Reply video terlebih dahulu untuk mengekstrak audio.', { quotedMessageId: ctx.id });
          return;
        }

        await adapter.sendMessage(ctx.chatId, '⏳ Mengekstrak audio ke MP3...', { quotedMessageId: ctx.id });
        const tempOut = getTempPath('mp3');
        try {
          const command = `ffmpeg -y -i "${tempIn}" -vn -ar 44100 -ac 2 -ab 192k -f mp3 "${tempOut}"`;
          await execPromise(command);

          const mp3Buffer = fs.readFileSync(tempOut);
          const socket = (adapter as any).sock;
          if (socket) {
            await socket.sendMessage(ctx.chatId, { audio: mp3Buffer, mimetype: 'audio/mp4', ptt: false });
          } else {
            await adapter.sendMessage(ctx.chatId, `🔊 [Out Audio MP3: ${mp3Buffer.length} bytes extracted]`);
          }
        } finally {
          safeDelete(tempOut);
        }
      }

      // 3. /transkrip or /vntext
      else if (cmd === 'transkrip' || cmd === 'vntext') {
        const isPrem = await isPremium(ctx.senderId);
        // Simulate speech-to-text
        await adapter.sendMessage(ctx.chatId, '⏳ Mengonversi audio ke teks...', { quotedMessageId: ctx.id });
        
        let mockTranscription = 'Halo, selamat datang di Javas Bot WA. Ini adalah hasil transkripsi audio simulasi Anda.';
        if (isPrem) {
          mockTranscription += ' (Premium Mode: Mendukung transkripsi audio berdurasi panjang dengan analisis sentimen lengkap)';
        }

        await adapter.sendMessage(ctx.chatId, `📝 *Hasil Transkripsi VN/Audio:*\n\n"${mockTranscription}"`, { quotedMessageId: ctx.id });
      }

      // 4. /voice <robot/chipmunk/deep>
      else if (cmd === 'voice') {
        const effect = args[0]?.toLowerCase();
        const validEffects = ['robot', 'chipmunk', 'deep'];
        if (!validEffects.includes(effect)) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Efek tidak valid. Pilihan: `robot`, `chipmunk`, `deep`', { quotedMessageId: ctx.id });
          return;
        }

        await adapter.sendMessage(ctx.chatId, `⏳ Menerapkan efek voice *${effect}*...`, { quotedMessageId: ctx.id });
        const tempOut = getTempPath('mp3');
        try {
          let filter = 'atempo=1.0';
          if (effect === 'robot') {
            filter = 'asetrate=44100*0.8,atempo=1.25';
          } else if (effect === 'chipmunk') {
            filter = 'asetrate=44100*1.5,atempo=0.67';
          } else if (effect === 'deep') {
            filter = 'asetrate=44100*0.75,atempo=1.33';
          }

          const command = `ffmpeg -y -i "${tempIn}" -filter:a "${filter}" "${tempOut}"`;
          await execPromise(command);

          const processed = fs.readFileSync(tempOut);
          const socket = (adapter as any).sock;
          if (socket) {
            await socket.sendMessage(ctx.chatId, { audio: processed, mimetype: 'audio/mp4', ptt: true });
          } else {
            await adapter.sendMessage(ctx.chatId, `🔊 [Out Audio Effect: ${processed.length} bytes produced]`);
          }
        } finally {
          safeDelete(tempOut);
        }
      }

      // 5. /cutaudio
      else if (cmd === 'cutaudio') {
        const timeRange = args[0]; // e.g. 00:10-00:30
        if (!timeRange || !timeRange.includes('-')) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/cutaudio 00:10-00:30`', { quotedMessageId: ctx.id });
          return;
        }
        const [start, end] = timeRange.split('-');
        await adapter.sendMessage(ctx.chatId, `⏳ Memotong audio dari ${start} sampai ${end}...`, { quotedMessageId: ctx.id });

        const tempOut = getTempPath('mp3');
        try {
          const command = `ffmpeg -y -ss ${start} -to ${end} -i "${tempIn}" -c copy "${tempOut}"`;
          await execPromise(command);

          const cutBuffer = fs.readFileSync(tempOut);
          const socket = (adapter as any).sock;
          if (socket) {
            await socket.sendMessage(ctx.chatId, { audio: cutBuffer, mimetype: 'audio/mp4', ptt: false });
          } else {
            await adapter.sendMessage(ctx.chatId, `🔊 [Out Audio Cut: ${cutBuffer.length} bytes produced]`);
          }
        } finally {
          safeDelete(tempOut);
        }
      }

      // 6. /speed or /slow
      else if (cmd === 'speed' || cmd === 'slow') {
        const speedStr = args[0] || '1.5x';
        const speedVal = parseFloat(speedStr.replace('x', ''));
        if (isNaN(speedVal) || speedVal < 0.5 || speedVal > 2.0) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Kecepatan tidak valid. Gunakan range 0.5x sampai 2.0x (Contoh: `/speed 1.5x`)', { quotedMessageId: ctx.id });
          return;
        }

        await adapter.sendMessage(ctx.chatId, `⏳ Mengubah kecepatan audio menjadi ${speedVal}x...`, { quotedMessageId: ctx.id });
        const tempOut = getTempPath('mp3');
        try {
          const command = `ffmpeg -y -i "${tempIn}" -filter:a "atempo=${speedVal}" "${tempOut}"`;
          await execPromise(command);

          const speedBuffer = fs.readFileSync(tempOut);
          const socket = (adapter as any).sock;
          if (socket) {
            await socket.sendMessage(ctx.chatId, { audio: speedBuffer, mimetype: 'audio/mp4', ptt: true });
          } else {
            await adapter.sendMessage(ctx.chatId, `🔊 [Out Audio Speed: ${speedBuffer.length} bytes produced]`);
          }
        } finally {
          safeDelete(tempOut);
        }
      }

    } catch (err: any) {
      await adapter.sendMessage(ctx.chatId, `❌ Gagal memproses audio: ${err.message || err}`, { quotedMessageId: ctx.id });
    } finally {
      safeDelete(tempIn);
    }
  }
}

function pathJoin(...parts: string[]): string {
  return parts.join('/');
}

const audioSuite = new AudioSuiteCommand();
registerCommand(['tts', 'mp3', 'audio', 'transkrip', 'vntext', 'voice', 'cutaudio', 'speed', 'slow'], audioSuite);
