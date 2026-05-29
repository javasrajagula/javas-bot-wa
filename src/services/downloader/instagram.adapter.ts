import axios from 'axios';

export interface InstagramMediaResult {
  type: 'video' | 'image' | 'carousel';
  urls: string[];
  title: string;
}

/**
 * Extracts public Instagram post or Reel links.
 * Calls VKrDownloader and falls back to regex scraping of HTML tags.
 */
export async function extractInstagramMedia(url: string): Promise<InstagramMediaResult> {
  const cleanUrl = url.trim();
  console.log(`[Instagram Downloader] Extracting URL: ${cleanUrl}`);

  // 1. Try VKrDownloader API
  try {
    const res = await axios.get('https://vkrdownloader.org/server/', {
      params: {
        api_key: 'vkrdownloader',
        vkr: cleanUrl
      },
      timeout: 15000
    });

    const body = res.data;
    if (body && body.data) {
      const mediaList = body.data.downloads || [];
      if (mediaList.length > 0) {
        // Find video or high quality image
        const videoMedia = mediaList.find((m: any) => m.extension === 'mp4' || m.type === 'video');
        if (videoMedia && videoMedia.url) {
          return {
            type: 'video',
            urls: [videoMedia.url],
            title: body.data.title || 'Instagram Video'
          };
        }

        const imageMedia = mediaList.find((m: any) => m.extension === 'jpg' || m.extension === 'png' || m.type === 'image');
        if (imageMedia && imageMedia.url) {
          return {
            type: 'image',
            urls: [imageMedia.url],
            title: body.data.title || 'Instagram Image'
          };
        }
      }
    }
  } catch (err) {
    console.error('[Instagram Downloader] VKrDownloader failed, trying HTML fallback...', err);
  }

  // 2. Fallback to basic HTML regex scraper
  try {
    const htmlRes = await axios.get(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });
    const html = htmlRes.data;

    // Search for og:video or og:image in meta tags
    const videoMatch = html.match(/<meta[^>]*property="og:video"[^>]*content="([^"]+)"/i) ||
                       html.match(/"video_url"\s*:\s*"([^"]+)"/i);
    const imageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i) ||
                       html.match(/"display_url"\s*:\s*"([^"]+)"/i);

    if (videoMatch && videoMatch[1]) {
      const videoUrl = videoMatch[1].replace(/\\u0026/g, '&');
      return {
        type: 'video',
        urls: [videoUrl],
        title: 'Instagram Video (Scraped)'
      };
    }

    if (imageMatch && imageMatch[1]) {
      const imageUrl = imageMatch[1].replace(/\\u0026/g, '&');
      return {
        type: 'image',
        urls: [imageUrl],
        title: 'Instagram Image (Scraped)'
      };
    }
  } catch (err) {
    console.error('[Instagram Downloader] HTML fallback failed:', err);
  }

  throw new Error('Gagal mendownload media Instagram. Pastikan akun tidak privat dan link valid.');
}
