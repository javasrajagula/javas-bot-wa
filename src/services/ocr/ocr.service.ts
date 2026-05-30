import { spawn } from 'child_process';
import fs from 'fs';
import { env } from '../../config/env.js';
import { getTempPath, safeDelete } from '../../utils/file.util.js';

export async function runOcr(imageBuffer: Buffer): Promise<string> {
  const input = getTempPath('png');
  await fs.promises.writeFile(input, imageBuffer);

  try {
    return await new Promise<string>((resolve, reject) => {
      const proc = spawn(env.OCR_COMMAND, [input, 'stdout', '-l', 'ind+eng'], {
        windowsHide: true
      });

      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', chunk => { stdout += chunk.toString(); });
      proc.stderr.on('data', chunk => { stderr += chunk.toString(); });
      proc.on('error', () => {
        reject(new Error(`OCR engine belum tersedia. Install Tesseract OCR atau set OCR_COMMAND. Detail: ${env.OCR_COMMAND}`));
      });
      proc.on('close', code => {
        if (code !== 0) {
          reject(new Error(stderr.trim() || `OCR gagal dengan exit code ${code}.`));
          return;
        }
        resolve(stdout.trim());
      });
    });
  } finally {
    safeDelete(input);
  }
}
