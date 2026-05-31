import { env } from '../../config/env.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import fs from 'fs';
import { getTempPath, safeDelete } from '../../utils/file.util.js';

const execAsync = promisify(exec);

export async function removeBackground(imageBuffer: Buffer): Promise<Buffer> {
  const provider = env.REMOVEBG_PROVIDER || 'none';

  if (provider === 'none') {
    throw new Error('Remove background belum dikonfigurasi. Set REMOVEBG_PROVIDER dan REMOVEBG_API_KEY atau REMOVEBG_COMMAND.');
  }

  if (provider === 'api') {
    if (!env.REMOVEBG_API_KEY) {
      throw new Error('API Key untuk removebg belum dikonfigurasi. Harap atur REMOVEBG_API_KEY.');
    }

    const response = await axios.post(
      'https://api.remove.bg/v1.5/removebg',
      {
        image_file_b64: imageBuffer.toString('base64'),
        size: 'auto'
      },
      {
        headers: {
          'X-Api-Key': env.REMOVEBG_API_KEY,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer',
        timeout: 30000
      }
    );
    return Buffer.from(response.data);
  }

  if (provider === 'local') {
    const cmd = env.REMOVEBG_COMMAND || 'rembg i';
    const tempIn = getTempPath('png');
    const tempOut = getTempPath('png');
    await fs.promises.writeFile(tempIn, imageBuffer);

    try {
      await execAsync(`${cmd} "${tempIn}" "${tempOut}"`);
      if (!fs.existsSync(tempOut)) {
        throw new Error('Gagal menghasilkan output dari local removebg command.');
      }
      return await fs.promises.readFile(tempOut);
    } finally {
      safeDelete(tempIn);
      safeDelete(tempOut);
    }
  }

  throw new Error(`Provider removebg tidak dikenal: ${provider}`);
}
