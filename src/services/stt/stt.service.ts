import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { env } from '../../config/env.js';
import { getTempPath, safeDelete } from '../../utils/file.util.js';

/**
 * Transcribes audio using the configured STT provider.
 * Priority:
 *   1. STT_COMMAND (local Whisper/Vosk wrapper)
 *   2. GROQ_API_KEY (Groq Whisper cloud — fast & free tier)
 *   3. Error if neither configured
 */
export async function transcribeAudio(audioBuffer: Buffer, ext = 'mp3'): Promise<string> {
  // --- Mode 1: Local STT via STT_COMMAND ---
  if (env.STT_COMMAND) {
    return transcribeLocal(audioBuffer, ext);
  }

  // --- Mode 2: Groq Whisper API ---
  if ((env as any).GROQ_API_KEY) {
    return transcribeGroq(audioBuffer, ext);
  }

  // --- Neither configured ---
  throw new Error(
    '⚠️ STT belum dikonfigurasi.\n\n' +
    '*Pilihan 1 — Groq API (mudah, gratis):*\n' +
    '1. Daftar di https://console.groq.com\n' +
    '2. Buat API key gratis\n' +
    '3. Tambahkan di .env:\n' +
    '   `GROQ_API_KEY=gsk_xxxxxxxxxxxxx`\n\n' +
    '*Pilihan 2 — Whisper Lokal (offline):*\n' +
    '1. Install Python 3.8-3.12\n' +
    '2. Jalankan: `python -m pip install openai-whisper`\n' +
    '3. Tambahkan di .env:\n' +
    '   `STT_COMMAND=python scripts/whisper_stt.py`'
  );
}

// --- Local STT via STT_COMMAND ---
async function transcribeLocal(audioBuffer: Buffer, ext: string): Promise<string> {
  const input = getTempPath(ext);
  await fs.promises.writeFile(input, audioBuffer);

  const timeoutSeconds = env.STT_TIMEOUT_SECONDS || 120;

  try {
    return await new Promise<string>((resolve, reject) => {
      const tokens = env.STT_COMMAND!.trim().split(/\s+/);
      const exe = tokens[0];
      const extraArgs = tokens.slice(1);
      const args = [...extraArgs, input];

      const proc = spawn(exe, args, { windowsHide: true });

      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error(`Proses STT melebihi batas waktu ${timeoutSeconds} detik.`));
      }, timeoutSeconds * 1000);

      proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
      proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

      proc.on('error', () => {
        clearTimeout(timer);
        reject(new Error(`STT command "${exe}" tidak dapat dijalankan. Pastikan executable/script tersebut ada di PATH.`));
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`STT gagal dengan exit code ${code}. Detail: ${stderr.trim()}`));
          return;
        }
        resolve(stdout.trim());
      });
    });
  } finally {
    safeDelete(input);
  }
}

// --- Groq Whisper API (cloud) ---
async function transcribeGroq(audioBuffer: Buffer, ext: string): Promise<string> {
  const groqApiKey = (env as any).GROQ_API_KEY as string;
  const input = getTempPath(ext);
  await fs.promises.writeFile(input, audioBuffer);

  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(input), {
      filename: `audio.${ext}`,
      contentType: getMimeType(ext),
    });
    form.append('model', 'whisper-large-v3-turbo');
    form.append('response_format', 'text');
    // Auto-detect language, or set 'id' for Indonesian
    const lang = (env as any).STT_LANGUAGE || '';
    if (lang) form.append('language', lang);

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        ...form.getHeaders(),
      },
      body: form as any,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq STT error ${response.status}: ${errText}`);
    }

    const text = await response.text();
    return text.trim();
  } finally {
    safeDelete(input);
  }
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    mp3: 'audio/mpeg',
    mp4: 'audio/mp4',
    ogg: 'audio/ogg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    webm: 'audio/webm',
    opus: 'audio/ogg',
  };
  return map[ext.toLowerCase()] || 'audio/mpeg';
}
