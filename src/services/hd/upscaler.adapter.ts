import sharp from 'sharp';
import { env } from '../../config/env.js';
import axios from 'axios';

export async function localUpscale(imageBuffer: Buffer, scale: 2 | 4 = 2): Promise<Buffer> {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const width = metadata.width || 512;
  const height = metadata.height || 512;

  if (width > 4096 || height > 4096) {
    throw new Error('Dimensi gambar terlalu besar (maksimal 4096x4096px).');
  }

  const targetWidth = width * scale;
  const targetHeight = height * scale;

  return image
    .resize(targetWidth, targetHeight, {
      kernel: 'lanczos3'
    })
    .sharpen(1.2, 1.0, 1.5)
    .jpeg({ quality: 90 })
    .toBuffer();
}

/**
 * Uploads buffer to tmpfiles.org and returns a direct download URL
 */
async function uploadToTempStorage(buffer: Buffer): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: 'image/png' });
  formData.append('file', blob, 'image.png');

  const response = await fetch('https://tmpfiles.org/api/v1/upload', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Failed to upload to temp storage: ${response.statusText}`);
  }

  const json: any = await response.json();
  const uploadUrl = json.data.url;
  // Convert view URL (https://tmpfiles.org/123/img.png) to download URL (https://tmpfiles.org/dl/123/img.png)
  return uploadUrl.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');
}

export async function replicateUpscale(imageBuffer: Buffer, scale: 2 | 4 = 2): Promise<Buffer> {
  if (!env.REPLICATE_API_TOKEN) {
    throw new Error('Replicate API token is not configured');
  }

  console.log('[Replicate Upscale] Uploading file to temporary hosting...');
  const fileUrl = await uploadToTempStorage(imageBuffer);
  console.log(`[Replicate Upscale] Uploaded to: ${fileUrl}. Calling Replicate prediction...`);

  // Using Real-ESRGAN model
  const modelVersion = '2a229a34c85d54d43f2070dbce6ca1fa8222b6a0fe3871d3a54b3df5e9e03079';
  
  const predictResponse = await axios.post(
    'https://api.replicate.com/v1/predictions',
    {
      version: modelVersion,
      input: {
        image: fileUrl,
        scale: scale,
        face_enhance: false
      }
    },
    {
      headers: {
        Authorization: `Token ${env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );

  let prediction = predictResponse.data;
  const predictionId = prediction.id;

  console.log(`[Replicate Upscale] Prediction started with ID: ${predictionId}. Polling...`);

  // Poll for result up to 60 seconds
  const start = Date.now();
  while (Date.now() - start < 60000) {
    const statusResponse = await axios.get(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      {
        headers: {
          Authorization: `Token ${env.REPLICATE_API_TOKEN}`
        }
      }
    );

    prediction = statusResponse.data;
    if (prediction.status === 'succeeded') {
      const outputUrl = prediction.output;
      console.log(`[Replicate Upscale] Succeeded: ${outputUrl}`);
      // Download output image
      const outputBufferResponse = await axios.get(outputUrl, { responseType: 'arraybuffer' });
      return Buffer.from(outputBufferResponse.data);
    } else if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(`Replicate prediction failed or canceled: ${prediction.error}`);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('Replicate upscaling timed out after 60 seconds');
}
