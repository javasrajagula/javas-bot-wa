export function validateFileSize(buffer: Buffer, maxSize: number): void {
  if (buffer.length > maxSize) {
    const sizeMb = (buffer.length / (1024 * 1024)).toFixed(2);
    const maxMb = (maxSize / (1024 * 1024)).toFixed(2);
    throw new Error(`Ukuran file terlalu besar (${sizeMb} MB). Batas maksimal adalah ${maxMb} MB.`);
  }
}

export function validateDuration(durationSeconds: number, maxSeconds: number): void {
  if (durationSeconds > maxSeconds) {
    throw new Error(`Durasi media terlalu panjang (${durationSeconds} detik). Batas maksimal adalah ${maxSeconds} detik.`);
  }
}

export function validateMimeType(mimeType: string, allowedTypes: string[]): void {
  const isAllowed = allowedTypes.some(type => {
    if (type.endsWith('/*')) {
      const prefix = type.split('/')[0];
      return mimeType.startsWith(prefix + '/');
    }
    return mimeType === type;
  });

  if (!isAllowed) {
    throw new Error(`Tipe media "${mimeType}" tidak didukung. Tipe yang didukung: ${allowedTypes.join(', ')}.`);
  }
}

export function validateImageMedia(buffer: Buffer, mimeType: string, maxSize = 15 * 1024 * 1024): void {
  validateMimeType(mimeType, ['image/jpeg', 'image/png', 'image/webp']);
  validateFileSize(buffer, maxSize);
}

export function validateVideoMedia(buffer: Buffer, mimeType: string, maxSize = 50 * 1024 * 1024): void {
  validateMimeType(mimeType, ['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/3gpp', 'image/gif']);
  validateFileSize(buffer, maxSize);
}

export function validateAudioMedia(buffer: Buffer, mimeType: string, maxSize = 20 * 1024 * 1024): void {
  validateMimeType(mimeType, ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/mp4', 'audio/amr']);
  validateFileSize(buffer, maxSize);
}

export function validateDocumentMedia(buffer: Buffer, mimeType: string, maxSize = 100 * 1024 * 1024): void {
  validateFileSize(buffer, maxSize);
}
