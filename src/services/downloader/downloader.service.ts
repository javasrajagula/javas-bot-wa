import axios from 'axios';
import { extractTikTokMedia } from './tiktok.adapter.js';
import { extractInstagramMedia } from './instagram.adapter.js';
import { getTempPath, safeDelete } from '../../utils/file.util.js';
import fs from 'fs';
import {
  fbdown,
  igdl,
  ttdl,
  twitter,
  youtube,
  capcut,
  pinterest,
  threads
} from 'btch-downloader';

export interface DownloadResult {
  type: 'video' | 'image' | 'images';
  title: string;
  files: { path: string; mimeType: string }[];
}

import {
  isAllowedTikTokUrl,
  isAllowedInstagramUrl,
  isAllowedYouTubeUrl,
  isAllowedFacebookUrl,
  isAllowedTwitterUrl,
  isAllowedThreadsUrl,
  isAllowedPinterestUrl,
  isAllowedCapCutUrl,
  isSafePublicUrl
} from '../../validators/url.validator.js';

export function isValidUrl(url: string): boolean {
  try {
    if (!isSafePublicUrl(url)) return false;
    return (
      isAllowedTikTokUrl(url) ||
      isAllowedInstagramUrl(url) ||
      isAllowedYouTubeUrl(url) ||
      isAllowedFacebookUrl(url) ||
      isAllowedTwitterUrl(url) ||
      isAllowedThreadsUrl(url) ||
      isAllowedPinterestUrl(url) ||
      isAllowedCapCutUrl(url)
    );
  } catch {
    return false;
  }
}

/**
 * Helper to wrap a promise with a timeout.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage = 'Batas waktu operasi habis.'): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  return Promise.race([
    promise.then((result) => {
      clearTimeout(timer);
      return result;
    }),
    timeoutPromise
  ]);
}

/**
 * Downloads a URL into a temporary file. Enforces a dynamic size limit.
 */
