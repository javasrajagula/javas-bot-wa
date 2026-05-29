import { env } from '../../config/env.js';
import { localUpscale, replicateUpscale } from './upscaler.adapter.js';

export interface HDUpscaleOptions {
  scale?: 2 | 4;
}

/**
 * Upscale image buffer.
 * If Replicate token is set, tries Replicate upscaling first.
 * Falls back to local high-quality upscaling (lanczos3 + sharpen) on failure or if token is missing.
 */
export async function enhanceImage(imageBuffer: Buffer, options: HDUpscaleOptions = {}): Promise<Buffer> {
  const scale = options.scale || 2;

  // Validate input file size (max 10 MB)
  if (imageBuffer.length > 10 * 1024 * 1024) {
    throw new Error('Ukuran file input terlalu besar (maksimal 10 MB).');
  }

  if (env.REPLICATE_API_TOKEN) {
    try {
      console.log('[HD Service] Trying Replicate upscaler...');
      // Wrap in a promise that rejects after 55 seconds to allow local fallback before a hard 60s limit
      const result = await Promise.race([
        replicateUpscale(imageBuffer, scale),
        new Promise<Buffer>((_, reject) =>
          setTimeout(() => reject(new Error('Replicate process timed out')), 55000)
        )
      ]);
      return result;
    } catch (err) {
      console.error('[HD Service] Replicate upscaling failed, falling back to local upscaler:', err);
    }
  }

  // Fallback to local upscaling
  console.log('[HD Service] Using local upscaler...');
  return localUpscale(imageBuffer, scale);
}
