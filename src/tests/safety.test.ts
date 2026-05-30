import { describe, it, expect, vi } from 'vitest';
import { SafetyCommand } from '../commands/document/safety.command.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import axios from 'axios';

vi.mock('axios');

describe('Safety & Anti-Scam Commands', () => {
  const cmd = new SafetyCommand();

  describe('/checklink command', () => {
    it('should validate a safe public URL', async () => {
      let replyMessage = '';
      const mockAdapter = {
        sendMessage: async (chatId: string, text: string) => {
          replyMessage = text;
        }
      } as any;

      const mockCtx = {
        chatId: 'test-chat@g.us',
        isGroup: true,
        body: '/checklink https://www.google.com',
        senderId: 'user@s.whatsapp.net',
        id: 'msg-1'
      } as any;

      // Mock axios for redirect validation
      vi.mocked(axios.head).mockResolvedValueOnce({
        status: 200,
        headers: {}
      } as any);

      await cmd.execute(mockCtx, ['https://www.google.com'], mockAdapter);

      expect(replyMessage).toContain('Hasil Pemeriksaan Link: AMAN');
      expect(replyMessage).toContain('https://www.google.com');
    });

    it('should block and report unsafe IP/localhost URLs', async () => {
      let replyMessage = '';
      const mockAdapter = {
        sendMessage: async (chatId: string, text: string) => {
          replyMessage = text;
        }
      } as any;

      const mockCtx = {
        chatId: 'test-chat@g.us',
        isGroup: true,
        body: '/checklink http://localhost:8080',
        senderId: 'user@s.whatsapp.net',
        id: 'msg-2'
      } as any;

      await cmd.execute(mockCtx, ['http://localhost:8080'], mockAdapter);

      expect(replyMessage).toContain('Hasil Pemeriksaan Link: TIDAK AMAN');
      expect(replyMessage).toContain('Akses ke localhost tidak diperbolehkan');
    });
  });

  describe('/cekpenipuan / /scamcheck command', () => {
    it('should score normal text as safe', async () => {
      let replyMessage = '';
      const mockAdapter = {
        sendMessage: async (chatId: string, text: string) => {
          replyMessage = text;
        }
      } as any;

      const mockCtx = {
        chatId: 'test-chat@g.us',
        isGroup: true,
        body: '/cekpenipuan Halo apa kabar? Besok jadi rapat kelompok ya.',
        senderId: 'user@s.whatsapp.net',
        id: 'msg-3'
      } as any;

      await cmd.execute(mockCtx, ['Halo', 'apa', 'kabar?', 'Besok', 'jadi', 'rapat', 'kelompok', 'ya.'], mockAdapter);

      expect(replyMessage).toContain('Scam Score:* *0/100*');
      expect(replyMessage).toContain('Tingkat Risiko:* *🟢 AMAN (LOW)*');
    });

    it('should detect critical risks for APK file modus', async () => {
      let replyMessage = '';
      const mockAdapter = {
        sendMessage: async (chatId: string, text: string) => {
          replyMessage = text;
        }
      } as any;

      const mockCtx = {
        chatId: 'test-chat@g.us',
        isGroup: true,
        body: '/cekpenipuan Silakan install file undangan_pernikahan.apk berikut ini.',
        senderId: 'user@s.whatsapp.net',
        id: 'msg-4'
      } as any;

      await cmd.execute(mockCtx, ['Silakan', 'install', 'file', 'undangan_pernikahan.apk', 'berikut', 'ini.'], mockAdapter);

      expect(replyMessage).toContain('File APK Palsu');
      expect(replyMessage).toContain('SEDANG-TINGGI');
    });

    it('should detect moderate-high risk for work task scam & slot combo', async () => {
      let replyMessage = '';
      const mockAdapter = {
        sendMessage: async (chatId: string, text: string) => {
          replyMessage = text;
        }
      } as any;

      const mockCtx = {
        chatId: 'test-chat@g.us',
        isGroup: true,
        body: '/scamcheck Dapatkan tugas komisi harian dengan like dan subscribe video youtube. Serta dapatkan slot gacor maxwin!',
        senderId: 'user@s.whatsapp.net',
        id: 'msg-5'
      } as any;

      await cmd.execute(mockCtx, ['Dapatkan', 'tugas', 'komisi', 'harian', 'dengan', 'like', 'dan', 'subscribe', 'video', 'youtube.', 'Serta', 'dapatkan', 'slot', 'gacor', 'maxwin!'], mockAdapter);

      expect(replyMessage).toContain('Scam Score:* *65/100*');
      expect(replyMessage).toContain('Tingkat Risiko:* *🔴 SANGAT TINGGI (CRITICAL)*');
    });
  });
});
