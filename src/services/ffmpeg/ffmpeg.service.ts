import { spawn } from 'child_process';

/**
 * Runs FFmpeg safely by spawning it as a child process with a tokenized argument array
 * to prevent shell command injection.
 */
export function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[FFmpeg Spawn] Executing: ffmpeg ${args.join(' ')}`);

    const proc = spawn('ffmpeg', args);
    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg processing failed (code ${code}). Details: ${stderr.slice(-200).trim()}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Uses ffprobe to parse the media duration (in seconds).
 * Falls back to 0 if ffprobe fails or duration cannot be parsed.
 */
export function getMediaDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    console.log(`[FFprobe Spawn] Inspecting duration of: ${filePath}`);
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ]);

    let stdout = '';
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        const parsed = parseFloat(stdout.trim());
        resolve(isNaN(parsed) ? 0 : parsed);
      } else {
        resolve(0);
      }
    });

    proc.on('error', () => {
      resolve(0);
    });
  });
}
