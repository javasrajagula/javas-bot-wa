import prisma from '../db/client.js';

export const DEFAULT_FEATURES: Record<string, any> = {
  sticker: true,
  brat: true,
  hd: true,
  downloader: false, // Default downloader harus nonaktif
  werewolf: true,
  welcome: false,
  goodbye: false,
  antilink: false,
  antispam: false,
  antitoxic: false,
  badword: false,
  warning: false,
  automute: false,
  blacklist: false,
  leveling: false,
  economy: false,
  confess: false,
  menfess: false,
  autoreply: false,
  poll: false,
  attendance: false,
  reminder: false,
  miniGames: false,
  rpg: false,
  crime: true,
  rob: true,
  language: 'id',
  persona: 'formal',
  
  // Advanced Moderation Configurations
  antispamMode: 'warn', // delete, warn, mute, kick
  antispamLimit: 5,     // requests
  antispamDuration: 10, // seconds
  antilinkMode: 'delete', // delete, warn, kick
  whitelistedDomains: [], // string[]
  antivirtex: false,
  antimention: false,
  antisticker: false,
  modsmart: false,
  antimentionLimit: 5,   // max mentions per message
  antivirtexLimit: 4000,  // max characters per message
};

export interface GroupFeatures {
  [key: string]: any;
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
  value: any
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
