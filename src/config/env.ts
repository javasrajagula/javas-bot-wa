import dotenv from 'dotenv';

dotenv.config();

export const env = {
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
  BOT_PREFIX: process.env.BOT_PREFIX || '/',
  ADAPTER_MODE: (process.env.ADAPTER_MODE || 'console') as 'console' | 'baileys',
  WA_SESSION_NAME: process.env.WA_SESSION_NAME || 'wa-session',
  USE_REDIS: process.env.USE_REDIS === 'true',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN || '',
  TIKTOK_COOKIES: process.env.TIKTOK_COOKIES || '',
  INSTAGRAM_COOKIES: process.env.INSTAGRAM_COOKIES || '',
  OWNER_IDS: process.env.OWNER_IDS || '',
  OWNER_DASHBOARD_PASSWORD: process.env.OWNER_DASHBOARD_PASSWORD || process.env.OWNER_PASSWORD || '',
  DASHBOARD_ENABLED: process.env.DASHBOARD_ENABLED === 'true',
  DASHBOARD_PORT: Number(process.env.DASHBOARD_PORT || 8787),
  BACKUP_RETENTION_DAYS: Number(process.env.BACKUP_RETENTION_DAYS || 14),
  AUTO_BACKUP_ENABLED: process.env.AUTO_BACKUP_ENABLED !== 'false',
  LIBRETRANSLATE_URL: process.env.LIBRETRANSLATE_URL || '',
  OCR_COMMAND: process.env.OCR_COMMAND || 'tesseract',
  STT_COMMAND: process.env.STT_COMMAND || '',
};
