import { jidDecode } from '@whiskeysockets/baileys';

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
  
  const exifHeader = Buffer.from('Exif\0\0', 'binary');
  const tiffHeader = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00]); // II*\0\x08\0\0\0
  const dirCount = Buffer.from([0x01, 0x00]);
  
  const entry = Buffer.alloc(12);
  entry.writeUInt16LE(0x5760, 0); // Tag 0x5760
  entry.writeUInt16LE(2, 2);      // Type ASCII (2)
  entry.writeUInt32LE(jsonBuffer.length, 4); // Count
  entry.writeUInt32LE(26, 8);     // Offset (26)
  
  const nextIfdOffset = Buffer.from([0x00, 0x00, 0x00, 0x00]);
  
  return Buffer.concat([
    exifHeader,
    tiffHeader,
    dirCount,
    entry,
    nextIfdOffset,
    jsonBuffer
  ]);
}

/**
 * Injects EXIF chunk containing sticker pack metadata into a WebP buffer.
 */
export function injectWebpExif(webpBuffer: Buffer, packname: string, author: string): Buffer {
  const exifBuffer = createExif(packname, author);
  
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
    const data = webpBuffer.subarray(offset + 8, offset + 8 + size);
    
    if (fourCC === 'VP8X') vp8xChunkIndex = chunks.length;
    if (fourCC === 'EXIF') exifChunkIndex = chunks.length;
    
    chunks.push({ fourCC, size, data: Buffer.from(data) });
    offset += 8 + paddedSize;
  }
  
  const newExifChunk = {
    fourCC: 'EXIF',
    size: exifBuffer.length,
    data: exifBuffer
  };
  
  if (exifChunkIndex !== -1) {
    chunks[exifChunkIndex] = newExifChunk;
  } else {
    if (vp8xChunkIndex === -1) {
      chunks.push(newExifChunk);
    } else {
      const vp8xData = Buffer.from(chunks[vp8xChunkIndex].data);
      vp8xData[0] = vp8xData[0] | 0x08; // set EXIF flag
      chunks[vp8xChunkIndex].data = vp8xData;
      chunks.push(newExifChunk);
    }
  }
  
  let bodySize = 4; // for 'WEBP'
  for (const chunk of chunks) {
    const paddedSize = chunk.size % 2 === 1 ? chunk.size + 1 : chunk.size;
    bodySize += 8 + paddedSize;
  }
  
  const outputBuffer = Buffer.alloc(8 + bodySize);
  outputBuffer.write('RIFF', 0);
  outputBuffer.writeUInt32LE(bodySize, 4);
  outputBuffer.write('WEBP', 8);
  
  let writeOffset = 12;
  for (const chunk of chunks) {
    outputBuffer.write(chunk.fourCC, writeOffset);
    outputBuffer.writeUInt32LE(chunk.size, writeOffset + 4);
    chunk.data.copy(outputBuffer, writeOffset + 8);
    writeOffset += 8 + chunk.size;
    if (chunk.size % 2 === 1) {
      outputBuffer[writeOffset] = 0; // padding byte
      writeOffset += 1;
    }
  }
  
  return outputBuffer;
}
