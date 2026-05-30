import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  downloadContentFromMessage,
  jidNormalizedUser,
  fetchLatestBaileysVersion,
  Browsers,
  WAMessage,
} from '@whiskeysockets/baileys';

import qrcode from 'qrcode-terminal';
import path from 'path';
import pino from 'pino';
import { WhatsAppAdapter, SendMessageOptions } from './whatsapp.adapter.js';
import { MessageContext, MessageMedia } from './message.types.js';
import { env } from '../config/env.js';

export class BaileysAdapter extends WhatsAppAdapter {
  public sock: any;
  private reconnectAttempts = 0;

  public async start(): Promise<void> {
    const sessionDir = path.join(process.cwd(), env.WA_SESSION_NAME);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    const { version, isLatest } = await fetchLatestBaileysVersion();

    console.log(`[WA] Using WhatsApp Web version ${version.join('.')}, latest: ${isLatest}`);

    this.sock = makeWASocket({
      auth: state,
      version,
      browser: Browsers.macOS('Desktop'),
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }) as any,
      markOnlineOnConnect: false,
      syncFullHistory: false,
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
        const shouldReconnect =
          statusCode !== DisconnectReason.loggedOut &&
          statusCode !== 405;
        console.log('Connection closed due to', error, ', reconnecting:', shouldReconnect);
        if (shouldReconnect) {
          const delayMs = Math.min(30_000, 1000 * 2 ** this.reconnectAttempts);
          this.reconnectAttempts++;
          setTimeout(() => {
            this.start().catch(err => console.error('Failed to reconnect WhatsApp:', err));
          }, delayMs);
        } else {
          console.log('[WA] Not reconnecting. Delete session and restart if needed.');
        }
      } else if (connection === 'open') {
        this.reconnectAttempts = 0;
        console.log('Successfully connected to WhatsApp!');
      }
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('group-participants.update', async (update: any) => {
      const { id, participants, action } = update;

      if ((action === 'add' || action === 'remove') && this.groupUpdateHandler) {
        try {
          const selfIds = [this.sock.user?.id, this.sock.user?.lid]
            .filter(Boolean)
            .map((jid) => jidNormalizedUser(jid));

          const targetParticipants = participants
            .map((participant: any) => {
              if (typeof participant === 'string') return participant;
              return participant?.id || participant?.phoneNumber || '';
            })
            .filter(Boolean)
            .filter((participant: string) => !selfIds.includes(jidNormalizedUser(participant)));

          if (targetParticipants.length === 0) return;

          await this.groupUpdateHandler({
            groupId: id,
            participants: targetParticipants,
            action,
          });
        } catch (err) {
          console.error('Error handling group participants update:', err);
        }
      }
    });

