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
import { env } from '../../config/env.js';
import { injectWebpExif } from '../../services/sticker/sticker-metadata.service.js';

// Helper to write WebP Exif metadata
export async function addStickerMetadata(
  webpBuffer: Buffer,
  pack = env.STICKER_PACK_NAME || 'Javas Bot WA',
  author = env.STICKER_AUTHOR_NAME || 'bot wa javas'
): Promise<Buffer> {
  try {
    return injectWebpExif(webpBuffer, pack, author);
  } catch (err) {
    console.warn('[Sticker Metadata] Failed to inject exif:', err);
    return webpBuffer;
  }
}

// Helper to validate WebP Sticker buffer size and format
export function validateStickerBuffer(buffer: Buffer): void {
  if (!buffer || buffer.length === 0) {
    throw new Error('Buffer stiker kosong.');
  }
  const isWebP = buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  if (!isWebP) {
    throw new Error('File hasil konversi bukan format WebP yang valid.');
  }
  if (buffer.length > 1024 * 1024) {
    throw new Error(`Ukuran stiker melebihi batas 1MB (Ukuran: ${(buffer.length / 1024).toFixed(1)} KB).`);
  }
}

export class StickerSuiteCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // Extract pack and author metadata overrides if present
    let pack = env.STICKER_PACK_NAME || 'Javas Bot WA';
    let author = env.STICKER_AUTHOR_NAME || 'bot wa javas';

    const packArg = args.find(a => a.startsWith('pack:'))?.replace('pack:', '');
    const authorArg = args.find(a => a.startsWith('author:'))?.replace('author:', '');
    if (packArg) pack = packArg;
    if (authorArg) author = authorArg;

    // Filter out pack: and author: from command arguments so they don't pollute text args
    const cleanArgs = args.filter(a => !a.startsWith('pack:') && !a.startsWith('author:'));

    // 1. /brat & /brat classic
    if (cmd === 'brat') {
      const isClassic = cleanArgs[0]?.toLowerCase() === 'classic';
      const text = (isClassic ? cleanArgs.slice(1) : cleanArgs).join(' ').trim();
      if (!text) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/brat hello world` atau `/brat classic hello world`', { quotedMessageId: ctx.id });
        return;
      }
      // mode 'brat' = background putih (default), 'classic' = background putih juga tapi blur lebih halus
      const buffer = await generateBratSticker(text, { mode: isClassic ? 'classic' : 'brat' });
      const metaWebp = await addStickerMetadata(buffer, pack, author);
      await adapter.sendSticker(ctx.chatId, metaWebp, { quotedMessageId: ctx.id });
      unlockStickerMaker(ctx, adapter);
      return;
    }

    // 2. /quote <teks>
    if (cmd === 'quote') {
      const text = cleanArgs.join(' ').trim();
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

      const webp = await sharp(Buffer.from(svg)).webp({ quality: 50 }).toBuffer();
      const metaWebp = await addStickerMetadata(webp, pack, author);
      await adapter.sendSticker(ctx.chatId, metaWebp, { quotedMessageId: ctx.id });
      unlockStickerMaker(ctx, adapter);
      return;
    }

    // 3. /emojimix 😂 + 😭
    if (cmd === 'emojimix' || cmd === 'mix') {
      const emoji1 = cleanArgs[0]?.trim();
      const emoji2 = cleanArgs[2]?.trim() || cleanArgs[1]?.trim();

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
        const webp = await sharp(Buffer.from(response.data)).webp({ quality: 50 }).toBuffer();
        const metaWebp = await addStickerMetadata(webp, pack, author);
        await adapter.sendSticker(ctx.chatId, metaWebp, { quotedMessageId: ctx.id });
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
      const isVideoCmd = (cmd === 'vstiker' || cmd === 'gifstiker' || cmd === 'sgif');
      const errMsg = isVideoCmd
        ? `⚠️ *Balas video* atau kirim video bersama \`${ctx.command?.prefix || '/'}${cmd}\` untuk dikonversi ke stiker animasi.\n\nContoh: kirim/balas video → ketik \`/${cmd}\``
        : '⚠️ Kirim atau reply gambar/video terlebih dahulu.';
      await adapter.sendMessage(ctx.chatId, errMsg, { quotedMessageId: ctx.id });
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
        const { removeBackground } = await import('../../services/removebg/removebg.service.js');
        const png = await removeBackground(buffer);
        await adapter.sendImage(ctx.chatId, png, 'Background berhasil dihapus.', { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `⚠️ ${err.message || 'Gagal memproses gambar.'}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 5. /stikerbg or /nobgstick
    if (cmd === 'stikerbg' || cmd === 'nobgstick') {
      await adapter.sendMessage(ctx.chatId, '⏳ Membuat stiker no-bg...', { quotedMessageId: ctx.id });
      try {
        const noBgPng = await sharp(buffer)
          .ensureAlpha()
          .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp({ quality: 50 })
          .toBuffer();
        const metaWebp = await addStickerMetadata(noBgPng, pack, author);
        await adapter.sendSticker(ctx.chatId, metaWebp, { quotedMessageId: ctx.id });
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
          .ensureAlpha()
          .resize(512, 512, { fit: 'cover' })
          .composite([{ input: circleMask, blend: 'dest-in' }])
          .webp({ quality: 50 })
          .toBuffer();
        const metaWebp = await addStickerMetadata(webp, pack, author);
        await adapter.sendSticker(ctx.chatId, metaWebp, { quotedMessageId: ctx.id });
        unlockStickerMaker(ctx, adapter);
      } catch (err) {
        await adapter.sendMessage(ctx.chatId, '❌ Gagal membuat stiker lingkaran.', { quotedMessageId: ctx.id });
      }
      return;
    }

    // 6.5. /heart or /love
    if (cmd === 'heart' || cmd === 'love') {
      await adapter.sendMessage(ctx.chatId, '⏳ Membuat stiker hati...', { quotedMessageId: ctx.id });
      try {
        const heartMask = Buffer.from(
          `<svg viewBox="0 0 512 512">` +
          `<path d="M256 470 C256 470 50 280 50 140 C50 60 110 30 180 30 C220 30 245 50 256 70 C267 50 292 30 332 30 C402 30 462 60 462 140 C462 280 256 470 256 470 Z" fill="#ffffff"/>` +
          `</svg>`
        );
        const webp = await sharp(buffer)
          .ensureAlpha()
          .resize(512, 512, { fit: 'cover' })
          .composite([{ input: heartMask, blend: 'dest-in' }])
          .webp({ quality: 50 })
          .toBuffer();
        const metaWebp = await addStickerMetadata(webp, pack, author);
        await adapter.sendSticker(ctx.chatId, metaWebp, { quotedMessageId: ctx.id });
        unlockStickerMaker(ctx, adapter);
      } catch (err) {
        await adapter.sendMessage(ctx.chatId, '❌ Gagal membuat stiker hati.', { quotedMessageId: ctx.id });
      }
      return;
    }

    // 7. /outline [white/black]
    if (cmd === 'outline') {
      const color = cleanArgs[0]?.toLowerCase() === 'black' ? '#000000' : '#ffffff';
      await adapter.sendMessage(ctx.chatId, '⏳ Menambahkan outline...', { quotedMessageId: ctx.id });
      try {
        const transparentPng = await sharp(buffer).ensureAlpha().toBuffer();
        const webp = await sharp(transparentPng)
          .ensureAlpha()
          .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp({ quality: 50 })
          .toBuffer();
        const metaWebp = await addStickerMetadata(webp, pack, author);
        await adapter.sendSticker(ctx.chatId, metaWebp, { quotedMessageId: ctx.id });
        unlockStickerMaker(ctx, adapter);
      } catch (err) {
        await adapter.sendMessage(ctx.chatId, '❌ Gagal menambahkan outline.', { quotedMessageId: ctx.id });
      }
      return;
    }

    // 8. /meme <top text> | <bottom text>
    if (cmd === 'meme') {
      const joinedArgs = cleanArgs.join(' ');
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

        const topText = top ? top.toUpperCase() : '';
        const bottomText = bottom ? bottom.toUpperCase() : '';
        
        const maxChars = Math.max(topText.length, bottomText.length);
        let fontSize = Math.floor(w / 12);
        if (maxChars > 40) fontSize = Math.floor(w / 18);
        else if (maxChars > 20) fontSize = Math.floor(w / 15);
        
        const maxCharsPerLine = Math.floor(w / (fontSize * 0.6));
        
        const topLines = topText ? wrapText(topText, maxCharsPerLine) : [];
        const bottomLines = bottomText ? wrapText(bottomText, maxCharsPerLine) : [];

        let svg = `<svg width="${w}" height="${h}">
          <style>
            .meme-text {
              font-family: Impact, Arial, sans-serif;
              font-size: ${fontSize}px;
              font-weight: 700;
              fill: white;
              stroke: black;
              stroke-width: ${Math.max(2, Math.floor(fontSize / 10))}px;
              text-anchor: middle;
            }
          </style>`;

        if (topLines.length > 0) {
          const startY = h * 0.05 + fontSize * 0.8;
          svg += `<text x="${w / 2}" y="${startY}" class="meme-text">`;
          topLines.forEach((line, index) => {
            const dy = index === 0 ? 0 : fontSize * 1.1;
            svg += `<tspan x="${w / 2}" dy="${dy}">${escapeXml(line)}</tspan>`;
          });
          svg += `</text>`;
        }

        if (bottomLines.length > 0) {
          const lineSpacing = fontSize * 1.1;
          const totalHeight = (bottomLines.length - 1) * lineSpacing;
          const startY = h * 0.92 - totalHeight;
          svg += `<text x="${w / 2}" y="${startY}" class="meme-text">`;
          bottomLines.forEach((line, index) => {
            const dy = index === 0 ? 0 : lineSpacing;
            svg += `<tspan x="${w / 2}" dy="${dy}">${escapeXml(line)}</tspan>`;
          });
          svg += `</text>`;
        }

        svg += `</svg>`;

        const webp = await sharp(buffer)
          .ensureAlpha()
          .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
          .webp({ quality: 50 })
          .toBuffer();

        const metaWebp = await addStickerMetadata(webp, pack, author);
        await adapter.sendSticker(ctx.chatId, metaWebp, { quotedMessageId: ctx.id });
        unlockStickerMaker(ctx, adapter);
      } catch (err) {
        await adapter.sendMessage(ctx.chatId, '❌ Gagal membuat meme.', { quotedMessageId: ctx.id });
      }
      return;
    }

    // 9. /stiker or /s (normal conversion)
    if (cmd === 'stiker' || cmd === 's') {
      let sharpDone = false;
      let metaDone = false;
      try {
        const webp = await sharp(buffer)
          .ensureAlpha()
          .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp({ quality: 50 })
          .toBuffer();
        sharpDone = true;

        const metaWebp = await addStickerMetadata(webp, pack, author);
        metaDone = true;

        validateStickerBuffer(metaWebp);

        await adapter.sendSticker(ctx.chatId, metaWebp, { quotedMessageId: ctx.id });
        unlockStickerMaker(ctx, adapter);
      } catch (err: any) {
        const stage = !sharpDone ? 'konversi-webp' : !metaDone ? 'exif-inject' : 'kirim-stiker';
        console.error(`[Sticker] Error at stage=${stage}:`, err?.message || err);
        await adapter.sendMessage(
          ctx.chatId,
          `❌ Gagal memproses stiker (${stage}): ${err?.message || 'unknown error'}`,
          { quotedMessageId: ctx.id }
        );
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

    // 11. /vstiker, /gifstiker, /sgif
    if (cmd === 'vstiker' || cmd === 'gifstiker' || cmd === 'sgif') {
      // Validasi tipe media — harus video atau gif
      const isVideo = media.type === 'video' || media.type === 'gif' ||
        media.mimetype?.startsWith('video/') || media.mimetype === 'image/gif';
      if (!isVideo) {
        const p = ctx.command?.prefix || '/';
        await adapter.sendMessage(
          ctx.chatId,
          `⚠️ Harus *balas video* atau *kirim video* bersama perintah \`${p}${cmd}\`.\n\nContoh: balas video lalu ketik \`${p}${cmd}\`.`,
          { quotedMessageId: ctx.id }
        );
        return;
      }

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

        let quality = 50;
        let fps = 15;
        let scale = 512;
        let compressionLevel = 4;
        let attempts = 0;
        let finalStickerBuffer: Buffer | null = null;

        while (attempts < 3) {
          // FFmpeg safe conversion argument list
          const argsList = [
            '-y',
            '-i', tempIn,
            '-t', String(maxSeconds),
            '-vf', `fps=${fps},scale=${scale}:${scale}:force_original_aspect_ratio=increase,crop=${scale}:${scale},format=yuva420p`,
            '-vcodec', 'libwebp',
            '-lossless', '0',
            '-compression_level', String(compressionLevel),
            '-q:v', String(quality),
            '-loop', '0',
            '-an',
            '-vsync', '0',
            tempOut
          ];
          await runFfmpeg(argsList);

          const webpOut = fs.readFileSync(tempOut);
          const metaWebp = await addStickerMetadata(webpOut, pack, author);

          if (metaWebp.length <= 1024 * 1024) {
            finalStickerBuffer = metaWebp;
            break;
          }

          // If size exceeds 1MB, reduce quality, framerate, and scale for the next attempt
          attempts++;
          quality = Math.max(20, quality - 15);
          fps = Math.max(10, fps - 3);
          scale = attempts === 1 ? 384 : 256;
          compressionLevel = 6; // Use higher compression effort
          finalStickerBuffer = metaWebp; // Fallback to last buffer if all attempts fail
        }

        validateStickerBuffer(finalStickerBuffer!);

        await adapter.sendSticker(ctx.chatId, finalStickerBuffer!, { quotedMessageId: ctx.id });
        unlockStickerMaker(ctx, adapter);
      } catch (err: any) {
        console.error('[VideoSticker] Error converting:', err);
        await adapter.sendMessage(ctx.chatId, `❌ Gagal mengonversi video ke stiker: ${err.message || 'Pastikan format video valid.'}`, { quotedMessageId: ctx.id });
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
          .ensureAlpha()
          .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp({ quality: 50 })
          .toBuffer();
        const metaWebp = await addStickerMetadata(webp, pack, author);
        await adapter.sendSticker(ctx.chatId, metaWebp, { quotedMessageId: ctx.id });
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

  import('../games/mission.command.js')
    .then(mod => mod.updateDailyMissionStickerCount(ctx.senderId))
    .catch(err => console.error('[Mission Sticker Fail]', err));
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

function wrapText(text: string, maxCharsPerLine = 20): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

const stickerSuite = new StickerSuiteCommand();
registerCommand(
  ['stiker', 's', 'toimg', 'brat', 'quote', 'removebg', 'rbg', 'stikerbg', 'nobgstick', 'circle', 'bulat', 'outline', 'meme', 'emojimix', 'mix', 'vstiker', 'gifstiker', 'sgif', 'batchstiker', 'pack', 'heart', 'love'],
  stickerSuite
);
