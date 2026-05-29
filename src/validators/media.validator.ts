import { isPremium } from '../bot/permission.js';

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
