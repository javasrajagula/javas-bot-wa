import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  downloadContentFromMessage,
  WAMessage,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import path from 'path';
import pino from 'pino';
import { WhatsAppAdapter, SendMessageOptions } from './whatsapp.adapter.js';
import { MessageContext, MessageMedia } from './message.types.js';
import { env } from '../config/env.js';

export class BaileysAdapter extends WhatsAppAdapter {
  private sock: any;

  public async start(): Promise<void> {
    const sessionDir = path.join(process.cwd(), env.WA_SESSION_NAME);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    this.sock = makeWASocket.default({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }) as any,
    });

    this.sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        qrcode.generate(qr, { small: true });
        console.log('Scan the QR Code above to connect your bot to WhatsApp!');
      }

      if (connection === 'close') {
        const error = lastDisconnect?.error;
        const statusCode = error?.output?.statusCode ?? (error as any)?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log('Connection closed due to', error, ', reconnecting:', shouldReconnect);
        if (shouldReconnect) {
          this.start();
        }
      } else if (connection === 'open') {
        console.log('Successfully connected to WhatsApp!');
      }
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('group-participants.update', async (update: any) => {
      const { id, participants, action } = update;
      if ((action === 'add' || action === 'remove') && this.groupUpdateHandler) {
        try {
          await this.groupUpdateHandler({ groupId: id, participants, action });
        } catch (err) {
          console.error('Error handling group participants update:', err);
        }
      }
    });

    this.sock.ev.on('messages.upsert', async (m: { messages: WAMessage[]; type: string }) => {
      if (m.type !== 'notify') return;

      for (const msg of m.messages) {
        if (!msg.message) continue;
        if (msg.key.fromMe) continue; // Ignore messages from the bot itself

        const ctx = await this.parseMessage(msg);
        if (ctx && this.messageHandler) {
          try {
            await this.messageHandler(ctx);
          } catch (err) {
            console.error('Error in message handler:', err);
          }
        }
      }
    });
  }

  private async parseMessage(msg: WAMessage): Promise<MessageContext | null> {
    const chatId = msg.key.remoteJid!;
    const isGroup = chatId.endsWith('@g.us');
    const senderId = msg.key.participant || msg.key.remoteJid!;
    const senderName = msg.pushName || senderId;

    const msgType = Object.keys(msg.message!)[0];
    let body = '';
    if (msgType === 'conversation') {
      body = msg.message.conversation || '';
    } else if (msgType === 'extendedTextMessage') {
      body = msg.message.extendedTextMessage?.text || '';
    } else if (msgType === 'imageMessage') {
      body = msg.message.imageMessage?.caption || '';
    } else if (msgType === 'videoMessage') {
      body = msg.message.videoMessage?.caption || '';
    }

    let media: MessageMedia | undefined;
    const mediaMessage = msg.message.imageMessage || msg.message.videoMessage || msg.message.stickerMessage || msg.message.documentMessage;
    if (mediaMessage) {
      let type: MessageMedia['type'] = 'document';
      let mimeType = (mediaMessage as any).mimetype || '';

      if (msg.message.imageMessage) type = 'image';
      else if (msg.message.videoMessage) type = 'video';
      else if (msg.message.stickerMessage) type = 'sticker';

      media = {
        type,
        mimeType,
        getBuffer: async () => {
          const stream = await downloadContentFromMessage(mediaMessage as any, type === 'sticker' ? 'sticker' : type);
          let buffer = Buffer.from([]);
          for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
          }
          return buffer;
        }
      };
    }

    let quotedMessage: MessageContext['quotedMessage'];
    const contextInfo = msg.message.extendedTextMessage?.contextInfo || (mediaMessage as any)?.contextInfo;
    if (contextInfo && contextInfo.quotedMessage) {
      const quoted = contextInfo.quotedMessage;
      const quotedMsgType = Object.keys(quoted)[0];
      let quotedBody = '';
      if (quotedMsgType === 'conversation') {
        quotedBody = quoted.conversation || '';
      } else if (quotedMsgType === 'extendedTextMessage') {
        quotedBody = quoted.extendedTextMessage?.text || '';
      } else if (quotedMsgType === 'imageMessage') {
        quotedBody = quoted.imageMessage?.caption || '';
      } else if (quotedMsgType === 'videoMessage') {
        quotedBody = quoted.videoMessage?.caption || '';
      }

      let quotedMedia: MessageMedia | undefined;
      const quotedMediaMessage = quoted.imageMessage || quoted.videoMessage || quoted.stickerMessage || quoted.documentMessage;
      if (quotedMediaMessage) {
        let qType: MessageMedia['type'] = 'document';
        let qMimeType = (quotedMediaMessage as any).mimetype || '';

        if (quoted.imageMessage) qType = 'image';
        else if (quoted.videoMessage) qType = 'video';
        else if (quoted.stickerMessage) qType = 'sticker';

        quotedMedia = {
          type: qType,
          mimeType: qMimeType,
          getBuffer: async () => {
            const stream = await downloadContentFromMessage(quotedMediaMessage as any, qType === 'sticker' ? 'sticker' : qType);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
              buffer = Buffer.concat([buffer, chunk]);
            }
            return buffer;
          }
        };
      }

      quotedMessage = {
        id: contextInfo.stanzaId || '',
        senderId: contextInfo.participant || '',
        body: quotedBody,
        media: quotedMedia
      };
    }

    return {
      id: msg.key.id!,
      senderId,
      senderName,
      chatId,
      isGroup,
      body,
      media,
      quotedMessage
    };
  }

  public async sendMessage(chatId: string, text: string, options?: SendMessageOptions): Promise<void> {
    const quoted = options?.quotedMessageId ? { key: { remoteJid: chatId, id: options.quotedMessageId } } : undefined;
    const mentions = options?.mentions || [];
    await this.sock.sendMessage(chatId, { text, mentions }, { quoted });
  }

  public async sendSticker(chatId: string, stickerBuffer: Buffer, options?: SendMessageOptions): Promise<void> {
    const quoted = options?.quotedMessageId ? { key: { remoteJid: chatId, id: options.quotedMessageId } } : undefined;
    await this.sock.sendMessage(chatId, { sticker: stickerBuffer }, { quoted });
  }

  public async sendImage(chatId: string, imageBuffer: Buffer, caption?: string, options?: SendMessageOptions): Promise<void> {
    const quoted = options?.quotedMessageId ? { key: { remoteJid: chatId, id: options.quotedMessageId } } : undefined;
    await this.sock.sendMessage(chatId, { image: imageBuffer, caption }, { quoted });
  }

  public async sendVideo(chatId: string, videoBuffer: Buffer, caption?: string, options?: SendMessageOptions): Promise<void> {
    const quoted = options?.quotedMessageId ? { key: { remoteJid: chatId, id: options.quotedMessageId } } : undefined;
    await this.sock.sendMessage(chatId, { video: videoBuffer, caption }, { quoted });
  }
}
