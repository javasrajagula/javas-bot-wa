import sharp from 'sharp';

/**
 * Generates a "Brat" style sticker (white background, black font, centered).
 */
export async function generateBratSticker(text: string): Promise<Buffer> {
  const cleanText = text.trim();
  
  // Wrap text
  const words = cleanText.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  const maxLineChars = 14;

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxLineChars) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  // Dynamic font sizing
  let fontSize = 70;
  if (lines.length > 4) {
    fontSize = 50;
  } else if (lines.length > 2) {
    fontSize = 60;
  }
  
  // If any single line is too long, shrink font size further
  const longestLine = Math.max(...lines.map(l => l.length));
  if (longestLine > 10) {
    fontSize = Math.min(fontSize, Math.floor(512 / (longestLine * 0.65)));
  }

  const lineHeight = fontSize * 1.15;
  const totalHeight = lines.length * lineHeight;
  const yStart = 256 - (totalHeight / 2) + (fontSize * 0.75);

  let svgContent = `<svg width="512" height="512">`;
  svgContent += `
    <style>
      .brat-text {
        fill: #000000;
        font-family: 'Arial Black', 'Helvetica Neue', 'Arial', sans-serif;
        font-size: ${fontSize}px;
        font-weight: 900;
        text-anchor: middle;
        letter-spacing: -2px;
      }
    </style>
  `;

  lines.forEach((line, index) => {
    const y = yStart + (index * lineHeight);
    const escapedText = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
    svgContent += `<text x="256" y="${y}" class="brat-text">${escapedText}</text>`;
  });

  svgContent += `</svg>`;

  const svgBuffer = Buffer.from(svgContent);

  // Create solid white canvas
  const whiteBackground = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
  .png()
  .toBuffer();

  // Composite text on background
  return sharp(whiteBackground)
    .composite([{ input: svgBuffer, top: 0, left: 0 }])
    .webp({ quality: 80 })
    .toBuffer();
}
