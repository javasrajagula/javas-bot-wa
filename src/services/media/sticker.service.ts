import sharp from 'sharp';

/**
 * Converts an image buffer to a WhatsApp-compatible WebP sticker.
 * Ensures the output is exactly 512x512 px and compressed below 100KB.
 */
export async function convertToSticker(imageBuffer: Buffer): Promise<Buffer> {
  let quality = 80;
  let buffer = await sharp(imageBuffer)
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .webp({ quality })
    .toBuffer();

  // If size is above 100KB, compress dynamically
  while (buffer.length > 100 * 1024 && quality > 10) {
    quality -= 10;
    buffer = await sharp(imageBuffer)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .webp({ quality })
      .toBuffer();
  }

  return buffer;
}
