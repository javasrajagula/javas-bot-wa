import sharp from 'sharp';

export interface TextOverlayOptions {
  position?: 'atas' | 'tengah' | 'bawah';
}

function wrapText(text: string, maxCharsPerLine = 20): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export async function overlayTextOnImage(
  imageBuffer: Buffer,
  text: string,
  options: TextOverlayOptions = {}
): Promise<Buffer> {
  const position = options.position || 'bawah';
  const lines = wrapText(text, 18);
  const lineHeight = 45;
  const fontSize = 38;

  let yStart = 0;
  if (position === 'atas') {
    yStart = 50;
  } else if (position === 'tengah') {
    const totalHeight = lines.length * lineHeight;
    yStart = 256 - (totalHeight / 2) + (fontSize / 2) + 10;
  } else {
    // bawah
    const totalHeight = lines.length * lineHeight;
    yStart = 460 - totalHeight + fontSize;
  }

  // Build SVG containing the text lines with white fill and thick black stroke
  let svgContent = `<svg width="512" height="512">`;
  svgContent += `
    <style>
      .text-line {
        fill: #ffffff;
        stroke: #000000;
        stroke-width: 3px;
        stroke-linejoin: round;
        font-family: 'Impact', 'Arial Black', sans-serif;
        font-size: ${fontSize}px;
        font-weight: 900;
        text-anchor: middle;
      }
    </style>
  `;

  lines.forEach((line, index) => {
    const y = yStart + (index * lineHeight);
    // Escape XML entities in line text
    const escapedText = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
    
    svgContent += `<text x="256" y="${y}" class="text-line">${escapedText}</text>`;
  });

  svgContent += `</svg>`;

  const svgBuffer = Buffer.from(svgContent);

  // First resize the base image to 512x512, then composite the SVG text overlay on top
  const resizedBase = await sharp(imageBuffer)
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();

  return sharp(resizedBase)
    .composite([{ input: svgBuffer, top: 0, left: 0 }])
    .webp({ quality: 80 })
    .toBuffer();
}
