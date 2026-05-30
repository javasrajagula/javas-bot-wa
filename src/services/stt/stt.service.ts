import { spawn } from 'child_process';
import fs from 'fs';
import { env } from '../../config/env.js';
import { getTempPath, safeDelete } from '../../utils/file.util.js';

export async function transcribeAudio(audioBuffer: Buffer, ext = 'mp3'): Promise<string> {
  if (!env.STT_COMMAND) {
    throw new Error('STT offline belum dikonfigurasi. Set STT_COMMAND ke wrapper Whisper/Vosk lokal yang menerima path file audio dan mencetak teks ke stdout.');
  }

  const input = getTempPath(ext);
  await fs.promises.writeFile(input, audioBuffer);

  try {
    return await new Promise<string>((resolve, reject) => {
      const proc = spawn(env.STT_COMMAND, [input], {
        windowsHide: true
      });

      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', chunk => { stdout += chunk.toString(); });
      proc.stderr.on('data', chunk => { stderr += chunk.toString(); });
      proc.on('error', () => {
        reject(new Error(`STT command tidak dapat dijalankan: ${env.STT_COMMAND}`));
      });
      proc.on('close', code => {
        if (code !== 0) {
          reject(new Error(stderr.trim() || `STT gagal dengan exit code ${code}.`));
          return;
        }
        resolve(stdout.trim());
      });
    });
  } finally {
    safeDelete(input);
  }
}
