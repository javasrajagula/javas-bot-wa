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
  DATABASE_URL: z.string().min(1).default('file:./dev.db'),
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
  AI_PROVIDER: z.enum(['none', 'openai', 'local', 'custom']).default('none'),
  AI_API_BASE_URL: optionalString.default(''),
  AI_API_KEY: optionalString.default(''),
  OWNER_BYPASS_RATE_LIMIT: booleanFromString.default(true),
  PRIVATE_CHAT_BYPASS_RATE_LIMIT: booleanFromString.default(true),
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
    console.warn("[WARNING] OWNER_IDS kosong. Beberapa command administrator/owner mungkin tidak dapat diakses.");
  }

  return value;
}
