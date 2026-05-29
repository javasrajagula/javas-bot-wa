import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import sharp from 'sharp';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getTempPath, safeDelete } from '../../utils/file.util.js';
import { enhanceImage } from '../../services/hd/hd.service.js';
import { isPremium } from '../../bot/permission.js';

const execPromise = promisify(exec);

export class MediaSuiteCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    // 1. /hd (Image quality enhancer)
    if (cmd === 'hd') {
      let media = ctx.media;
      if (!media && ctx.quotedMessage && ctx.quotedMessage.media) {
        media = ctx.quotedMessage.media;
      }

      if (!media || (media.type !== 'image' && media.type !== 'sticker')) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Reply/kirim gambar dulu, lalu pakai command ini.', { quotedMessageId: ctx.id });
        return;
      }

      let scale: 2 | 4 = 2;
      if (args[0] === '4x') {
        scale = 4;
        const premium = await isPremium(ctx.senderId);
        if (!premium) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Mode HD 4x (berat) hanya tersedia untuk pengguna Premium.', { quotedMessageId: ctx.id });
          return;
        }
      }

      await adapter.sendMessage(ctx.chatId, '🔄 Sedang meningkatkan kualitas gambar...', { quotedMessageId: ctx.id });
      try {
        const buffer = await media.getBuffer();
        const enhanced = await enhanceImage(buffer, { scale });
        await adapter.sendImage(ctx.chatId, enhanced, `Enhanced ${scale}x.`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal memproses gambar: ${err.message || err}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // Resolve media from context
    let media = ctx.media;
    if (!media && ctx.quotedMessage && ctx.quotedMessage.media) {
      media = ctx.quotedMessage.media;
    }

    if (!media) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Kirim atau reply gambar/video terlebih dahulu.', { quotedMessageId: ctx.id });
      return;
    }

    const buffer = await media.getBuffer();

    // 2. /compress or /kompres
    if (cmd === 'compress' || cmd === 'kompres') {
      const level = args[0]?.toLowerCase() || 'medium'; // low, medium, high
      await adapter.sendMessage(ctx.chatId, '⏳ Mengompres file...', { quotedMessageId: ctx.id });

      if (media.type === 'image') {
        try {
          let quality = 70;
          if (level === 'high') quality = 30;
          if (level === 'low') quality = 90;

          const compressed = await sharp(buffer).jpeg({ quality }).toBuffer();
          await adapter.sendImage(ctx.chatId, compressed, 'Gambar berhasil dikompres.', { quotedMessageId: ctx.id });
        } catch (err) {
          await adapter.sendMessage(ctx.chatId, '❌ Gagal mengompres gambar.', { quotedMessageId: ctx.id });
        }
      } else if (media.type === 'video') {
        const tempIn = getTempPath('mp4');
        const tempOut = getTempPath('mp4');
        try {
          fs.writeFileSync(tempIn, buffer);
          let crf = 28;
          if (level === 'high') crf = 35;
          if (level === 'low') crf = 22;

          const command = `ffmpeg -y -i "${tempIn}" -vcodec libx264 -crf ${crf} -preset fast -acodec copy "${tempOut}"`;
          await execPromise(command);

          const compressed = fs.readFileSync(tempOut);
          await adapter.sendVideo(ctx.chatId, compressed, 'Video berhasil dikompres.', { quotedMessageId: ctx.id });
        } catch (err) {
          await adapter.sendMessage(ctx.chatId, '❌ Gagal mengompres video. Pastikan FFmpeg terinstall.', { quotedMessageId: ctx.id });
        } finally {
          safeDelete(tempIn);
          safeDelete(tempOut);
        }
      }
      return;
    }

    // 3. /resize
    if (cmd === 'resize') {
      const presetOrDim = args[0]?.toLowerCase();
      if (!presetOrDim) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/resize 1080x1080` atau `/resize story` (story|feed|profile|wallpaper)', { quotedMessageId: ctx.id });
        return;
      }

      let w = 1080, h = 1080;
      if (presetOrDim === 'story') { w = 1080; h = 1920; }
      else if (presetOrDim === 'feed') { w = 1080; h = 1080; }
      else if (presetOrDim === 'profile') { w = 720; h = 720; }
      else if (presetOrDim === 'wallpaper') { w = 1080; h = 2400; }
      else if (presetOrDim.includes('x')) {
        const parts = presetOrDim.split('x');
        w = parseInt(parts[0], 10);
        h = parseInt(parts[1], 10);
      }

      if (isNaN(w) || isNaN(h)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Dimensi tidak valid.', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `⏳ Mengubah ukuran menjadi ${w}x${h}...`, { quotedMessageId: ctx.id });

      try {
        const resized = await sharp(buffer).resize(w, h, { fit: 'fill' }).toBuffer();
        await adapter.sendImage(ctx.chatId, resized, `Resized to ${w}x${h}.`, { quotedMessageId: ctx.id });
      } catch (err) {
        await adapter.sendMessage(ctx.chatId, '❌ Gagal meresize gambar.', { quotedMessageId: ctx.id });
      }
      return;
    }

    // 4. /crop
    if (cmd === 'crop') {
      const ratio = args[0]?.toLowerCase() || 'square';
      let w = 500, h = 500;
      if (ratio === 'story') { w = 1080; h = 1920; }
      else if (ratio === 'pp') { w = 500; h = 500; }

      await adapter.sendMessage(ctx.chatId, `⏳ Memotong gambar (${ratio})...`, { quotedMessageId: ctx.id });
      try {
        const cropped = await sharp(buffer).resize(w, h, { fit: 'cover' }).toBuffer();
        await adapter.sendImage(ctx.chatId, cropped, 'Gambar berhasil dipotong.', { quotedMessageId: ctx.id });
      } catch (err) {
        await adapter.sendMessage(ctx.chatId, '❌ Gagal memotong gambar.', { quotedMessageId: ctx.id });
      }
      return;
    }

    // 5. /wm
    if (cmd === 'wm') {
      const text = args.join(' ').trim() || 'Javas Bot';
      await adapter.sendMessage(ctx.chatId, '⏳ Menambahkan watermark...', { quotedMessageId: ctx.id });

      if (media.type === 'image') {
        try {
          const svg = `
            <svg width="500" height="50">
              <text x="490" y="35" font-family="Arial" font-size="24" fill="white" opacity="0.6" text-anchor="end">
                ${text}
              </text>
            </svg>
          `;
          const watermarked = await sharp(buffer)
            .composite([{ input: Buffer.from(svg), gravity: 'southeast' }])
            .toBuffer();

          await adapter.sendImage(ctx.chatId, watermarked, 'Watermark berhasil ditambahkan.', { quotedMessageId: ctx.id });
        } catch (err) {
          await adapter.sendMessage(ctx.chatId, '❌ Gagal menambahkan watermark.', { quotedMessageId: ctx.id });
        }
      } else if (media.type === 'video') {
        const tempIn = getTempPath('mp4');
        const tempOut = getTempPath('mp4');
        try {
          fs.writeFileSync(tempIn, buffer);
          const command = `ffmpeg -y -i "${tempIn}" -vf "drawtext=text='${text}':x=w-tw-10:y=h-th-10:fontsize=24:fontcolor=white@0.6" -codec:a copy "${tempOut}"`;
          await execPromise(command);

          const wmVideo = fs.readFileSync(tempOut);
          await adapter.sendVideo(ctx.chatId, wmVideo, 'Video watermark berhasil.', { quotedMessageId: ctx.id });
        } catch (err) {
          await adapter.sendMessage(ctx.chatId, '❌ Gagal menambahkan watermark ke video.', { quotedMessageId: ctx.id });
        } finally {
          safeDelete(tempIn);
          safeDelete(tempOut);
        }
      }
      return;
    }

    // Video only commands
    if (media.type !== 'video') {
      await adapter.sendMessage(ctx.chatId, '⚠️ Fitur ini hanya dapat digunakan untuk konten video.', { quotedMessageId: ctx.id });
      return;
    }

    const tempIn = getTempPath('mp4');
    fs.writeFileSync(tempIn, buffer);

    try {
      // 6. /togif
      if (cmd === 'togif') {
        const isPrem = await isPremium(ctx.senderId);
        const maxSecs = isPrem ? 30 : 10;
        await adapter.sendMessage(ctx.chatId, `⏳ Mengonversi video ke GIF (max ${maxSecs}s)...`, { quotedMessageId: ctx.id });

        const tempOut = getTempPath('gif');
        try {
          const command = `ffmpeg -y -i "${tempIn}" -t ${maxSecs} -vf "fps=10,scale=320:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" "${tempOut}"`;
          await execPromise(command);
          const gif = fs.readFileSync(tempOut);
          await adapter.sendImage(ctx.chatId, gif, 'Video berhasil diubah ke GIF.', { quotedMessageId: ctx.id });
        } finally {
          safeDelete(tempOut);
        }
      }

      // 7. /thumb
      else if (cmd === 'thumb') {
        const time = args[0] || '00:00:01';
        await adapter.sendMessage(ctx.chatId, `⏳ Mengambil thumbnail pada ${time}...`, { quotedMessageId: ctx.id });

        const tempOut = getTempPath('jpg');
        try {
          const command = `ffmpeg -y -ss ${time} -i "${tempIn}" -vframes 1 -q:v 2 "${tempOut}"`;
          await execPromise(command);
          const thumb = fs.readFileSync(tempOut);
          await adapter.sendImage(ctx.chatId, thumb, `Thumbnail pada ${time}.`, { quotedMessageId: ctx.id });
        } finally {
          safeDelete(tempOut);
        }
      }

      // 8. /cut
      else if (cmd === 'cut') {
        const timeRange = args[0]; // e.g. 00:05-00:15
        if (!timeRange || !timeRange.includes('-')) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/cut 00:05-00:15`', { quotedMessageId: ctx.id });
          return;
        }

        const [start, end] = timeRange.split('-');
        await adapter.sendMessage(ctx.chatId, `⏳ Memotong video dari ${start} sampai ${end}...`, { quotedMessageId: ctx.id });

        const tempOut = getTempPath('mp4');
        try {
          const command = `ffmpeg -y -ss ${start} -to ${end} -i "${tempIn}" -c copy "${tempOut}"`;
          await execPromise(command);
          const cutVideo = fs.readFileSync(tempOut);
          await adapter.sendVideo(ctx.chatId, cutVideo, `Video berhasil dipotong.`, { quotedMessageId: ctx.id });
        } finally {
          safeDelete(tempOut);
        }
      }

      // 9. /subtitle
      else if (cmd === 'subtitle') {
        // Enforce premium
        const prem = await isPremium(ctx.senderId);
        if (!prem) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Fitur subtitle otomatis hanya tersedia untuk pengguna Premium.', { quotedMessageId: ctx.id });
          return;
        }

        await adapter.sendMessage(ctx.chatId, '⏳ Menambahkan subtitle otomatis (simulasi)...', { quotedMessageId: ctx.id });
        const tempOut = getTempPath('mp4');
        try {
          // Simulate sub overlay drawtext
          const command = `ffmpeg -y -i "${tempIn}" -vf "drawtext=text='[Transkrip Subtitle Javas Bot]':x=(w-tw)/2:y=h-80:fontsize=22:fontcolor=yellow:box=1:boxcolor=black@0.5" -codec:a copy "${tempOut}"`;
          await execPromise(command);
          const subVideo = fs.readFileSync(tempOut);
          await adapter.sendVideo(ctx.chatId, subVideo, 'Video dengan subtitle berhasil diproduksi.', { quotedMessageId: ctx.id });
        } finally {
          safeDelete(tempOut);
        }
      }

      // 10. /mute
      else if (cmd === 'mute') {
        await adapter.sendMessage(ctx.chatId, '⏳ Menghapus audio video...', { quotedMessageId: ctx.id });
        const tempOut = getTempPath('mp4');
        try {
          const command = `ffmpeg -y -i "${tempIn}" -an -vcodec copy "${tempOut}"`;
          await execPromise(command);
          const mutedVideo = fs.readFileSync(tempOut);
          await adapter.sendVideo(ctx.chatId, mutedVideo, 'Video berhasil dimute.', { quotedMessageId: ctx.id });
        } finally {
          safeDelete(tempOut);
        }
      }

      // 11. /reverse
      else if (cmd === 'reverse') {
        await adapter.sendMessage(ctx.chatId, '⏳ Memutar balik video...', { quotedMessageId: ctx.id });
        const tempOut = getTempPath('mp4');
        try {
          const command = `ffmpeg -y -i "${tempIn}" -vf reverse -af areverse "${tempOut}"`;
          await execPromise(command);
          const reversedVideo = fs.readFileSync(tempOut);
          await adapter.sendVideo(ctx.chatId, reversedVideo, 'Video berhasil diputar balik.', { quotedMessageId: ctx.id });
        } finally {
          safeDelete(tempOut);
        }
      }

    } catch (err: any) {
      await adapter.sendMessage(ctx.chatId, `❌ Gagal memproses media: ${err.message || err}`, { quotedMessageId: ctx.id });
    } finally {
      safeDelete(tempIn);
    }
  }
}

const mediaSuite = new MediaSuiteCommand();
registerCommand(
  ['hd', 'compress', 'kompres', 'resize', 'crop', 'wm', 'togif', 'thumb', 'cut', 'subtitle', 'mute', 'reverse'],
  mediaSuite
);
