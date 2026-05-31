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

  const timeoutSeconds = env.STT_TIMEOUT_SECONDS || 120;

  try {
    return await new Promise<string>((resolve, reject) => {
      const tokens = env.STT_COMMAND!.trim().split(/\s+/);
      const exe = tokens[0];
      const extraArgs = tokens.slice(1);
      const args = [...extraArgs, input];

      const proc = spawn(exe, args, {
        windowsHide: true
      });

      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error(`Proses STT melebihi batas waktu ${timeoutSeconds} detik.`));
      }, timeoutSeconds * 1000);

      proc.stdout.on('data', chunk => { stdout += chunk.toString(); });
      proc.stderr.on('data', chunk => { stderr += chunk.toString(); });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(new Error(`STT command "${exe}" tidak dapat dijalankan. Pastikan executable/script tersebut ada di PATH.`));
      });

      proc.on('close', code => {
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
