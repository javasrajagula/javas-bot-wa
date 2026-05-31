import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import prisma from '../db/client.js';
import { rateLimiter } from '../utils/rate-limit.util.js';
import { isOwner, isPremium } from '../bot/permission.js';
import { DEFAULT_FEATURES, parseFeatureFlags } from '../config/feature-flags.js';
import { achievementService } from '../services/achievement/achievement.service.js';
import { env } from '../config/env.js';
import { permissionService } from '../services/system/permission.service.js';

// Cooldown overrides (stored in-memory or dynamically modified by /setcooldown)
export const cooldownOverrides: Record<string, number> = {};

// In-memory trackers for spam & auto mute (keys are scoped as "groupId:userId" or "private:userId")
const messageTimestamps = new Map<string, number[]>();
const lastMessages = new Map<string, { body: string; count: number }>();
const stickerTimestamps = new Map<string, number[]>();
const lastSuggestionTime = new Map<string, number>();

function getLevenshteinDistance(a: string, b: string): number {
  const tmp = [];
  let i, j;
  for (i = 0; i <= a.length; i++) tmp.push([i]);
  for (j = 1; j <= b.length; j++) tmp[0].push(j);
  for (i = 1; i <= a.length; i++) {
    for (j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length][b.length];
}

export interface Command {
  execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void>;
}

// Commands registry
const commands: Record<string, Command> = {};

import { commandRegistry } from './registry/command-registry.js';

export function registerCommand(names: string[], command: Command) {
  names.forEach(name => {
    commands[name.toLowerCase()] = command;
  });
  commandRegistry.register(names, (ctx, args, adapter) => command.execute(ctx, args, adapter));
}

/**
 * Checks if a sender is an admin of a group.
 * Delegated to central PermissionService.
 */
export async function checkIfAdmin(chatId: string | null, senderId: string, adapter: WhatsAppAdapter): Promise<boolean> {
  return permissionService.checkIfAdmin(chatId, senderId, adapter);
}

/**
 * Maps a command name to its corresponding PRD feature key for setting checks and rate limiting.
 */
function getFeatureKey(commandName: string): string {
  const name = commandName.toLowerCase();
  if (name === 'stiker' || name === 's' || name === 'toimg' || name === 'stikerteks') return 'sticker';
  if (name === 'brat') return 'brat';
  if (name === 'hd') return 'hd';
  if (name === 'tt' || name === 'tiktok' || name === 'ig' || name === 'instagram') return 'downloader';
  if (name === 'ww') return 'werewolf';
  return 'general';
}

export async function routeMessage(ctx: MessageContext, adapter: WhatsAppAdapter) {
  // Blacklist check
  const { requireNotBlacklisted } = await import('../validators/permission.validator.js');
  try {
    await requireNotBlacklisted(ctx.isGroup ? ctx.chatId : null, ctx.senderId);
  } catch (err: any) {
    // Ignore blacklisted user
    return;
  }

  // Auto mute ignore check
  const { stateStore } = await import('../services/state/state-store.js');
  const scopeKey = `${ctx.chatId}:${ctx.senderId}`;
  const isMuted = await stateStore.get(`mute:${scopeKey}`);
  if (isMuted) {
    return; // Ignore muted user
  }

  // Intercept game session answers (e.g. Tebak Kata) before processing commands
  const { gameSessionService } = await import('../services/games/game-session.service.js');
  const handledByGame = await gameSessionService.handleMessage(ctx, adapter);
  if (handledByGame) return;

  const isGroup = ctx.isGroup;

  if (isGroup) {
    const { updateGroupUserStats } = await import('./community/stats.command.js');
    updateGroupUserStats(ctx.chatId, ctx.senderId).catch(err => console.error('[Stats Log Fail]', err));
  }

  // Update daily mission message count
  const { updateDailyMissionMsgCount } = await import('./games/mission.command.js');
  updateDailyMissionMsgCount(ctx.senderId).catch(err => console.error('[Mission Msg Fail]', err));

  // 1. Get Group/Bot Configuration (or default values)
  let prefix = env.BOT_PREFIX || '/';
  let botEnabled = true;
  let groupConfig: any = null;

  if (isGroup) {
    const { getOrCreateGroupConfig } = await import('../services/system/default-record.service.js');
    groupConfig = await getOrCreateGroupConfig(ctx.chatId);

    prefix = groupConfig.prefix;
    botEnabled = groupConfig.botEnabled;
  }

  // Parse command name and args
  const body = ctx.body.trim();
  const isCommand = body.startsWith(prefix);
  const parts = isCommand ? body.slice(prefix.length).trim().split(/\s+/) : [];
  let commandName = parts[0]?.toLowerCase() || '';
  const args = parts.slice(1);

  // Resolve group-specific command alias
  if (isCommand && isGroup && commandName) {
    try {
      const aliasRecord = await prisma.commandAlias.findUnique({
        where: {
          groupId_alias: {
            groupId: ctx.chatId,
            alias: commandName
          }
        }
      });
      if (aliasRecord) {
        commandName = aliasRecord.command.toLowerCase();
      }
    } catch (err) {
      console.error('[Alias] Failed to resolve command alias:', err);
    }
  }

  const isBotOnCommand = isCommand && commandName === 'bot' && args[0] === 'on';

  // If bot is turned off, ignore all messages unless it is the "/bot on" command
  if (isGroup && !botEnabled && !isBotOnCommand) return;

  // 2. Perform Group Moderation & Features checks (if group)
  if (isGroup && groupConfig) {
    const flags = JSON.parse(groupConfig.featuresJson || '{}');

    // --- AUTO REPLY CHECK ---
    if (flags.autoreply) {
      const autoReplies = await prisma.autoReply.findMany({
        where: { groupId: ctx.chatId }
      });
      const bodyLower = ctx.body.trim().toLowerCase();
      const matched = autoReplies.find(r => {
        const triggerLower = r.trigger.toLowerCase();
        return r.matchType === 'exact' ? bodyLower === triggerLower : bodyLower.includes(triggerLower);
      });

      if (matched) {
        await adapter.sendMessage(ctx.chatId, matched.response, { quotedMessageId: ctx.id });
        return;
      }
    }

    // --- ADVANCED MODERATION CHECKS (EPIC 5 & 7) ---
    const isSenderAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
    if (!isSenderAdmin) {
      // 1. Anti-Virtex & Unicode Abuse
      if (flags.antivirtex) {
        const textLimit = flags.antivirtexLimit || 4000;
        const invisibleChars = /[\u200B-\u200D\uFEFF\u202E]/g;
        if (ctx.body) {
          if (ctx.body.length > textLimit) {
            await executePunishment(ctx.chatId, ctx.senderId, flags.antispamMode || 'delete', 'Mengirimkan pesan melebihi batas karakter (Virtex)', ctx, adapter);
            return;
          }
          if (invisibleChars.test(ctx.body)) {
            await executePunishment(ctx.chatId, ctx.senderId, flags.antispamMode || 'delete', 'Karakter invisible / Unicode abuse', ctx, adapter);
            return;
          }
        }
      }

      // 2. Anti-Mention Spam
      if (flags.antimention && ctx.body) {
        const matches = ctx.body.match(/@\d+/g) || [];
        const totalMentions = matches.length + (ctx.quotedMessage ? 1 : 0);
        const mentionLimit = flags.antimentionLimit || 5;
        if (totalMentions > mentionLimit) {
          await executePunishment(ctx.chatId, ctx.senderId, flags.antispamMode || 'delete', `Spam mentions (${totalMentions} mention)`, ctx, adapter);
          return;
        }
      }

      // 3. Anti-Sticker Spam
      if (flags.antisticker && ctx.media?.type === 'sticker') {
        const now = Date.now();
        const timestamps = stickerTimestamps.get(scopeKey) || [];
        const valid = timestamps.filter(t => now - t < 10000);
        valid.push(now);
        stickerTimestamps.set(scopeKey, valid);

        if (valid.length > 3) {
          await executePunishment(ctx.chatId, ctx.senderId, flags.antispamMode || 'delete', 'Spam stiker beruntun', ctx, adapter);
          return;
        }
      }

      // 4. Anti-Spam Message Frequency (Rate & Cooldown)
      if (flags.antispam) {
        const now = Date.now();

        // Repeated identical message check
        if (ctx.body) {
          const lastMsg = lastMessages.get(scopeKey);
          if (lastMsg && lastMsg.body === ctx.body) {
            lastMsg.count++;
            if (lastMsg.count >= 3) {
              await executePunishment(ctx.chatId, ctx.senderId, flags.antispamMode || 'delete', 'Spam pesan berulang', ctx, adapter);
              return;
            }
          } else {
            lastMessages.set(scopeKey, { body: ctx.body, count: 1 });
          }
        }

        // Message speed frequency
        const timestamps = messageTimestamps.get(scopeKey) || [];
        const duration = (flags.antispamDuration || 10) * 1000;
        const valid = timestamps.filter(t => now - t < duration);
        valid.push(now);
        messageTimestamps.set(scopeKey, valid);

        const limit = flags.antispamLimit || 5;
        if (valid.length > limit) {
          await executePunishment(ctx.chatId, ctx.senderId, flags.antispamMode || 'delete', `Spam frekuensi pesan (${valid.length} pesan dalam ${flags.antispamDuration || 10} detik)`, ctx, adapter);
          return;
        }
      }

      // 5. Anti-Link Check
      if (flags.antilink && ctx.body) {
        const hasLink = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi.test(ctx.body);
        if (hasLink) {
          const whitelisted = flags.whitelistedDomains || [];
          let isWhitelisted = false;
          try {
            const matches = ctx.body.match(/(https?:\/\/[^\s]+|www\.[^\s]+)/gi);
            if (matches) {
              isWhitelisted = matches.every(link => {
                const cleanLink = link.startsWith('http') ? link : 'http://' + link;
                const hostname = new URL(cleanLink).hostname.toLowerCase();
                return whitelisted.some((domain: string) => hostname === domain || hostname.endsWith('.' + domain));
              });
            }
          } catch { }

          if (!isWhitelisted) {
            await executePunishment(ctx.chatId, ctx.senderId, flags.antilinkMode || 'delete', 'Mengirimkan link dilarang', ctx, adapter);
            return;
          }
        }
      }

      // 6. Badword / Toxic Word Check (EPIC 7)
      if (flags.badword || flags.antitoxic) {
        const badwords = await prisma.badword.findMany({
          where: { groupId: ctx.chatId },
          select: { word: true }
        });
        if (ctx.body) {
          const bodyLower = ctx.body.toLowerCase();
          const containsBadword = badwords.some(b => bodyLower.includes(b.word));
          if (containsBadword) {
            await executePunishment(ctx.chatId, ctx.senderId, 'delete', 'Menggunakan kata kasar/toxic', ctx, adapter);
            return;
          }
        }
      }
    }

    // --- LEVELING / XP ON CHAT ---
    const { handleChatXp } = await import('./economy.command.js');
    handleChatXp(ctx, adapter).catch(err => console.error('[Leveling] Failed to handle chat XP:', err));
  }

  // Intercept Setup Wizard inputs
  const { handleWizardInput } = await import('./setup.command.js');
  const wasWizardInput = await handleWizardInput(ctx, adapter);
  if (wasWizardInput) return;

  // Intercept Captcha inputs
  if (isGroup) {
    const captchaKey = `captcha:${ctx.chatId}:${ctx.senderId}`;
    const captcha = await stateStore.get<any>(captchaKey);
    if (captcha) {
      if (ctx.body.trim() === captcha.answer) {
        await stateStore.delete(captchaKey);
        await adapter.sendMessage(ctx.chatId, `✅ *Verifikasi Berhasil!* Selamat bergabung @${ctx.senderId.split('@')[0]}.`, { mentions: [ctx.senderId] });
        if (captcha.welcomeText) {
          await adapter.sendMessage(ctx.chatId, captcha.welcomeText, { mentions: [ctx.senderId] });
        }
      } else {
        await adapter.sendMessage(ctx.chatId, `❌ Jawaban salah. Silakan coba lagi.`, { quotedMessageId: ctx.id });
      }
      return;
    }
  }

  // If it's not a command, check if Chat Mode is enabled in this chat
  if (!isCommand) {
    const scopeKey = isGroup ? `chatmode:${ctx.chatId}` : `chatmode:${ctx.senderId}`;
    const isChatmode = await stateStore.get(scopeKey);
    if (isChatmode && ctx.body.trim()) {
      try {
        const { aiProviderService } = await import('../services/ai/ai-provider.service.js');
        const response = await aiProviderService.generateText(ctx.body.trim());
        await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
      } catch (err) {
        console.error('[ChatMode] Failed to reply:', err);
      }
    }
    return;
  }

  // 3. Handle Admin Controls: /bot on (needs to work even if bot is turned off)
  if (isBotOnCommand) {
    if (isGroup) {
      const isSenderAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      if (!isSenderAdmin) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang dapat mengaktifkan bot.', { quotedMessageId: ctx.id });
        return;
      }
      await prisma.groupConfig.update({
        where: { groupId: ctx.chatId },
        data: { botEnabled: true }
      });
      await adapter.sendMessage(ctx.chatId, '✅ Bot berhasil diaktifkan kembali.', { quotedMessageId: ctx.id });
    } else {
      await adapter.sendMessage(ctx.chatId, '✅ Bot aktif.', { quotedMessageId: ctx.id });
    }
    return;
  }

  // Check Maintenance Mode
  const { isMaintenanceMode } = await import('./owner/owner.command.js');
  if (isMaintenanceMode && !isOwner(ctx.senderId)) {
    await adapter.sendMessage(ctx.chatId, '⚠️ Bot sedang dalam mode pemeliharaan (maintenance). Harap coba beberapa saat lagi.', { quotedMessageId: ctx.id });
    return;
  }

  // Find Command Handler
  const registeredCmd = commandRegistry.get(commandName);
  if (!registeredCmd) {
    const now = Date.now();
    const lastTime = lastSuggestionTime.get(ctx.senderId) || 0;
    if (now - lastTime > 15000) {
      lastSuggestionTime.set(ctx.senderId, now);

      const allRegistered = commandRegistry.getAll();
      let bestMatch: any = null;
      let minDistance = 999;

      for (const cmd of allRegistered) {
        const primary = cmd.metadata.name.toLowerCase();
        const dist = getLevenshteinDistance(commandName, primary);
        if (dist < minDistance) {
          minDistance = dist;
          bestMatch = cmd.metadata;
        }
        for (const alias of cmd.metadata.aliases || []) {
          const aliasDist = getLevenshteinDistance(commandName, alias.toLowerCase());
          if (aliasDist < minDistance) {
            minDistance = aliasDist;
            bestMatch = cmd.metadata;
          }
        }
      }

      const threshold = commandName.length <= 4 ? 1 : 2;
      if (bestMatch && minDistance <= threshold) {
        await adapter.sendMessage(
          ctx.chatId,
          `⚠️ Command *${prefix}${commandName}* tidak ditemukan.\nMaksud kamu *${prefix}${bestMatch.name}*?\n\n📝 *Deskripsi:* ${bestMatch.description}\n💡 *Cara pakai:* \`${bestMatch.usage.replace(/\//g, prefix)}\``,
          { quotedMessageId: ctx.id }
        );
      }
    }
    return;
  }

  // Dynamic Plugin System Check (Global Owner Toggle)
  const { pluginManager } = await import('../config/plugins.js');
  if (!pluginManager.isPluginEnabled(registeredCmd.metadata.plugin)) {
    await adapter.sendMessage(ctx.chatId, `⚠️ Plugin untuk command "/${commandName}" sedang dinonaktifkan secara global oleh Owner.`, { quotedMessageId: ctx.id });
    return;
  }

  const featureKey = registeredCmd.metadata.featureFlag;

  // 4. Validate if feature is enabled in Group
  if (isGroup && groupConfig) {
    const flags = parseFeatureFlags(groupConfig.featuresJson);
    if (featureKey !== 'general') {
      const isEnabled = flags[featureKey] !== undefined ? flags[featureKey] : DEFAULT_FEATURES[featureKey];
      if (!isEnabled) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Fitur "${featureKey}" sedang nonaktif sementara di grup ini.`, { quotedMessageId: ctx.id });
        return;
      }
    }

    // Enforce group subscription plan restrictions
    let groupPlan = 'free';
    const sub = await prisma.groupSubscription.findUnique({
      where: { groupId: ctx.chatId }
    });
    if (sub) {
      const expired = sub.expiresAt && sub.expiresAt.getTime() < Date.now();
      if (!expired) {
        groupPlan = sub.plan || 'free';
      }
    }

    const category = registeredCmd.metadata.category;

    const freeAllowedCommands = [
      'sewa',
      'ceksewa',
      'fitursewa',
      'invoice',
      'sewaconfirm',
      'trial'
    ];

    if (freeAllowedCommands.includes(commandName)) {
      // command sewa harus tetap bisa dipakai walaupun grup masih FREE
    } else if (groupPlan === 'free') {
      if (category !== 'general' && category !== 'sticker') {
        await adapter.sendMessage(ctx.chatId, `⚠️ Grup ini menggunakan paket FREE. Fitur "${category}" tidak tersedia. Silakan gunakan paket BASIC atau PREMIUM. Ketik \`/sewa\` untuk info.`, { quotedMessageId: ctx.id });
        return;
      }
    } else if (groupPlan === 'basic') {
      if (category === 'downloader' || category === 'media' || category === 'document') {
        await adapter.sendMessage(ctx.chatId, `⚠️ Grup ini menggunakan paket BASIC. Fitur "${category}" tidak tersedia. Silakan upgrade ke paket PREMIUM. Ketik \`/sewa\` untuk info.`, { quotedMessageId: ctx.id });
        return;
      }
    }
  }

  // --- ROLE AND PERMISSION CHECKS (Run for both Group and Private) ---
  const { getUserRole } = await import('../bot/permission.js');
  const userRole = await getUserRole(isGroup ? ctx.chatId : null, ctx.senderId, adapter);

  // Role hierarchy mapping
  const roleHierarchy: Record<string, number> = {
    owner: 4,
    admin: 3,
    premium: 2,
    user: 1
  };

  const minRole = registeredCmd.metadata.minRole || 'user';
  const isPremiumOnly = registeredCmd.metadata.premiumOnly || false;

  if (roleHierarchy[userRole] < roleHierarchy[minRole]) {
    if (minRole === 'owner') {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini khusus untuk Owner.', { quotedMessageId: ctx.id });
      return;
    }
    if (minRole === 'admin') {
      if (!isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya dapat digunakan di dalam grup oleh Admin.', { quotedMessageId: ctx.id });
      } else {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini khusus untuk Admin grup.', { quotedMessageId: ctx.id });
      }
      return;
    }
  }

  const alwaysAllowedCommands = [
    'menu',
    'help',
    'start',
    'cmd',
    'cari',
    'sewa',
    'ceksewa',
    'fitursewa',
    'invoice',
    'trial',
    'premiumguide'
  ];

  if (
    !alwaysAllowedCommands.includes(commandName) &&
    isPremiumOnly &&
    roleHierarchy[userRole] < roleHierarchy['premium']
  ) {
    await adapter.sendMessage(ctx.chatId, '⚠️ Command ini khusus untuk Premium User.', { quotedMessageId: ctx.id });
    return;
  }

  // 5. Rate Limiting Check
  let isRateLimited = false;
  let retryAfterSeconds = 0;

  const bypassOwner = env.OWNER_BYPASS_RATE_LIMIT;
  const bypassPrivate = env.PRIVATE_CHAT_BYPASS_RATE_LIMIT;
  const isSenderOwner = isOwner(ctx.senderId);

  const rateLimitFeature = registeredCmd.metadata.rateLimitKey || featureKey || 'general';

  if (isGroup) {
    if (!(isSenderOwner && bypassOwner)) {
      const rateLimitKey = rateLimitFeature === 'werewolf'
        ? `group:${ctx.chatId}:werewolf`
        : `user:${ctx.senderId}:${rateLimitFeature}`;

      const res = rateLimiter.isRateLimited(rateLimitKey, rateLimitFeature);
      isRateLimited = res.limited;
      retryAfterSeconds = res.retryAfterSeconds;
    }
  } else {
    if (!bypassPrivate && !(isSenderOwner && bypassOwner)) {
      const rateLimitKey = `user:${ctx.senderId}:${rateLimitFeature}`;
      const res = rateLimiter.isRateLimited(rateLimitKey, rateLimitFeature);
      isRateLimited = res.limited;
      retryAfterSeconds = res.retryAfterSeconds;
    }
  }
  if (isRateLimited) {
    await adapter.sendMessage(
      ctx.chatId,
      `⏳ Anda terkena rate limit. Silakan coba lagi setelah ${retryAfterSeconds} detik.`,
      { quotedMessageId: ctx.id }
    );
    return;
  }

  // 5b. Pessimistic Quota Reservation check
  const startTime = Date.now();
  const tempLog = await prisma.usageLog.create({
    data: {
      userId: ctx.senderId,
      groupId: isGroup ? ctx.chatId : null,
      feature: featureKey,
      command: commandName,
      success: false,
      status: 'failed'
    }
  });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const quotaBypassCommands = [
    'sewa',
    'ceksewa',
    'fitursewa',
    'invoice',
    'sewaconfirm',
    'trial',
    'menu',
    'help',
    'rules'
  ];
  const shouldBypassQuota = quotaBypassCommands.includes(commandName);

  if (isGroup) {
    let groupPlan = 'free';
    const sub = await prisma.groupSubscription.findUnique({
      where: { groupId: ctx.chatId }
    });
    if (sub) {
      const expired = sub.expiresAt && sub.expiresAt.getTime() < Date.now();
      if (!expired) {
        groupPlan = sub.plan || 'free';
      }
    }

    let maxCmd = 50;
    if (groupPlan === 'basic') maxCmd = 200;
    else if (groupPlan === 'premium') maxCmd = 999999;

    if (sub && sub.maxDailyCmd !== null && sub.maxDailyCmd !== undefined) {
      maxCmd = sub.maxDailyCmd;
    }

    if (groupPlan !== 'premium' && !shouldBypassQuota) {
      const usageCount = await prisma.usageLog.count({
        where: {
          groupId: ctx.chatId,
          createdAt: { gte: startOfDay }
        }
      });
      if (usageCount > maxCmd) {
        await prisma.usageLog.delete({ where: { id: tempLog.id } }).catch(() => { });
        await adapter.sendMessage(
          ctx.chatId,
          `⚠️ *KUOTA HARIAN GRUP HABIS!* ⚠️\n\nGrup ini telah mencapai batas kuota harian *${maxCmd}* perintah (Paket ${groupPlan.toUpperCase()}).\nSewa paket PREMIUM untuk mendapatkan kuota tak terbatas! Ketik \`/sewa\` untuk informasi sewa.`,
          { quotedMessageId: ctx.id }
        );
        return;
      }
    }
  } else {
    // Private chat quota check
    const isSenderPremium = await isPremium(ctx.senderId);
    if (!isSenderOwner && !shouldBypassQuota) {
      const limitEnv = isSenderPremium ? env.PREMIUM_PRIVATE_DAILY_CMD_LIMIT : env.PRIVATE_DAILY_CMD_LIMIT;
      const maxCmd = parseInt(limitEnv || (isSenderPremium ? '200' : '20'), 10);
      const usageCount = await prisma.usageLog.count({
        where: {
          userId: ctx.senderId,
          groupId: null,
          createdAt: { gte: startOfDay }
        }
      });
      if (usageCount > maxCmd) {
        await prisma.usageLog.delete({ where: { id: tempLog.id } }).catch(() => { });
        await adapter.sendMessage(
          ctx.chatId,
          isSenderPremium
            ? `⚠️ *KUOTA HARIAN ANDA HABIS!* ⚠️\n\nAnda telah mencapai batas kuota harian *${maxCmd}* perintah untuk chat pribadi (Premium Limit).`
            : `⚠️ *KUOTA HARIAN ANDA HABIS!* ⚠️\n\nAnda telah mencapai batas kuota harian *${maxCmd}* perintah untuk chat pribadi.\nJadilah user PREMIUM untuk mendapatkan kuota *200* perintah harian! Ketik \`/invoice premium 1\` untuk membeli premium.`,
          { quotedMessageId: ctx.id }
        );
        return;
      }
    }
  }

  // Auto-delete Command Message if cleancmd feature is enabled (only in group)
  if (isGroup && groupConfig) {
    const flags = parseFeatureFlags(groupConfig.featuresJson);
    if (flags.cleancmd) {
      try {
        await adapter.deleteMessage(ctx.chatId, ctx.id, ctx.senderId);
      } catch (err) {
        console.error('[CleanCmd] Failed to auto-delete command message:', err);
      }
    }
  }

  // 6. Execute Command
  try {
    const { updateDailyMissionCmdCount } = await import('./games/mission.command.js');
    updateDailyMissionCmdCount(ctx.senderId).catch(err => console.error('[Mission Cmd Fail]', err));

    if (isGroup) {
      const { updateGroupUserCommandStats } = await import('./community/stats.command.js');
      updateGroupUserCommandStats(ctx.chatId, ctx.senderId).catch(err => console.error('[Command Stats Update Fail]', err));
    }

    await registeredCmd.execute(ctx, args, adapter);

    // Update reservation log as success
    const durationMs = Date.now() - startTime;
    await prisma.usageLog.update({
      where: { id: tempLog.id },
      data: {
        success: true,
        status: 'success',
        durationMs
      }
    }).catch(err => console.error('Failed to update UsageLog success:', err));

    checkCommandAchievements(ctx.senderId, isGroup, ctx.chatId, adapter, commandName, minRole);

    achievementService.checkEconomyAchievements(
      ctx.senderId,
      adapter,
      isGroup ? ctx.chatId : undefined
    ).catch(err => console.error('[Achievement Economy Hook Failed]', err));
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const { logError } = await import('../utils/logger.js');
    const errorId = await logError('routeMessage', featureKey, err, {
      userId: ctx.senderId,
      command: commandName,
      args
    });

    // Update reservation log as failed with error details
    await prisma.usageLog.update({
      where: { id: tempLog.id },
      data: {
        success: false,
        status: 'failed',
        errorId,
        durationMs
      }
    }).catch(dbErr => console.error('Failed to update UsageLog error:', dbErr));

    try {
      const errMsg = err.message || '';
      if (errMsg.includes('internal-server-error') || errMsg.toLowerCase().includes('translate')) {
        await adapter.sendMessage(
          ctx.chatId,
          `❌ Layanan sedang bermasalah. Coba lagi nanti atau gunakan teks yang lebih pendek. (Error ID: ${errorId})`,
          { quotedMessageId: ctx.id }
        );
      } else {
        await adapter.sendMessage(
          ctx.chatId,
          `Terjadi kesalahan sistem saat memproses command Anda. Error ID: ${errorId}`,
          { quotedMessageId: ctx.id }
        );
      }
    } catch (sendErr) {
      console.error('[Logger] Failed to send safe reply error to user:', sendErr);
    }
  }
}

