import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StickerSuiteCommand } from '../commands/sticker/sticker.command.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import fs from 'fs';

const runFfmpegMock = vi.fn();

vi.mock('../services/ffmpeg/ffmpeg.service.js', () => {
  return {
    getMediaDuration: async () => 5,
    runFfmpeg: async (args: string[]) => {
      runFfmpegMock(args);
      
      // Parse scale from -vf argument to determine output size
      const vfIndex = args.indexOf('-vf');
      const vfArg = vfIndex !== -1 ? args[vfIndex + 1] : '';
      
      let size = 800 * 1024; // Default success size (800 KB)
      if (vfArg.includes('scale=512:512')) {
        size = 1.2 * 1024 * 1024; // 1.2 MB (exceeds limit)
      } else if (vfArg.includes('scale=384:384')) {
        size = 1.05 * 1024 * 1024; // 1.05 MB (exceeds limit)
      } else if (vfArg.includes('scale=256:256')) {
        size = 750 * 1024; // 750 KB (within limit)
      }

      const tempOut = args[args.length - 1];
      const mockWebp = Buffer.alloc(size);
      mockWebp.write('RIFF', 0, 'ascii');
      mockWebp.write('WEBP', 8, 'ascii');
      fs.writeFileSync(tempOut, mockWebp);
    }
  };
});

vi.mock('../bot/permission.js', () => {
  return {
    isPremium: async () => false,
    isOwner: () => false,
    isGroupAdmin: async () => false,
    checkIfAdmin: async () => false,
    getUserRole: async () => 'user'
  };
});

describe('Sticker Suite Command - vstiker Fallback Loop', () => {
  beforeEach(() => {
    runFfmpegMock.mockClear();
  });

  it('should fallback dynamically in resolution (512 -> 384 -> 256) and quality/fps when size is over 1MB', async () => {
    const stickerCmd = new StickerSuiteCommand();
    const sentStickers: { chatId: string; buffer: Buffer; options?: any }[] = [];
    const messagesSent: string[] = [];

    const mockAdapter = {
      sendMessage: async (chatId: string, text: string) => {
        messagesSent.push(text);
      },
      sendSticker: async (chatId: string, buffer: Buffer, options?: any) => {
        sentStickers.push({ chatId, buffer, options });
      }
    } as unknown as WhatsAppAdapter;

    const mockMedia = {
      type: 'video',
      getBuffer: async () => Buffer.from('dummy video data')
    };

    const mockContext = {
      body: '/vstiker',
      chatId: '123@s.whatsapp.net',
      senderId: '123@s.whatsapp.net',
      id: 'msg-123',
      media: mockMedia,
      quotedMessage: null
    } as unknown as MessageContext;

    await stickerCmd.execute(mockContext, [], mockAdapter);

    // Verify messages
    expect(messagesSent[0]).toContain('Mengonversi video ke stiker');

    // Verify runFfmpeg was called 3 times
    expect(runFfmpegMock).toHaveBeenCalledTimes(3);

    // 1st Attempt: scale=512:512, fps=15, q=50
    const args1 = runFfmpegMock.mock.calls[0][0] as string[];
    const vf1 = args1[args1.indexOf('-vf') + 1];
    expect(vf1).toContain('scale=512:512');
    expect(vf1).toContain('fps=15');
    expect(args1[args1.indexOf('-q:v') + 1]).toBe('50');

    // 2nd Attempt: scale=384:384, fps=12, q=35
    const args2 = runFfmpegMock.mock.calls[1][0] as string[];
    const vf2 = args2[args2.indexOf('-vf') + 1];
    expect(vf2).toContain('scale=384:384');
    expect(vf2).toContain('fps=12');
    expect(args2[args2.indexOf('-q:v') + 1]).toBe('35');

    // 3rd Attempt: scale=256:256, fps=10, q=20
    const args3 = runFfmpegMock.mock.calls[2][0] as string[];
    const vf3 = args3[args3.indexOf('-vf') + 1];
    expect(vf3).toContain('scale=256:256');
    expect(vf3).toContain('fps=10');
    expect(args3[args3.indexOf('-q:v') + 1]).toBe('20');

    // Verify the sticker was sent successfully and is the 3rd attempt's buffer
    expect(sentStickers).toHaveLength(1);
    expect(sentStickers[0].buffer.length).toBe(750 * 1024);
  });

  it('should generate brat sticker correctly supporting custom newlines and scaling', async () => {
    const { generateBratSticker } = await import('../services/media/brat.service.js');
    const text = 'brat and it\'s\nthe same but\nthere\'s three\nmore songs\nso it\'s not';
    const buffer = await generateBratSticker(text);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
