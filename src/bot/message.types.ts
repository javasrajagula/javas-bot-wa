export interface MessageMedia {
  type: 'image' | 'video' | 'sticker' | 'document';
  mimeType: string;
  getBuffer: () => Promise<Buffer>;
  filename?: string;
}

export interface MessageContext {
  id: string;
  senderId: string;
  senderName: string;
  chatId: string;
  isGroup: boolean;
  body: string;
  media?: MessageMedia;
  quotedMessage?: MessageContextQuoted;
}

export interface MessageContextQuoted {
  id: string;
  senderId: string;
  body: string;
  media?: MessageMedia;
}
