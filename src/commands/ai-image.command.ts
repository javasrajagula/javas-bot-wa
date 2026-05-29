import { Command, registerCommand } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import { isPremium } from '../bot/permission.js';
import sharp from 'sharp';

export class AiImageCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    // 1. Premium Permission Check
    const premium = await isPremium(ctx.senderId);
    if (!premium) {
      await adapter.sendMessage(
        ctx.chatId,
        '⚠️ Fitur ini hanya untuk premium user.',
        { quotedMessageId: ctx.id }
      );
      return;
    }

    const commandType = ctx.body.split(/\s+/)[0].slice(1).toLowerCase();

    // Find the image attachment (either direct or quoted)
    const mediaContext = ctx.media?.type === 'image' ? ctx : ctx.quotedMessage?.media?.type === 'image' ? ctx.quotedMessage : null;
    if (!mediaContext || !mediaContext.media) {
      await adapter.sendMessage(
        ctx.chatId,
        '⚠️ Kirim atau reply gambar terlebih dahulu untuk memakai fitur ini.',
        { quotedMessageId: ctx.id }
      );
      return;
    }

    await adapter.sendMessage(ctx.chatId, '⏳ Sedang memproses gambar dengan AI local adapter...', { quotedMessageId: ctx.id });

    try {
      const inputBuffer = await mediaContext.media.getBuffer();
      let outputBuffer: Buffer;

      if (commandType === 'avatar') {
        const style = args[0]?.toLowerCase() || 'anime';
        const validStyles = ['anime', 'kartun', 'cyberpunk', '3d'];

        if (!validStyles.includes(style)) {
          await adapter.sendMessage(
            ctx.chatId,
            '⚠️ Gaya avatar tidak valid. Gaya yang tersedia: `anime`, `kartun`, `cyberpunk`, `3d`',
            { quotedMessageId: ctx.id }
          );
          return;
        }

        // Local Sharp styling simulator
        if (style === 'cyberpunk') {
          outputBuffer = await sharp(inputBuffer)
            .modulate({ saturation: 1.8 })
            .tint({ r: 230, g: 0, b: 120 }) // Magenta tint
            .toBuffer();
        } else if (style === 'anime') {
          outputBuffer = await sharp(inputBuffer)
            .modulate({ brightness: 1.25, saturation: 1.5 })
            .median(2)
            .sharpen()
            .toBuffer();
        } else if (style === 'kartun') {
          outputBuffer = await sharp(inputBuffer)
            .modulate({ saturation: 2.0 })
            .linear(1.3, -0.15) // High contrast
            .toBuffer();
        } else {
          // 3d
          outputBuffer = await sharp(inputBuffer)
            .modulate({ brightness: 1.1, saturation: 1.3 })
            .sharpen({ sigma: 1.5 })
            .toBuffer();
        }

        await adapter.sendImage(ctx.chatId, outputBuffer, `🎨 AI Avatar [Style: ${style.toUpperCase()}]`, {
          quotedMessageId: ctx.id
        });
      } else if (commandType === 'bg') {
        const description = args.join(' ').trim() || 'studio putih';

        // Local Sharp Background changer simulator
        // 1. Resize input to make it fit nicely
        const resizedInput = await sharp(inputBuffer)
          .resize(500, 500, { fit: 'inside' })
          .toBuffer();

        // 2. Generate a custom gradient/solid background based on description
        let r = 240, g = 240, b = 240; // Default white studio
        if (description.includes('pantai') || description.includes('beach') || description.includes('kuning')) {
          r = 250; g = 200; b = 100; // Warm beach sunset color
        } else if (description.includes('malam') || description.includes('night') || description.includes('dark')) {
          r = 20; g = 30; b = 50; // Dark night color
        } else if (description.includes('hijau') || description.includes('green') || description.includes('forest')) {
          r = 40; g = 100; b = 60; // Forest green
        } else if (description.includes('neon') || description.includes('cyber')) {
          r = 130; g = 10; b = 180; // Cyberpunk violet
        }

        // Composite user image on the generated solid color background canvas
        outputBuffer = await sharp({
          create: {
            width: 800,
            height: 800,
            channels: 3,
            background: { r, g, b }
          }
        })
          .composite([{ input: resizedInput, gravity: 'center' }])
          .png()
          .toBuffer();

        await adapter.sendImage(ctx.chatId, outputBuffer, `🌅 AI Background Changed: *${description}*`, {
          quotedMessageId: ctx.id
        });
      }
    } catch (err: any) {
      await adapter.sendMessage(
        ctx.chatId,
        `❌ Gagal memproses gambar AI: ${err.message || 'Terjadi kesalahan sistem.'}`,
        { quotedMessageId: ctx.id }
      );
    }
  }
}

// Register AI commands
const aiImgCmd = new AiImageCommand();
registerCommand(['avatar', 'bg'], aiImgCmd);
