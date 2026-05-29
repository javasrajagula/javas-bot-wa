import axios from 'axios';
import { extractTikTokMedia } from './tiktok.adapter.js';
import { extractInstagramMedia } from './instagram.adapter.js';
import { getTempPath, safeDelete } from '../../utils/file.util.js';
import fs from 'fs';

export interface DownloadResult {
  type: 'video' | 'image' | 'images';
  title: string;
  files: { path: string; mimeType: string }[];
}

import { isAllowedTikTokUrl, isAllowedInstagramUrl, isSafePublicUrl } from '../../validators/url.validator.js';

export function isValidUrl(url: string): boolean {
  try {
    if (!isSafePublicUrl(url)) return false;
    return isAllowedTikTokUrl(url) || isAllowedInstagramUrl(url);
  } catch {
    return false;
  }
}

/**
 * Downloads a URL into a temporary file. Enforces a 50MB limit.
 */
async function downloadUrlToTemp(url: string, extension: string): Promise<string> {
  const tempPath = getTempPath(extension);
  const writer = fs.createWriteStream(tempPath);

  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  let downloadedBytes = 0;
  const maxBytes = 50 * 1024 * 1024; // 50MB limit

  return new Promise((resolve, reject) => {
    response.data.on('data', (chunk: Buffer) => {
      downloadedBytes += chunk.length;
      if (downloadedBytes > maxBytes) {
        writer.close();
        safeDelete(tempPath);
        reject(new Error('Ukuran file melebihi batas 50 MB.'));
      }
    });

    response.data.pipe(writer);

    writer.on('finish', () => resolve(tempPath));
    writer.on('error', (err) => {
      safeDelete(tempPath);
      reject(err);
    });
  });
}

/**
 * Validates, extracts, and downloads social media content.
 */
export async function downloadMedia(url: string): Promise<DownloadResult> {
  if (!isValidUrl(url)) {
    throw new Error('Domain tidak didukung. Hanya mendukung link TikTok dan Instagram.');
  }

  const isTikTok = url.includes('tiktok.com');
  const tempFiles: { path: string; mimeType: string }[] = [];

  try {
    if (isTikTok) {
      const extracted = await extractTikTokMedia(url);
      if (extracted.type === 'video') {
        const path = await downloadUrlToTemp(extracted.urls[0], 'mp4');
        tempFiles.push({ path, mimeType: 'video/mp4' });
        return { type: 'video', title: extracted.title, files: tempFiles };
      } else {
        // slideshow images
        for (const imgUrl of extracted.urls) {
          const path = await downloadUrlToTemp(imgUrl, 'png');
          tempFiles.push({ path, mimeType: 'image/png' });
        }
        return { type: 'images', title: extracted.title, files: tempFiles };
      }
    } else {
      // Instagram
      const extracted = await extractInstagramMedia(url);
      if (extracted.type === 'video') {
        const path = await downloadUrlToTemp(extracted.urls[0], 'mp4');
        tempFiles.push({ path, mimeType: 'video/mp4' });
        return { type: 'video', title: extracted.title, files: tempFiles };
      } else {
        const path = await downloadUrlToTemp(extracted.urls[0], 'png');
        tempFiles.push({ path, mimeType: 'image/png' });
        return { type: 'image', title: extracted.title, files: tempFiles };
      }
    }
  } catch (err) {
    // Ensure cleanup of any partially downloaded files on error
    for (const file of tempFiles) {
      safeDelete(file.path);
    }
    throw err;
  }
}
