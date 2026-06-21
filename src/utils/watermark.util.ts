import sharp from 'sharp';

/**
 * Adds a text watermark to the bottom-right corner of an image buffer.
 */
export async function addWatermarkToImage(imageBuffer: Buffer, text: string): Promise<Buffer> {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 500;
    const height = metadata.height || 500;

    // Dynamically calculate font size and coordinates
    const fontSize = Math.max(12, Math.floor(width / 35));
    const textLength = text.length;
    const padding = 15;
    
    // Estimate width of text to position it properly from the right edge
    const estimatedTextWidth = textLength * (fontSize * 0.6);
    const x = Math.max(padding, width - estimatedTextWidth - padding);
    const y = height - padding;

    const svg = `
      <svg width="${width}" height="${height}">
        <style>
          .watermark {
            font-family: Arial, Helvetica, sans-serif;
            font-weight: bold;
            fill: #ffffff;
            fill-opacity: 0.55;
            stroke: #000000;
            stroke-width: 1px;
            stroke-opacity: 0.55;
          }
        </style>
        <text x="${x}" y="${y}" font-size="${fontSize}" class="watermark">${text}</text>
      </svg>
    `;

    return await sharp(imageBuffer)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .toBuffer();
  } catch (err) {
    console.error('[Watermark Util] Failed to composite watermark:', err);
    return imageBuffer;
  }
}
