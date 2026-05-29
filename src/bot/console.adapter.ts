import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { WhatsAppAdapter, SendMessageOptions } from './whatsapp.adapter.js';
import { MessageContext, MessageMedia } from './message.types.js';

export class ConsoleAdapter extends WhatsAppAdapter {
  private rl!: readline.Interface;

  public async start(): Promise<void> {
    console.log('\n======================================');
    console.log('      WhatsApp Bot Console Mode');
    console.log('======================================');
    console.log('Format input:');
    console.log('  [senderId in chatId] message_text');
    console.log('Options for simulating media:');
    console.log('  --image <path>        (Simulates message with image)');
    console.log('  --sticker <path>      (Simulates message with sticker)');
    console.log('  --reply-image <path>  (Simulates replying to image)');
    console.log('  --reply-sticker <path> (Simulates replying to sticker)');
    console.log('Examples:');
    console.log('  [user1 in group1] /menu');
    console.log('  [user1 in group1] /s --image c:\\test.png');
    console.log('  [user1 in group1] /toimg --reply-sticker c:\\test.webp');
    console.log('Type "/exit" to stop the bot.');
    console.log('======================================\n');

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> '
    });

    this.rl.prompt();

    this.rl.on('line', async (line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        this.rl.prompt();
        return;
      }

      if (trimmed === '/exit') {
        console.log('Exiting Console Mode...');
        process.exit(0);
      }

      const match = trimmed.match(/^\[([^\]]+)\s+in\s+([^\]]+)\]\s*(.*)$/);
      if (!match) {
        console.log('Invalid format. Use: [senderId in chatId] message_text');
        this.rl.prompt();
        return;
      }

      const senderId = match[1].trim();
      const chatId = match[2].trim();
      let bodyText = match[3].trim();
      const isGroup = chatId.startsWith('group') || chatId.includes('@g.us');

      let media: MessageMedia | undefined;
      let quotedMessage: MessageContext['quotedMessage'];

      // Parse simulated media
      const imgMatch = bodyText.match(/--image\s+(\S+)/);
      const stkMatch = bodyText.match(/--sticker\s+(\S+)/);
      const repImgMatch = bodyText.match(/--reply-image\s+(\S+)/);
      const repStkMatch = bodyText.match(/--reply-sticker\s+(\S+)/);

      if (imgMatch) {
        const filePath = imgMatch[1];
        if (fs.existsSync(filePath)) {
          media = {
            type: 'image',
            mimeType: 'image/png',
            getBuffer: async () => fs.promises.readFile(filePath),
            filename: path.basename(filePath)
          };
          bodyText = bodyText.replace(/--image\s+\S+/, '').trim();
        } else {
          console.log(`Error: File not found: ${filePath}`);
        }
      } else if (stkMatch) {
        const filePath = stkMatch[1];
        if (fs.existsSync(filePath)) {
          media = {
            type: 'sticker',
            mimeType: 'image/webp',
            getBuffer: async () => fs.promises.readFile(filePath),
            filename: path.basename(filePath)
          };
          bodyText = bodyText.replace(/--sticker\s+\S+/, '').trim();
        } else {
          console.log(`Error: File not found: ${filePath}`);
        }
      }

      if (repImgMatch) {
        const filePath = repImgMatch[1];
        if (fs.existsSync(filePath)) {
          quotedMessage = {
            id: `quoted-${Date.now()}`,
            senderId: 'other_user',
            body: '',
            media: {
              type: 'image',
              mimeType: 'image/png',
              getBuffer: async () => fs.promises.readFile(filePath),
              filename: path.basename(filePath)
            }
          };
          bodyText = bodyText.replace(/--reply-image\s+\S+/, '').trim();
        } else {
          console.log(`Error: File not found: ${filePath}`);
        }
      } else if (repStkMatch) {
        const filePath = repStkMatch[1];
        if (fs.existsSync(filePath)) {
          quotedMessage = {
            id: `quoted-${Date.now()}`,
            senderId: 'other_user',
            body: '',
            media: {
              type: 'sticker',
              mimeType: 'image/webp',
              getBuffer: async () => fs.promises.readFile(filePath),
              filename: path.basename(filePath)
            }
          };
          bodyText = bodyText.replace(/--reply-sticker\s+\S+/, '').trim();
        } else {
          console.log(`Error: File not found: ${filePath}`);
        }
      }

      const ctx: MessageContext = {
        id: `msg-${Date.now()}`,
        senderId,
        senderName: senderId,
        chatId,
        isGroup,
        body: bodyText,
        media,
        quotedMessage
      };

      if (this.messageHandler) {
        try {
          await this.messageHandler(ctx);
        } catch (err) {
          console.error('Error handling message:', err);
        }
      }

      this.rl.prompt();
    });
  }

  public async sendMessage(chatId: string, text: string, options?: SendMessageOptions): Promise<void> {
    console.log(`\n[Out -> ${chatId}]: ${text}`);
    if (options?.quotedMessageId) {
      console.log(`   (Reply to: ${options.quotedMessageId})`);
    }
    if (options?.mentions && options.mentions.length > 0) {
      console.log(`   (Mentions: ${options.mentions.join(', ')})`);
    }
    this.rl?.prompt();
  }

  public async sendSticker(chatId: string, stickerBuffer: Buffer, options?: SendMessageOptions): Promise<void> {
    console.log(`\n[Out -> ${chatId}] <Sticker: ${stickerBuffer.length} bytes>`);
    if (options?.quotedMessageId) {
      console.log(`   (Reply to: ${options.quotedMessageId})`);
    }
    try {
      const outDir = path.join(process.cwd(), 'temp_outputs');
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      const outPath = path.join(outDir, `sticker_${Date.now()}.webp`);
      fs.writeFileSync(outPath, stickerBuffer);
      console.log(`   (Saved output sticker to: ${outPath})`);
    } catch (err) {
      console.error('   (Failed to save output sticker locally)', err);
    }
    this.rl?.prompt();
  }

  public async sendImage(chatId: string, imageBuffer: Buffer, caption?: string, options?: SendMessageOptions): Promise<void> {
    console.log(`\n[Out -> ${chatId}] <Image: ${imageBuffer.length} bytes>${caption ? ` - "${caption}"` : ''}`);
    if (options?.quotedMessageId) {
      console.log(`   (Reply to: ${options.quotedMessageId})`);
    }
    try {
      const outDir = path.join(process.cwd(), 'temp_outputs');
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      const outPath = path.join(outDir, `image_${Date.now()}.png`);
      fs.writeFileSync(outPath, imageBuffer);
      console.log(`   (Saved output image to: ${outPath})`);
    } catch (err) {
      console.error('   (Failed to save output image locally)', err);
    }
    this.rl?.prompt();
  }

  public async sendVideo(chatId: string, videoBuffer: Buffer, caption?: string, options?: SendMessageOptions): Promise<void> {
    console.log(`\n[Out -> ${chatId}] <Video: ${videoBuffer.length} bytes>${caption ? ` - "${caption}"` : ''}`);
    if (options?.quotedMessageId) {
      console.log(`   (Reply to: ${options.quotedMessageId})`);
    }
    try {
      const outDir = path.join(process.cwd(), 'temp_outputs');
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      const outPath = path.join(outDir, `video_${Date.now()}.mp4`);
      fs.writeFileSync(outPath, videoBuffer);
      console.log(`   (Saved output video to: ${outPath})`);
    } catch (err) {
      console.error('   (Failed to save output video locally)', err);
    }
    this.rl?.prompt();
  }

  public async sendAudio(chatId: string, audioBuffer: Buffer, options?: SendMessageOptions): Promise<void> {
    console.log(`\n[Out -> ${chatId}] <Audio: ${audioBuffer.length} bytes>`);
    if (options?.quotedMessageId) {
      console.log(`   (Reply to: ${options.quotedMessageId})`);
    }
    try {
      const outDir = path.join(process.cwd(), 'temp_outputs');
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      const outPath = path.join(outDir, `audio_${Date.now()}.mp3`);
      fs.writeFileSync(outPath, audioBuffer);
      console.log(`   (Saved output audio to: ${outPath})`);
    } catch (err) {
      console.error('   (Failed to save output audio locally)', err);
    }
    this.rl?.prompt();
  }

  public async sendVoiceNote(chatId: string, audioBuffer: Buffer, options?: SendMessageOptions): Promise<void> {
    console.log(`\n[Out -> ${chatId}] <VoiceNote: ${audioBuffer.length} bytes>`);
    if (options?.quotedMessageId) {
      console.log(`   (Reply to: ${options.quotedMessageId})`);
    }
    try {
      const outDir = path.join(process.cwd(), 'temp_outputs');
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      const outPath = path.join(outDir, `vn_${Date.now()}.mp3`);
      fs.writeFileSync(outPath, audioBuffer);
      console.log(`   (Saved output voice note to: ${outPath})`);
    } catch (err) {
      console.error('   (Failed to save output voice note locally)', err);
    }
    this.rl?.prompt();
  }

  public async sendDocument(chatId: string, buffer: Buffer, fileName: string, mimeType: string, options?: SendMessageOptions): Promise<void> {
    console.log(`\n[Out -> ${chatId}] <Document: ${fileName} (${mimeType}) - ${buffer.length} bytes>`);
    if (options?.quotedMessageId) {
      console.log(`   (Reply to: ${options.quotedMessageId})`);
    }
    try {
      const outDir = path.join(process.cwd(), 'temp_outputs');
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      const outPath = path.join(outDir, `doc_${Date.now()}_${fileName}`);
      fs.writeFileSync(outPath, buffer);
      console.log(`   (Saved output document to: ${outPath})`);
    } catch (err) {
      console.error('   (Failed to save output document locally)', err);
    }
    this.rl?.prompt();
  }

  public async deleteMessage(chatId: string, messageId: string, senderId?: string): Promise<void> {
    console.log(`\n[System] Deleted message ${messageId} sent by ${senderId} in chat ${chatId}.`);
    this.rl?.prompt();
  }
}
