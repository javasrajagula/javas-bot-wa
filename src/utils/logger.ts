import prisma from '../db/client.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';

export async function logError(
  scope: string,
  feature: string,
  error: any,
  metadata: Record<string, any> = {}
): Promise<void> {
  const message = error?.message || String(error);
  const stack = error?.stack || null;

  console.error(`[Error] [${scope}] [${feature}]: ${message}`, stack || '');

  try {
    await prisma.errorLog.create({
      data: {
        scope,
        feature,
        message,
        stack,
        metadataJson: JSON.stringify(metadata)
      }
    });
  } catch (dbErr) {
    console.error('[Logger] Failed to write ErrorLog to database:', dbErr);
  }
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

  // Log detailed error to console & database
  await logError(scope, feature, error, {
    chatId,
    ...options.metadata
  });

  // Reply user with generic safe error message
  try {
    await adapter.sendMessage(
      chatId,
      '❌ Terjadi kesalahan sistem saat memproses command Anda. Harap coba lagi nanti.',
      { quotedMessageId: options.quotedMessageId }
    );
  } catch (sendErr) {
    console.error('[Logger] Failed to send safe reply error to user:', sendErr);
  }
}

