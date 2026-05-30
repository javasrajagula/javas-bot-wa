import { Command, registerCommand } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import { downloadMedia, isValidUrl } from '../services/downloader/downloader.service.js';
import { downloaderQueue } from '../queues/queue.js';
import { safeDelete } from '../utils/file.util.js';
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
    const isHeavy = ['ytmp3', 'ytmp4', 'fb', 'facebook', 'fbdown', 'twitter', 'x', 'twtdl', 'threads', 'thread'].includes(type);
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

    // Send loading feedback
    await adapter.sendMessage(ctx.chatId, '⏳ Sedang mengunduh media...', { quotedMessageId: ctx.id });

    const jobId = `downloader-${ctx.id}`;

    await downloaderQueue.add({
      id: jobId,
      data: { url, userId: ctx.senderId },
      process: async () => {
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
              await adapter.sendVideo(ctx.chatId, buffer, caption, { quotedMessageId: ctx.id });
            } else if (file.mimeType.startsWith('audio/')) {
              await adapter.sendAudio(ctx.chatId, buffer, { quotedMessageId: ctx.id });
            } else {
              await adapter.sendImage(ctx.chatId, buffer, caption, { quotedMessageId: ctx.id });
            }
          }
        } finally {
          // Auto clean up temporary files immediately after sending
          for (const file of result.files) {
            safeDelete(file.path);
          }
        }
      },
      onSuccess: () => {
        if (!userIsPremium) {
          freeDownloaderCooldowns.set(senderId, Date.now());
        }
      },
      onFailure: async (err) => {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal mengunduh media: ${err.message || 'Terjadi kesalahan sistem.'}`, { quotedMessageId: ctx.id });
      }
    });
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
