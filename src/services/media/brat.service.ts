import sharp from 'sharp';

export interface BratOptions {
  mode?: 'grid' | 'classic';
  width?: number;
  height?: number;
  background?: string;
  textColor?: string;
  blur?: number;
}

export function escapeSvgText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function generateBratSticker(text: string, options?: BratOptions): Promise<Buffer> {
  const cleanText = text.trim().toLowerCase(); // lowercase otomatis
  const mode = options?.mode || 'grid';
  const width = options?.width || 512;
  const height = options?.height || 512;
  const background = options?.background || '#ffffff';
  const textColor = options?.textColor || '#000000';
  const blurVal = options?.blur !== undefined ? options.blur : (Math.random() * 0.8 + 0.4); // blur 0.4 - 1.2 px

  let svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
  svgContent += `
    <style>
      .brat-text {
        fill: ${textColor};
        font-family: 'Arial Black', 'Helvetica Neue', 'Arial', sans-serif;
        font-weight: 900;
        letter-spacing: -1.5px;
      }
    </style>
  `;

  if (mode === 'grid') {
    const words = cleanText.split(/\s+/);
    // Grid layout: 2 to 3 columns
    const cols = words.length > 6 ? 3 : 2;
    const rows: string[][] = [];
    for (let i = 0; i < words.length; i += cols) {
      rows.push(words.slice(i, i + cols));
    }

    const rowCount = rows.length;
    const fontSize = Math.max(32, Math.min(64, Math.floor(450 / (rowCount || 1))));
    const lineHeight = fontSize * 1.35;
    const totalHeight = rowCount * lineHeight;
    const yStart = (height - totalHeight) / 2 + fontSize * 0.8;

    rows.forEach((rowWords, rIdx) => {
      const colCountInRow = rowWords.length;
      rowWords.forEach((word, cIdx) => {
        // Space columns evenly
        const colWidth = (width - 100) / cols;
        const randomXOffset = Math.random() * 16 - 8; // random offset kecil
        const randomYOffset = Math.random() * 10 - 5;
        
        const x = 50 + cIdx * colWidth + randomXOffset;
        const y = yStart + rIdx * lineHeight + randomYOffset;

        svgContent += `<text x="${x}" y="${y}" font-size="${fontSize}px" class="brat-text">${escapeSvgText(word)}</text>`;
      });
    });
  } else {
    // Classic multiline layout
    const words = cleanText.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';
    const maxLineChars = 15;

    words.forEach(word => {
      if ((currentLine + ' ' + word).trim().length <= maxLineChars) {
        currentLine = (currentLine + ' ' + word).trim();
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });
    if (currentLine) lines.push(currentLine);

    const rowCount = lines.length;
    const fontSize = Math.max(36, Math.min(72, Math.floor(450 / (rowCount || 1))));
    const lineHeight = fontSize * 1.25;
    const totalHeight = rowCount * lineHeight;
    const yStart = (height - totalHeight) / 2 + fontSize * 0.8;

    lines.forEach((line, index) => {
      const y = yStart + index * lineHeight;
      svgContent += `<text x="50" y="${y}" font-size="${fontSize}px" class="brat-text">${escapeSvgText(line)}</text>`;
    });
  }

  svgContent += `</svg>`;

  // Create canvas background
  const bgImage = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: hexToRgb(background)
    }
  })
  .png()
  .toBuffer();

  // Overlay text and apply light blur for the low-quality/compressed look
  const sharpImg = sharp(bgImage)
    .composite([{ input: Buffer.from(svgContent), top: 0, left: 0 }])
    .blur(blurVal);

  return sharpImg
    .webp({ quality: 60 }) // low-quality / compressed look, target under 100 KB
    .toBuffer();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleanHex = hex.replace('#', '');
  const num = parseInt(cleanHex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}
