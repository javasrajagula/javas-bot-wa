import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import fs from 'fs';
import axios from 'axios';
import { getTempPath, safeDelete } from '../../utils/file.util.js';
import { isPremium } from '../../bot/permission.js';
import { runFfmpeg } from '../../services/ffmpeg/ffmpeg.service.js';
import { transcribeAudio } from '../../services/stt/stt.service.js';
import { parseTimeToSeconds, validateSpeed, validateTimestamp } from '../../validators/media.validator.js';

export class AudioSuiteCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    if (cmd === 'tts') {
      const text = args.join(' ').trim();
      if (!text) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/tts Halo apa kabar`', { quotedMessageId: ctx.id });
        return;
      }

      const limit = (await isPremium(ctx.senderId)) ? 2000 : 300;
      if (text.length > limit) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Teks terlalu panjang. Batas maksimal adalah ${limit} karakter.`, { quotedMessageId: ctx.id });
        return;
      }

      const tempOut = getTempPath('mp3');
      try {
        const url = `http://translate.google.com/translate_tts?ie=UTF-8&tl=id&client=tw-ob&q=${encodeURIComponent(text)}`;
        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
        await fs.promises.writeFile(tempOut, response.data);
        await adapter.sendVoiceNote(ctx.chatId, await fs.promises.readFile(tempOut), { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal memproses TTS: ${err.message}`, { quotedMessageId: ctx.id });
      } finally {
        safeDelete(tempOut);
      }
      return;
    }

    const media = ctx.media || ctx.quotedMessage?.media;
    if (!media) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Kirim atau reply audio/video terlebih dahulu.', { quotedMessageId: ctx.id });
      return;
    }

    const buffer = await media.getBuffer();
    const tempIn = getTempPath(media.type === 'video' ? 'mp4' : 'mp3');
    await fs.promises.writeFile(tempIn, buffer);

    try {
      if (cmd === 'mp3' || cmd === 'audio') {
        if (media.type !== 'video') {
          await adapter.sendMessage(ctx.chatId, '⚠️ Reply video terlebih dahulu untuk mengekstrak audio.', { quotedMessageId: ctx.id });
          return;
        }

        const tempOut = getTempPath('mp3');
        try {
          await runFfmpeg(['-y', '-i', tempIn, '-vn', '-ar', '44100', '-ac', '2', '-ab', '192k', '-f', 'mp3', tempOut]);
          await adapter.sendAudio(ctx.chatId, await fs.promises.readFile(tempOut), { quotedMessageId: ctx.id });
        } finally {
          safeDelete(tempOut);
        }
        return;
      }

      if (cmd === 'transkrip' || cmd === 'vntext') {
        const limit = (await isPremium(ctx.senderId)) ? 25 * 1024 * 1024 : 8 * 1024 * 1024;
        if (buffer.length > limit) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Ukuran audio melebihi batas transkripsi ${Math.round(limit / 1024 / 1024)} MB.`, { quotedMessageId: ctx.id });
          return;
        }

        try {
          const transcription = await transcribeAudio(buffer, media.type === 'video' ? 'mp4' : 'mp3');
          await adapter.sendMessage(ctx.chatId, `📝 *Hasil Transkripsi VN/Audio:*\n\n${transcription || '(kosong)'}`, { quotedMessageId: ctx.id });
        } catch (err: any) {
          await adapter.sendMessage(ctx.chatId, `⚠️ ${err.message}`, { quotedMessageId: ctx.id });
        }
        return;
      }

      if (cmd === 'voice') {
        const effect = args[0]?.toLowerCase();
        const filters: Record<string, string> = {
          robot: 'asetrate=44100*0.8,atempo=1.25',
          chipmunk: 'asetrate=44100*1.5,atempo=0.67',
          deep: 'asetrate=44100*0.75,atempo=1.33'
        };
        if (!effect || !filters[effect]) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Efek tidak valid. Pilihan: `robot`, `chipmunk`, `deep`', { quotedMessageId: ctx.id });
          return;
        }

        const tempOut = getTempPath('mp3');
        try {
          await runFfmpeg(['-y', '-i', tempIn, '-filter:a', filters[effect], tempOut]);
          await adapter.sendVoiceNote(ctx.chatId, await fs.promises.readFile(tempOut), { quotedMessageId: ctx.id });
        } finally {
          safeDelete(tempOut);
        }
        return;
      }

      if (cmd === 'cutaudio') {
        const timeRange = args[0];
        if (!timeRange || !timeRange.includes('-')) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/cutaudio 00:10-00:30`', { quotedMessageId: ctx.id });
          return;
        }

        const [start, end] = timeRange.split('-');
        if (!validateTimestamp(start) || !validateTimestamp(end)) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format waktu tidak valid. Gunakan HH:MM:SS, MM:SS, atau detik.', { quotedMessageId: ctx.id });
          return;
        }

        const duration = parseTimeToSeconds(end) - parseTimeToSeconds(start);
        const maxDuration = (await isPremium(ctx.senderId)) ? 600 : 60;
        if (duration <= 0 || duration > maxDuration) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Durasi pemotongan harus 1-${maxDuration} detik.`, { quotedMessageId: ctx.id });
          return;
        }

        const tempOut = getTempPath('mp3');
        try {
          await runFfmpeg(['-y', '-ss', start, '-to', end, '-i', tempIn, '-c', 'copy', tempOut]);
          await adapter.sendAudio(ctx.chatId, await fs.promises.readFile(tempOut), { quotedMessageId: ctx.id });
        } finally {
          safeDelete(tempOut);
        }
        return;
      }

      if (cmd === 'speed' || cmd === 'slow') {
        const speedVal = parseFloat((args[0] || (cmd === 'slow' ? '0.75x' : '1.5x')).replace('x', ''));
        try {
          validateSpeed(speedVal);
        } catch (err: any) {
          await adapter.sendMessage(ctx.chatId, `⚠️ ${err.message}`, { quotedMessageId: ctx.id });
          return;
        }

        const tempOut = getTempPath('mp3');
        try {
          await runFfmpeg(['-y', '-i', tempIn, '-filter:a', `atempo=${speedVal}`, tempOut]);
          await adapter.sendVoiceNote(ctx.chatId, await fs.promises.readFile(tempOut), { quotedMessageId: ctx.id });
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

const audioSuite = new AudioSuiteCommand();
registerCommand(['tts', 'mp3', 'audio', 'transkrip', 'vntext', 'voice', 'cutaudio', 'speed', 'slow'], audioSuite);
