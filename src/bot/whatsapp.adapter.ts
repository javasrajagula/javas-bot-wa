import { MessageContext } from './message.types.js';

export interface SendMessageOptions {
  quotedMessageId?: string;
  mentions?: string[];
}

export abstract class WhatsAppAdapter {
  protected messageHandler?: (ctx: MessageContext) => Promise<void>;
  protected groupUpdateHandler?: (update: { groupId: string, participants: string[], action: 'add' | 'remove' }) => Promise<void>;

  public onMessage(handler: (ctx: MessageContext) => Promise<void>) {
    this.messageHandler = handler;
  }

  public onGroupUpdate(handler: (update: { groupId: string, participants: string[], action: 'add' | 'remove' }) => Promise<void>) {
    this.groupUpdateHandler = handler;
  }

  public abstract start(): Promise<void>;
  public abstract sendMessage(chatId: string, text: string, options?: SendMessageOptions): Promise<void>;
  public abstract sendSticker(chatId: string, stickerBuffer: Buffer, options?: SendMessageOptions): Promise<void>;
  public abstract sendImage(chatId: string, imageBuffer: Buffer, caption?: string, options?: SendMessageOptions): Promise<void>;
  public abstract sendVideo(chatId: string, videoBuffer: Buffer, caption?: string, options?: SendMessageOptions): Promise<void>;
  public abstract sendAudio(chatId: string, audioBuffer: Buffer, options?: SendMessageOptions): Promise<void>;
  public abstract sendVoiceNote(chatId: string, audioBuffer: Buffer, options?: SendMessageOptions): Promise<void>;
  public abstract sendDocument(chatId: string, buffer: Buffer, fileName: string, mimeType: string, options?: SendMessageOptions): Promise<void>;
  public abstract deleteMessage(chatId: string, messageId: string, senderId?: string): Promise<void>;
}
