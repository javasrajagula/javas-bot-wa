import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import JSZip from 'jszip';
import { correctTypos, summarizeExtractive, translateText } from '../services/text/free-text.service.js';
import { imageToPdf, inspectZip } from '../services/document/document-tools.service.js';
import { parseFeatureFlags } from '../config/feature-flags.js';

describe('Epic 14-17 implementation checks', () => {
  it('summarizes and corrects text without paid AI', async () => {
    const text = 'Javas Bot membantu grup. Bot memiliki fitur moderasi. Fitur moderasi menjaga grup tetap aman. Admin dapat memakai dashboard.';
    expect(summarizeExtractive(text, 2)).toContain('moderasi');
    expect(correctTypos('aq belajar dgn bot yg baik')).toBe('aku belajar dengan bot yang baik');

    const translated = await translateText('halo saya belajar', 'en');
    expect(translated.text.toLowerCase()).toContain('hello');
  });

  it('creates a valid PDF buffer from an image', async () => {
    const image = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: '#ffffff'
      }
    }).png().toBuffer();

    const pdf = await imageToPdf(image);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('rejects unsafe files inside zip listings', async () => {
    const zip = new JSZip();
    zip.file('safe/readme.txt', 'ok');
    zip.file('../escape.txt', 'bad');
    zip.file('run.exe', 'bad');
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    const entries = await inspectZip(buffer);
    expect(entries.find(entry => entry.name === 'safe/readme.txt')?.safe).toBe(true);
    expect(entries.find(entry => entry.name === '../escape.txt')?.safe).toBe(false);
    expect(entries.find(entry => entry.name === 'run.exe')?.safe).toBe(false);
  });

  it('keeps setup preset flags mergeable with defaults', () => {
    const flags = parseFeatureFlags(JSON.stringify({ antispam: true, modsmart: true }));
    expect(flags.antispam).toBe(true);
    expect(flags.modsmart).toBe(true);
    expect(flags.welcome).toBe(false);
  });
});