export async function executePunishment(
  chatId: string,
  userId: string,
  action: string,
  reason: string,
  ctx: MessageContext | null,
  adapter: WhatsAppAdapter,
  warnedBy: string = 'system'
) {
  const isSenderAdmin = await checkIfAdmin(chatId, userId, adapter);
  if (isSenderAdmin) return;

  // 1. Delete message if triggered by a specific message
  if (ctx && action !== 'warn_no_delete') {
    try {
      await adapter.deleteMessage(chatId, ctx.id, userId);
    } catch { }
  }

  const actualAction = action === 'warn_no_delete' ? 'warn' : action;

  // Log infraction
  await prisma.infractionLog.create({
    data: {
      groupId: chatId,
      userId,
      type: actualAction,
      reason,
      action: actualAction,
      createdBy: warnedBy
    }
  }).catch(err => console.error('Failed to log infraction:', err));

  // Determine group log type
  let logType = 'moderation';
  const rLow = reason.toLowerCase();
  if (rLow.includes('spam') || rLow.includes('karakter') || rLow.includes('virtex')) logType = 'spam';
  else if (rLow.includes('link')) logType = 'link';
  else if (rLow.includes('kata kasar') || rLow.includes('badword')) logType = 'badword';
  else if (actualAction === 'warn') logType = 'warn';
  else if (actualAction === 'kick') logType = 'kick';

  // Log group event
  await prisma.groupLog.create({
    data: {
      groupId: chatId,
      userId,
      type: logType,
      action: actualAction,
      message: reason
    }
  }).catch(err => console.error('Failed to log group event:', err));

  // 2. Execute action
  if (actualAction === 'warn') {
    await prisma.warning.create({
      data: {
        groupId: chatId,
        userId,
        reason,
        warnedBy
      }
    });

    const userWarnings = await prisma.warning.count({
      where: { groupId: chatId, userId }
    });

    const mention = `@${userId.split('@')[0]}`;
    let warningMsg = `⚠️ *PERINGATAN* ⚠️\n\n${mention} mendapatkan peringatan.\nAlasan: *${reason}*\nJumlah Peringatan: *${userWarnings}*`;

    // Fetch dynamic rules
    const rules = await prisma.warningRule.findMany({
      where: { groupId: chatId },
      orderBy: { threshold: 'desc' }
    });

    let triggeredRule = null;
    for (const rule of rules) {
      if (userWarnings >= rule.threshold) {
        triggeredRule = rule;
        break;
      }
    }

    // Default rule if no custom rules exist: Kick at 3 warnings
    if (!triggeredRule && rules.length === 0 && userWarnings >= 3) {
      triggeredRule = { threshold: 3, action: 'kick' };
    }

    if (triggeredRule) {
      const ruleAction = triggeredRule.action;
      warningMsg += `\n\n🚫 ${mention} telah mencapai batas ${triggeredRule.threshold} peringatan! Melakukan tindakan: *${ruleAction.toUpperCase()}*.`;

      await adapter.sendMessage(chatId, warningMsg, { mentions: [userId] });

      if (ruleAction === 'kick') {
        await prisma.warning.deleteMany({ where: { groupId: chatId, userId } });
        const socket = (adapter as any).sock;
        if (socket) {
          try {
            await socket.groupParticipantsUpdate(chatId, [userId], 'remove');
          } catch (err) {
            console.error('[System Warn] Failed to kick user:', err);
          }
        }
      } else if (ruleAction === 'mute') {
        const { stateStore } = await import('../services/state/state-store.js');
        await stateStore.set(`mute:${chatId}:${userId}`, true, 300);
      }
    } else {
      await adapter.sendMessage(chatId, warningMsg, { mentions: [userId] });
    }
  } else if (actualAction === 'mute') {
    const { stateStore } = await import('../services/state/state-store.js');
    await stateStore.set(`mute:${chatId}:${userId}`, true, 300);
    const mention = `@${userId.split('@')[0]}`;
    await adapter.sendMessage(chatId, `🚫 ${mention} dimute selama 5 menit karena: *${reason}*.`, { mentions: [userId] });
  } else if (actualAction === 'kick') {
    const mention = `@${userId.split('@')[0]}`;
    await adapter.sendMessage(chatId, `🚫 Mengeluarkan ${mention} dari grup karena: *${reason}*.`, { mentions: [userId] });
    const socket = (adapter as any).sock;
    if (socket) {
      try {
        await socket.groupParticipantsUpdate(chatId, [userId], 'remove');
      } catch (err) {
        console.error('[System Kick] Failed to kick user:', err);
      }
    }
  } else {
    // delete only
    const mention = `@${userId.split('@')[0]}`;
    await adapter.sendMessage(chatId, `⚠️ Pesan dari ${mention} dihapus otomatis karena: *${reason}*.`, { mentions: [userId] });
  }
}

