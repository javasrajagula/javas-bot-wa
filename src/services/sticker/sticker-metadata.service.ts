/**
 * Creates EXIF metadata buffer for WhatsApp stickers.
 */
export function createExif(packname: string, author: string): Buffer {
  const json = {
    'sticker-pack-id': 'com.javas.bot',
    'sticker-pack-name': packname,
    'sticker-pack-publisher': author,
    'emojis': ['🌸']
  };
  const jsonStr = JSON.stringify(json);
  const jsonBuffer = Buffer.from(jsonStr, 'utf-8');
  
  const tiffHeader = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00]); // II*\0\x08\0\0\0
  const dirCount = Buffer.from([0x01, 0x00]);
  
  const entry = Buffer.alloc(12);
  entry.writeUInt16LE(0x5760, 0); // Tag 0x5760
  entry.writeUInt16LE(2, 2);      // Type ASCII (2)
  entry.writeUInt32LE(jsonBuffer.length, 4); // Count
  entry.writeUInt32LE(26, 8);     // Offset (26)
  
  const nextIfdOffset = Buffer.from([0x00, 0x00, 0x00, 0x00]);
  
  return Buffer.concat([
    tiffHeader,
    dirCount,
    entry,
    nextIfdOffset,
    jsonBuffer
  ]);
}

/**
 * Reads width/height from a raw VP8 lossy bitstream chunk data.
 * Returns null if the signature is not recognised.
 */
function readVP8Dimensions(data: Buffer): { width: number; height: number } | null {
  // VP8 frame starts with 3-byte frame tag; bytes 3-5 are the start code 0x9D 0x01 0x2A
  if (data.length < 10) return null;
  if (data[3] !== 0x9D || data[4] !== 0x01 || data[5] !== 0x2A) return null;
  const width = (data.readUInt16LE(6) & 0x3FFF);
  const height = (data.readUInt16LE(8) & 0x3FFF);
  return { width, height };
}

/**
 * Reads width/height from a VP8L lossless bitstream chunk data.
 * Returns null if the signature byte is not recognised.
 */
function readVP8LDimensions(data: Buffer): { width: number; height: number } | null {
  // VP8L starts with signature byte 0x2F, then 28 bits packed:
  // bits 0-13 = canvas_width - 1, bits 14-27 = canvas_height - 1
  if (data.length < 5) return null;
  if (data[0] !== 0x2F) return null;
  const bits = data.readUInt32LE(1);
  const width = (bits & 0x3FFF) + 1;
  const height = ((bits >> 14) & 0x3FFF) + 1;
  return { width, height };
}

/**
 * Builds a 10-byte VP8X chunk data block.
 * Flag bit 3 (0x08) = EXIF metadata present.
 */
function buildVP8XData(width: number, height: number, flags = 0x08): Buffer {
  const buf = Buffer.alloc(10);
  buf.writeUInt8(flags, 0);          // flags
  buf.writeUInt8(0, 1);              // reserved
  buf.writeUInt8(0, 2);              // reserved
  buf.writeUInt8(0, 3);              // reserved
  // canvas width minus 1 as 24-bit LE
  buf.writeUInt8((width - 1) & 0xFF, 4);
  buf.writeUInt8(((width - 1) >> 8) & 0xFF, 5);
  buf.writeUInt8(((width - 1) >> 16) & 0xFF, 6);
  // canvas height minus 1 as 24-bit LE
  buf.writeUInt8((height - 1) & 0xFF, 7);
  buf.writeUInt8(((height - 1) >> 8) & 0xFF, 8);
  buf.writeUInt8(((height - 1) >> 16) & 0xFF, 9);
  return buf;
}

/**
 * Serialises an array of WebP chunks back into a RIFF/WEBP container.
 */
