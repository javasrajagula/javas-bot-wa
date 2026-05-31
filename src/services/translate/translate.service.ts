import axios from 'axios';
import { env } from '../../config/env.js';
import { aiProviderService } from '../ai/ai-provider.service.js';
import { translateText as localTranslateText } from '../text/free-text.service.js';

/**
 * Multi-tier translation service:
 * 1. LibreTranslate (if configured)
 * 2. AI Provider (if configured)
 * 3. Local Dictionary (fallback)
 */
export async function translateText(
  text: string,
  targetLang: string,
  sourceLang?: string
): Promise<{ text: string; provider: string }> {
  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error('Teks yang ingin diterjemahkan tidak boleh kosong.');
  }

  // Tier 1: LibreTranslate
  if (env.LIBRETRANSLATE_URL) {
    try {
      const response = await axios.post(
        `${env.LIBRETRANSLATE_URL.replace(/\/$/, '')}/translate`,
        {
          q: cleanText,
          source: sourceLang || 'auto',
          target: targetLang,
          format: 'text'
        },
        { timeout: 10_000 }
      );
      if (response.data?.translatedText) {
        return { text: response.data.translatedText, provider: 'LibreTranslate' };
      }
    } catch (err: any) {
      console.error('[Translation Service] LibreTranslate failed:', err.message || err);
    }
  }

  // Tier 2: AI Provider
  const aiProvider = env.AI_PROVIDER || 'none';
  if (aiProvider !== 'none' && env.AI_API_KEY) {
    try {
      const sourceStr = sourceLang ? ` from ${sourceLang}` : '';
      const prompt = `Translate the following text to ${targetLang}${sourceStr}. Output ONLY the exact translated text without any explanation, prefix, quotes, or formatting.\n\nText: ${cleanText}`;
      const systemPrompt = 'You are a professional, accurate translator. You translate text directly and output nothing else.';
      const result = await aiProviderService.generateText(prompt, systemPrompt);
      if (result && !result.includes('Gagal menghubungi AI Provider')) {
        return { text: result, provider: `AI (${aiProvider})` };
      }
    } catch (err: any) {
      console.error('[Translation Service] AI Translation failed:', err.message || err);
    }
  }

  // Tier 3: Local dictionary fallback
  try {
    const localResult = await localTranslateText(cleanText, targetLang);
    return { text: localResult.text, provider: localResult.provider };
  } catch (err: any) {
    console.error('[Translation Service] Local fallback failed:', err.message || err);
    throw new Error('Gagal menerjemahkan teks. Silakan coba beberapa saat lagi.');
  }
}