export async function checkCommandAchievements(
  userId: string,
  isGroup: boolean,
  chatId: string,
  adapter: WhatsAppAdapter,
  commandName: string,
  minRole: string
) {
  try {
    const totalCmds = await prisma.usageLog.count({ where: { userId } });
    if (totalCmds >= 1) {
      await achievementService.unlockAchievement(userId, 'first_command', adapter, isGroup ? chatId : undefined);
    }
    if (totalCmds >= 100) {
      await achievementService.unlockAchievement(userId, 'messages_100', adapter, isGroup ? chatId : undefined);
    }
    if (totalCmds >= 1000) {
      await achievementService.unlockAchievement(userId, 'messages_1000', adapter, isGroup ? chatId : undefined);
    }

    // Check active days (active_7_days and active_30_days)
    const logs = await prisma.usageLog.findMany({
      where: { userId },
      select: { createdAt: true }
    });

    const uniqueDays = new Set(logs.map(log => {
      const d = new Date(log.createdAt);
      return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    }));

    if (uniqueDays.size >= 7) {
      await achievementService.unlockAchievement(userId, 'active_7_days', adapter, isGroup ? chatId : undefined);
    }
    if (uniqueDays.size >= 30) {
      await achievementService.unlockAchievement(userId, 'active_30_days', adapter, isGroup ? chatId : undefined);
    }

    // Check admin_helper
    if (minRole === 'admin' || minRole === 'owner') {
      const isSenderAdmin = await checkIfAdmin(chatId, userId, adapter);
      if (isSenderAdmin) {
        await achievementService.unlockAchievement(userId, 'admin_helper', adapter, isGroup ? chatId : undefined);
      }
    }
  } catch (err) {
    console.error('[Achievement Hook Failed]', err);
  }
}
