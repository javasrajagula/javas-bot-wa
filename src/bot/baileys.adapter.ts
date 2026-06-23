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
import fs from 'fs';
import pino from 'pino';
import { WhatsAppAdapter, SendMessageOptions } from './whatsapp.adapter.js';
import { MessageContext, MessageMedia } from './message.types.js';
import { env } from '../config/env.js';
import { normalizeJid } from '../utils/jid.util.js';

function maskJid(jid: string): string {
  if (!jid) return '';
  const parts = jid.split('@');
  const user = parts[0];
  const server = parts[1] || '';
  if (user.includes(':')) {
    const subParts = user.split(':');
    return `${subParts[0].slice(0, 4)}***:${subParts[1]}@${server}`;
  }
  return `${user.slice(0, 4)}***@${server}`;
}

function unwrapMessage(msg: any): any {
  if (!msg) return msg;
  if (msg.ephemeralMessage?.message) return unwrapMessage(msg.ephemeralMessage.message);
  if (msg.viewOnceMessage?.message) return unwrapMessage(msg.viewOnceMessage.message);
  if (msg.viewOnceMessageV2?.message) return unwrapMessage(msg.viewOnceMessageV2.message);
  if (msg.documentWithCaptionMessage?.message) return unwrapMessage(msg.documentWithCaptionMessage.message);
  if (msg.editedMessage?.message?.protocolMessage?.editedMessage) {
    return unwrapMessage(msg.editedMessage.message.protocolMessage.editedMessage);
  }
  return msg;
}

function checkIfViewOnce(msg: any): boolean {
  if (!msg) return false;
  if (msg.viewOnceMessage || msg.viewOnceMessageV2) return true;
  if (msg.ephemeralMessage?.message) return checkIfViewOnce(msg.ephemeralMessage.message);
  if (msg.documentWithCaptionMessage?.message) return checkIfViewOnce(msg.documentWithCaptionMessage.message);
  if (msg.editedMessage?.message?.protocolMessage?.editedMessage) {
    return checkIfViewOnce(msg.editedMessage.message.protocolMessage.editedMessage);
  }
  return false;
}

export class BaileysAdapter extends WhatsAppAdapter {
  public sock: any;
  private reconnectAttempts = 0;
  private messageKeyCache = new Map<string, any>();
  private lidToPhoneMap = new Map<string, string>();

  private loadJidMap() {
    try {
      const mapPath = path.join(process.cwd(), 'data', 'jid_map.json');
      if (fs.existsSync(mapPath)) {
        const data = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
        for (const [lid, phone] of Object.entries(data)) {
          this.lidToPhoneMap.set(lid, phone as string);
        }
        console.log(`[WA] Loaded ${this.lidToPhoneMap.size} JID mapping(s) from persistent storage.`);
      }
    } catch (err) {
      console.error('[WA] Failed to load JID map:', err);
    }
  }

