import prisma from '../db/client.js';

export const DEFAULT_FEATURES: Record<string, boolean> = {
  welcome: false,
  goodbye: false,
  antilink: false,
  leveling: false,
  economy: false,
  confess: false,
  menfess: false,
  cleancmd: false, // auto delete command message
  automute: false,
  antispam: false,
  antitoxic: false,
  badword: false,
};

export interface GroupFeatures {
  [key: string]: boolean;
}

/**
 * Returns merged features configuration from DB JSON with default values.
 */
export function parseFeatureFlags(featuresJsonStr: string): GroupFeatures {
  try {
    const dbConfig = JSON.parse(featuresJsonStr || '{}');
    return {
      ...DEFAULT_FEATURES,
      ...dbConfig,
    };
  } catch {
    return { ...DEFAULT_FEATURES };
  }
}

/**
 * Gets the feature flags for a group, creating group config if missing.
 */
export async function getGroupFeatures(groupId: string): Promise<GroupFeatures> {
  let config = await prisma.groupConfig.findUnique({
    where: { groupId }
  });

  if (!config) {
    config = await prisma.groupConfig.create({
      data: {
        groupId,
        prefix: '/',
        botEnabled: true,
        featuresJson: JSON.stringify(DEFAULT_FEATURES),
      }
    });
  }

  return parseFeatureFlags(config.featuresJson);
}

/**
 * Toggles a feature flag for a group.
 */
export async function setGroupFeature(
  groupId: string,
  featureName: string,
  value: boolean
): Promise<GroupFeatures> {
  const currentFeatures = await getGroupFeatures(groupId);

  // Check if feature is valid
  if (!(featureName in DEFAULT_FEATURES)) {
    throw new Error(`Fitur "${featureName}" tidak terdaftar di sistem.`);
  }

  currentFeatures[featureName] = value;

  await prisma.groupConfig.update({
    where: { groupId },
    data: {
      featuresJson: JSON.stringify(currentFeatures)
    }
  });

  return currentFeatures;
}
