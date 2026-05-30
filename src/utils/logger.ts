import prisma from '../db/client.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import { createErrorId, rememberError } from './error-id.util.js';
import { redactSensitive } from './mask.util.js';

export async function logError(
  scope: string,
  feature: string,
  error: any,
  metadata: Record<string, any> = {}
): Promise<string> {
  const errorId = createErrorId();
  const message = error?.message || String(error);
  const stack = error?.stack || null;
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
