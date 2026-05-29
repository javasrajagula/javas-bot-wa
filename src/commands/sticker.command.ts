import { Command, registerCommand } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import { convertToSticker } from '../services/media/sticker.service.js';
import { overlayTextOnImage, TextOverlayOptions } from '../services/media/text-overlay.service.js';
import { convertStickerToImage } from '../services/media/sticker-to-image.service.js';

export class StickerCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const isStickerTeks = ctx.body.trim().toLowerCase().startsWith('/stikerteks');
    let text = args.join(' ').trim();
    let textPosition: 'atas' | 'tengah' | 'bawah' = 'bawah';

    // Parse options: atas:teks, tengah:teks, bawah:teks
    if (text) {
      if (text.toLowerCase().startsWith('atas:')) {
        textPosition = 'atas';
        text = text.slice(5).trim();
      } else if (text.toLowerCase().startsWith('tengah:')) {
        textPosition = 'tengah';
        text = text.slice(7).trim();
      } else if (text.toLowerCase().startsWith('bawah:')) {
        textPosition = 'bawah';
        text = text.slice(6).trim();
      }
    }

    if (text.length > 80) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Teks terlalu panjang (maksimal 80 karakter).', { quotedMessageId: ctx.id });
      return;
    }

    // Resolve media from message or quoted message
    let media = ctx.media;
    if (!media && ctx.quotedMessage && ctx.quotedMessage.media) {
      media = ctx.quotedMessage.media;
    }

    if (!media || (media.type !== 'image' && media.type !== 'sticker')) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Reply/kirim gambar dulu, lalu pakai command ini.', { quotedMessageId: ctx.id });
      return;
    }

    try {
      const imgBuffer = await media.getBuffer();
      let stickerBuffer: Buffer;

      if (text) {
        // Overlay text
        stickerBuffer = await overlayTextOnImage(imgBuffer, text, { position: textPosition });
      } else {
        // Convert normally
        stickerBuffer = await convertToSticker(imgBuffer);
      }

      await adapter.sendSticker(ctx.chatId, stickerBuffer, { quotedMessageId: ctx.id });
    } catch (err: any) {
      console.error('Failed to create sticker:', err);
      await adapter.sendMessage(ctx.chatId, `❌ Gagal memproses stiker: ${err.message || err}`, { quotedMessageId: ctx.id });
    }
  }
}

export class ToImageCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    let media = ctx.media;
    if (!media && ctx.quotedMessage && ctx.quotedMessage.media) {
      media = ctx.quotedMessage.media;
    }

    if (!media || media.type !== 'sticker') {
      await adapter.sendMessage(ctx.chatId, '⚠️ Reply stiker dulu untuk mengubahnya ke gambar.', { quotedMessageId: ctx.id });
      return;
    }

    try {
      const stickerBuffer = await media.getBuffer();
      // PNG conversion
      const imageBuffer = await convertStickerToImage(stickerBuffer);
      await adapter.sendImage(ctx.chatId, imageBuffer, 'Stiker berhasil diubah ke gambar.', { quotedMessageId: ctx.id });
    } catch (err: any) {
      console.error('Failed to convert sticker to image:', err);
      await adapter.sendMessage(ctx.chatId, `❌ Gagal mengubah stiker ke gambar: ${err.message || err}`, { quotedMessageId: ctx.id });
    }
  }
}

// Register commands
const stickerCmd = new StickerCommand();
registerCommand(['stiker', 's', 'stikerteks'], stickerCmd);

const toImgCmd = new ToImageCommand();
registerCommand(['toimg'], toImgCmd);
