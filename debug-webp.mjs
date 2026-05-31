// Debug script: inspect WebP chunk structure before & after EXIF injection
import sharp from 'sharp';

function parseChunks(buf) {
  if (buf.slice(0, 4).toString() !== 'RIFF' || buf.slice(8, 12).toString() !== 'WEBP') {
    return { error: 'Not a valid WebP' };
  }
  const chunks = [];
  let offset = 12;
  while (offset < buf.length) {
    if (offset + 8 > buf.length) break;
    const fourCC = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const paddedSize = size % 2 === 1 ? size + 1 : size;
    if (offset + 8 + paddedSize > buf.length) {
      chunks.push({ fourCC, size, note: 'truncated' });
      break;
    }
    const data = buf.subarray(offset + 8, offset + 8 + size);
    let extra = '';
    if (fourCC === 'VP8X') {
      const flags = data.readUInt32LE(0);
      const w = (data.readUInt8(4) | (data.readUInt8(5) << 8) | (data.readUInt8(6) << 16)) + 1;
      const h = (data.readUInt8(7) | (data.readUInt8(8) << 8) | (data.readUInt8(9) << 16)) + 1;
      extra = `flags=0x${flags.toString(16).padStart(8,'0')} (ICC=${(flags>>1)&1} Alpha=${(flags>>2)&1} EXIF=${(flags>>3)&1} XMP=${(flags>>4)&1} Anim=${(flags>>5)&1}) canvas=${w}x${h}`;
    } else if (fourCC === 'VP8 ') {
      const hasStart = data[3] === 0x9D && data[4] === 0x01 && data[5] === 0x2A;
      if (hasStart) {
        const w = data.readUInt16LE(6) & 0x3FFF;
        const h = data.readUInt16LE(8) & 0x3FFF;
        extra = `start_code=OK dim=${w}x${h}`;
      } else {
        extra = `start_code MISSING (got ${data[3].toString(16)} ${data[4].toString(16)} ${data[5].toString(16)})`;
      }
    } else if (fourCC === 'VP8L') {
      extra = `sig=0x${data[0].toString(16)}`;
    } else if (fourCC === 'EXIF') {
      extra = `header="${data.slice(0,6).toString('latin1').replace(/\0/g,'\\0')}"`;
    }
    chunks.push({ fourCC, size, offset, extra });
    offset += 8 + paddedSize;
  }
  return { totalBytes: buf.length, riffSize: buf.readUInt32LE(4), chunks };
}

// ─── Create test image using Sharp (same as /stiker command) ──────────────────
console.log('=== Creating test image with Sharp ===');
const jpegInput = await sharp({
  create: { width: 300, height: 200, channels: 3, background: { r: 200, g: 100, b: 50 } }
}).jpeg().toBuffer();

const webpBefore = await sharp(jpegInput)
  .ensureAlpha()
  .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .webp()
  .toBuffer();

console.log('\n── Before EXIF injection:');
console.dir(parseChunks(webpBefore), { depth: null });

// ─── Apply EXIF injection ─────────────────────────────────────────────────────
const { injectWebpExif } = await import('./src/services/sticker/sticker-metadata.service.js');

const webpAfter = injectWebpExif(webpBefore, 'Javas Bot WA', 'bot wa javas');

console.log('\n── After EXIF injection:');
console.dir(parseChunks(webpAfter), { depth: null });

// ─── Validate with Sharp ──────────────────────────────────────────────────────
try {
  const meta = await sharp(webpAfter).metadata();
  console.log('\n✅ Sharp can read after injection:', { format: meta.format, width: meta.width, height: meta.height });
} catch (e) {
  console.log('\n❌ Sharp FAILS to read after injection:', e.message);
}

// ─── Save files for manual inspection ────────────────────────────────────────
import fs from 'fs';
fs.writeFileSync('debug-before.webp', webpBefore);
fs.writeFileSync('debug-after.webp', webpAfter);
console.log('\nFiles saved: debug-before.webp and debug-after.webp');
