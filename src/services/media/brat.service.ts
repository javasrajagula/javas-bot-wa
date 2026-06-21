import sharp from 'sharp';

export interface BratOptions {
  mode?: 'brat' | 'classic';
  background?: string;
  textColor?: string;
}

export function escapeSvgText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Brat generator — 100% mirip bratgenerator.com
 *
 * Spesifikasi asli:
 *  - Background: putih (#ffffff)
 *  - Teks: hitam (#000000), bold, lowercase
 *  - Font: Arial Narrow (condensed sans-serif)
 *  - Word-wrap: otomatis sesuai lebar kanvas
 *  - Blur: feGaussianBlur di teks (bukan di seluruh gambar)
 *  - Letter-spacing: sangat rapat
 *  - Align: kiri
 *  - Ukuran kanvas: 512x512
 */
export async function generateBratSticker(text: string, options?: BratOptions): Promise<Buffer> {
  const bg      = options?.background  ?? '#ffffff';
  const fg      = options?.textColor   ?? '#000000';
  const mode    = options?.mode        ?? 'brat';

  // Force lowercase — signature brat aesthetic
  const cleanText = text.trim().toLowerCase();

  const CANVAS   = 512;
  const MARGIN   = 32;          // px margin kiri & kanan
  const MAX_W    = CANVAS - MARGIN * 2;  // lebar area teks: 448px

  // ── Font metrics estimation ────────────────────────────────────────────────
  // Arial Narrow ~0.48 * fontSize per karakter (condensed)
  // Kita hitung wrap secara manual
  const CHAR_RATIO = 0.5; // lebar rata-rata per karakter relatif terhadap fontSize

  function estimateLineWidth(str: string, fz: number): number {
    return str.length * CHAR_RATIO * fz;
  }

  // ── Auto word-wrap ─────────────────────────────────────────────────────────
  function wrapText(words: string[], fontSize: number): string[] {
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (estimateLineWidth(candidate, fontSize) <= MAX_W) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  // ── Pick font size that fills canvas nicely ────────────────────────────────
  const words = cleanText.split(/\s+/).filter(Boolean);

  let fontSize  = 80;
  let lines: string[] = [];

  // Reduce font size until the layout fits vertically
  for (let fz = 80; fz >= 28; fz -= 2) {
    const wrapped = wrapText(words, fz);
    const lineH   = fz * 1.25;
    const totalH  = wrapped.length * lineH;
    if (totalH <= CANVAS - MARGIN * 2) {
      fontSize = fz;
      lines    = wrapped;
      break;
    }
    lines = wrapped; // use last even if tall
  }

  const lineHeight = fontSize * 1.25;
  const totalTextH = lines.length * lineHeight;
  const yStart     = (CANVAS - totalTextH) / 2 + fontSize * 0.85; // vertically centred

  // ── SVG blur filter (feGaussianBlur on text only) ─────────────────────────
  // stdDeviation=1.8 matches the characteristic brat blur
  const blurStd = mode === 'brat' ? 1.8 : 1.2;

  // ── Build SVG ──────────────────────────────────────────────────────────────
  // We use a <g filter="url(#b)"> wrapper around all text so blur is on text only
  const textElements = lines.map((line, i) => {
    const y = yStart + i * lineHeight;
    return `<text
      x="${MARGIN}"
      y="${y.toFixed(1)}"
      font-family="'Arial Narrow', 'Arial', sans-serif"
      font-size="${fontSize}"
      font-weight="bold"
      font-stretch="condensed"
      fill="${fg}"
      letter-spacing="-${(fontSize * 0.02).toFixed(1)}"
      text-rendering="geometricPrecision"
    >${escapeSvgText(line)}</text>`;
  }).join('\n');

  const svg = `<svg
    width="${CANVAS}"
    height="${CANVAS}"
    viewBox="0 0 ${CANVAS} ${CANVAS}"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <filter id="b" x="-5%" y="-5%" width="110%" height="110%">
        <feGaussianBlur stdDeviation="${blurStd}" />
      </filter>
    </defs>

    <!-- Background -->
    <rect width="${CANVAS}" height="${CANVAS}" fill="${bg}" />

    <!-- Blurred text group -->
    <g filter="url(#b)">
      ${textElements}
    </g>
  </svg>`;

  // ── Render via sharp ───────────────────────────────────────────────────────
  // sharp renders SVG at native resolution, output as WebP < 1 MB
  const webpBuffer = await sharp(Buffer.from(svg))
    .resize(CANVAS, CANVAS, { fit: 'fill' })
    .webp({ quality: 80 })
    .toBuffer();

  return webpBuffer;
}
