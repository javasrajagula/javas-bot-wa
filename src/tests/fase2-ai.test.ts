import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import prisma from '../db/client.js';
import { routeMessage } from '../commands/index.js';
import { messageCache } from '../services/state/message-cache.js';
import { aiProviderService } from '../services/ai/ai-provider.service.js';
import * as indexModule from '../commands/index.js';
import { parseFeatureFlags } from '../config/feature-flags.js';

// Import command modules for registration side effects
import '../commands/text/ai.command.js';
import '../commands/text/ai-advanced.command.js';
import '../commands/text/text.command.js';

describe('Fase 2 AI & Text Processing Tests', () => {
  const testGroup = 'test-fase2-group@g.us';
  const adminUser = 'adminuser@s.whatsapp.net';
  const memberUser = 'memberuser@s.whatsapp.net';

  beforeEach(async () => {
    await prisma.groupConfig.deleteMany({ where: { groupId: testGroup } });
    await prisma.groupSubscription.deleteMany({ where: { groupId: testGroup } });
    await prisma.groupSubscription.create({
      data: {
        groupId: testGroup,
        plan: 'premium',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
    messageCache.clear();
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await prisma.groupConfig.deleteMany({ where: { groupId: testGroup } });
    await prisma.groupSubscription.deleteMany({ where: { groupId: testGroup } });
    messageCache.clear();
  });

  describe('AI Persona Kustom & Language Detection', () => {
    it('should configure and use custom AI Persona in /ai command', async () => {
      // 1. Create group config
      await prisma.groupConfig.create({
        data: {
          groupId: testGroup,
          prefix: '/',
          botEnabled: true,
          featuresJson: JSON.stringify({ persona_name: 'Javas AI' })
        }
      });

      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      vi.spyOn(indexModule, 'checkIfAdmin').mockResolvedValue(true);

      const generateTextSpy = vi.spyOn(aiProviderService, 'generateText').mockResolvedValue('Halo! Saya asisten kustom.');

      // Run setpersona to change name
      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/setpersona name AsistenKeren',
        senderId: adminUser,
        id: 'msg-set-name'
      } as any, adapter);

      expect(replyText).toContain('Nama persona AI berhasil diubah');

      // Run setpersona to change prompt
      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/setpersona prompt Anda adalah bajak laut',
        senderId: adminUser,
        id: 'msg-set-prompt'
      } as any, adapter);

      expect(replyText).toContain('Prompt/karakter AI berhasil diubah');

      // Run setpersona to change style
      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/setpersona style santai',
        senderId: adminUser,
        id: 'msg-set-style'
      } as any, adapter);

      expect(replyText).toContain('Gaya bahasa AI berhasil diubah');

      // Trigger /ai
      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/ai Siapa kamu?',
        senderId: memberUser,
        id: 'msg-ai-query'
      } as any, adapter);

      expect(generateTextSpy).toHaveBeenCalled();
      const systemPromptUsed = generateTextSpy.mock.calls[0][1];
      expect(systemPromptUsed).toContain('Nama Anda adalah AsistenKeren');
      expect(systemPromptUsed).toContain('Anda adalah bajak laut');
      expect(systemPromptUsed).toContain('Gunakan gaya bahasa santai');
      expect(replyText).toBe('Halo! Saya asisten kustom.');
    });
  });

  describe('AI Message Summary & Content Recommendations & Sentiment Analysis', () => {
    it('should summarize group chat logs when /ringkas is called without arguments', async () => {
      await prisma.groupConfig.create({
        data: {
          groupId: testGroup,
          prefix: '/',
          botEnabled: true,
          featuresJson: JSON.stringify({})
        }
      });

      // Seed messageCache
      messageCache.set('msg-c1', {
        body: 'Halo teman-teman, mari kita bahas rencana liburan besok.',
        senderId: memberUser,
        senderName: 'Budi',
        chatId: testGroup,
        timestamp: Date.now() - 5000
      });
      messageCache.set('msg-c2', {
        body: 'Aku mau ke pantai saja.',
        senderId: adminUser,
        senderName: 'Andi',
        chatId: testGroup,
        timestamp: Date.now() - 2000
      });

      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      const generateTextSpy = vi.spyOn(aiProviderService, 'generateText').mockResolvedValue('Rangkuman: Anggota merencanakan liburan ke pantai.');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/ringkas',
        senderId: memberUser,
        id: 'msg-ringkas'
      } as any, adapter);

      expect(generateTextSpy).toHaveBeenCalled();
      const promptUsed = generateTextSpy.mock.calls[0][0];
      expect(promptUsed).toContain('Budi: Halo teman-teman');
      expect(promptUsed).toContain('Andi: Aku mau ke pantai saja');
      expect(replyText).toContain('Rangkuman: Anggota merencanakan liburan');
    });

    it('should analyze group sentiment when /sentimen is called', async () => {
      await prisma.groupConfig.create({
        data: {
          groupId: testGroup,
          prefix: '/',
          botEnabled: true,
          featuresJson: JSON.stringify({})
        }
      });

      messageCache.set('msg-c1', {
        body: 'Sangat menyebalkan sekali hari ini macet parah!',
        senderId: memberUser,
        senderName: 'Budi',
        chatId: testGroup,
        timestamp: Date.now() - 5000
      });

      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      const generateTextSpy = vi.spyOn(aiProviderService, 'generateText').mockResolvedValue('Sentimen: Negatif karena macet.');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/sentimen',
        senderId: memberUser,
        id: 'msg-sentimen'
      } as any, adapter);

      expect(generateTextSpy).toHaveBeenCalled();
      expect(replyText).toContain('Sentimen: Negatif karena macet');
    });

    it('should recommend discussion content when /rekomendasi is called', async () => {
      await prisma.groupConfig.create({
        data: {
          groupId: testGroup,
          prefix: '/',
          botEnabled: true,
          featuresJson: JSON.stringify({})
        }
      });

      messageCache.set('msg-c1', {
        body: 'Aku ingin belajar pemrograman Javascript.',
        senderId: memberUser,
        senderName: 'Budi',
        chatId: testGroup,
        timestamp: Date.now() - 5000
      });

      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      const generateTextSpy = vi.spyOn(aiProviderService, 'generateText').mockResolvedValue('Rekomendasi: 1. Framework Node.js.');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/rekomendasi',
        senderId: memberUser,
        id: 'msg-rekomendasi'
      } as any, adapter);

      expect(generateTextSpy).toHaveBeenCalled();
      expect(replyText).toContain('Rekomendasi: 1. Framework Node.js');
    });
  });

  describe('AI Story Generator', () => {
    it('should generate interactive stories when /cerita is called', async () => {
      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      const generateTextSpy = vi.spyOn(aiProviderService, 'generateText').mockResolvedValue('Pada suatu hari di Mars...');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/cerita Mars',
        senderId: memberUser,
        id: 'msg-cerita'
      } as any, adapter);

      expect(generateTextSpy).toHaveBeenCalled();
      expect(replyText).toContain('Pada suatu hari di Mars');
    });
  });

  describe('AI Auto-Caption & FAQ Auto Responder', () => {
    it('should trigger auto caption for empty caption images when flag is active', async () => {
      await prisma.groupConfig.create({
        data: {
          groupId: testGroup,
          prefix: '/',
          botEnabled: true,
          featuresJson: JSON.stringify({ auto_caption: true })
        }
      });

      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      // Mock OCR and AI
      const ocrModule = await import('../services/ocr/ocr.service.js');
      vi.spyOn(ocrModule, 'runOcr').mockResolvedValue('HELLOWORLD');
      vi.spyOn(aiProviderService, 'generateText').mockResolvedValue('Ini adalah gambar berisi tulisan HELLOWORLD.');

      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '',
        senderId: memberUser,
        media: {
          type: 'image',
          mimeType: 'image/png',
          getBuffer: async () => Buffer.from('mock-png'),
          filename: 'test.png'
        },
        id: 'msg-image-no-caption'
      } as any, adapter);

      expect(replyText).toContain('AI Auto-Caption');
      expect(replyText).toContain('Ini adalah gambar berisi tulisan HELLOWORLD');
    });

    it('should configure and response to FAQs automatically', async () => {
      await prisma.groupConfig.create({
        data: {
          groupId: testGroup,
          prefix: '/',
          botEnabled: true,
          featuresJson: JSON.stringify({})
        }
      });

      let replyText = '';
      const adapter = {
        sendMessage: async (chatId: string, text: string) => { replyText = text; return { id: 'msg-reply' }; }
      } as any;

      vi.spyOn(indexModule, 'checkIfAdmin').mockResolvedValue(true);

      // Add FAQ
      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/addfaq cara daftar | Masuk ke website kami di example.com',
        senderId: adminUser,
        id: 'msg-addfaq'
      } as any, adapter);

      expect(replyText).toContain('FAQ berhasil ditambahkan');

      // List FAQs
      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/listfaq',
        senderId: memberUser,
        id: 'msg-listfaq'
      } as any, adapter);

      expect(replyText).toContain('cara daftar');

      // Trigger FAQ automatically
      replyText = '';
      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: 'Tolong info cara daftar dong',
        senderId: memberUser,
        id: 'msg-ask'
      } as any, adapter);

      expect(replyText).toBe('Masuk ke website kami di example.com');

      // Delete FAQ
      await routeMessage({
        chatId: testGroup,
        isGroup: true,
        body: '/delfaq cara daftar',
        senderId: adminUser,
        id: 'msg-delfaq'
      } as any, adapter);

      expect(replyText).toContain('berhasil dihapus');
    });
  });
});
