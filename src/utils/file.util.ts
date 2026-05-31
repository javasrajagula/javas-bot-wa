import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import { env } from '../config/env.js';

const TEMP_DIR = path.resolve(process.cwd(), 'temp');
const OUTPUT_DIR = path.resolve(process.cwd(), 'output');

// Ensure base directories exist
for (const dir of [TEMP_DIR, OUTPUT_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getTempPath(ext = ''): string {
  const randomName = crypto.randomBytes(16).toString('hex');
  const filename = ext ? `${randomName}.${ext.replace(/^\./, '')}` : randomName;
  return path.join(TEMP_DIR, filename);
}

export function getOutputPath(ext = ''): string {
  const randomName = crypto.randomBytes(16).toString('hex');
  const filename = ext ? `${randomName}.${ext.replace(/^\./, '')}` : randomName;
  return path.join(OUTPUT_DIR, filename);
}

/**
 * Assert that a URL is safe for outbound requests:
 * - Must use http/https scheme
 * - Must NOT be a private/loopback address
 * - If DOWNLOAD_TRUSTED_HOSTS is set, hostname must match (or be subdomain of) one entry
 */
export function assertSafePublicUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`URL tidak valid: ${rawUrl}`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`URL harus menggunakan protokol http atau https, bukan "${parsed.protocol}"`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block private / loopback ranges
  const privateHostname =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.') || // lazy, fine for SSRF guard
    hostname.startsWith('192.168.') ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal');

  if (privateHostname) {
    throw new Error(`URL mengarah ke alamat internal yang tidak diizinkan: ${hostname}`);
  }

  const trustedHosts = env.DOWNLOAD_TRUSTED_HOSTS
    ? env.DOWNLOAD_TRUSTED_HOSTS.split(',').map(h => h.trim().toLowerCase()).filter(Boolean)
    : [];

  if (trustedHosts.length > 0) {
    const allowed = trustedHosts.some(
      h => hostname === h || hostname.endsWith(`.${h}`)
    );
    if (!allowed) {
      throw new Error(`URL host "${hostname}" tidak termasuk dalam daftar host tepercaya.`);
    }
  }

  return parsed;
}

/**
 * Download a URL to a local file path with connection/read timeouts and size limit.
 */
export async function downloadFile(url: string, targetPath: string): Promise<void> {
  assertSafePublicUrl(url);

  const timeoutMs = (env.DOWNLOAD_TIMEOUT_SECONDS ?? 30) * 1000;
  const maxBytes = env.DOWNLOAD_MAX_BYTES ?? 100 * 1024 * 1024;

  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    timeout: timeoutMs,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    maxContentLength: maxBytes,
    maxBodyLength: maxBytes
  });

  // Content-Length pre-check
  const rawContentLength = response.headers['content-length'];
  const contentLength = parseInt(String(rawContentLength ?? '0'), 10);
  if (contentLength > maxBytes) {
    if (typeof (response.data as any).destroy === 'function') {
      (response.data as any).destroy();
    }
    throw new Error(`Ukuran file melebihi batas maksimal: ${(maxBytes / 1024 / 1024).toFixed(0)}MB`);
  }

  // Ensure target is inside TEMP or OUTPUT
  const absTarget = path.resolve(targetPath);
  if (!absTarget.startsWith(TEMP_DIR) && !absTarget.startsWith(OUTPUT_DIR)) {
    if (typeof (response.data as any).destroy === 'function') {
      (response.data as any).destroy();
    }
    throw new Error(`Target download di luar direktori yang diizinkan: ${targetPath}`);
  }

  const writer = fs.createWriteStream(absTarget);
  let totalBytes = 0;

  response.data.on('data', (chunk: Buffer) => {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      if (typeof (response.data as any).destroy === 'function') {
        (response.data as any).destroy();
      }
      writer.destroy(new Error(`Ukuran file melebihi batas maksimal: ${(maxBytes / 1024 / 1024).toFixed(0)}MB`));
    }
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', (err) => {
      safeDeleteTemp(absTarget);
      reject(err);
    });
    response.data.on('error', reject);
  });
}

/**
 * Download a URL into a Buffer with connection/read timeouts and size limit.
 */
export async function downloadToBuffer(url: string): Promise<Buffer> {
  assertSafePublicUrl(url);

  const timeoutMs = (env.DOWNLOAD_TIMEOUT_SECONDS ?? 30) * 1000;
  const maxBytes = env.DOWNLOAD_MAX_BYTES ?? 100 * 1024 * 1024;

  const response = await axios({
    url,
    method: 'GET',
    responseType: 'arraybuffer',
    timeout: timeoutMs,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    maxContentLength: maxBytes,
    maxBodyLength: maxBytes
  });

  if (response.data.byteLength > maxBytes) {
    throw new Error(`Ukuran buffer melebihi batas maksimal: ${(maxBytes / 1024 / 1024).toFixed(0)}MB`);
  }

  return Buffer.from(response.data);
}

// ─── Bounded Safe Delete Functions ──────────────────────────────────────────

function safeDeleteWithin(filePath: string, allowedRoot: string, label: string): void {
  try {
    if (!filePath) return;
    const absPath = path.resolve(filePath);
    if (!absPath.startsWith(allowedRoot + path.sep) && absPath !== allowedRoot) {
      console.warn(`[SafeDelete] Ditolak – "${absPath}" bukan bagian dari ${label} dir: ${allowedRoot}`);
      return;
    }
    if (fs.existsSync(absPath)) {
      const stat = fs.statSync(absPath);
      if (stat.isDirectory()) {
        fs.rmSync(absPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(absPath);
      }
    }
  } catch (err) {
    console.error(`[SafeDelete] Gagal menghapus file/dir (${label}): ${filePath}`, err);
  }
}

/** Delete a file only if it lives inside the temp directory. */
export function safeDeleteTemp(filePath: string): void {
  safeDeleteWithin(filePath, TEMP_DIR, 'temp');
}

/** Delete a file only if it lives inside the output directory. */
export function safeDeleteOutput(filePath: string): void {
  safeDeleteWithin(filePath, OUTPUT_DIR, 'output');
}

/** Delete a file if it lives inside a specific allowed directory root. */
export function safeDeleteFromAllowedDir(filePath: string, allowedDirRoot: string): void {
  const absRoot = path.resolve(allowedDirRoot);
  safeDeleteWithin(filePath, absRoot, absRoot);
}

/**
 * Backward-compat alias – tries temp then output, refuses anything else.
 * @deprecated Use safeDeleteTemp / safeDeleteOutput directly.
 */
export function safeDelete(filePath: string): void {
  if (!filePath) return;
  const absPath = path.resolve(filePath);
  if (absPath.startsWith(TEMP_DIR + path.sep) || absPath === TEMP_DIR) {
    safeDeleteTemp(filePath);
  } else if (absPath.startsWith(OUTPUT_DIR + path.sep) || absPath === OUTPUT_DIR) {
    safeDeleteOutput(filePath);
  } else {
    console.warn(`[SafeDelete] Ditolak – "${absPath}" bukan di temp atau output dir.`);
  }
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

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
