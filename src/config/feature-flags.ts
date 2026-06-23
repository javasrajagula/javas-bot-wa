import prisma from '../db/client.js';

export const DEFAULT_FEATURES: Record<string, any> = {
  sticker: true,
  brat: true,
  hd: true,
  media: true,
  media_compress: true,
  media_resize: true,
  media_video: true,
  document: true,
  audio: true,
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
  antiviewonce: false,
  antidelete: false,
  badword_censor: false,

  // Phase 1 Batch 1C Configurations
  antiflood: false,
  antifloodMode: 'warn',
  antilinkwhitelist: false,
  antiforward: false,
  antiforwardLimit: 3,
  antiforwardMode: 'delete',
  antijoin: false,
  antijoinRisk: 50,
  antijoinMode: 'kick',
  captcha2: false,
  muteprogressive: false,

  // Phase 1 Batch 1D Configurations
  antitagall: false,
  antitagallLimit: 5,
  antitagallMode: 'delete',
  anonanalytics: false,
  sensitivelog: false,
  consentai: false,
  privateguard: false,
  privacynotice: true,

  // Fase 1 Moderation Flags
  antiraid: false,
  antiraidLimit: 10,     // requests/joins
  antiraidDuration: 60,  // seconds
  lockdown: false,
  allowed_message_types: 'all', // all, text_only, media_only, no_stickers, etc.
  smart_automute: false,
  smart_automute_limit: 5,
  smart_automute_duration: 10,
  word_cooldown: '{}',   // JSON mapping of word -> cooldown_seconds
  anti_fake_news: false,
  anti_nsfw: false,
  auto_demote_inactive: false,
  auto_demote_days: 30,
  watermark: false,

  // Fase 2 AI Flags
  persona_name: 'Javas AI',
  persona_prompt: 'Anda adalah Javas AI, asisten pintar.',
  persona_style: 'formal',
  auto_caption: false,
  faq_mapping: '{}',
  sentiment_analysis: false,
  footer_text: '',

  // Category Specific Feature Flags
  group_moderation: true,
  privacy: true,
  admin: true,
  school: true,
  productivity: true,
  business: true,
  automation: true,
  analytics: true,
  developer: true,
  premium: true,
  games: true,

  // PRD Category Feature Flags
  prd_moderation: true,
  prd_privacy: true,
  prd_admin_ops: true,
  prd_school: true,
  prd_productivity: true,
  prd_media: true,
  prd_document: true,
  prd_ai: true,
  prd_business: true,
  prd_downloader: false, // Default downloader is disabled by default
  prd_automation: true,
  prd_analytics: true,
  prd_devops: true,
  prd_premium: true,
  prd_games: true,
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
  const { getOrCreateGroupConfig } = await import('../services/system/default-record.service.js');
  const config = await getOrCreateGroupConfig(groupId);

  return parseFeatureFlags(config.featuresJson);
}

export async function saveGroupConfigSnapshot(groupId: string): Promise<void> {
  const config = await prisma.groupConfig.findUnique({
    where: { groupId }
  });
  if (!config) return;

  const snapshot = {
    prefix: config.prefix,
    featuresJson: config.featuresJson,
    welcomeMessage: config.welcomeMessage,
    goodbyeMessage: config.goodbyeMessage,
    botEnabled: config.botEnabled
  };

  await prisma.customVariable.upsert({
    where: {
      groupId_userId_key: {
        groupId,
        userId: 'system',
        key: 'config_snapshot'
      }
    },
    create: {
      groupId,
      userId: 'system',
      key: 'config_snapshot',
      value: JSON.stringify(snapshot)
    },
    update: {
      value: JSON.stringify(snapshot)
    }
  });
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

  // Save current config to snapshot before changing
  await saveGroupConfigSnapshot(groupId);

  currentFeatures[featureName] = value;

  await prisma.groupConfig.update({
    where: { groupId },
    data: {
      featuresJson: JSON.stringify(currentFeatures)
    }
  });

  return currentFeatures;
}
