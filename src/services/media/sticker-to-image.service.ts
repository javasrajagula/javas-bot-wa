import sharp from 'sharp';

/**
 * Converts a WebP sticker buffer back into a standard PNG image buffer,
 * preserving transparent backgrounds.
 */
export async function convertStickerToImage(stickerBuffer: Buffer): Promise<Buffer> {
  return sharp(stickerBuffer)
    .png()
    .toBuffer();
}
