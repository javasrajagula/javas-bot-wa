import sharp from 'sharp';
import fs from 'fs';
import { env } from '../../config/env.js';
import { getTempPath, safeDelete } from '../../utils/file.util.js';
import { runFfmpeg } from '../ffmpeg/ffmpeg.service.js';

/**
 * Escapes text for FFmpeg's drawtext filter
 */
function escapeFfmpegDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "'\\\\''")
    .replace(/%/g, '\\%');
}

/**
 * Helper to escape XML/SVG characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Adds watermark to an image buffer
 */
export async function watermarkImage(buffer: Buffer, text: string): Promise<Buffer> {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const width = metadata.width || 512;
  const height = metadata.height || 512;

  const fontSize = Math.max(16, Math.floor(width * 0.04));
  const svgWidth = width;
  const svgHeight = fontSize * 2;
  const escapedText = escapeXml(text);

  const svg = `
    <svg width="${svgWidth}" height="${svgHeight}">
      <text x="${svgWidth - 20}" y="${fontSize + 5}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="bold" fill="white" opacity="0.6" text-anchor="end" stroke="black" stroke-width="${Math.max(1, Math.floor(fontSize / 8))}">
        ${escapedText}
      </text>
    </svg>
  `;

  const top = Math.max(0, height - svgHeight - 10);

  return image
    .composite([{
      input: Buffer.from(svg),
      top: top,
      left: 0
    }])
    .toBuffer();
}

/**
 * Adds watermark to a video buffer
 */
export async function watermarkVideo(
  buffer: Buffer,
  text: string,
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center' = 'bottom-right'
): Promise<Buffer> {
  const tempIn = getTempPath('mp4');
  const tempOut = getTempPath('mp4');
  fs.writeFileSync(tempIn, buffer);

  const cleanText = text.replace(/[^a-zA-Z0-9\s.,!?-]/g, '');

  let tempOverlay: string | null = null;

  // Map position to FFmpeg overlay parameters
  let overlayPos = 'W-w-10:H-h-10'; // default: bottom-right
  let drawtextPos = 'x=w-tw-10:y=h-th-10';

  if (position === 'bottom-left') {
    overlayPos = '10:H-h-10';
    drawtextPos = 'x=10:y=h-th-10';
  } else if (position === 'top-right') {
    overlayPos = 'W-w-10:10';
    drawtextPos = 'x=w-tw-10:y=10';
  } else if (position === 'top-left') {
    overlayPos = '10:10';
    drawtextPos = 'x=10:y=10';
  } else if (position === 'center') {
    overlayPos = '(W-w)/2:(H-h)/2';
    drawtextPos = 'x=(w-tw)/2:y=(h-th)/2';
  }

  const runOverlayFallback = async () => {
    const fontSize = 24;
    const svgWidth = 400;
    const svgHeight = 50;
    const escapedText = escapeXml(cleanText);

    const svg = `
      <svg width="${svgWidth}" height="${svgHeight}">
        <text x="${svgWidth - 10}" y="${fontSize + 5}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="bold" fill="white" opacity="0.6" text-anchor="end" stroke="black" stroke-width="2">
          ${escapedText}
        </text>
      </svg>
    `;

    const overlayBuffer = await sharp({
      create: {
        width: svgWidth,
        height: svgHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();

    tempOverlay = getTempPath('png');
    fs.writeFileSync(tempOverlay, overlayBuffer);

    const args = [
      '-y',
      '-i', tempIn,
      '-i', tempOverlay,
      '-filter_complex', `overlay=${overlayPos}`,
      '-codec:a', 'copy',
      tempOut
    ];
    await runFfmpeg(args);
  };

  try {
    let success = false;
    if (env.FONT_FILE_PATH && fs.existsSync(env.FONT_FILE_PATH)) {
      try {
        const escapedText = escapeFfmpegDrawtext(cleanText);
        const escapedFontPath = env.FONT_FILE_PATH.replace(/\\/g, '/').replace(/:/g, '\\:');
        const filter = `drawtext=text='${escapedText}':${drawtextPos}:fontsize=24:fontcolor=white@0.6:fontfile='${escapedFontPath}'`;

        const args = [
          '-y',
          '-i', tempIn,
          '-vf', filter,
          '-codec:a', 'copy',
          tempOut
        ];
        await runFfmpeg(args);
        success = true;
      } catch (err) {
        console.warn('[Watermark] FFmpeg drawtext failed, falling back to overlay image.', err);
      }
    }

    if (!success) {
      await runOverlayFallback();
    }

    return fs.readFileSync(tempOut);
  } finally {
    safeDelete(tempIn);
    safeDelete(tempOut);
    if (tempOverlay) {
      safeDelete(tempOverlay);
    }
  }
}