    this.sock.ev.on('messages.upsert', async (m: { messages: WAMessage[]; type: string }) => {
      if (m.type !== 'notify') return;

      for (const msg of m.messages) {
        if (!msg.message) continue;
        if (msg.key.fromMe) continue;

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
    const message = msg.message;
    if (!message) return null;

    const chatId = msg.key.remoteJid!;
    const isGroup = chatId.endsWith('@g.us');
    const senderId = msg.key.participant || msg.key.remoteJid!;
    const senderName = msg.pushName || senderId;

    const msgType = Object.keys(message)[0];

    let body = '';

    if (msgType === 'conversation') {
      body = message.conversation || '';
    } else if (msgType === 'extendedTextMessage') {
      body = message.extendedTextMessage?.text || '';
    } else if (msgType === 'imageMessage') {
      body = message.imageMessage?.caption || '';
    } else if (msgType === 'videoMessage') {
      body = message.videoMessage?.caption || '';
    }

    let media: MessageMedia | undefined;

    const mediaMessage =
      message.imageMessage ||
      message.videoMessage ||
      message.stickerMessage ||
      message.documentMessage ||
      message.audioMessage;

    if (mediaMessage) {
      let type: MessageMedia['type'] = 'document';
      const mimeType = (mediaMessage as any).mimetype || '';

      if (message.imageMessage) type = 'image';
      else if (message.videoMessage) type = 'video';
      else if (message.stickerMessage) type = 'sticker';
      else if (message.audioMessage) type = 'audio';

      media = {
        type,
        mimeType,
        filename: (mediaMessage as any).fileName || undefined,
        getBuffer: async () => {
          const downloadType = type === 'sticker' ? 'sticker' : type;
          const stream = await downloadContentFromMessage(mediaMessage as any, downloadType as any);

          let buffer = Buffer.from([]);

          for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
          }

          return buffer;
        },
      };
    }

    let quotedMessage: MessageContext['quotedMessage'];

    const contextInfo =
      message.extendedTextMessage?.contextInfo ||
      (mediaMessage as any)?.contextInfo;

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

      const quotedMediaMessage =
        quoted.imageMessage ||
        quoted.videoMessage ||
        quoted.stickerMessage ||
        quoted.documentMessage ||
        quoted.audioMessage;

      if (quotedMediaMessage) {
        let qType: MessageMedia['type'] = 'document';
        const qMimeType = (quotedMediaMessage as any).mimetype || '';

        if (quoted.imageMessage) qType = 'image';
        else if (quoted.videoMessage) qType = 'video';
        else if (quoted.stickerMessage) qType = 'sticker';
        else if (quoted.audioMessage) qType = 'audio';

        quotedMedia = {
          type: qType,
          mimeType: qMimeType,
          filename: (quotedMediaMessage as any).fileName || undefined,
          getBuffer: async () => {
            const downloadType = qType === 'sticker' ? 'sticker' : qType;
            const stream = await downloadContentFromMessage(
              quotedMediaMessage as any,
              downloadType as any
            );

            let buffer = Buffer.from([]);

            for await (const chunk of stream) {
              buffer = Buffer.concat([buffer, chunk]);
            }

            return buffer;
          },
        };
      }

      quotedMessage = {
        id: contextInfo.stanzaId || '',
        senderId: contextInfo.participant || '',
        body: quotedBody,
        media: quotedMedia,
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
      quotedMessage,
    };
  }

  public async sendMessage(
    chatId: string,
    text: string,
    options?: SendMessageOptions
  ): Promise<void> {
    const mentions = options?.mentions || [];

    await this.sock.sendMessage(chatId, {
      text,
      mentions,
    });
  }

  public async sendSticker(
    chatId: string,
    stickerBuffer: Buffer,
    options?: SendMessageOptions
  ): Promise<void> {
    await this.sock.sendMessage(chatId, {
      sticker: stickerBuffer,
    });
  }

  public async sendImage(
    chatId: string,
    imageBuffer: Buffer,
    caption?: string,
    options?: SendMessageOptions
  ): Promise<void> {
    await this.sock.sendMessage(chatId, {
      image: imageBuffer,
      caption,
    });
  }

  public async sendVideo(
    chatId: string,
    videoBuffer: Buffer,
    caption?: string,
    options?: SendMessageOptions
  ): Promise<void> {
    await this.sock.sendMessage(chatId, {
      video: videoBuffer,
      caption,
    });
  }

  public async sendAudio(
    chatId: string,
    audioBuffer: Buffer,
    options?: SendMessageOptions
  ): Promise<void> {
    const mentions = options?.mentions || [];

    await this.sock.sendMessage(chatId, {
      audio: audioBuffer,
      mimetype: 'audio/mp4',
      ptt: false,
      mentions,
    });
  }

  public async sendVoiceNote(
    chatId: string,
    audioBuffer: Buffer,
    options?: SendMessageOptions
  ): Promise<void> {
    const mentions = options?.mentions || [];

    await this.sock.sendMessage(chatId, {
      audio: audioBuffer,
      mimetype: 'audio/mp4',
      ptt: true,
      mentions,
    });
  }

  public async sendDocument(
    chatId: string,
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    options?: SendMessageOptions
  ): Promise<void> {
    const mentions = options?.mentions || [];

    await this.sock.sendMessage(chatId, {
      document: buffer,
      fileName,
      mimetype: mimeType,
      mentions,
    });
  }

  public async deleteMessage(
    chatId: string,
    messageId: string,
    senderId?: string
  ): Promise<void> {
    await this.sock.sendMessage(chatId, {
      delete: {
        remoteJid: chatId,
        id: messageId,
        participant: senderId,
        fromMe: false,
      },
    });
  }
}