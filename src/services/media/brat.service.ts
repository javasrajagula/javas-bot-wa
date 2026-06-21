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

  let svgContent = '';

  if (mode === 'grid') {
    let rows: string[][] = [];
    let cols = 3;

    if (cleanText.includes('\n')) {
      const lines = cleanText.split('\n').map(line => line.trim()).filter(Boolean);
      // Find the max number of words in any line (up to 3)
      let maxCols = 2;
      const lineWordLists = lines.map(line => {
        const words = line.split(/\s+/).filter(Boolean);
        if (words.length > maxCols) {
          maxCols = Math.min(3, words.length);
        }
        return words;
      });
      cols = maxCols;

      // Distribute words in columns based on maximum cols count
      rows = lineWordLists.map(words => {
        const row = new Array(cols).fill('');
        if (words.length === 1) {
          row[0] = words[0];
        } else if (words.length === 2 && cols === 3) {
          row[0] = words[0];
          row[2] = words[1]; // Align second word to the last column for gaps
        } else {
          for (let i = 0; i < Math.min(cols, words.length); i++) {
            row[i] = words[i];
          }
        }
        return row;
      });
    } else {
      // Normal auto-wrapping fallback for single line text
      const words = cleanText.split(/\s+/).filter(Boolean);
      cols = words.length > 6 ? 3 : 2;
      for (let i = 0; i < words.length; i += cols) {
        rows.push(words.slice(i, i + cols));
      }
    }

    const rowCount = rows.length;
    const fontSize = Math.max(36, Math.min(80, Math.floor(390 / (rowCount || 1))));
    const lineHeight = fontSize * 1.3;
    const totalHeight = rowCount * lineHeight;
    const yStart = (height - totalHeight) / 2 + fontSize * 0.85;

    svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
    svgContent += `
      <style>
        .brat-text {
          fill: ${textColor};
          font-family: Arial, Helvetica, sans-serif;
          font-weight: normal;
          letter-spacing: -0.5px;
        }
      </style>
    `;

    // Horizontal scale factor of 0.72 to stretch/condense characters vertically
    const horizontalScale = 0.72;
    svgContent += `<g transform="scale(${horizontalScale}, 1.0)">`;

    rows.forEach((rowWords, rIdx) => {
      rowWords.forEach((word, cIdx) => {
        if (!word) return;
        
        let targetX = 50;
        if (cols === 3) {
          if (cIdx === 0) targetX = 45;
          else if (cIdx === 1) targetX = 195;
          else targetX = 345;
        } else {
          if (cIdx === 0) targetX = 50;
          else targetX = 275;
        }

        // Add a tiny random offset for organic compressed look
        const randomXOffset = Math.random() * 8 - 4;
        const randomYOffset = Math.random() * 6 - 3;

        const x = (targetX + randomXOffset) / horizontalScale;
        const y = yStart + rIdx * lineHeight + randomYOffset;

        svgContent += `<text x="${x}" y="${y}" font-size="${fontSize}px" class="brat-text">${escapeSvgText(word)}</text>`;
      });
    });

    svgContent += `</g></svg>`;
  } else {
    // Classic multiline layout
    const words = cleanText.split(/\s+/).filter(Boolean);
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
    const fontSize = Math.max(36, Math.min(80, Math.floor(400 / (rowCount || 1))));
    const lineHeight = fontSize * 1.25;
    const totalHeight = rowCount * lineHeight;
    const yStart = (height - totalHeight) / 2 + fontSize * 0.8;

    svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
    svgContent += `
      <style>
        .brat-text {
          fill: ${textColor};
          font-family: Arial, Helvetica, sans-serif;
          font-weight: normal;
          letter-spacing: -0.5px;
        }
      </style>
    `;

    const horizontalScale = 0.72;
    svgContent += `<g transform="scale(${horizontalScale}, 1.0)">`;

    lines.forEach((line, index) => {
      const x = 50 / horizontalScale;
      const y = yStart + index * lineHeight;
      svgContent += `<text x="${x}" y="${y}" font-size="${fontSize}px" class="brat-text">${escapeSvgText(line)}</text>`;
    });

    svgContent += `</g></svg>`;
  }

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
