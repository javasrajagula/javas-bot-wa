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
