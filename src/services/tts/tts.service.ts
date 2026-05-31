import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import axios from 'axios';
import { env } from '../../config/env.js';
import { getTempPath, safeDelete } from '../../utils/file.util.js';

const execAsync = promisify(exec);

export interface TtsResult {
  buffer: Buffer;
  mimeType: string;
}

/**
 * Generates text-to-speech audio buffer using local cmd -> custom api -> Google fallback chain.
 */
export async function generateTts(text: string, lang = 'id'): Promise<TtsResult> {
  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error('Teks untuk TTS tidak boleh kosong.');
  }

  // 1. Try Local Command if configured
  if (env.TTS_COMMAND) {
    const tempOut = getTempPath('wav');
    try {
      let commandLine = env.TTS_COMMAND;
      if (commandLine.includes('{output}') || commandLine.includes('{text}')) {
        commandLine = commandLine
          .replace('{output}', `"${tempOut}"`)
          .replace('{text}', `"${cleanText.replace(/"/g, '\\"')}"`);
      } else {
        commandLine = `${commandLine} --output "${tempOut}" "${cleanText.replace(/"/g, '\\"')}"`;
      }

      await execAsync(commandLine, { timeout: 15000 });

      if (fs.existsSync(tempOut)) {
        const buffer = fs.readFileSync(tempOut);
        safeDelete(tempOut);
        if (buffer.length > 0) {
          return { buffer, mimeType: 'audio/wav' };
        }
      }
    } catch (err) {
      console.warn('[TTS Service] Local command failed, falling back to API:', err);
      safeDelete(tempOut);
    }
  }

  // 2. Try Custom API if configured
  if (env.TTS_API_BASE_URL) {
    try {
      const headers: Record<string, string> = {};
      if (env.TTS_API_KEY) {
        headers['Authorization'] = `Bearer ${env.TTS_API_KEY}`;
      }

      // Try POST first
      try {
        const response = await axios.post(
          env.TTS_API_BASE_URL,
          { text: cleanText, lang },
          {
            headers,
            responseType: 'arraybuffer',
            timeout: 10000
          }
        );

        const contentType = String(response.headers['content-type'] || '');
        if (contentType.startsWith('audio/') && response.data?.length > 0) {
          return { buffer: Buffer.from(response.data), mimeType: contentType };
        }
      } catch (postErr) {
        // Fallback to GET
        const response = await axios.get(env.TTS_API_BASE_URL, {
          params: { text: cleanText, lang },
          headers,
          responseType: 'arraybuffer',
          timeout: 10000
        });

        const contentType = String(response.headers['content-type'] || '');
        if (contentType.startsWith('audio/') && response.data?.length > 0) {
          return { buffer: Buffer.from(response.data), mimeType: contentType };
        }
      }
    } catch (err) {
      console.warn('[TTS Service] Custom API failed, falling back to Google:', err);
    }
  }

  // 3. Fallback to Google Translate TTS
  try {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(cleanText)}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      responseType: 'arraybuffer',
      timeout: 10000
    });

    const contentType = String(response.headers['content-type'] || '');
    if (response.data && response.data.length > 0) {
      return {
        buffer: Buffer.from(response.data),
        mimeType: contentType.startsWith('audio/') ? contentType : 'audio/mpeg'
      };
    }
  } catch (err) {
    console.error('[TTS Service] Google Translate TTS failed:', err);
  }

  throw new Error('Gagal menghasilkan audio TTS menggunakan semua penyedia layanan.');
}
