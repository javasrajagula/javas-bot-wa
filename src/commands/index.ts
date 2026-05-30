import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import prisma from '../db/client.js';
import { rateLimiter } from '../utils/rate-limit.util.js';
import { isOwner } from '../bot/permission.js';
import { DEFAULT_FEATURES } from '../config/feature-flags.js';
import { achievementService } from '../services/achievement/achievement.service.js';

// Cooldown overrides (stored in-memory or dynamically modified by /setcooldown)
export const cooldownOverrides: Record<string, number> = {};

// In-memory trackers for spam & auto mute
const messageTimestamps = new Map<string, number[]>();
const mutedUsers = new Map<string, number>();
const lastMessages = new Map<string, { body: string; count: number }>();
const stickerTimestamps = new Map<string, number[]>();

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
 * For ConsoleAdapter, senderId starting with "admin" or being the game host is allowed.
 * For BaileysAdapter, queries the group metadata participant roles.
 */
export async function checkIfAdmin(chatId: string, senderId: string, adapter: WhatsAppAdapter): Promise<boolean> {
  // If console adapter, simulate admins
  if (senderId.includes('admin') || senderId === 'host' || senderId === 'user1') {
    return true;
  }

  if (!chatId || !chatId.endsWith('@g.us')) return false;

  const socket = (adapter as any).sock;
  if (!socket) return false;

  try {
    const groupMetadata = await socket.groupMetadata(chatId);
    const participant = groupMetadata.participants.find((p: any) => p.id === senderId);
    return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
  } catch (err) {
    console.error('Failed to check admin status:', err);
    return false;
  }
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
  const muteTime = mutedUsers.get(ctx.senderId) || 0;
  if (Date.now() < muteTime) {
    return; // Ignore muted user
  }

  const isGroup = ctx.isGroup;
  
  // 1. Get Group Configuration (or default values)
  let prefix = '/';
  let botEnabled = true;
  let featureEnabled = true;
  let groupConfig: any = null;

  if (isGroup) {
    groupConfig = await prisma.groupConfig.findUnique({
      where: { groupId: ctx.chatId }
    });

    if (!groupConfig) {
      groupConfig = await prisma.groupConfig.create({
        data: {
          groupId: ctx.chatId,
          prefix: '/',
          botEnabled: true,
          featuresJson: JSON.stringify(DEFAULT_FEATURES)
        }
      });
    }

    prefix = groupConfig.prefix;
    botEnabled = groupConfig.botEnabled;
  }

  // Parse command name and args
  const body = ctx.body.trim();
  const isCommand = body.startsWith(prefix);
  const parts = isCommand ? body.slice(prefix.length).trim().split(/\s+/) : [];
  const commandName = parts[0]?.toLowerCase() || '';
  const args = parts.slice(1);

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
        const timestamps = stickerTimestamps.get(ctx.senderId) || [];
        const valid = timestamps.filter(t => now - t < 10000);
        valid.push(now);
        stickerTimestamps.set(ctx.senderId, valid);

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
          const lastMsg = lastMessages.get(ctx.senderId);
          if (lastMsg && lastMsg.body === ctx.body) {
            lastMsg.count++;
            if (lastMsg.count >= 3) {
              await executePunishment(ctx.chatId, ctx.senderId, flags.antispamMode || 'delete', 'Spam pesan berulang', ctx, adapter);
              return;
            }
          } else {
            lastMessages.set(ctx.senderId, { body: ctx.body, count: 1 });
          }
        }

        // Message speed frequency
        const timestamps = messageTimestamps.get(ctx.senderId) || [];
        const duration = (flags.antispamDuration || 10) * 1000;
        const valid = timestamps.filter(t => now - t < duration);
        valid.push(now);
        messageTimestamps.set(ctx.senderId, valid);

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
          } catch {}

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

  // If it's not a command, we are done
  if (!isCommand) return;

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
  if (!registeredCmd) return;

  // Dynamic Plugin System Check (Global Owner Toggle)
  const { pluginManager } = await import('../config/plugins.js');
  if (!pluginManager.isPluginEnabled(registeredCmd.metadata.plugin)) {
    await adapter.sendMessage(ctx.chatId, `⚠️ Plugin untuk command "/${commandName}" sedang dinonaktifkan secara global oleh Owner.`, { quotedMessageId: ctx.id });
    return;
  }

  const featureKey = registeredCmd.metadata.featureFlag;

  // 4. Validate if feature is enabled in Group
  if (isGroup && groupConfig) {
    const flags = JSON.parse(groupConfig.featuresJson || '{}');
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
    if (groupPlan === 'free') {
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

  // --- ROLE AND PERMISSION CHECKS ---
  const { getUserRole } = await import('../bot/permission.js');
  const userRole = await getUserRole(ctx.chatId, ctx.senderId, adapter);

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

  if (isPremiumOnly && roleHierarchy[userRole] < roleHierarchy['premium']) {
    await adapter.sendMessage(ctx.chatId, '⚠️ Command ini khusus untuk Premium User.', { quotedMessageId: ctx.id });
    return;
  }

  // 5. Rate Limiting Check
  let isRateLimited = false;
  let retryAfterSeconds = 0;

  const bypassOwner = process.env.OWNER_BYPASS_RATE_LIMIT !== 'false';
  const bypassPrivate = process.env.PRIVATE_CHAT_BYPASS_RATE_LIMIT !== 'false';
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

  // Log usage in Database asynchronously
  prisma.usageLog.create({
    data: {
      userId: ctx.senderId,
      groupId: isGroup ? ctx.chatId : null,
      feature: featureKey
    }
  }).then(() => {
    checkCommandAchievements(ctx.senderId, isGroup, ctx.chatId, adapter, commandName, minRole);
  }).catch(err => console.error('Failed to save UsageLog:', err));

  // Auto-delete Command Message if cleancmd feature is enabled
  if (isGroup && groupConfig) {
    const flags = JSON.parse(groupConfig.featuresJson || '{}');
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
    await registeredCmd.execute(ctx, args, adapter);
    achievementService.checkEconomyAchievements(
      ctx.senderId,
      adapter,
      isGroup ? ctx.chatId : undefined
    ).catch(err => console.error('[Achievement Economy Hook Failed]', err));
  } catch (err: any) {
    const { safeReplyError } = await import('../utils/logger.js');
    await safeReplyError(ctx.chatId, err, adapter, {
      quotedMessageId: ctx.id,
      scope: 'routeMessage',
      feature: featureKey,
      metadata: {
        userId: ctx.senderId,
        command: commandName,
        args
      }
    });
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
    } catch {}
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
        const duration = 5 * 60 * 1000;
        mutedUsers.set(userId, Date.now() + duration);
      }
    } else {
      await adapter.sendMessage(chatId, warningMsg, { mentions: [userId] });
    }
  } else if (actualAction === 'mute') {
    const duration = 5 * 60 * 1000; // 5 minutes mute
    mutedUsers.set(userId, Date.now() + duration);
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
