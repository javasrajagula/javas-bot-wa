import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { env } from '../../config/env.js';

const execAsync = promisify(exec);

export async function checkCommandAvailable(cmd: string): Promise<boolean> {
  if (!cmd) return false;
  try {
    const cleanCmd = cmd.split(/\s+/)[0];
    const checkCmd = process.platform === 'win32' ? `where "${cleanCmd}"` : `which "${cleanCmd}"`;
    await execAsync(checkCmd);
    return true;
  } catch {
    // Fallback: try executing it with a flag
    try {
      const cleanCmd = cmd.split(/\s+/)[0];
      await execAsync(`"${cleanCmd}" --version`);
      return true;
    } catch {
      // Local poppler check for Windows Winget installation path
      if (process.platform === 'win32' && (cmd === 'pdftoppm' || cmd === 'pdftotext')) {
        try {
          const homeDir = process.env.USERPROFILE || process.env.HOMEPATH || '';
          const wingetDir = path.join(homeDir, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages');
          if (fs.existsSync(wingetDir)) {
            const packages = fs.readdirSync(wingetDir);
            const popplerPkg = packages.find(p => p.startsWith('oschwartz10612.Poppler'));
            if (popplerPkg) {
              const pkgPath = path.join(wingetDir, popplerPkg);
              const subdirs = fs.readdirSync(pkgPath);
              const popplerDir = subdirs.find(d => d.startsWith('poppler-'));
              if (popplerDir) {
                const fullPath = path.join(pkgPath, popplerDir, 'Library', 'bin', `${cmd}.exe`);
                if (fs.existsSync(fullPath)) {
                  return true;
                }
              }
            }
          }
        } catch {}
      }
      return false;
    }
  }
}

export function checkFontFile(): boolean {
  if (!env.FONT_FILE_PATH) return false;
  try {
    return fs.existsSync(env.FONT_FILE_PATH);
  } catch {
    return false;
  }
}

export interface DependencyStatus {
  ffmpeg: boolean;
  ffprobe: boolean;
  fontFile: boolean;
  pdftoppm: boolean;
  pdftotext: boolean;
  tesseract: boolean;
  ocrCommand: boolean;
  sttCommand: boolean;
  removebgProvider: string;
  ttsProvider: string;
}

export async function checkAllDependencies(): Promise<DependencyStatus> {
  const [
    ffmpeg,
    ffprobe,
    pdftoppm,
    pdftotext,
    tesseract,
    ocrCommand,
    sttCommand
  ] = await Promise.all([
    checkCommandAvailable('ffmpeg'),
    checkCommandAvailable('ffprobe'),
    checkCommandAvailable('pdftoppm'),
    checkCommandAvailable('pdftotext'),
    checkCommandAvailable(env.TESSERACT_CMD || 'tesseract'),
    env.OCR_COMMAND ? checkCommandAvailable(env.OCR_COMMAND) : Promise.resolve(false),
    env.STT_COMMAND ? checkCommandAvailable(env.STT_COMMAND) : Promise.resolve(false)
  ]);

  return {
    ffmpeg,
    ffprobe,
    fontFile: checkFontFile(),
    pdftoppm,
    pdftotext,
    tesseract,
    ocrCommand: env.OCR_COMMAND ? ocrCommand : false,
    sttCommand: env.STT_COMMAND ? sttCommand : false,
    removebgProvider: env.REMOVEBG_PROVIDER || 'none',
    ttsProvider: env.TTS_PROVIDER || 'google'
  };
}
