import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import sharp from 'sharp';
import {
  validateImageResolution,
  validateVideoDuration,
  validateVideoDurationByPath
} from '../validators/media.validator.js';
import * as permModule from '../bot/permission.js';

describe('Media Processing Guardrails', () => {
  let isPremiumSpy: any;

  beforeEach(() => {
    isPremiumSpy = vi.spyOn(permModule, 'isPremium').mockResolvedValue(false);
  });

  afterEach(() => {
    isPremiumSpy.mockRestore();
  });

  describe('validateImageResolution', () => {
    it('accepts image below free user dimension limit (4096)', async () => {
      const buffer = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      })
      .jpeg()
      .toBuffer();

      await expect(validateImageResolution(buffer, 'user-free')).resolves.not.toThrow();
    });

    it('rejects image above free user dimension limit (4096) for free user', async () => {
      // Mock metadata returns a huge size without creating a massive buffer
      vi.spyOn(sharp.prototype, 'metadata').mockResolvedValue({
        width: 5000,
        height: 5000
      });

      await expect(validateImageResolution(Buffer.from('dummy'), 'user-free'))
        .rejects.toThrow(/Resolusi gambar terlalu besar/);
    });

    it('accepts image above free limit but below premium limit (8192) for premium user', async () => {
      isPremiumSpy.mockResolvedValue(true);
      vi.spyOn(sharp.prototype, 'metadata').mockResolvedValue({
        width: 5000,
        height: 5000
      });

      await expect(validateImageResolution(Buffer.from('dummy'), 'user-prem')).resolves.not.toThrow();
    });

    it('rejects image above premium limit (8192) even for premium user', async () => {
      isPremiumSpy.mockResolvedValue(true);
      vi.spyOn(sharp.prototype, 'metadata').mockResolvedValue({
        width: 9000,
        height: 9000
      });

      await expect(validateImageResolution(Buffer.from('dummy'), 'user-prem'))
        .rejects.toThrow(/Resolusi gambar terlalu besar/);
    });
  });

  describe('validateVideoDuration', () => {
    it('accepts video duration below free limit (60s) for free user', async () => {
      await expect(validateVideoDuration(45, 'user-free')).resolves.not.toThrow();
    });

    it('rejects video duration above free limit (60s) for free user', async () => {
      await expect(validateVideoDuration(75, 'user-free'))
        .rejects.toThrow(/Durasi video terlalu panjang/);
    });

    it('accepts video duration above free limit but below premium limit (600s) for premium user', async () => {
      isPremiumSpy.mockResolvedValue(true);
      await expect(validateVideoDuration(300, 'user-prem')).resolves.not.toThrow();
    });

    it('rejects video duration above premium limit (600s) even for premium user', async () => {
      isPremiumSpy.mockResolvedValue(true);
      await expect(validateVideoDuration(650, 'user-prem'))
        .rejects.toThrow(/Durasi video terlalu panjang/);
    });
  });
});
