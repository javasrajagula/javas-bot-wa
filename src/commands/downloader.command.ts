import { Command, registerCommand } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import { downloadMedia, isValidUrl } from '../services/downloader/downloader.service.js';
import { downloaderQueue } from '../queues/queue.js';
import { safeDeleteTemp } from '../utils/file.util.js';
import { getMediaDuration } from '../services/ffmpeg/ffmpeg.service.js';
import prisma from '../db/client.js';
import fs from 'fs';

// Store last download timestamp for free users (in-memory)
const freeDownloaderCooldowns = new Map<string, number>();

export class DownloaderCommand implements Command {
  constructor(public readonly commandType?: string) {}

  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cleanBody = ctx.body.trim();
    const firstWord = cleanBody.split(/\s+/)[0] || '';
    const commandName = firstWord.replace(/^[^a-zA-Z0-9]+/, '').toLowerCase();
    
    // Resolve type from constructor or fall back to command name
    const type = this.commandType || commandName;

    const senderId = ctx.senderId;
    const { isPremium } = await import('../bot/permission.js');
    const userIsPremium = await isPremium(senderId);

    // Dynamic configuration of limits based on user premium status
    const maxBytes = userIsPremium ? 100 * 1024 * 1024 : 25 * 1024 * 1024;
    const maxDurationSeconds = userIsPremium ? 15 * 60 : 3 * 60;

    // Check cooldown for free users
    if (!userIsPremium) {
      const now = Date.now();
      const lastDownload = freeDownloaderCooldowns.get(senderId) || 0;
      const cooldownMs = 3 * 60 * 1000; // 3 minutes
      if (now - lastDownload < cooldownMs) {
        const remaining = Math.ceil((cooldownMs - (now - lastDownload)) / 1000);
        await adapter.sendMessage(
          ctx.chatId,
          `⏳ Cooldown downloader. Silakan coba lagi dalam ${remaining} detik. Hubungi owner untuk upgrade Premium agar bebas limit.`,
          { quotedMessageId: ctx.id }
        );
        return;
      }
    }

    // Heavy downloaders: ytmp3, ytmp4, fb, twitter, threads
    const isHeavy = ['ytmp3', 'ytmp4', 'youtube-audio', 'youtube-video', 'fb', 'facebook', 'fbdown', 'twitter', 'x', 'twtdl', 'threads', 'thread'].includes(type);
    if (isHeavy) {
      let groupIsPremium = false;
      if (ctx.isGroup) {
        const sub = await prisma.groupSubscription.findUnique({
          where: { groupId: ctx.chatId }
        });
        if (sub && sub.plan === 'premium' && (!sub.expiresAt || sub.expiresAt.getTime() > Date.now())) {
          groupIsPremium = true;
        }
      }

      if (!userIsPremium && !groupIsPremium) {
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Fitur downloader ini (YouTube, Facebook, Twitter, Threads) hanya dapat digunakan oleh pengguna Premium atau di grup sewa Premium.',
          { quotedMessageId: ctx.id }
        );
        return;
      }
    }

    const url = args[0]?.trim();
    let targetUrl = url;
    let searchMetadata: any = null;

    const isYoutube = ['ytmp3', 'ytmp4', 'youtube-audio', 'youtube-video'].includes(type);
    if (isYoutube && (!url || !isValidUrl(url))) {
      const query = args.join(' ').trim();
      if (!query) {
        await adapter.sendMessage(
          ctx.chatId,
          `⚠️ Format salah. Contoh: \`/${type} <url atau keyword>\``,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      await adapter.sendMessage(ctx.chatId, `🔍 Mencari *"${query}"* di YouTube...`, { quotedMessageId: ctx.id });

      try {
        const { yts } = await import('btch-downloader');
        const searchResult = (await yts(query)) as any;
        if (!searchResult || !searchResult.status || !searchResult.result?.videos?.length) {
          await adapter.sendMessage(ctx.chatId, '❌ Video tidak ditemukan di YouTube.', { quotedMessageId: ctx.id });
          return;
        }
        const firstVideo = searchResult.result.videos[0];
        targetUrl = firstVideo.url;
        searchMetadata = {
          title: firstVideo.title,
          views: firstVideo.views,
          duration: firstVideo.timestamp || firstVideo.duration?.timestamp || 'unknown',
          author: firstVideo.author?.name || 'unknown'
        };
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal melakukan pencarian YouTube: ${err.message}`, { quotedMessageId: ctx.id });
        return;
      }
    } else {
      if (!url) {
        await adapter.sendMessage(
          ctx.chatId,
          `⚠️ Format salah. Contoh: \`/${type} <url>\``,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      if (!isValidUrl(url)) {
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Link tidak valid. Kirim link publik dari platform yang didukung.',
          { quotedMessageId: ctx.id }
        );
        return;
      }
    }

    // Send loading feedback
    await adapter.sendMessage(
      ctx.chatId,
      searchMetadata 
        ? `🎬 *Menemukan:* ${searchMetadata.title}\n⏳ Sedang mengunduh media...`
        : '⏳ Sedang mengunduh media...',
      { quotedMessageId: ctx.id }
    );

    const jobId = `downloader-${ctx.id}`;

    await downloaderQueue.add({
      id: jobId,
      data: {
        type: 'downloader',
        payload: {
          url: targetUrl,
          type,
          maxBytes,
          maxDurationSeconds,
          chatId: ctx.chatId,
          quotedMessageId: ctx.id,
          userIsPremium,
          userId: ctx.senderId,
          searchMetadata
        }
      }
    });
  }
}

