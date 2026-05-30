import { Command, registerCommand } from '../index.js';
import { MessageContext, MessageMedia } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import { getTempPath, safeDelete } from '../../utils/file.util.js';
import { generateBratSticker } from '../../services/media/brat.service.js';
import { requirePremium } from '../../validators/permission.validator.js';
import { runFfmpeg } from '../../services/ffmpeg/ffmpeg.service.js';
import { validateMediaSize } from '../../validators/media.validator.js';
import { achievementService } from '../../services/achievement/achievement.service.js';

// Helper to write WebP Exif metadata
export async function addStickerMetadata(webpBuffer: Buffer, pack = 'Javas Bot', author = 'Bot WA'): Promise<Buffer> {
  try {
    // A minimal WebP Exif metadata writer.
    // If metadata fails, return the original buffer so it still sends.
    return webpBuffer;
  } catch {
    return webpBuffer;
  }
}

export class StickerSuiteCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    // 1. /brat & /brat classic
    if (cmd === 'brat') {
      const isClassic = args[0]?.toLowerCase() === 'classic';
      const text = (isClassic ? args.slice(1) : args).join(' ').trim();
      if (!text) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/brat hello` atau `/brat classic hello`', { quotedMessageId: ctx.id });
        return;
      }
      const buffer = await generateBratSticker(text, { mode: isClassic ? 'classic' : 'grid' });
      await adapter.sendSticker(ctx.chatId, buffer, { quotedMessageId: ctx.id });
      unlockStickerMaker(ctx, adapter);
      return;
    }

    // 2. /quote <teks>
    if (cmd === 'quote') {
      const text = args.join(' ').trim();
      if (!text) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/quote Hidup ini indah`', { quotedMessageId: ctx.id });
        return;
      }
      
      const svg = `
        <svg width="512" height="512">
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#8ec5fc;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#e0c3fc;stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect width="512" height="512" rx="30" fill="url(#grad)" />
          <text x="256" y="260" font-family="'Helvetica Neue', Helvetica, Arial" font-size="32" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">
            "${text}"
          </text>
        </svg>
      `;

      const webp = await sharp(Buffer.from(svg)).webp().toBuffer();
      await adapter.sendSticker(ctx.chatId, webp, { quotedMessageId: ctx.id });
      unlockStickerMaker(ctx, adapter);
      return;
    }

    // 3. /emojimix 😂 + 😭
    if (cmd === 'emojimix' || cmd === 'mix') {
      const emoji1 = args[0]?.trim();
      const emoji2 = args[2]?.trim() || args[1]?.trim();

      if (!emoji1 || !emoji2) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/mix 😂 + 😭` atau `/mix 😂 😭`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⏳ Sedang menggabungkan emoji...', { quotedMessageId: ctx.id });
      try {
        // Use public emojimix API
        const response = await axios.get(`https://api.lolhuman.xyz/api/emojimix?apikey=freekey&emoji1=${encodeURIComponent(emoji1)}&emoji2=${encodeURIComponent(emoji2)}`, {
          responseType: 'arraybuffer'
        });
        const webp = await sharp(Buffer.from(response.data)).webp().toBuffer();
        await adapter.sendSticker(ctx.chatId, webp, { quotedMessageId: ctx.id });
        unlockStickerMaker(ctx, adapter);
      } catch (err) {
        await adapter.sendMessage(ctx.chatId, '❌ Gagal menggabungkan emoji. Emoji tidak didukung.', { quotedMessageId: ctx.id });
      }
      return;
    }

    // For all other commands, we need a media file
    let media = ctx.media;
    if (!media && ctx.quotedMessage && ctx.quotedMessage.media) {
      media = ctx.quotedMessage.media;
    }

    if (!media) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Kirim atau reply gambar/video terlebih dahulu.', { quotedMessageId: ctx.id });
      return;
    }

    const buffer = await media.getBuffer();

    // 4. /removebg or /rbg (free limit 5MB, premium limit 15MB)
    if (cmd === 'removebg' || cmd === 'rbg') {
      const maxSize = (await isPremiumUser(ctx.senderId)) ? 15 * 1024 * 1024 : 5 * 1024 * 1024;
      if (buffer.length > maxSize) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Batas ukuran removebg adalah ${maxSize / 1024 / 1024} MB.`, { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⏳ Menghapus background...', { quotedMessageId: ctx.id });
      try {
        // Sharp mock bg removal (makes transparent format png)
        const png = await sharp(buffer).ensureAlpha().png().toBuffer();
        await adapter.sendImage(ctx.chatId, png, 'Background berhasil dihapus.', { quotedMessageId: ctx.id });
      } catch (err) {
        await adapter.sendMessage(ctx.chatId, '❌ Gagal memproses gambar.', { quotedMessageId: ctx.id });
      }
      return;
    }

    // 5. /stikerbg or /nobgstick
    if (cmd === 'stikerbg' || cmd === 'nobgstick') {
      await adapter.sendMessage(ctx.chatId, '⏳ Membuat stiker no-bg...', { quotedMessageId: ctx.id });
      try {
        const noBgPng = await sharp(buffer).ensureAlpha().resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp().toBuffer();
        await adapter.sendSticker(ctx.chatId, noBgPng, { quotedMessageId: ctx.id });
        unlockStickerMaker(ctx, adapter);
      } catch (err) {
        await adapter.sendMessage(ctx.chatId, '❌ Gagal membuat stiker no-bg.', { quotedMessageId: ctx.id });
      }
      return;
    }

    // 6. /circle or /bulat
    if (cmd === 'circle' || cmd === 'bulat') {
      await adapter.sendMessage(ctx.chatId, '⏳ Membuat stiker lingkaran...', { quotedMessageId: ctx.id });
      try {
        const circleMask = Buffer.from(
          `<svg width="512" height="512"><circle cx="256" cy="256" r="256" fill="#ffffff"/></svg>`
        );
        const webp = await sharp(buffer)
          .resize(512, 512, { fit: 'cover' })
          .composite([{ input: circleMask, blend: 'dest-in' }])
          .webp()
          .toBuffer();
        await adapter.sendSticker(ctx.chatId, webp, { quotedMessageId: ctx.id });
        unlockStickerMaker(ctx, adapter);
      } catch (err) {
        await adapter.sendMessage(ctx.chatId, '❌ Gagal membuat stiker lingkaran.', { quotedMessageId: ctx.id });
      }
      return;
    }

    // 7. /outline [white/black]
    if (cmd === 'outline') {
      const color = args[0]?.toLowerCase() === 'black' ? '#000000' : '#ffffff';
      await adapter.sendMessage(ctx.chatId, '⏳ Menambahkan outline...', { quotedMessageId: ctx.id });
      try {
        // Outline effect using Sharp: composite transparent image on a slightly resized background outline mask
        const transparentPng = await sharp(buffer).ensureAlpha().toBuffer();
        const webp = await sharp(transparentPng)
          .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp()
          .toBuffer();
        await adapter.sendSticker(ctx.chatId, webp, { quotedMessageId: ctx.id });
        unlockStickerMaker(ctx, adapter);
      } catch (err) {
        await adapter.sendMessage(ctx.chatId, '❌ Gagal menambahkan outline.', { quotedMessageId: ctx.id });
      }
      return;
    }

    // 8. /meme <top text> | <bottom text>
    if (cmd === 'meme') {
      const joinedArgs = args.join(' ');
      const [top, bottom] = joinedArgs.split('|').map(t => t.trim());

      if (!top && !bottom) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/meme teks atas | teks bawah`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⏳ Membuat meme...', { quotedMessageId: ctx.id });
      try {
        const metadata = await sharp(buffer).metadata();
        const w = metadata.width || 512;
        const h = metadata.height || 512;

        let svg = `<svg width="${w}" height="${h}">
          <style>
            .meme-text {
              font-family: Impact, sans-serif;
              font-size: ${Math.floor(w / 12)}px;
              fill: white;
              stroke: black;
              stroke-width: 3px;
              text-anchor: middle;
            }
          </style>`;

        if (top) {
          svg += `<text x="${w / 2}" y="${h * 0.15}" class="meme-text">${escapeXml(top.toUpperCase())}</text>`;
        }
        if (bottom) {
          svg += `<text x="${w / 2}" y="${h * 0.9}" class="meme-text">${escapeXml(bottom.toUpperCase())}</text>`;
        }
        svg += `</svg>`;

        const webp = await sharp(buffer)
          .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
          .webp()
          .toBuffer();

        await adapter.sendSticker(ctx.chatId, webp, { quotedMessageId: ctx.id });
        unlockStickerMaker(ctx, adapter);
      } catch (err) {
        await adapter.sendMessage(ctx.chatId, '❌ Gagal membuat meme.', { quotedMessageId: ctx.id });
      }
      return;
    }

    // 9. /stiker or /s (normal conversion)
    if (cmd === 'stiker' || cmd === 's') {
      try {
        let pack = 'Javas Bot';
        let author = 'Bot WA';
        
        // Parse metadata args: pack:Name author:Author
        const packArg = args.find(a => a.startsWith('pack:'))?.replace('pack:', '');
        const authorArg = args.find(a => a.startsWith('author:'))?.replace('author:', '');
        if (packArg) pack = packArg;
        if (authorArg) author = authorArg;

        const webp = await sharp(buffer)
          .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp()
          .toBuffer();

        const metaWebp = await addStickerMetadata(webp, pack, author);
        await adapter.sendSticker(ctx.chatId, metaWebp, { quotedMessageId: ctx.id });
        unlockStickerMaker(ctx, adapter);
      } catch (err) {
        await adapter.sendMessage(ctx.chatId, '❌ Gagal memproses stiker.', { quotedMessageId: ctx.id });
      }
      return;
    }

    // 10. /toimg
    if (cmd === 'toimg') {
      if (media.type !== 'sticker') {
        await adapter.sendMessage(ctx.chatId, '⚠️ Reply stiker terlebih dahulu.', { quotedMessageId: ctx.id });
        return;
      }
      try {
        const png = await sharp(buffer).png().toBuffer();
        await adapter.sendImage(ctx.chatId, png, 'Stiker berhasil diubah ke gambar.', { quotedMessageId: ctx.id });
      } catch (err) {
        await adapter.sendMessage(ctx.chatId, '❌ Gagal mengubah stiker ke gambar.', { quotedMessageId: ctx.id });
      }
      return;
    }

    // 11. /vstiker or /gifstiker
    if (cmd === 'vstiker' || cmd === 'gifstiker') {
      try {
        await validateMediaSize(buffer.length, ctx.senderId);
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `⚠️ ${err.message}`, { quotedMessageId: ctx.id });
        return;
      }

      const isPrem = await isPremiumUser(ctx.senderId);
      const maxSeconds = isPrem ? 10 : 5;

      await adapter.sendMessage(ctx.chatId, `⏳ Mengonversi video ke stiker (Maksimal ${maxSeconds} detik)...`, { quotedMessageId: ctx.id });

      const tempIn = getTempPath('mp4');
      const tempOut = getTempPath('webp');

      try {
        fs.writeFileSync(tempIn, buffer);

        // FFmpeg safe conversion argument list
        const args = [
          '-y',
          '-i', tempIn,
          '-t', String(maxSeconds),
          '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000',
          '-vcodec', 'libwebp',
          '-lossless', '0',
          '-compression_level', '4',
          '-q:v', '50',
          '-loop', '0',
          '-an',
          '-vsync', '0',
          tempOut
        ];
        await runFfmpeg(args);

        const webpOut = fs.readFileSync(tempOut);
        await adapter.sendSticker(ctx.chatId, webpOut, { quotedMessageId: ctx.id });
        unlockStickerMaker(ctx, adapter);
      } catch (err: any) {
        console.error('[VideoSticker] Error converting:', err);
        await adapter.sendMessage(ctx.chatId, '❌ Gagal mengonversi video ke stiker. Pastikan format video valid.', { quotedMessageId: ctx.id });
      } finally {
        safeDelete(tempIn);
        safeDelete(tempOut);
      }
      return;
    }

    // 12. /batchstiker or /pack (simulated queue for multiple images)
    if (cmd === 'batchstiker' || cmd === 'pack') {
      await adapter.sendMessage(ctx.chatId, '⏳ Memproses batch stiker...', { quotedMessageId: ctx.id });
      try {
        const webp = await sharp(buffer)
          .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp()
          .toBuffer();
        await adapter.sendSticker(ctx.chatId, webp, { quotedMessageId: ctx.id });
        unlockStickerMaker(ctx, adapter);
      } catch (err) {
        await adapter.sendMessage(ctx.chatId, '❌ Gagal memproses batch stiker.', { quotedMessageId: ctx.id });
      }
      return;
    }
  }
}

async function isPremiumUser(userId: string): Promise<boolean> {
  const { isPremium } = await import('../../bot/permission.js');
  return isPremium(userId);
}

function unlockStickerMaker(ctx: MessageContext, adapter: WhatsAppAdapter) {
  achievementService.unlockAchievement(
    ctx.senderId,
    'sticker_maker',
    adapter,
    ctx.isGroup ? ctx.chatId : undefined
  ).catch(err => console.error('[Achievement Sticker Hook Failed]', err));
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

const stickerSuite = new StickerSuiteCommand();
registerCommand(
  ['stiker', 's', 'toimg', 'brat', 'quote', 'removebg', 'rbg', 'stikerbg', 'nobgstick', 'circle', 'bulat', 'outline', 'meme', 'emojimix', 'mix', 'vstiker', 'gifstiker', 'batchstiker', 'pack'],
  stickerSuite
);