async function downloadUrlToTemp(url: string, extension: string, maxBytes: number = 50 * 1024 * 1024): Promise<string> {
  const tempPath = getTempPath(extension);
  const writer = fs.createWriteStream(tempPath);

  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    timeout: 60000, // 60 seconds connection/read timeout
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  let downloadedBytes = 0;

  return new Promise((resolve, reject) => {
    response.data.on('data', (chunk: Buffer) => {
      downloadedBytes += chunk.length;
      if (downloadedBytes > maxBytes) {
        writer.close();
        safeDelete(tempPath);
        reject(new Error(`Ukuran file melebihi batas maksimal (${(maxBytes / (1024 * 1024)).toFixed(0)} MB).`));
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
export async function downloadMedia(url: string, commandName: string = 'tt', maxBytes: number = 50 * 1024 * 1024): Promise<DownloadResult> {
  if (!isValidUrl(url)) {
    throw new Error('Domain tidak didukung atau link tidak valid.');
  }

  const cleanCmd = commandName.toLowerCase();
  const tempFiles: { path: string; mimeType: string }[] = [];

  try {
    if (cleanCmd === 'tt' || cleanCmd === 'tiktok') {
      try {
        const extracted = await withTimeout(extractTikTokMedia(url), 30000, 'Batas waktu ekstraksi TikTok habis.');
        if (extracted.type === 'video') {
          const path = await downloadUrlToTemp(extracted.urls[0], 'mp4', maxBytes);
          tempFiles.push({ path, mimeType: 'video/mp4' });
          return { type: 'video', title: extracted.title, files: tempFiles };
        } else {
          // slideshow images
          for (const imgUrl of extracted.urls) {
            const path = await downloadUrlToTemp(imgUrl, 'png', maxBytes);
            tempFiles.push({ path, mimeType: 'image/png' });
          }
          return { type: 'images', title: extracted.title, files: tempFiles };
        }
      } catch (err: any) {
        console.warn(`[TikTok Legacy Failed] falling back to btch-downloader ttdl: ${err.message}`);
        const data = await withTimeout(ttdl(url), 30000, 'Batas waktu ekstraksi TikTok (fallback) habis.');
        if (!data || !data.video || data.video.length === 0) {
          throw new Error('Gagal mengekstrak video TikTok.');
        }
        const path = await downloadUrlToTemp(data.video[0], 'mp4', maxBytes);
        tempFiles.push({ path, mimeType: 'video/mp4' });
        return { type: 'video', title: data.title || 'TikTok Video', files: tempFiles };
      }
    }

    if (cleanCmd === 'ig' || cleanCmd === 'instagram') {
      try {
        const extracted = await withTimeout(extractInstagramMedia(url), 30000, 'Batas waktu ekstraksi Instagram habis.');
        if (extracted.type === 'video') {
          const path = await downloadUrlToTemp(extracted.urls[0], 'mp4', maxBytes);
          tempFiles.push({ path, mimeType: 'video/mp4' });
          return { type: 'video', title: extracted.title, files: tempFiles };
        } else {
          const path = await downloadUrlToTemp(extracted.urls[0], 'png', maxBytes);
          tempFiles.push({ path, mimeType: 'image/png' });
          return { type: 'image', title: extracted.title, files: tempFiles };
        }
      } catch (err: any) {
        console.warn(`[Instagram Legacy Failed] falling back to btch-downloader igdl: ${err.message}`);
        const data = await withTimeout(igdl(url), 30000, 'Batas waktu ekstraksi Instagram (fallback) habis.');
        const resultList = data.result || [];
        if (resultList.length === 0) {
          throw new Error('Gagal mengekstrak media Instagram.');
        }
        for (const item of resultList) {
          const isVideo = item.url.includes('.mp4') || item.url.includes('mime=video') || item.url.includes('&_nc_cat=');
          const ext = isVideo ? 'mp4' : 'png';
          const path = await downloadUrlToTemp(item.url, ext, maxBytes);
          tempFiles.push({ path, mimeType: isVideo ? 'video/mp4' : 'image/png' });
        }
        const isMulti = tempFiles.length > 1;
        return {
          type: isMulti ? 'images' : (tempFiles[0].mimeType === 'video/mp4' ? 'video' : 'image'),
          title: 'Instagram Media',
          files: tempFiles
        };
      }
    }

    if (cleanCmd === 'ytmp3' || cleanCmd === 'youtube-audio') {
      const data = await withTimeout(youtube(url), 30000, 'Batas waktu ekstraksi YouTube habis.');
      if (!data || !data.mp3) {
        throw new Error('Gagal mengekstrak audio dari YouTube. Pastikan link video YouTube valid.');
      }
      const path = await downloadUrlToTemp(data.mp3, 'mp3', maxBytes);
      tempFiles.push({ path, mimeType: 'audio/mpeg' });
      return { type: 'video', title: data.title || 'YouTube Audio', files: tempFiles };
    }

    if (cleanCmd === 'ytmp4' || cleanCmd === 'youtube-video') {
      const data = await withTimeout(youtube(url), 30000, 'Batas waktu ekstraksi YouTube habis.');
      if (!data || !data.mp4) {
        throw new Error('Gagal mengekstrak video dari YouTube. Pastikan link video YouTube valid.');
      }
      const path = await downloadUrlToTemp(data.mp4, 'mp4', maxBytes);
      tempFiles.push({ path, mimeType: 'video/mp4' });
      return { type: 'video', title: data.title || 'YouTube Video', files: tempFiles };
    }

    if (cleanCmd === 'fb' || cleanCmd === 'facebook' || cleanCmd === 'fbdown') {
      const data = await withTimeout(fbdown(url), 30000, 'Batas waktu ekstraksi Facebook habis.');
      const downloadUrl = data.HD || data.Normal_video;
      if (!downloadUrl) {
        throw new Error('Gagal mengekstrak video Facebook.');
      }
      const path = await downloadUrlToTemp(downloadUrl, 'mp4', maxBytes);
      tempFiles.push({ path, mimeType: 'video/mp4' });
      return { type: 'video', title: 'Facebook Video', files: tempFiles };
    }

    if (cleanCmd === 'twitter' || cleanCmd === 'x' || cleanCmd === 'twtdl') {
      const data = await withTimeout(twitter(url), 30000, 'Batas waktu ekstraksi Twitter/X habis.');
      if (!data || !data.url) {
        throw new Error('Gagal mengekstrak video Twitter/X.');
      }
      const path = await downloadUrlToTemp(data.url, 'mp4', maxBytes);
      tempFiles.push({ path, mimeType: 'video/mp4' });
      return { type: 'video', title: data.title || 'Twitter/X Video', files: tempFiles };
    }

    if (cleanCmd === 'threads' || cleanCmd === 'thread') {
      const data = await withTimeout(threads(url), 30000, 'Batas waktu ekstraksi Threads habis.');
      if (!data || !data.result) {
        throw new Error('Gagal mengekstrak media Threads.');
      }
      const item = data.result;
      const isVideo = !!item.video || item.type === 'video';
      const path = await downloadUrlToTemp(item.video || item.image, isVideo ? 'mp4' : 'png', maxBytes);
      tempFiles.push({ path, mimeType: isVideo ? 'video/mp4' : 'image/png' });
      return { type: isVideo ? 'video' : 'image', title: 'Threads Media', files: tempFiles };
    }

    if (cleanCmd === 'pinterest' || cleanCmd === 'pin' || cleanCmd === 'pindl') {
      const data = await withTimeout(pinterest(url), 30000, 'Batas waktu ekstraksi Pinterest habis.');
      if (!data || !data.result) {
        throw new Error('Gagal mengekstrak media Pinterest.');
      }
      const item = data.result;
      const pin = (Array.isArray(item.result) ? item.result[0] : item) as any;
      const downloadUrl = pin.video_url || pin.image_url || pin.image;
      if (!downloadUrl) {
        throw new Error('Link media Pinterest tidak ditemukan.');
      }
      const isVideo = !!pin.video_url || !!pin.is_video;
      const path = await downloadUrlToTemp(downloadUrl, isVideo ? 'mp4' : 'png', maxBytes);
      tempFiles.push({ path, mimeType: isVideo ? 'video/mp4' : 'image/png' });
      return { type: isVideo ? 'video' : 'image', title: pin.title || 'Pinterest Media', files: tempFiles };
    }

    if (cleanCmd === 'capcut' || cleanCmd === 'cc') {
      const data = await withTimeout(capcut(url), 30000, 'Batas waktu ekstraksi CapCut habis.');
      if (!data || !data.originalVideoUrl) {
        throw new Error('Gagal mengekstrak template CapCut.');
      }
      const path = await downloadUrlToTemp(data.originalVideoUrl, 'mp4', maxBytes);
      tempFiles.push({ path, mimeType: 'video/mp4' });
      return { type: 'video', title: data.title || 'CapCut Template', files: tempFiles };
    }

    throw new Error('Tipe downloader tidak didukung.');
  } catch (err) {
    for (const file of tempFiles) {
      safeDelete(file.path);
    }
    throw err;
  }
}
