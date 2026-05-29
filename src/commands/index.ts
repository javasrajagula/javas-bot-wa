import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import prisma from '../db/client.js';
import { rateLimiter } from '../utils/rate-limit.util.js';

// Cooldown overrides (stored in-memory or dynamically modified by /setcooldown)
export const cooldownOverrides: Record<string, number> = {};

export interface Command {
  execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void>;
}

// Commands registry
const commands: Record<string, Command> = {};

export function registerCommand(names: string[], command: Command) {
  names.forEach(name => {
    commands[name.toLowerCase()] = command;
  });
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
          stickerEnabled: true,
          hdEnabled: true,
          downloaderEnabled: true,
          werewolfEnabled: true
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

    // --- ANTILINK CHECK ---
    if (flags.antilink) {
      const hasLink = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi.test(ctx.body);
      if (hasLink) {
        const isSenderAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isSenderAdmin) {
          try {
            await adapter.deleteMessage(ctx.chatId, ctx.id, ctx.senderId);
            await adapter.sendMessage(
              ctx.chatId,
              `⚠️ @${ctx.senderId.split('@')[0]} dilarang mengirimkan link di grup ini!`,
              { mentions: [ctx.senderId] }
            );
          } catch (err) {
            console.error('[Anti-Link] Failed to handle link deletion:', err);
          }
          return; // Stop processing link message
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
  const { isMaintenanceMode } = await import('./owner.command.js');
  const { isOwner } = await import('../bot/permission.js');
  if (isMaintenanceMode && !isOwner(ctx.senderId)) {
    await adapter.sendMessage(ctx.chatId, '⚠️ Bot sedang dalam mode pemeliharaan (maintenance). Harap coba beberapa saat lagi.', { quotedMessageId: ctx.id });
    return;
  }

  // Find Command Handler
  const command = commands[commandName];
  if (!command) return;

  const featureKey = getFeatureKey(commandName);

  // 4. Validate if feature is enabled in Group
  if (isGroup && groupConfig) {
    if (featureKey === 'sticker' && !groupConfig.stickerEnabled) featureEnabled = false;
    if (featureKey === 'brat' && !groupConfig.stickerEnabled) featureEnabled = false; // Brat is also sticker
    if (featureKey === 'hd' && !groupConfig.hdEnabled) featureEnabled = false;
    if (featureKey === 'downloader' && !groupConfig.downloaderEnabled) featureEnabled = false;
    if (featureKey === 'werewolf' && !groupConfig.werewolfEnabled) featureEnabled = false;

    if (!featureEnabled) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Fitur ini sedang nonaktif sementara.', { quotedMessageId: ctx.id });
      return;
    }
  }

  // 5. Rate Limiting Check
  // Werewolf command is rate limited per Group. Others are per User.
  const rateLimitKey = featureKey === 'werewolf' && isGroup
    ? `group:${ctx.chatId}:werewolf`
    : `user:${ctx.senderId}:${featureKey}`;

  const { limited, retryAfterSeconds } = rateLimiter.isRateLimited(rateLimitKey, featureKey);
  if (limited) {
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
    await command.execute(ctx, args, adapter);
  } catch (err: any) {
    console.error(`Error executing command /${commandName}:`, err);
    await adapter.sendMessage(ctx.chatId, `❌ Error: ${err.message || 'Terjadi kesalahan sistem.'}`, { quotedMessageId: ctx.id });
  }
}
