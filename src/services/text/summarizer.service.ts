import { env } from '../../config/env.js';
import { aiProviderService } from '../ai/ai-provider.service.js';
import { summarizeExtractive } from './free-text.service.js';

/**
 * Summarize text using AI or deterministic extractive fallback.
 * Enforces structured layouts and factual accuracy.
 */
export async function summarizeText(text: string): Promise<{ summary: string; provider: string }> {
  const cleanText = text.trim();
  if (cleanText.length < 80) {
    throw new Error('Teks terlalu pendek untuk diringkas (minimal 80 karakter).');
  }

  const aiProvider = env.AI_PROVIDER || 'none';
  if (aiProvider !== 'none' && env.AI_API_KEY) {
    try {
      const prompt = `Ringkas teks berikut dengan format yang persis seperti template di bawah ini. Jangan menambahkan fakta di luar teks (jangan berhalusinasi).

Template Output:
📝 Ringkasan:
1. [Poin ringkasan utama 1]
2. [Poin ringkasan utama 2]
3. [Poin ringkasan utama 3]

🔑 Poin penting:
• [Detail penting 1]
• [Detail penting 2]

📌 Kesimpulan:
[Satu kalimat kesimpulan akhir]

Teks untuk diringkas:
${cleanText}`;

      const systemPrompt = 'Anda adalah asisten ringkasan yang akurat dan obyektif. Tugas Anda hanya meringkas teks yang diberikan secara faktual menggunakan format template yang ditentukan.';
      const result = await aiProviderService.generateText(prompt, systemPrompt);
      
      // Make sure the response didn't trigger a fallback warning message from generateText
      if (result && !result.includes('Gagal menghubungi AI Provider')) {
        return { summary: result, provider: `AI (${aiProvider})` };
      }
    } catch (err: any) {
      console.error('[Summarizer Service] AI Summarization failed, falling back to extractive:', err.message || err);
    }
  }

  // Extractive fallback
  // Split into points using the extractive helper
  const points = summarizeExtractive(cleanText, 5).split('\n');
  
  // Format deterministic structure
  const summaryPart = points.slice(0, 3).map((p, i) => `${i + 1}. ${p.replace(/^- /, '')}`).join('\n');
  const keyPointsPart = points.slice(3).map(p => `• ${p.replace(/^- /, '')}`).join('\n');
  const conclusion = points[0] ? points[0].replace(/^- /, '') : 'Teks telah diringkas secara ekstraktif.';

  const formatted = [
    `📝 Ringkasan:`,
    summaryPart || '1. (Tidak cukup kalimat untuk membuat ringkasan rinci)',
    ``,
    `🔑 Poin penting:`,
    keyPointsPart || '• (Tidak cukup poin penting tambahan)',
    ``,
    `📌 Kesimpulan:`,
    conclusion
  ].join('\n');

  return {
    summary: formatted,
    provider: 'extractive-fallback'
  };
}
