import { spawn } from 'child_process';
import { env } from '../../config/env.js';

/**
 * Runs FFmpeg safely by spawning it as a child process with a tokenized argument array
 * to prevent shell command injection.
 */
export function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[FFmpeg Spawn] Executing: ffmpeg ${args.join(' ')}`);

    const timeoutSeconds = parseInt(process.env.FFMPEG_TIMEOUT_SECONDS || '120', 10);
    const proc = spawn('ffmpeg', args);
    let stderr = '';

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`FFmpeg process timed out after ${timeoutSeconds} seconds.`));
    }, timeoutSeconds * 1000);

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg processing failed (code ${code}). Details: ${stderr.slice(-200).trim()}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Uses ffprobe to parse the media duration (in seconds).
 * Rejects with an error if ffprobe fails or duration cannot be parsed.
 * Honors FFPROBE_TIMEOUT_SECONDS env variable (default: 30 seconds).
 */
export function getMediaDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    console.log(`[FFprobe Spawn] Inspecting duration of: ${filePath}`);
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ]);

    const timeoutSeconds = env.FFPROBE_TIMEOUT_SECONDS ?? 30;
    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`ffprobe timed out after ${timeoutSeconds} seconds.`));
    }, timeoutSeconds * 1000);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        const parsed = parseFloat(stdout.trim());
        if (isNaN(parsed)) {
          reject(new Error(`Failed to parse duration from ffprobe output: "${stdout.trim()}"`));
        } else {
          resolve(parsed);
        }
      } else {
        reject(new Error(`ffprobe failed with code ${code}. Details: ${stderr.trim()}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to execute ffprobe: ${err.message}`));
    });
  });
}
