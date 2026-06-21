import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import prisma from '../db/client.js';
import { MenuCommand } from '../commands/menu.command.js';
import { DownloaderCommand } from '../commands/downloader.command.js';
import { AdapterHolder } from '../bot/adapter-holder.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import fs from 'fs';
import path from 'path';

vi.mock('btch-downloader', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    yts: async (query: string) => {
      return {
        status: true,
        result: {
          videos: [
            {
              url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
              title: 'Mock Search: ' + query,
              views: 987654,
              timestamp: '4:20',
              duration: { seconds: 260, timestamp: '4:20' },
              author: { name: 'Javas Channel' }
            }
          ]
        }
      };
    },
    youtube: async (url: string) => {
      return {
        mp3: 'https://example.com/mock.mp3',
        mp4: 'https://example.com/mock.mp4',
        title: 'Mock Download'
      };
    }
  };
});

// Mock downloader queue
vi.mock('../queues/queue.js', () => {
  return {
    downloaderQueue: {
      add: async (job: any) => {
        const { processDownloaderJob } = await import('../commands/downloader.command.js');
        await processDownloaderJob(job.data.payload);
      }
    }
  };
});

// Mock downloader service's downloadMedia
vi.mock('../services/downloader/downloader.service.js', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    downloadMedia: async (url: string, type: string, maxBytes: number) => {
      const p = path.join(process.cwd(), 'temp', `test_upgrade_media_${Date.now()}.mp3`);
      fs.writeFileSync(p, Buffer.from('dummy mp3 content'));
      return {
        type: 'video',
        title: 'Mock Downloaded Media',
        files: [
          {
            path: p,
            mimeType: type === 'ytmp3' ? 'audio/mpeg' : 'video/mp4'
          }
        ]
      };
    }
  };
});

// Mock getMediaDuration to avoid running ffprobe
vi.mock('../services/ffmpeg/ffmpeg.service.js', () => {
  return {
    getMediaDuration: async () => 260
  };
});

describe('Upgrades Verification Suite', () => {
  const testPremiumUser = '6285338123425@s.whatsapp.net';

  beforeEach(async () => {
    // Setup clean database state
    await prisma.premiumUser.deleteMany({ where: { userId: testPremiumUser } });
    await prisma.userProfile.deleteMany({ where: { userId: testPremiumUser } });
  });

  afterEach(async () => {
    await prisma.premiumUser.deleteMany({ where: { userId: testPremiumUser } });
    await prisma.userProfile.deleteMany({ where: { userId: testPremiumUser } });
  });

  describe('/menu Upgrades', () => {
    it('displays premium expiration details for premium users', async () => {
      // Set user as premium
      const expiry = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days left
      await prisma.premiumUser.create({
        data: {
          userId: testPremiumUser,
          expiresAt: expiry
        }
      });
      await prisma.userProfile.create({
        data: {
          userId: testPremiumUser,
          isPremium: true,
          premiumUntil: expiry
        }
      });

      const menuCmd = new MenuCommand();
      let sentText = '';

      const mockAdapter = {
        sendMessage: async (chatId: string, text: string) => {
          sentText = text;
        }
      } as unknown as WhatsAppAdapter;

      const mockContext = {
        senderId: testPremiumUser,
        senderName: 'PremiumUser',
        chatId: testPremiumUser,
        isGroup: false,
        body: '/menu',
        id: 'msg-menu-premium'
      } as unknown as MessageContext;

      await menuCmd.execute(mockContext, [], mockAdapter);

      expect(sentText).toContain('Expired Premium:');
      expect(sentText).toContain('5 hari lagi');
    });

    it('hides admin category and commands in private chat', async () => {
      const menuCmd = new MenuCommand();
      let sentText = '';

      const mockAdapter = {
        sendMessage: async (chatId: string, text: string) => {
          sentText = text;
        }
      } as unknown as WhatsAppAdapter;

      const mockContext = {
        senderId: testPremiumUser,
        senderName: 'PremiumUser',
        chatId: testPremiumUser,
        isGroup: false,
        body: '/menu all',
        id: 'msg-menu-all'
      } as unknown as MessageContext;

      await menuCmd.execute(mockContext, ['all'], mockAdapter);

      // Admin category should be hidden
      expect(sentText).not.toContain('ADMIN');
    });

    it('returns error message for /menu admin in private chat', async () => {
      const menuCmd = new MenuCommand();
      let sentText = '';

      const mockAdapter = {
        sendMessage: async (chatId: string, text: string) => {
          sentText = text;
        }
      } as unknown as WhatsAppAdapter;

      const mockContext = {
        senderId: testPremiumUser,
        senderName: 'PremiumUser',
        chatId: testPremiumUser,
        isGroup: false,
        body: '/menu admin',
        id: 'msg-menu-admin'
      } as unknown as MessageContext;

      await menuCmd.execute(mockContext, ['admin'], mockAdapter);

      expect(sentText).toContain('Kategori Admin Grup tidak tersedia di chat pribadi.');
    });
  });

  describe('/ytmp3 Search Upgrades', () => {
    it('supports YouTube search queries and sends detailed confirmation messages', async () => {
      // Set user as premium to allow ytmp3 downloads
      const expiry = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      await prisma.premiumUser.create({
        data: {
          userId: testPremiumUser,
          expiresAt: expiry
        }
      });

      const ytmp3Cmd = new DownloaderCommand('ytmp3');
      const messagesSent: string[] = [];
      let audioSent = false;

      const mockAdapter = {
        sendMessage: async (chatId: string, text: string) => {
          messagesSent.push(text);
        },
        sendAudio: async (chatId: string, buffer: Buffer) => {
          audioSent = true;
        }
      } as unknown as WhatsAppAdapter;

      AdapterHolder.setAdapter(mockAdapter);

      const mockContext = {
        senderId: testPremiumUser,
        chatId: testPremiumUser,
        isGroup: false,
        body: '/ytmp3 never gonna give you up',
        id: 'msg-ytmp3-search'
      } as unknown as MessageContext;

      await ytmp3Cmd.execute(mockContext, ['never', 'gonna', 'give', 'you', 'up'], mockAdapter);

      // Verify search message was sent
      expect(messagesSent[0]).toContain('Mencari');
      expect(messagesSent[0]).toContain('never gonna give you up');
      expect(messagesSent[0]).toContain('YouTube');

      // Verify download message was sent
      expect(messagesSent[1]).toContain('Menemukan');
      expect(messagesSent[1]).toContain('Mock Search: never gonna give you up');
      // Verify audio was sent
      expect(audioSent).toBe(true);
      // Verify detailed confirmation message was sent at the end
      const lastMessage = messagesSent[messagesSent.length - 1];
      expect(lastMessage).toContain('YouTube Audio Terkirim');
      expect(lastMessage).toContain('Mock Downloaded Media');
      expect(lastMessage).toContain('Durasi');
      expect(lastMessage).toContain('4:20');
      expect(lastMessage).toContain('Channel');
      expect(lastMessage).toContain('Javas Channel');
      expect(lastMessage).toContain('Views');
      expect(lastMessage).toContain('987.654');
    });
  });
});
