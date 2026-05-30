import prisma from '../db/client.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import { createErrorId, rememberError } from './error-id.util.js';
import { redactSensitive, redactText } from './mask.util.js';
import { env } from '../config/env.js';

export enum LogLevel {
  SILENT = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
}

const LEVEL_VALUES: Record<string, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

function shouldLog(level: string): boolean {
  const configured = env.LOG_LEVEL || 'info';
  const configuredVal = LEVEL_VALUES[configured] ?? 3;
  const targetVal = LEVEL_VALUES[level] ?? 3;
  return configuredVal >= targetVal;
}

export function logInfo(message: string, ...args: any[]): void {
  if (shouldLog('info')) {
    const safeArgs = args.map(arg => typeof arg === 'string' ? redactText(arg) : redactSensitive(arg));
    console.log(`[Info] ${redactText(message)}`, ...safeArgs);
  }
}

export function logDebug(message: string, ...args: any[]): void {
  if (shouldLog('debug')) {
    const safeArgs = args.map(arg => typeof arg === 'string' ? redactText(arg) : redactSensitive(arg));
    console.debug(`[Debug] ${redactText(message)}`, ...safeArgs);
  }
}

export function logWarn(message: string, ...args: any[]): void {
  if (shouldLog('warn')) {
    const safeArgs = args.map(arg => typeof arg === 'string' ? redactText(arg) : redactSensitive(arg));
    console.warn(`[Warn] ${redactText(message)}`, ...safeArgs);
  }
}

export function logSecure(message: string, data: any, level: 'info' | 'debug' | 'warn' | 'error' = 'info'): void {
  if (shouldLog(level)) {
    const redacted = redactSensitive(data);
    const formatted = typeof redacted === 'object' ? JSON.stringify(redacted) : String(redacted);
    const safeMessage = redactText(message);
    const safeFormatted = typeof redacted === 'string' ? redactText(formatted) : formatted;
    if (level === 'error') {
      console.error(`[Secure-Error] ${safeMessage}:`, safeFormatted);
    } else if (level === 'warn') {
      console.warn(`[Secure-Warn] ${safeMessage}:`, safeFormatted);
    } else if (level === 'debug') {
      console.debug(`[Secure-Debug] ${safeMessage}:`, safeFormatted);
    } else {
      console.log(`[Secure-Info] ${safeMessage}:`, safeFormatted);
    }
  }
}

export async function logError(
  scope: string,
  feature: string,
  error: any,
  metadata: Record<string, any> = {}
): Promise<string> {
  const errorId = createErrorId();
  const message = redactText(error?.message || String(error));
  const stack = error?.stack ? redactText(error.stack) : null;
  const safeMetadata = redactSensitive(metadata);

  rememberError({
    id: errorId,
    scope,
    feature,
    message,
    createdAt: new Date(),
    metadata: safeMetadata
  });

  console.error(`[Error] [${errorId}] [${scope}] [${feature}]: ${message}`, stack || '');

  try {
    await prisma.errorLog.create({
      data: {
        errorId,
        scope,
        feature,
        message,
        stack,
        metadataJson: JSON.stringify(safeMetadata)
      }
    });
  } catch (dbErr) {
    console.error('[Logger] Failed to write ErrorLog to database:', dbErr);
  }

  return errorId;
}

export async function safeReplyError(
  chatId: string,
  error: any,
  adapter: WhatsAppAdapter,
  options: {
    quotedMessageId?: string;
    scope?: string;
    feature?: string;
    metadata?: Record<string, any>;
  } = {}
): Promise<void> {
  const scope = options.scope || 'command';
  const feature = options.feature || 'general';

  const errorId = await logError(scope, feature, error, {
    chatId,
    ...options.metadata
  });

  try {
    await adapter.sendMessage(
      chatId,
      `Terjadi kesalahan sistem saat memproses command Anda. Error ID: ${errorId}`,
      { quotedMessageId: options.quotedMessageId }
    );
  } catch (sendErr) {
    console.error('[Logger] Failed to send safe reply error to user:', sendErr);
  }
}
