import prisma from '../db/client.js';

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
