import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';

const TEMP_DIR = path.join(process.cwd(), 'temp');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

export function getTempPath(ext = ''): string {
  const randomName = crypto.randomBytes(16).toString('hex');
  const filename = ext ? `${randomName}.${ext.replace(/^\./, '')}` : randomName;
  return path.join(TEMP_DIR, filename);
}

export async function downloadFile(url: string, targetPath: string): Promise<void> {
  const writer = fs.createWriteStream(targetPath);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

export async function downloadToBuffer(url: string): Promise<Buffer> {
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  return Buffer.from(response.data);
}

export function safeDelete(filePath: string): void {
  try {
    if (filePath && fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }
    }
  } catch (err) {
    console.error(`Failed to delete file/directory: ${filePath}`, err);
  }
}

/**
 * Sweeps the temp folder deleting any files or directories older than maxAgeMs (default: 15 minutes)
 */
export function cleanupTempFiles(maxAgeMs = 15 * 60 * 1000): void {
  try {
    if (!fs.existsSync(TEMP_DIR)) return;
    const files = fs.readdirSync(TEMP_DIR);
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      const stat = fs.statSync(filePath);
      const age = now - stat.mtimeMs;

      if (age > maxAgeMs) {
        if (stat.isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(filePath);
        }
        console.log(`[File Cleanup] Deleted old temp item: ${file} (${Math.round(age / 1000 / 60)}m old)`);
      }
    }
  } catch (err) {
    console.error('Error cleaning up temp files:', err);
  }
}

// Start automatic periodic cleanup every 5 minutes
export function startCleanupInterval(intervalMs = 5 * 60 * 1000): NodeJS.Timeout {
  return setInterval(() => {
    cleanupTempFiles();
  }, intervalMs);
}