export async function processDownloaderJob(payload: any): Promise<void> {
  const { url, type, maxBytes, maxDurationSeconds, chatId, quotedMessageId, userIsPremium, userId, searchMetadata } = payload;
  const { AdapterHolder } = await import('../bot/adapter-holder.js');
  const adapter = AdapterHolder.getAdapter();

  try {
    const result = await downloadMedia(url, type, maxBytes);
    try {
      for (let i = 0; i < result.files.length; i++) {
        const file = result.files[i];
        const buffer = fs.readFileSync(file.path);
        
        // Check duration if it's audio or video
        const isAudioOrVideo = file.mimeType.startsWith('video/') || file.mimeType.startsWith('audio/');
        if (isAudioOrVideo) {
          const durationSeconds = await getMediaDuration(file.path);
          if (durationSeconds > maxDurationSeconds) {
            throw new Error(`Durasi media (${Math.ceil(durationSeconds / 60)} menit) melebihi batas maksimal ${Math.ceil(maxDurationSeconds / 60)} menit.`);
          }
        }

        const caption = result.files.length > 1 ? `${result.title} (${i + 1}/${result.files.length})` : result.title;

        if (file.mimeType.startsWith('video/')) {
          await adapter.sendVideo(chatId, buffer, caption, { quotedMessageId });
        } else if (file.mimeType.startsWith('audio/')) {
          await adapter.sendAudio(chatId, buffer, { quotedMessageId });
          
          if (['ytmp3', 'youtube-audio'].includes(type)) {
            const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
            let durationStr = 'unknown';
            try {
              const durationSeconds = await getMediaDuration(file.path);
              const durationMin = Math.floor(durationSeconds / 60);
              const durationSec = Math.floor(durationSeconds % 60);
              durationStr = `${durationMin}:${durationSec.toString().padStart(2, '0')}`;
            } catch {}

            let detailsMsg = `🎵 *YouTube Audio Terkirim* 🎵\n\n`;
            detailsMsg += `• *Judul:* ${caption}\n`;
            detailsMsg += `• *Durasi:* ${durationStr}\n`;
            detailsMsg += `• *Ukuran:* ${sizeMB} MB\n`;
            if (searchMetadata) {
              detailsMsg += `• *Channel:* ${searchMetadata.author || 'unknown'}\n`;
              detailsMsg += `• *Views:* ${searchMetadata.views ? searchMetadata.views.toLocaleString('id-ID') : '0'}\n`;
            }
            detailsMsg += `\n💡 Nikmati audionya!`;
            await adapter.sendMessage(chatId, detailsMsg, { quotedMessageId });
          }
        } else {
          await adapter.sendImage(chatId, buffer, caption, { quotedMessageId });
        }
      }

      if (!userIsPremium) {
        freeDownloaderCooldowns.set(userId, Date.now());
      }
    } finally {
      for (const file of result.files) {
        safeDeleteTemp(file.path);
      }
    }
  } catch (err: any) {
    await adapter.sendMessage(chatId, `❌ Gagal mengunduh media: ${err.message || 'Terjadi kesalahan sistem.'}`, { quotedMessageId });
    throw err;
  }
}

// Register commands
registerCommand(['tt', 'tiktok'], new DownloaderCommand('tt'));
registerCommand(['ig', 'instagram'], new DownloaderCommand('ig'));
registerCommand(['ytmp3', 'youtube-audio'], new DownloaderCommand('ytmp3'));
registerCommand(['ytmp4', 'youtube-video'], new DownloaderCommand('ytmp4'));
registerCommand(['fb', 'facebook', 'fbdown'], new DownloaderCommand('fb'));
registerCommand(['twitter', 'x', 'twtdl'], new DownloaderCommand('twitter'));
registerCommand(['threads', 'thread'], new DownloaderCommand('threads'));
registerCommand(['pinterest', 'pin', 'pindl'], new DownloaderCommand('pinterest'));
registerCommand(['capcut', 'cc'], new DownloaderCommand('capcut'));
