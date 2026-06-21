import { isPremium } from '../bot/permission.js';
import sharp from 'sharp';
import { getMediaDuration } from '../services/ffmpeg/ffmpeg.service.js';

/**
 * Validates if the timestamp string matches standard formats (HH:MM:SS, MM:SS, or raw seconds)
 */
export function validateTimestamp(timestamp: string): boolean {
  const hhmmss = /^\d{2}:\d{2}:\d{2}$/;
  const mmss = /^\d{2}:\d{2}$/;
  const seconds = /^\d+(\.\d+)?$/;
  return hhmmss.test(timestamp) || mmss.test(timestamp) || seconds.test(timestamp);
}

/**
 * Parses time format string into seconds
 */
export function parseTimeToSeconds(timeStr: string): number {
  if (/^\d+(\.\d+)?$/.test(timeStr)) {
    return parseFloat(timeStr);
  }
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

/**
 * Validates file buffer size based on user premium status
 */
export async function validateMediaSize(bufferLength: number, userId: string): Promise<void> {
  const isPrem = await isPremium(userId);
  const maxSize = isPrem ? 50 * 1024 * 1024 : 10 * 1024 * 1024; // 50MB premium, 10MB free
  if (bufferLength > maxSize) {
    throw new Error(`Ukuran file media terlalu besar (${(bufferLength / 1024 / 1024).toFixed(1)} MB). Batas maksimum adalah ${maxSize / 1024 / 1024} MB.`);
  }
}

/**
 * Validates image resolution using sharp metadata
 */
export async function validateImageResolution(buffer: Buffer, userId: string): Promise<void> {
  const isPrem = await isPremium(userId);
  const maxDim = isPrem ? 8192 : 4096; // 8192x8192 premium, 4096x4096 free
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  if (width > maxDim || height > maxDim) {
    throw new Error(`Resolusi gambar terlalu besar (${width}x${height}). Batas maksimum untuk user ${isPrem ? 'Premium' : 'Free'} adalah ${maxDim}x${maxDim}.`);
  }
}

/**
 * Validates video duration using ffprobe duration in seconds
 */
export async function validateVideoDuration(duration: number, userId: string): Promise<void> {
  const isPrem = await isPremium(userId);
  const maxDur = isPrem ? 600 : 60; // 10 minutes (600s) premium, 1 minute (60s) free
  if (duration > maxDur) {
    throw new Error(`Durasi video terlalu panjang (${duration.toFixed(1)} detik). Batas maksimum untuk user ${isPrem ? 'Premium' : 'Free'} adalah ${maxDur} detik.`);
  }
}

/**
 * Validates video duration by file path using ffprobe
 */
export async function validateVideoDurationByPath(filePath: string, userId: string): Promise<void> {
  const duration = await getMediaDuration(filePath);
  await validateVideoDuration(duration, userId);
}

/**
 * Validates text length for watermarking to prevent excessive sizing and overflow
 */
export function validateWatermarkText(text: string): void {
  if (text.length > 30) {
    throw new Error('Teks watermark terlalu panjang. Maksimal 30 karakter.');
  }
}

/**
 * Validates audio/video speed multiplier rate
 */
export function validateSpeed(speed: number): void {
  if (isNaN(speed) || speed < 0.5 || speed > 2.0) {
    throw new Error('Kecepatan tidak valid. Harus berada di rentang 0.5x sampai 2.0x.');
  }
}
