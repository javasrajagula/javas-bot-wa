export interface CachedMessage {
  body: string;
  senderId: string;
  senderName: string;
  chatId: string;
  media?: {
    type: 'image' | 'video' | 'sticker' | 'document' | 'audio';
    mimeType: string;
    buffer: Buffer;
    filename?: string;
  };
  timestamp: number;
}

class MessageCache {
  private cache = new Map<string, CachedMessage>();

  public set(messageId: string, msg: CachedMessage) {
    this.cache.set(messageId, msg);
    // Cleanup old messages (older than 15 minutes)
    const fifteenMinsAgo = Date.now() - 15 * 60 * 1000;
    for (const [id, cached] of this.cache.entries()) {
      if (cached.timestamp < fifteenMinsAgo) {
        this.cache.delete(id);
      }
    }
  }

  public getForChat(chatId: string): CachedMessage[] {
    const list: CachedMessage[] = [];
    for (const cached of this.cache.values()) {
      if (cached.chatId === chatId) {
        list.push(cached);
      }
    }
    return list.sort((a, b) => a.timestamp - b.timestamp);
  }

  public get(messageId: string): CachedMessage | undefined {
    return this.cache.get(messageId);
  }

  public delete(messageId: string) {
    this.cache.delete(messageId);
  }

  public clear() {
    this.cache.clear();
  }
}

export const messageCache = new MessageCache();
