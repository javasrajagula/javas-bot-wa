export interface MessageMedia {
  type: 'image' | 'video' | 'sticker' | 'document' | 'audio';
  mimeType: string;
  getBuffer: () => Promise<Buffer>;
  filename?: string;
}

export interface ParsedCommand {
  prefix: string;
  rawCommandName: string;
  commandName: string;
  args: string[];
  isCommand: boolean;
}

export interface MessageContext {
  id: string;
  senderId: string;
  senderCanonicalId?: string;
  senderName: string;
  chatId: string;
  chatCanonicalId?: string;
  isGroup: boolean;
  body: string;
  media?: MessageMedia;
  quotedMessage?: MessageContextQuoted;
  rawMessageKey?: any;
  rawQuotedMessageKey?: any;
  command?: ParsedCommand;
  isViewOnce?: boolean;
}

export interface MessageContextQuoted {
  id: string;
  senderId: string;
  senderCanonicalId?: string;
  body: string;
  media?: MessageMedia;
}
