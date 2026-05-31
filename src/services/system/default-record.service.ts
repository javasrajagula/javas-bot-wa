import prisma from '../../db/client.js';
import { DEFAULT_FEATURES } from '../../config/feature-flags.js';
import { isUniqueConstraintError } from '../../utils/prisma-error.util.js';

/**
 * Atomic get-or-create helper for group configurations to prevent P2002 race conditions.
 */
export async function getOrCreateGroupConfig(groupId: string) {
  try {
    return await prisma.groupConfig.upsert({
      where: { groupId },
      update: {},
      create: {
        groupId,
        prefix: '/',
        botEnabled: true,
        featuresJson: JSON.stringify(DEFAULT_FEATURES)
      }
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      // Fallback: try retrieving the record that was created by the competing thread
      const config = await prisma.groupConfig.findUnique({
        where: { groupId }
      });
      if (config) return config;
    }
    throw err;
  }
}
