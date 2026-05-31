import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { watermarkImage } from '../services/watermark/watermark.service.js';
import { translateText } from '../services/translate/translate.service.js';
import { summarizeText } from '../services/text/summarizer.service.js';
import { gameSessionService, GameAnswerHandler } from '../services/games/game-session.service.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';

describe('PRD Stabilization & Integration Tests', () => {

  describe('Watermark Service', () => {
    it('successfully overlays watermark on an image buffer', async () => {
      // Create a small blank transparent PNG image buffer
      const inputBuffer = await sharp({
        create: {
          width: 200,
          height: 100,
          channels: 4,
          background: { r: 255, g: 0, b: 0, alpha: 255 }
        }
      })
      .png()
      .toBuffer();

      const watermarked = await watermarkImage(inputBuffer, 'Javas Test');
      expect(watermarked).toBeInstanceOf(Buffer);

      // Verify that the output buffer is a valid image and readable by Sharp
      const metadata = await sharp(watermarked).metadata();
      expect(metadata.width).toBe(200);
      expect(metadata.height).toBe(100);
    });
  });

  describe('Translation Service', () => {
    it('uses local dictionary fallback to translate standard words without crashing', async () => {
      // "halo" to "en" should fall back to the basic local dictionary: "hello"
      const result = await translateText('halo', 'en');
      expect(result.text.toLowerCase()).toBe('hello');
      expect(result.provider).toContain('dictionary');
    });

    it('throws an error on empty input text', async () => {
      await expect(translateText('', 'en')).rejects.toThrow('Teks yang ingin diterjemahkan tidak boleh kosong.');
    });
  });

  describe('Summarizer Service', () => {
    it('enforces minimum character limit of 80 characters', async () => {
      const shortText = 'This is a short text.';
      await expect(summarizeText(shortText)).rejects.toThrow('Teks terlalu pendek untuk diringkas (minimal 80 karakter).');
    });

    it('generates structured template format for extractive fallback', async () => {
      const longText = 'Javas Bot WA adalah bot asisten serbaguna yang sangat canggih dan stabil. ' +
        'Bot ini dirancang khusus untuk memenuhi kebutuhan berbagai macam grup WhatsApp dengan mudah. ' +
        'Sistem ini terintegrasi penuh dengan database lokal SQLite dan menggunakan Baileys SDK terbaru. ' +
        'Selain itu, bot ini juga memiliki fitur ekonomi virtual serta moderasi grup yang cerdas.';

      const result = await summarizeText(longText);
      expect(result.summary).toContain('📝 Ringkasan:');
      expect(result.summary).toContain('🔑 Poin penting:');
      expect(result.summary).toContain('📌 Kesimpulan:');
      expect(result.provider).toBe('extractive-fallback');
    });
  });

  describe('Game Session Service Routing', () => {
    it('routes and intercepts message answers via registered handlers', async () => {
      let isCalled = false;

      const dummyHandler: GameAnswerHandler = {
        async canHandle(ctx: MessageContext): Promise<boolean> {
          return ctx.body === 'test-game-answer';
        },
        async handleAnswer(ctx: MessageContext, adapter: WhatsAppAdapter): Promise<boolean> {
          isCalled = true;
          return true; // handled
        }
      };

      gameSessionService.registerHandler(dummyHandler);

      const mockCtx = {
        body: 'test-game-answer',
        chatId: '123@g.us',
        senderId: '456@s.whatsapp.net'
      } as unknown as MessageContext;

      const mockAdapter = {} as unknown as WhatsAppAdapter;

      const handled = await gameSessionService.handleMessage(mockCtx, mockAdapter);
      expect(handled).toBe(true);
      expect(isCalled).toBe(true);

      const notHandledCtx = {
        body: 'random-chat-message',
        chatId: '123@g.us',
        senderId: '456@s.whatsapp.net'
      } as unknown as MessageContext;

      const handled2 = await gameSessionService.handleMessage(notHandledCtx, mockAdapter);
      expect(handled2).toBe(false);
    });
  });

  describe('Sticker Metadata Service', () => {
    it('injects metadata into a transparent (VP8X) WebP and remains valid', async () => {
      // RGBA canvas -> Sharp produces VP8X-extended WebP
      const rawWebp = await sharp({
        create: {
          width: 512,
          height: 512,
          channels: 4,
          background: { r: 0, g: 255, b: 0, alpha: 200 }
        }
      })
      .webp()
      .toBuffer();

      const { injectWebpExif } = await import('../services/sticker/sticker-metadata.service.js');
      const metaWebp = injectWebpExif(rawWebp, 'Javas Test Pack', 'Javas Author');
      expect(metaWebp).toBeInstanceOf(Buffer);

      const metadata = await sharp(metaWebp).metadata();
      expect(metadata.width).toBe(512);
      expect(metadata.height).toBe(512);
      expect(metadata.format).toBe('webp');
    });

    it('injects metadata into an opaque (VP8 simple) WebP and remains valid', async () => {
      // RGB canvas with ensureAlpha -> JPEG-like opaque image converted to WebP
      // Sharp may produce a simple VP8 or VP8L bitstream without VP8X header
      const jpegBuffer = await sharp({
        create: {
          width: 300,
          height: 200,
          channels: 3,
          background: { r: 200, g: 100, b: 50 }
        }
      })
      .jpeg()
      .toBuffer();

      // Convert to WebP the same way /stiker command does
      const rawWebp = await sharp(jpegBuffer)
        .ensureAlpha()
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp()
        .toBuffer();

      const { injectWebpExif } = await import('../services/sticker/sticker-metadata.service.js');
      const metaWebp = injectWebpExif(rawWebp, 'Javas Test Pack', 'bot wa javas');
      expect(metaWebp).toBeInstanceOf(Buffer);

      const metadata = await sharp(metaWebp).metadata();
      expect(metadata.width).toBe(512);
      expect(metadata.height).toBe(512);
      expect(metadata.format).toBe('webp');
    });
  });

});
