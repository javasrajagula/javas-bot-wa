import { z } from 'zod';

const booleanFromString = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}, z.boolean());

const optionalString = z.preprocess((value) => value ?? '', z.string());

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['silent', 'error', 'warn', 'info', 'debug']).default('info'),
  DATABASE_URL: z.string().min(1).default('file:./data/dev.db'),
  DATABASE_PROVIDER: z.enum(['sqlite', 'postgresql', 'mysql']).default('sqlite'),
  BOT_PREFIX: z.string().min(1).max(4).default('/'),
  ADAPTER_MODE: z.enum(['console', 'baileys']).default('console'),
  WA_SESSION_NAME: z.string().min(1).default('wa-session'),
  USE_REDIS: booleanFromString.default(false),
  REDIS_ENABLED: booleanFromString.default(false),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  REPLICATE_API_TOKEN: optionalString.default(''),
  TIKTOK_COOKIES: optionalString.default(''),
  INSTAGRAM_COOKIES: optionalString.default(''),
  OWNER_IDS: optionalString.default(''),
  OWNER_DASHBOARD_PASSWORD: optionalString.default(''),
  OWNER_PASSWORD: optionalString.default(''),
  DASHBOARD_ENABLED: booleanFromString.default(false),
  DASHBOARD_HOST: z.string().min(1).default('127.0.0.1'),
  DASHBOARD_PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  DASHBOARD_API_ENABLED: booleanFromString.default(false),
  DASHBOARD_API_KEY: optionalString.default(''),
  PUBLIC_BASE_URL: optionalString.default(''),
  BACKUP_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(14),
  AUTO_BACKUP_ENABLED: booleanFromString.default(true),
  LIBRETRANSLATE_URL: optionalString.default(''),
  OCR_COMMAND: z.string().default('tesseract'),
  STT_COMMAND: optionalString.default(''),
  STT_LANGUAGE: optionalString.default(''),    // e.g. 'id' for Indonesian, '' = auto-detect
  GROQ_API_KEY: optionalString.default(''),    // Groq API key for cloud Whisper (free tier)
  AI_PROVIDER: z.enum(['none', 'openai', 'local', 'custom']).default('none'),
  AI_API_BASE_URL: optionalString.default(''),
  AI_API_KEY: optionalString.default(''),
  OWNER_BYPASS_RATE_LIMIT: booleanFromString.default(true),
  PRIVATE_CHAT_BYPASS_RATE_LIMIT: booleanFromString.default(true),
  TRUST_PROXY: booleanFromString.default(false),
  FFPROBE_TIMEOUT_SECONDS: z.coerce.number().int().min(1).max(120).default(30),
  DOWNLOAD_TIMEOUT_SECONDS: z.coerce.number().int().min(5).max(300).default(30),
  DOWNLOAD_MAX_BYTES: z.coerce.number().int().min(1048576).max(524288000).default(104857600), // default 100MB
  DOWNLOAD_TRUSTED_HOSTS: optionalString.default(''), // comma-separated list
  REMOVEBG_PROVIDER: z.enum(['none', 'api', 'local']).default('none'),
  REMOVEBG_API_KEY: optionalString.default(''),
  REMOVEBG_COMMAND: optionalString.default(''),
  STICKER_PACK_NAME: z.string().default('Javas Bot WA'),
  STICKER_AUTHOR_NAME: z.string().default('bot wa javas'),
  FONT_FILE_PATH: optionalString.default(''),
  STT_TIMEOUT_SECONDS: z.coerce.number().int().default(120),
  OCR_TIMEOUT_SECONDS: z.coerce.number().int().default(60),
  TESSERACT_CMD: z.string().default('tesseract'),
  TTS_PROVIDER: z.string().default('google'),
  PRIVATE_DAILY_CMD_LIMIT: z.string().default('20'),
  PREMIUM_PRIVATE_DAILY_CMD_LIMIT: z.string().default('200'),
  PREMIUM_PAYMENT_METHOD: z.string().default('GoPay'),
  PREMIUM_PAYMENT_NUMBER: z.string().default('085338123425'),
  TTS_COMMAND: optionalString.default(''),
  TTS_API_BASE_URL: optionalString.default(''),
  TTS_API_KEY: optionalString.default(''),
}).passthrough();

export type Env = z.infer<typeof envSchema> & {
  OWNER_DASHBOARD_PASSWORD: string;
  USE_REDIS: boolean;
};

export function parseEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Konfigurasi environment tidak valid: ${issues}`);
  }

  const value = parsed.data as Env;
  value.OWNER_DASHBOARD_PASSWORD = value.OWNER_DASHBOARD_PASSWORD || value.OWNER_PASSWORD || '';
  value.USE_REDIS = value.USE_REDIS || value.REDIS_ENABLED;

  if (value.DASHBOARD_ENABLED && !value.OWNER_DASHBOARD_PASSWORD) {
    throw new Error("Konfigurasi environment tidak valid: OWNER_DASHBOARD_PASSWORD wajib diisi saat DASHBOARD_ENABLED bernilai true.");
  }

  if (!value.OWNER_IDS || value.OWNER_IDS.trim() === '') {
    if (value.NODE_ENV === 'production') {
      throw new Error("Konfigurasi environment tidak valid: OWNER_IDS wajib diisi di production.");
    }
    console.warn("[WARNING] OWNER_IDS kosong. Beberapa command administrator/owner mungkin tidak dapat diakses.");
  }

  return value;
}