  private saveJidMap() {
    try {
      const mapPath = path.join(process.cwd(), 'data', 'jid_map.json');
      fs.mkdirSync(path.dirname(mapPath), { recursive: true });
      const obj = Object.fromEntries(this.lidToPhoneMap.entries());
      fs.writeFileSync(mapPath, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
      console.error('[WA] Failed to save JID map:', err);
    }
  }

  public updateJidMap(contacts: any[]) {
    if (!contacts || !Array.isArray(contacts)) return;
    let changed = false;
    for (const contact of contacts) {
      if (contact.id && contact.lid) {
        const phoneJid = contact.id.split(':')[0] + '@s.whatsapp.net';
        const lidJid = contact.lid.split(':')[0] + '@lid';
        if (this.lidToPhoneMap.get(lidJid) !== phoneJid) {
          this.lidToPhoneMap.set(lidJid, phoneJid);
          changed = true;
        }
      }
    }
    if (changed) {
      this.saveJidMap();
    }
  }

  public updateJidMapFromParticipants(participants: any[]) {
    if (!participants || !Array.isArray(participants)) return;
    let changed = false;
    for (const p of participants) {
      if (p.id && p.lid) {
        const phoneJid = p.id.split(':')[0] + '@s.whatsapp.net';
        const lidJid = p.lid.split(':')[0] + '@lid';
        if (this.lidToPhoneMap.get(lidJid) !== phoneJid) {
          this.lidToPhoneMap.set(lidJid, phoneJid);
          changed = true;
        }
      }
    }
    if (changed) {
      this.saveJidMap();
    }
  }

  public async start(): Promise<void> {
    this.loadJidMap();
    if (this.sock) {
      console.log('[WA] Closing old socket and clearing event listeners...');
      try {
        this.sock.ev.removeAllListeners('connection.update');
        this.sock.ev.removeAllListeners('creds.update');
        this.sock.ev.removeAllListeners('group-participants.update');
        this.sock.ev.removeAllListeners('messages.upsert');
        this.sock.end(new Error('Reconnecting socket'));
      } catch (err) {
        console.error('[WA] Error ending old socket:', err);
      }
    }

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

    this.sock.ev.on('contacts.upsert', (contacts: any[]) => {
      this.updateJidMap(contacts);
    });

    this.sock.ev.on('contacts.update', (contacts: any[]) => {
      this.updateJidMap(contacts);
    });

    const originalGroupMetadata = this.sock.groupMetadata.bind(this.sock);
    this.sock.groupMetadata = async (jid: string) => {
      const metadata = await originalGroupMetadata(jid);
      if (metadata && metadata.participants) {
        this.updateJidMapFromParticipants(metadata.participants);
      }
      return metadata;
    };

    this.sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (connection === 'open') {
        this.isConnected = true;
      } else if (connection === 'close') {
        this.isConnected = false;
      }

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

        try {
          const groups = await this.sock.groupFetchAllParticipating();

          console.log('\n[DAFTAR GRUP BOT]');
          for (const [id, group] of Object.entries(groups)) {
            console.log(`${(group as any).subject} => ${id}`);
            if ((group as any).participants) {
              this.updateJidMapFromParticipants((group as any).participants);
            }
          }
          console.log('[END DAFTAR GRUP BOT]\n');
        } catch (err) {
          console.error('[DEBUG GROUP LIST ERROR]', err);
        }
      }
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('call', async (calls: any[]) => {
      for (const call of calls) {
        if (call.status === 'offer') {
          try {
            await this.sock.rejectCall(call.id, call.from);
            const warningMsg = `⚠️ *Sistem Otomatis Bot* ⚠️\n\nMaaf, bot tidak menerima panggilan telepon/video. Silakan kirim pesan teks atau gunakan perintah bot. Menelepon bot berkali-kali dapat menyebabkan nomor Anda diblokir otomatis.`;
            await this.sendMessage(call.from, warningMsg);
          } catch (err) {
            console.error('[Call Filter] Failed to reject call:', err);
          }
        }
      }
    });

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
      if (m.type === 'append') {
        // Sync riwayat — abaikan tanpa log agar terminal tidak spam
        return;
      }
      console.log(`[WA] Received messages.upsert of type: ${m.type}, count: ${m.messages?.length}`);
      if (m.type !== 'notify') return;

      for (const msg of m.messages) {
        if (!msg.message) {
          console.log(`[WA] Ignored message: no message content`);
          continue;
        }

        // --- DELETION / REVOKE HANDLER ---
        const protocolMessage = msg.message?.protocolMessage;
        if (protocolMessage && (protocolMessage.type === 3 || (protocolMessage.type as any) === 'REVOKE')) {
          const deletedId = protocolMessage.key?.id;
          if (deletedId) {
            await this.handleAntiDelete(protocolMessage.key);
          }
          continue;
        }

        if (msg.key.fromMe) {
          console.log(`[WA] Ignored message: fromMe is true (self message)`);
          continue;
        }

        const ctx = await this.parseMessage(msg);
        console.log(`[WA] Parsed message: sender=${ctx?.senderId}, body="${ctx?.body}"`);

        // --- CACHE THE MESSAGE FOR ANTI-DELETE ---
        if (ctx && ctx.id) {
          try {
            const isGroup = ctx.isGroup;
            let cachedMedia: any = undefined;

            if (ctx.media) {
              const { getGroupFeatures } = await import('../config/feature-flags.js');
              const flags: any = isGroup ? await getGroupFeatures(ctx.chatId).catch(() => ({})) : {};
              if (!isGroup || flags.antidelete) {
                try {
                  const buf = await ctx.media.getBuffer();
                  cachedMedia = {
                    type: ctx.media.type,
                    mimeType: ctx.media.mimeType,
                    buffer: buf,
                    filename: ctx.media.filename
                  };
                } catch (err) {
                  console.error('[Message Cache] Failed to download media buffer:', err);
                }
              }
            }

            const { messageCache } = await import('../services/state/message-cache.js');
            messageCache.set(ctx.id, {
              body: ctx.body,
              senderId: ctx.senderId,
              senderName: ctx.senderName,
              chatId: ctx.chatId,
              media: cachedMedia,
              timestamp: Date.now()
            });
          } catch (err) {
            console.error('[Message Cache] Error caching message:', err);
          }
        }

        if (ctx && this.messageHandler) {
          try {
            await this.messageHandler(ctx);
          } catch (err) {
            console.error('[WA] Error in message handler:', err);
          }
        }
      }
    });
  }

  private async parseMessage(msg: WAMessage): Promise<MessageContext | null> {
    const isViewOnce = checkIfViewOnce(msg.message);
    const message = unwrapMessage(msg.message);
    if (!message) return null;

    let chatId = msg.key.remoteJid!;
    const isGroup = chatId.endsWith('@g.us');
    let senderId = msg.key.participant || msg.key.remoteJid!;

    chatId = this.resolveToPhoneJid(chatId);
    senderId = this.resolveToPhoneJid(senderId);
    const senderName = msg.pushName || senderId;
    if (env.LOG_LEVEL === 'debug') {
      console.log('[DEBUG CHAT ID]', {
        chatId: maskJid(chatId),
        isGroup,
        senderId: maskJid(senderId),
        senderName
      });
    }

    if (msg.key.id) {
      this.messageKeyCache.set(msg.key.id, msg.key);
      if (this.messageKeyCache.size > 1000) {
        const firstKey = this.messageKeyCache.keys().next().value;
        if (firstKey) this.messageKeyCache.delete(firstKey);
      }
    }

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
    } else if (msgType === 'documentMessage') {
      body = message.documentMessage?.caption || '';
    } else if (msgType === 'buttonsResponseMessage') {
      body = message.buttonsResponseMessage?.selectedButtonId || '';
    } else if (msgType === 'listResponseMessage') {
      body = message.listResponseMessage?.singleSelectReply?.selectedRowId || '';
    } else if (msgType === 'templateButtonReplyMessage') {
      body = message.templateButtonReplyMessage?.selectedId || '';
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
          try {
            const stream = await downloadContentFromMessage(mediaMessage as any, downloadType as any);

            const chunks: Buffer[] = [];
            let totalBytes = 0;
            const MAX_MEDIA_DOWNLOAD_BYTES = 50 * 1024 * 1024; // 50MB limit

            for await (const chunk of stream) {
              totalBytes += chunk.length;
              if (totalBytes > MAX_MEDIA_DOWNLOAD_BYTES) {
                if (typeof (stream as any).destroy === 'function') {
                  (stream as any).destroy();
                }
                throw new Error('Ukuran media melebihi batas maksimal (50MB).');
              }
              chunks.push(chunk);
            }

            return Buffer.concat(chunks);
          } catch (err: any) {
            console.error('[WA] downloadContentFromMessage error:', err);
            throw new Error('Gagal mengunduh media dari WhatsApp. Pastikan media/stiker masih baru dan belum kedaluwarsa.');
          }
        },
      };
    }

    let quotedMessage: MessageContext['quotedMessage'];
    let rawQuotedMessageKey: any;

    const contextInfo =
      message.extendedTextMessage?.contextInfo ||
      (mediaMessage as any)?.contextInfo;

    if (contextInfo && contextInfo.quotedMessage) {
      const quoted = unwrapMessage(contextInfo.quotedMessage);
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
      } else if (quotedMsgType === 'documentMessage') {
        quotedBody = quoted.documentMessage?.caption || '';
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
            try {
              const stream = await downloadContentFromMessage(
                quotedMediaMessage as any,
                downloadType as any
              );

              const chunks: Buffer[] = [];
              let totalBytes = 0;
              const MAX_MEDIA_DOWNLOAD_BYTES = 50 * 1024 * 1024; // 50MB limit

              for await (const chunk of stream) {
                totalBytes += chunk.length;
                if (totalBytes > MAX_MEDIA_DOWNLOAD_BYTES) {
                  if (typeof (stream as any).destroy === 'function') {
                    (stream as any).destroy();
                  }
                  throw new Error('Ukuran media melebihi batas maksimal (50MB).');
                }
                chunks.push(chunk);
              }

              return Buffer.concat(chunks);
            } catch (err: any) {
              console.error('[WA] downloadContentFromMessage error (quoted):', err);
              throw new Error('Gagal mengunduh media dari WhatsApp. Pastikan media/stiker masih baru dan belum kedaluwarsa.');
            }
          },
        };
      }

      const quotedSenderId = this.resolveToPhoneJid(contextInfo.participant || '');
      quotedMessage = {
        id: contextInfo.stanzaId || '',
        senderId: quotedSenderId,
        senderCanonicalId: quotedSenderId ? normalizeJid(quotedSenderId) : undefined,
        body: quotedBody,
        media: quotedMedia,
      };

      rawQuotedMessageKey = {
        remoteJid: isGroup ? chatId : senderId,
        id: contextInfo.stanzaId,
        fromMe: contextInfo.participant === jidNormalizedUser(this.sock.user?.id) || quotedSenderId === jidNormalizedUser(this.sock.user?.id),
        ...(isGroup ? { participant: contextInfo.participant } : {})
      };
    }

    const isForwarded = !!contextInfo?.isForwarded;

    return {
      id: msg.key.id!,
      senderId,
      senderCanonicalId: normalizeJid(senderId),
      senderName,
      chatId,
      chatCanonicalId: normalizeJid(chatId),
      isGroup,
      body,
      media,
      quotedMessage,
      rawMessageKey: msg.key,
      rawQuotedMessageKey,
      isViewOnce,
      isForwarded,
    };
  }

  private getQuotedOption(options?: SendMessageOptions): any {
    if (!options) return undefined;
    let key = options.quotedMessageKey;
    if (!key && options.quotedMessageId) {
      key = this.messageKeyCache.get(options.quotedMessageId);
    }
    if (key) {
      return {
        quoted: {
          key,
          message: { conversation: '' }
        }
      };
    }
    return undefined;
  }

  public async sendMessage(
    chatId: string,
    text: string,
    options?: SendMessageOptions
  ): Promise<void> {
    const mentions = options?.mentions || [];
    const quotedOpt = this.getQuotedOption(options);
    await this.sock.sendMessage(chatId, {
      text,
      mentions,
    }, { ...quotedOpt });
  }

  public async sendSticker(
    chatId: string,
    stickerBuffer: Buffer,
    options?: SendMessageOptions
  ): Promise<void> {
    const mentions = options?.mentions || [];
    const quotedOpt = this.getQuotedOption(options);
    await this.sock.sendMessage(chatId, {
      sticker: stickerBuffer,
      mimetype: 'image/webp',
      mentions,
    }, { ...quotedOpt });
  }

  public async sendImage(
    chatId: string,
    imageBuffer: Buffer,
    caption?: string,
    options?: SendMessageOptions
  ): Promise<void> {
    const mentions = options?.mentions || [];
    const quotedOpt = this.getQuotedOption(options);

    let processedBuffer = imageBuffer;
    if (chatId.endsWith('@g.us')) {
      try {
        const { getGroupFeatures } = await import('../config/feature-flags.js');
        const features = await getGroupFeatures(chatId);
        if (features.watermark) {
          const { addWatermarkToImage } = await import('../utils/watermark.util.js');
          let groupName = 'Group';
          try {
            const metadata = await this.sock.groupMetadata(chatId);
            groupName = metadata.subject || 'Group';
          } catch { }
          const timestampStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
          const watermarkText = `${groupName} | ${timestampStr}`;
          processedBuffer = await addWatermarkToImage(imageBuffer, watermarkText);
        }
      } catch (err) {
        console.error('[Adapter Watermark Error]', err);
      }
    }

    await this.sock.sendMessage(chatId, {
      image: processedBuffer,
      caption,
      mentions,
    }, { ...quotedOpt });
  }

  public async sendVideo(
    chatId: string,
    videoBuffer: Buffer,
    caption?: string,
    options?: SendMessageOptions
  ): Promise<void> {
    const mentions = options?.mentions || [];
    const quotedOpt = this.getQuotedOption(options);
    await this.sock.sendMessage(chatId, {
      video: videoBuffer,
      caption,
      mentions,
    }, { ...quotedOpt });
  }

  public async sendAudio(
    chatId: string,
    audioBuffer: Buffer,
    options?: SendMessageOptions
  ): Promise<void> {
    const mentions = options?.mentions || [];
    const quotedOpt = this.getQuotedOption(options);
    const mimetype = options?.mimetype || 'audio/mp4';
    await this.sock.sendMessage(chatId, {
      audio: audioBuffer,
      mimetype,
      ptt: false,
      mentions,
    }, { ...quotedOpt });
  }

  public async sendVoiceNote(
    chatId: string,
    audioBuffer: Buffer,
    options?: SendMessageOptions
  ): Promise<void> {
    const mentions = options?.mentions || [];
    const quotedOpt = this.getQuotedOption(options);
    const mimetype = options?.mimetype || 'audio/mp4';
    await this.sock.sendMessage(chatId, {
      audio: audioBuffer,
      mimetype,
      ptt: true,
      mentions,
    }, { ...quotedOpt });
  }

  public async sendDocument(
    chatId: string,
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    options?: SendMessageOptions
  ): Promise<void> {
    const mentions = options?.mentions || [];
    const quotedOpt = this.getQuotedOption(options);
    await this.sock.sendMessage(chatId, {
      document: buffer,
      fileName,
      mimetype: mimeType,
      mentions,
    }, { ...quotedOpt });
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

  public resolveToPhoneJid(jid: string): string {
    if (!jid) return jid;
    if (jid.endsWith('@s.whatsapp.net')) return jid;

    const cleanJid = jid.split(':')[0];
    const lidKey = cleanJid.endsWith('@lid') ? cleanJid : `${cleanJid}@lid`;

    const mapped = this.lidToPhoneMap.get(lidKey);
    if (mapped) {
      return mapped;
    }

    if (jid.endsWith('@lid') && this.sock?.contacts) {
      for (const key of Object.keys(this.sock.contacts)) {
        const contact = this.sock.contacts[key];
        if (contact && contact.lid === jid) {
          if (key.endsWith('@s.whatsapp.net')) {
            const phoneJid = key.split(':')[0] + '@s.whatsapp.net';
            this.lidToPhoneMap.set(lidKey, phoneJid);
            this.saveJidMap();
            return phoneJid;
          }
        }
      }
    }
    return jid;
  }

  private async handleAntiDelete(key: any) {
    try {
      const chatId = this.resolveToPhoneJid(key.remoteJid);
      const isGroup = chatId.endsWith('@g.us');
      if (!isGroup) return;

      const { getGroupFeatures } = await import('../config/feature-flags.js');
      const flags: any = await getGroupFeatures(chatId).catch(() => ({}));
      if (!flags.antidelete) return;

      const { messageCache } = await import('../services/state/message-cache.js');
      const cached = messageCache.get(key.id);
      if (!cached) return;

      const senderNumber = cached.senderId.split('@')[0];
      const header = `🕵️‍♂️ *Anti-Delete Detected!* 🕵️‍♂️\n\n👤 *Pengirim:* @${senderNumber}`;

      if (cached.media) {
        const caption = `${header}\n📄 *Tipe:* ${cached.media.type === 'image' ? 'Gambar' : cached.media.type === 'video' ? 'Video' : cached.media.type === 'sticker' ? 'Stiker' : cached.media.type === 'audio' ? 'Audio' : 'Dokumen'}${cached.body ? `\n📝 *Keterangan:* ${cached.body}` : ''}`;

        if (cached.media.type === 'image') {
          await this.sendImage(chatId, cached.media.buffer, caption, { mentions: [cached.senderId] });
        } else if (cached.media.type === 'video') {
          await this.sendVideo(chatId, cached.media.buffer, caption, { mentions: [cached.senderId] });
        } else if (cached.media.type === 'sticker') {
          await this.sendMessage(chatId, caption, { mentions: [cached.senderId] });
          await this.sendSticker(chatId, cached.media.buffer, { mentions: [cached.senderId] });
        } else if (cached.media.type === 'audio') {
          await this.sendMessage(chatId, caption, { mentions: [cached.senderId] });
          await this.sendAudio(chatId, cached.media.buffer, { mentions: [cached.senderId] });
        } else {
          await this.sendMessage(chatId, caption, { mentions: [cached.senderId] });
          await this.sendDocument(chatId, cached.media.buffer, cached.media.filename || 'document', cached.media.mimeType, { mentions: [cached.senderId] });
        }
      } else {
        const text = `${header}\n💬 *Pesan:* ${cached.body}`;
        await this.sendMessage(chatId, text, { mentions: [cached.senderId] });
      }
    } catch (err) {
      console.error('[Anti-Delete] Failed to process revoke:', err);
    }
  }
}