function serializeChunks(chunks: { fourCC: string; size: number; data: Buffer }[]): Buffer {
  let bodySize = 4; // 'WEBP' tag
  for (const chunk of chunks) {
    const paddedSize = chunk.size % 2 === 1 ? chunk.size + 1 : chunk.size;
    bodySize += 8 + paddedSize;
  }

  const out = Buffer.alloc(8 + bodySize);
  out.write('RIFF', 0);
  out.writeUInt32LE(bodySize, 4);
  out.write('WEBP', 8);

  let pos = 12;
  for (const chunk of chunks) {
    out.write(chunk.fourCC, pos);
    out.writeUInt32LE(chunk.size, pos + 4);
    chunk.data.copy(out, pos + 8);
    pos += 8 + chunk.size;
    if (chunk.size % 2 === 1) {
      out[pos] = 0;
      pos += 1;
    }
  }
  return out;
}

/**
 * Injects EXIF chunk containing sticker pack metadata into a WebP buffer.
 *
 * Correctly handles all three WebP container layouts:
 *  - Simple VP8  (no VP8X) — synthesises a VP8X chunk
 *  - Simple VP8L (no VP8X) — synthesises a VP8X chunk
 *  - Extended VP8X         — sets the EXIF flag and replaces/appends EXIF chunk
 */
export function injectWebpExif(webpBuffer: Buffer, packname: string, author: string): Buffer {
  const exifBuffer = createExif(packname, author);

  // Parse all RIFF chunks starting after 'RIFF????WEBP' (offset 12)
  let offset = 12;
  const chunks: { fourCC: string; size: number; data: Buffer }[] = [];
  let vp8xChunkIndex = -1;
  let exifChunkIndex = -1;

  while (offset < webpBuffer.length) {
    if (offset + 8 > webpBuffer.length) break;
    const fourCC = webpBuffer.toString('ascii', offset, offset + 4);
    const size = webpBuffer.readUInt32LE(offset + 4);
    const paddedSize = size % 2 === 1 ? size + 1 : size;
    if (offset + 8 + paddedSize > webpBuffer.length) break;
    const data = Buffer.from(webpBuffer.subarray(offset + 8, offset + 8 + size));

    if (fourCC === 'VP8X') vp8xChunkIndex = chunks.length;
    if (fourCC === 'EXIF') exifChunkIndex = chunks.length;

    chunks.push({ fourCC, size, data });
    offset += 8 + paddedSize;
  }

  const newExifChunk = { fourCC: 'EXIF', size: exifBuffer.length, data: exifBuffer };

  if (vp8xChunkIndex !== -1) {
    // Extended WebP – set EXIF flag in VP8X data
    const vp8xData = Buffer.from(chunks[vp8xChunkIndex].data);
    vp8xData[0] = vp8xData[0] | 0x08;
    chunks[vp8xChunkIndex] = { fourCC: 'VP8X', size: vp8xData.length, data: vp8xData };

    // Replace existing EXIF or insert right after VP8X (index vp8xChunkIndex + 1)
    if (exifChunkIndex !== -1) {
      chunks[exifChunkIndex] = newExifChunk;
    } else {
      chunks.splice(vp8xChunkIndex + 1, 0, newExifChunk);
    }
    return serializeChunks(chunks);
  }

  // Simple WebP (VP8 or VP8L) — we must synthesise a VP8X chunk.
  // Determine image dimensions from the image bitstream chunk.
  let dims: { width: number; height: number } | null = null;
  for (const chunk of chunks) {
    if (chunk.fourCC === 'VP8 ') dims = readVP8Dimensions(chunk.data);
    else if (chunk.fourCC === 'VP8L') dims = readVP8LDimensions(chunk.data);
    if (dims) break;
  }

  if (!dims) {
    // Fallback: return buffer unmodified to avoid producing a corrupt file
    console.warn('[StickerMetadata] Could not parse WebP dimensions; skipping EXIF injection.');
    return webpBuffer;
  }

  const vp8xData = buildVP8XData(dims.width, dims.height, 0x08);
  const vp8xChunk = { fourCC: 'VP8X', size: vp8xData.length, data: vp8xData };

  // VP8X must be the very first chunk, followed immediately by EXIF, then the rest
  const reordered = [vp8xChunk, newExifChunk, ...chunks];
  return serializeChunks(reordered);
}
