import axios from 'axios';
import { env } from '../../config/env.js';

const COMMON_TYPOS: Record<string, string> = {
  aq: 'aku',
  ak: 'aku',
  yg: 'yang',
  dgn: 'dengan',
  utk: 'untuk',
  gk: 'tidak',
  ga: 'tidak',
  nggak: 'tidak',
  krn: 'karena',
  bgt: 'banget',
  sm: 'sama',
  sy: 'saya',
  org: 'orang',
  dr: 'dari',
  dl: 'dulu',
  skrg: 'sekarang',
  trs: 'terus'
};

const BASIC_DICTIONARY: Record<string, Record<string, string>> = {
  en: {
    halo: 'hello',
    hai: 'hi',
    saya: 'I',
    aku: 'I',
    kamu: 'you',
    makan: 'eat',
    minum: 'drink',
    belajar: 'study',
    sekolah: 'school',
    rumah: 'home',
    terima: 'thank',
    kasih: 'you',
    pagi: 'morning',
    malam: 'night',
    baik: 'good',
    buruk: 'bad',
    dan: 'and',
    atau: 'or',
    dengan: 'with',
    untuk: 'for'
  },
  id: {
    hello: 'halo',
    hi: 'hai',
    i: 'saya',
    you: 'kamu',
    eat: 'makan',
    drink: 'minum',
    study: 'belajar',
    school: 'sekolah',
    home: 'rumah',
    morning: 'pagi',
    night: 'malam',
    good: 'baik',
    bad: 'buruk',
    and: 'dan',
    or: 'atau',
    with: 'dengan',
    for: 'untuk',
    thank: 'terima',
    thanks: 'terima kasih'
  }
};

export async function translateText(text: string, targetLang: string): Promise<{ text: string; provider: string }> {
  if (env.LIBRETRANSLATE_URL) {
    const response = await axios.post(
      `${env.LIBRETRANSLATE_URL.replace(/\/$/, '')}/translate`,
      {
        q: text,
        source: 'auto',
        target: targetLang,
        format: 'text'
      },
      { timeout: 15_000 }
    );
    return { text: response.data?.translatedText || text, provider: 'LibreTranslate' };
  }

  const dictionary = BASIC_DICTIONARY[targetLang] || {};
  const translated = text.replace(/\b[\w'-]+\b/g, word => {
    const lower = word.toLowerCase();
    const mapped = dictionary[lower];
    if (!mapped) return word;
    return /^[A-Z]/.test(word) ? mapped.charAt(0).toUpperCase() + mapped.slice(1) : mapped;
  });

  return {
    text: translated,
    provider: `dictionary-${targetLang}`
  };
}

export function summarizeExtractive(text: string, maxSentences = 4): string {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= maxSentences) return sentences.join(' ');

  const stopWords = new Set([
    'yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'dengan', 'atau', 'ini', 'itu',
    'the', 'and', 'for', 'from', 'with', 'that', 'this', 'are', 'was', 'were'
  ]);
  const freq = new Map<string, number>();

  for (const word of text.toLowerCase().match(/[a-zA-ZÀ-ÿ0-9]+/g) || []) {
    if (word.length < 3 || stopWords.has(word)) continue;
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  const scored = sentences.map((sentence, index) => {
    const words = sentence.toLowerCase().match(/[a-zA-ZÀ-ÿ0-9]+/g) || [];
    const score = words.reduce((sum, word) => sum + (freq.get(word) || 0), 0) / Math.max(1, words.length);
    return { sentence, index, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.index - b.index)
    .map(item => `- ${item.sentence}`)
    .join('\n');
}

export function rewriteText(style: string, text: string): string {
  const clean = text.trim();
  if (style === 'formal') {
    return `Dengan hormat, ${clean.replace(/\baku\b/gi, 'saya').replace(/\bkamu\b/gi, 'Anda')}`;
  }
  if (style === 'santai') {
    return clean.replace(/\bsaya\b/gi, 'aku').replace(/\bAnda\b/gi, 'kamu');
  }
  if (style === 'sopan') {
    return `Mohon izin, ${clean}. Terima kasih atas perhatiannya.`;
  }
  if (style === 'singkat') {
    const summary = summarizeExtractive(clean, 1);
    return summary.replace(/^- /, '');
  }
  return clean;
}

export function correctTypos(text: string): string {
  return text.replace(/\b[\w'-]+\b/g, word => {
    const replacement = COMMON_TYPOS[word.toLowerCase()];
    if (!replacement) return word;
    return /^[A-Z]/.test(word) ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement;
  });
}
