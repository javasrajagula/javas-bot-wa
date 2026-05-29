import { Command, registerCommand } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import axios from 'axios';

export class SsWebCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    let url = args[0]?.trim();
    if (!url) {
      await adapter.sendMessage(
        ctx.chatId,
        '⚠️ Format salah. Gunakan: `/ssweb <url>`\nContoh: `/ssweb https://google.com`',
        { quotedMessageId: ctx.id }
      );
      return;
    }

    // Auto prepend protocol if missing
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    await adapter.sendMessage(ctx.chatId, `⏳ Sedang mengambil screenshot website *${url}*...`, { quotedMessageId: ctx.id });

    try {
      // Use thum.io public website screenshot service
      const targetUrl = `https://image.thum.io/get/width/1280/crop/800/${url}`;
      const response = await axios.get(targetUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });

      const buffer = Buffer.from(response.data);
      await adapter.sendImage(ctx.chatId, buffer, `📸 Screenshot: ${url}`, {
        quotedMessageId: ctx.id
      });
    } catch (err: any) {
      console.error('[SSWeb] Error capturing screenshot:', err);
      await adapter.sendMessage(
        ctx.chatId,
        `❌ Gagal mengambil screenshot: ${err.message || 'Terjadi kesalahan pada server screenshot.'}`,
        { quotedMessageId: ctx.id }
      );
    }
  }
}

export class QrCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const text = args.join(' ').trim();
    if (!text) {
      await adapter.sendMessage(
        ctx.chatId,
        '⚠️ Format salah. Gunakan: `/qr <teks/url>`\nContoh: `/qr Halo Dunia`',
        { quotedMessageId: ctx.id }
      );
      return;
    }

    await adapter.sendMessage(ctx.chatId, '⏳ Sedang membuat QR Code...', { quotedMessageId: ctx.id });

    try {
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(text)}`;
      const response = await axios.get(qrApiUrl, {
        responseType: 'arraybuffer',
        timeout: 10000
      });

      const buffer = Buffer.from(response.data);
      await adapter.sendImage(ctx.chatId, buffer, `📱 QR Code: "${text}"`, {
        quotedMessageId: ctx.id
      });
    } catch (err: any) {
      console.error('[QR] Error generating QR code:', err);
      await adapter.sendMessage(
        ctx.chatId,
        `❌ Gagal membuat QR Code: ${err.message}`,
        { quotedMessageId: ctx.id }
      );
    }
  }
}

export class ReadQrCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const mediaContext = ctx.media?.type === 'image' ? ctx : ctx.quotedMessage?.media?.type === 'image' ? ctx.quotedMessage : null;
    if (!mediaContext || !mediaContext.media) {
      await adapter.sendMessage(
        ctx.chatId,
        '⚠️ Kirim atau reply gambar QR Code terlebih dahulu untuk memakai fitur ini.',
        { quotedMessageId: ctx.id }
      );
      return;
    }

    await adapter.sendMessage(ctx.chatId, '⏳ Sedang membaca QR Code...', { quotedMessageId: ctx.id });

    try {
      const imageBuffer = await mediaContext.media.getBuffer();

      // Build multipart/form-data payload manually in pure Node/TS
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
      const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="qr.png"\r\nContent-Type: image/png\r\n\r\n`;
      const footer = `\r\n--${boundary}--\r\n`;
      const payload = Buffer.concat([
        Buffer.from(header, 'utf-8'),
        imageBuffer,
        Buffer.from(footer, 'utf-8')
      ]);

      const response = await axios.post('https://api.qrserver.com/v1/read-qr-code/', payload, {
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        timeout: 15000
      });

      const result = response.data?.[0]?.symbol?.[0];
      if (result && result.data) {
        await adapter.sendMessage(
          ctx.chatId,
          `✅ *QR Code Berhasil Dibaca!*\n\n📝 *Hasil:* ${result.data}`,
          { quotedMessageId: ctx.id }
        );
      } else {
        const errorMsg = result?.error || 'QR code tidak terdeteksi atau tidak valid.';
        await adapter.sendMessage(
          ctx.chatId,
          `⚠️ Gagal membaca QR Code: ${errorMsg}`,
          { quotedMessageId: ctx.id }
        );
      }
    } catch (err: any) {
      console.error('[ReadQR] Error reading QR code:', err);
      await adapter.sendMessage(
        ctx.chatId,
        `❌ Terjadi kesalahan saat membaca QR Code: ${err.message}`,
        { quotedMessageId: ctx.id }
      );
    }
  }
}

// Register commands
registerCommand(['ssweb'], new SsWebCommand());
registerCommand(['qr'], new QrCommand());
registerCommand(['readqr'], new ReadQrCommand());
