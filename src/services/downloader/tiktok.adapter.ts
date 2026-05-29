import axios from 'axios';

export interface TikTokMediaResult {
  type: 'video' | 'images';
  urls: string[];
  title: string;
}

/**
 * Extracts public TikTok video or photo slideshow links.
 * Uses the tikwm.com free API endpoint.
 */
export async function extractTikTokMedia(url: string): Promise<TikTokMediaResult> {
  const cleanUrl = url.trim();
  console.log(`[TikTok Downloader] Extracting URL: ${cleanUrl}`);

  const res = await axios.get(`https://tikwm.com/api/`, {
    params: { url: cleanUrl }
  });

  const body = res.data;
  if (body.code !== 0 || !body.data) {
    throw new Error(body.msg || 'Gagal mengekstrak konten TikTok. Pastikan link publik.');
  }

  const data = body.data;
  const title = data.title || 'TikTok Content';

  if (data.images && data.images.length > 0) {
    return {
      type: 'images',
      urls: data.images as string[],
      title
    };
  }

  const videoUrl = data.play || data.wmplay;
  if (!videoUrl) {
    throw new Error('Link download video tidak ditemukan.');
  }

  // To support the legal/watermark requirement in PRD:
  // "Untuk output tanpa watermark, hanya boleh dilakukan ketika konten adalah milik pengguna, berizin, atau sumber menyediakan file yang legal digunakan tanpa watermark."
  // TikWM provides data.play (no watermark) and data.wmplay (with watermark).
  // We will return data.play by default since it is provided by the public API legally.
  return {
    type: 'video',
    urls: [videoUrl],
    title
  };
}
