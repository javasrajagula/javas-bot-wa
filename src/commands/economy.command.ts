import { Command, registerCommand, checkIfAdmin } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import { getGroupFeatures } from '../config/feature-flags.js';
import prisma from '../db/client.js';
import { isPremium, isOwner } from '../bot/permission.js';
import { downloadToBuffer } from '../utils/file.util.js';
import { renderRankCard, renderProfileCard, renderLeaderboardCard } from '../services/media/card.service.js';
import { achievementService } from '../services/achievement/achievement.service.js';

// Cooldown helper for XP gain (to prevent spamming)
const xpCooldowns = new Map<string, number>();

function parseJsonStringArray(value: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Calculates XP required to reach the next level.
 * Formula: level * 200
 */
export function getXpNeededForNextLevel(level: number): number {
  return level * 200;
}

/**
 * Updates user XP and balance for leveling/economy.
 * If user levels up, returns the new level, otherwise null.
 */
export async function addXpAndBalance(
  userId: string,
  xpToAdd: number,
  balanceToAdd: number
): Promise<{ newLevel: number | null; economy: any }> {
  const economy = await prisma.userEconomy.upsert({
    where: { userId },
    create: {
      userId,
      xp: xpToAdd,
      balance: balanceToAdd,
      level: 1,
    },
    update: {
      xp: { increment: xpToAdd },
      balance: { increment: balanceToAdd },
    },
  });

  let currentXp = economy.xp;
  let currentLevel = economy.level;
  let xpNeeded = getXpNeededForNextLevel(currentLevel);
  let leveledUp = false;

  while (currentXp >= xpNeeded) {
    currentXp -= xpNeeded;
    currentLevel += 1;
    xpNeeded = getXpNeededForNextLevel(currentLevel);
    leveledUp = true;
  }

  if (leveledUp) {
    const updatedEconomy = await prisma.userEconomy.update({
      where: { userId },
      data: {
        level: currentLevel,
        xp: currentXp,
      },
    });
    return { newLevel: currentLevel, economy: updatedEconomy };
  }

  return { newLevel: null, economy };
}

/**
 * Handles normal chat activity for XP & Economy.
 * Triggered on every message if features are enabled.
 */
export async function handleChatXp(ctx: MessageContext, adapter: WhatsAppAdapter) {
  if (!ctx.isGroup) return;

  try {
    const flags = await getGroupFeatures(ctx.chatId);
    if (!flags.leveling && !flags.economy) return;

    const now = Date.now();
    const lastXpTime = xpCooldowns.get(ctx.senderId) || 0;
    if (now - lastXpTime < 30000) return; // 30s cooldown per user for earning XP

    xpCooldowns.set(ctx.senderId, now);

    const xpToAdd = flags.leveling ? Math.floor(Math.random() * 11) + 5 : 0; // 5-15 XP
    const balanceToAdd = flags.economy ? Math.floor(Math.random() * 4) + 2 : 0; // 2-5 Balance

    if (xpToAdd > 0 || balanceToAdd > 0) {
      const { newLevel } = await addXpAndBalance(ctx.senderId, xpToAdd, balanceToAdd);
      if (newLevel && flags.leveling) {
        const mention = `@${ctx.senderId.split('@')[0]}`;
        await adapter.sendMessage(
          ctx.chatId,
          `🎉 *LEVEL UP!* 🎉\nSelamat ${mention}, kamu naik ke *Level ${newLevel}*! 🚀`,
          { mentions: [ctx.senderId] }
        );
      }
    }
  } catch (err) {
    console.error('[Economy] Failed to handle chat XP:', err);
  }
}

export class BalanceCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (ctx.isGroup) {
      const flags = await getGroupFeatures(ctx.chatId);
      if (!flags.economy) {
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Fitur ekonomi sedang nonaktif di grup ini. Admin dapat mengaktifkannya menggunakan `/feature economy on`.',
          { quotedMessageId: ctx.id }
        );
        return;
      }
    }

    const economy = await prisma.userEconomy.findUnique({
      where: { userId: ctx.senderId },
    });

    const balance = economy?.balance ?? 0;
    const level = economy?.level ?? 1;
    const xp = economy?.xp ?? 0;
    const xpNeeded = getXpNeededForNextLevel(level);

    const mention = `@${ctx.senderId.split('@')[0]}`;
    const response = `💰 *DOMPET WARGA* 💰

👤 *Pengguna:* ${mention}
💵 *Saldo:* Rp. ${balance.toLocaleString('id-ID')}
📊 *Level:* ${level} (XP: ${xp}/${xpNeeded})`;

    await adapter.sendMessage(ctx.chatId, response, {
      quotedMessageId: ctx.id,
      mentions: [ctx.senderId],
    });
  }
}

export class ClaimCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (ctx.isGroup) {
      const flags = await getGroupFeatures(ctx.chatId);
      if (!flags.economy) {
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Fitur ekonomi sedang nonaktif di grup ini. Admin dapat mengaktifkannya menggunakan `/feature economy on`.',
          { quotedMessageId: ctx.id }
        );
        return;
      }
    }

    const economy = await prisma.userEconomy.findUnique({
      where: { userId: ctx.senderId },
    });

    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;

    if (economy && economy.lastClaim) {
      const lastClaimTime = economy.lastClaim.getTime();
      const timeDiff = now.getTime() - lastClaimTime;
      if (timeDiff < oneDay) {
        const remainingMs = oneDay - timeDiff;
        const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
        const remainingMinutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
        await adapter.sendMessage(
          ctx.chatId,
          `⏳ Anda sudah mengklaim hadiah harian hari ini. Silakan coba lagi setelah *${remainingHours} jam ${remainingMinutes} menit*.`,
          { quotedMessageId: ctx.id }
        );
        return;
      }
    }

    const randomBalance = Math.floor(Math.random() * 501) + 500; // Rp. 500 - 1000
    const claimXp = 100;
    
    let newStreak = 1;
    if (economy && economy.lastClaim) {
      const lastClaimTime = economy.lastClaim.getTime();
      const timeDiff = now.getTime() - lastClaimTime;
      if (timeDiff <= 2 * oneDay) {
        newStreak = (economy.claimStreak || 0) + 1;
      } else {
        newStreak = 1;
      }
    }

    await prisma.userEconomy.upsert({
      where: { userId: ctx.senderId },
      create: {
        userId: ctx.senderId,
        balance: randomBalance,
        xp: claimXp,
        level: 1,
        lastClaim: now,
        claimStreak: newStreak,
      },
      update: {
        balance: { increment: randomBalance },
        xp: { increment: claimXp },
        lastClaim: now,
        claimStreak: newStreak,
      },
    });

    // Check level up as well
    const { newLevel } = await addXpAndBalance(ctx.senderId, 0, 0);

    // Achievements check for daily claim streak
    if (newStreak >= 7) {
      await achievementService.unlockAchievement(ctx.senderId, 'streak_7', adapter, ctx.isGroup ? ctx.chatId : undefined);
    }
    if (newStreak >= 30) {
      await achievementService.unlockAchievement(ctx.senderId, 'streak_30', adapter, ctx.isGroup ? ctx.chatId : undefined);
    }

    let response = `🎁 *DAILY CLAIM* 🎁\n\nSelamat! Kamu mendapatkan:\n💵 *+Rp. ${randomBalance.toLocaleString('id-ID')}*\n📊 *+${claimXp} XP*\n🔥 *Streak:* ${newStreak} Hari`;
    if (newLevel) {
      response += `\n\n🎉 *LEVEL UP!* Kamu naik ke *Level ${newLevel}*!`;
    }

    await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
  }
}

export class TransferCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (ctx.isGroup) {
      const flags = await getGroupFeatures(ctx.chatId);
      if (!flags.economy) {
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Fitur ekonomi sedang nonaktif di grup ini. Admin dapat mengaktifkannya menggunakan `/feature economy on`.',
          { quotedMessageId: ctx.id }
        );
        return;
      }
    }

    const rawUser = args[0];
    const amountStr = args[1];
    const amount = parseInt(amountStr, 10);

    if (!rawUser || isNaN(amount) || amount <= 0) {
      await adapter.sendMessage(
        ctx.chatId,
        '⚠️ Format salah. Gunakan: `/transfer @user <jumlah>`',
        { quotedMessageId: ctx.id }
      );
      return;
    }

    // Resolve target JID
    const targetUserId = rawUser.includes('@')
      ? rawUser.replace('@', '').trim() + '@s.whatsapp.net'
      : rawUser.trim();

    if (targetUserId === ctx.senderId) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Kamu tidak bisa mentransfer uang ke dirimu sendiri.', { quotedMessageId: ctx.id });
      return;
    }

    // Check sender balance
    const senderEco = await prisma.userEconomy.findUnique({
      where: { userId: ctx.senderId },
    });

    if (!senderEco || senderEco.balance < amount) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Saldo kamu tidak mencukupi untuk melakukan transfer ini.', { quotedMessageId: ctx.id });
      return;
    }

    try {
      // Perform transfer within transaction
      await prisma.$transaction([
        prisma.userEconomy.update({
          where: { userId: ctx.senderId },
          data: { balance: { decrement: amount } },
        }),
        prisma.userEconomy.upsert({
          where: { userId: targetUserId },
          create: {
            userId: targetUserId,
            balance: amount,
            level: 1,
            xp: 0,
          },
          update: {
            balance: { increment: amount },
          },
        }),
      ]);

      const mentionSender = `@${ctx.senderId.split('@')[0]}`;
      const mentionTarget = `@${targetUserId.split('@')[0]}`;

      await adapter.sendMessage(
        ctx.chatId,
        `💸 *TRANSFER BERHASIL* 💸\n\n${mentionSender} mentransfer *Rp. ${amount.toLocaleString('id-ID')}* ke ${mentionTarget}.`,
        {
          quotedMessageId: ctx.id,
          mentions: [ctx.senderId, targetUserId],
        }
      );
    } catch (err: any) {
      await adapter.sendMessage(ctx.chatId, `❌ Transfer gagal: ${err.message}`, { quotedMessageId: ctx.id });
    }
  }
}

export class RankCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (ctx.isGroup) {
      const flags = await getGroupFeatures(ctx.chatId);
      if (!flags.leveling) {
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Fitur leveling sedang nonaktif di grup ini. Admin dapat mengaktifkannya menggunakan `/feature leveling on`.',
          { quotedMessageId: ctx.id }
        );
        return;
      }
    }

    const economy = await prisma.userEconomy.findUnique({
      where: { userId: ctx.senderId },
    });

    const level = economy?.level ?? 1;
    const xp = economy?.xp ?? 0;
    const xpNeeded = getXpNeededForNextLevel(level);
    const balance = economy?.balance ?? 0;

    // Find rank globally
    const allUsers = await prisma.userEconomy.findMany({
      orderBy: [
        { level: 'desc' },
        { xp: 'desc' },
      ],
    });

    const rankGlobal = allUsers.findIndex(u => u.userId === ctx.senderId) + 1 || allUsers.length + 1;

    let rankGrup: number | string = 'N/A';
    const socket = (adapter as any).sock;
    if (ctx.isGroup && socket) {
      try {
        const groupMetadata = await socket.groupMetadata(ctx.chatId);
        const participantIds = groupMetadata.participants.map((p: any) => p.id);
        const groupEconomies = await prisma.userEconomy.findMany({
          where: { userId: { in: participantIds } },
          orderBy: [
            { level: 'desc' },
            { xp: 'desc' }
          ]
        });
        const idx = groupEconomies.findIndex(u => u.userId === ctx.senderId);
        if (idx !== -1) {
          rankGrup = idx + 1;
        }
      } catch (e) {
        console.error('[RankGrup] Failed to get group rank:', e);
      }
    }

    const profile = await prisma.userProfile.findUnique({
      where: { userId: ctx.senderId }
    });
    const title = profile?.title || 'Warga Biasa';
    const badges = JSON.parse(profile?.badgesJson || '[]');
    const isUserPrem = await isPremium(ctx.senderId);

    let avatarBuffer: Buffer | undefined = undefined;
    if (socket) {
      try {
        const avatarUrl = await socket.profilePictureUrl(ctx.senderId, 'image');
        if (avatarUrl) {
          avatarBuffer = await downloadToBuffer(avatarUrl);
        }
      } catch {}
    }

    let bgBuffer: Buffer | undefined = undefined;
    if (profile?.cardBgUrl) {
      try {
        bgBuffer = await downloadToBuffer(profile.cardBgUrl);
      } catch {}
    }

    try {
      const buffer = await renderRankCard({
        username: ctx.senderName || ctx.senderId.split('@')[0],
        userId: ctx.senderId,
        level,
        xp,
        xpNeeded,
        balance,
        rankGlobal,
        rankGrup,
        title,
        badges,
        isPremium: isUserPrem,
        avatarBuffer,
        bgBuffer
      });
      await adapter.sendImage(ctx.chatId, buffer, `📊 *RANKING WARGA* 📊\n\n👤 *Warga:* @${ctx.senderId.split('@')[0]}\n📊 *Level:* ${level} (XP: ${xp}/${xpNeeded})`, {
        quotedMessageId: ctx.id,
        mentions: [ctx.senderId]
      });
    } catch (err: any) {
      console.error('[RankCommand] Failed to render rank card:', err);
      // Fallback to text
      const response = `📊 *RANKING WARGA* 📊\n\n👤 *Pengguna:* @${ctx.senderId.split('@')[0]}\n📊 *Level:* ${level}\n✨ *XP:* ${xp} / ${xpNeeded}\n🏆 *Peringkat Global:* #${rankGlobal} dari ${allUsers.length} warga\n🏆 *Peringkat Grup:* #${rankGrup}`;
      await adapter.sendMessage(ctx.chatId, response, {
        quotedMessageId: ctx.id,
        mentions: [ctx.senderId],
      });
    }
  }
}

export class ProfileCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (ctx.isGroup) {
      const flags = await getGroupFeatures(ctx.chatId);
      if (!flags.leveling) {
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Fitur leveling sedang nonaktif di grup ini.',
          { quotedMessageId: ctx.id }
        );
        return;
      }
    }

    let targetUserId = ctx.senderId;
    let targetName = ctx.senderName || ctx.senderId.split('@')[0];

    const rawUser = args[0];
    if (rawUser) {
      targetUserId = rawUser.includes('@')
        ? rawUser.replace(/[@\s]/g, '').trim() + '@s.whatsapp.net'
        : rawUser.trim() + '@s.whatsapp.net';
      targetName = targetUserId.split('@')[0];
    }

    const economy = await prisma.userEconomy.findUnique({
      where: { userId: targetUserId },
    });

    const level = economy?.level ?? 1;
    const xp = economy?.xp ?? 0;
    const xpNeeded = getXpNeededForNextLevel(level);
    const balance = economy?.balance ?? 0;

    const allUsers = await prisma.userEconomy.findMany({
      orderBy: [{ level: 'desc' }, { xp: 'desc' }],
    });
    const rankGlobal = allUsers.findIndex(u => u.userId === targetUserId) + 1 || allUsers.length + 1;

    let rankGrup: number | string = 'N/A';
    const socket = (adapter as any).sock;
    if (ctx.isGroup && socket) {
      try {
        const groupMetadata = await socket.groupMetadata(ctx.chatId);
        const participantIds = groupMetadata.participants.map((p: any) => p.id);
        const groupEconomies = await prisma.userEconomy.findMany({
          where: { userId: { in: participantIds } },
          orderBy: [{ level: 'desc' }, { xp: 'desc' }]
        });
        const idx = groupEconomies.findIndex(u => u.userId === targetUserId);
        if (idx !== -1) {
          rankGrup = idx + 1;
        }
      } catch {}
    }

    const profile = await prisma.userProfile.findUnique({
      where: { userId: targetUserId }
    });
    const title = profile?.title || 'Warga Biasa';
    const badges = JSON.parse(profile?.badgesJson || '[]');
    const isUserPrem = await isPremium(targetUserId);

    const totalCommands = await prisma.usageLog.count({
      where: { userId: targetUserId }
    });

    const createdDate = profile?.createdAt || economy?.createdAt || new Date();
    const joinDate = `${createdDate.getDate()} ${createdDate.toLocaleString('id-ID', { month: 'short' })} ${createdDate.getFullYear()}`;

    let avatarBuffer: Buffer | undefined = undefined;
    if (socket) {
      try {
        const avatarUrl = await socket.profilePictureUrl(targetUserId, 'image');
        if (avatarUrl) {
          avatarBuffer = await downloadToBuffer(avatarUrl);
        }
      } catch {}
    }

    let bgBuffer: Buffer | undefined = undefined;
    if (profile?.cardBgUrl) {
      try {
        bgBuffer = await downloadToBuffer(profile.cardBgUrl);
      } catch {}
    }

    try {
      const buffer = await renderProfileCard({
        username: targetName,
        userId: targetUserId,
        level,
        xp,
        xpNeeded,
        balance,
        rankGlobal,
        rankGrup,
        title,
        badges,
        totalCommands,
        joinDate,
        isPremium: isUserPrem,
        avatarBuffer,
        bgBuffer
      });
      await adapter.sendImage(ctx.chatId, buffer, `👤 *PROFIL WARGA* 👤\n\n- Nama: *${targetName}*\n- Level: *${level}*\n- Title: *${title}*`, {
        quotedMessageId: ctx.id,
        mentions: [targetUserId]
      });
    } catch (err: any) {
      console.error('[ProfileCommand] Failed to render profile card:', err);
      const textResponse = `👤 *PROFIL WARGA* 👤\n\n👤 *Nama:* ${targetName}\n📊 *Level:* ${level} (XP: ${xp}/${xpNeeded})\n💰 *Saldo:* Rp ${balance.toLocaleString('id-ID')}\n🏆 *Rank:* Global #${rankGlobal} | Grup #${rankGrup}\n🏆 *Title:* ${title}\n💬 *Total Command:* ${totalCommands}\n📅 *Gabung:* ${joinDate}\n🛡️ *Premium:* ${isUserPrem ? 'Ya' : 'Tidak'}`;
      await adapter.sendMessage(ctx.chatId, textResponse, {
        quotedMessageId: ctx.id,
        mentions: [targetUserId]
      });
    }
  }
}

export class CardCustomizationCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const helpText = `💳 *KUSTOMISASI KARTU WARGA* 💳

Anda dapat mengubah tampilan visual kartu \`/rank\` dan \`/profile\` menggunakan command berikut:

🎨 *Background Kustom:*
└ \`/setbg <url_gambar>\`
  _(Khusus user Premium. Gunakan URL gambar publik berformat JPG/PNG)_

🏆 *Gelar/Title Kustom:*
└ \`/settitle <teks_gelar>\` atau \`/title set <teks_gelar>\`
  _(Memerlukan item 'title keren' yang dibeli dari \`/shop\` seharga Rp 500)_

🎖️ *Kustomisasi Badge:*
└ \`/setbadge <emoji1> [emoji2] [emoji3]...\`
  _(Maksimal 6 emoji badge untuk dipajang di profile card Anda)_`;

    await adapter.sendMessage(ctx.chatId, helpText, { quotedMessageId: ctx.id });
  }
}

export class AchievementCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const view = await achievementService.getUserAchievementView(ctx.senderId);
    const unlocked = view.filter(item => item.unlocked);
    const locked = view.filter(item => !item.unlocked);

    if (view.length === 0) {
      await adapter.sendMessage(ctx.chatId, 'Belum ada achievement yang tersedia.', { quotedMessageId: ctx.id });
      return;
    }

    const showAll = args[0]?.toLowerCase() === 'all' || args[0]?.toLowerCase() === 'semua';
    const visible = showAll ? view : [...unlocked, ...locked.slice(0, Math.max(0, 10 - unlocked.length))];

    let text = `*ACHIEVEMENT WARGA*\n\n`;
    text += `Progress: *${unlocked.length}/${view.length}* unlocked\n\n`;

    for (const item of visible) {
      const status = item.unlocked ? '[UNLOCKED]' : '[LOCKED]';
      const rewards = [
        item.reward.balance ? `Rp ${item.reward.balance.toLocaleString('id-ID')}` : '',
        item.reward.badge ? `Badge ${item.reward.badge}` : '',
        item.reward.title ? `Title ${item.reward.title}` : ''
      ].filter(Boolean).join(', ') || 'Tanpa reward';

      text += `${status} *${item.name}* (${item.rarity})\n`;
      text += `- ${item.description}\n`;
      text += `- Reward: ${rewards}\n\n`;
    }

    if (!showAll && visible.length < view.length) {
      text += `Ketik */achievements all* untuk melihat semua achievement.`;
    }

    await adapter.sendMessage(ctx.chatId, text.trim(), { quotedMessageId: ctx.id });
  }
}

export class SetBgCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const isUserPrem = await isPremium(ctx.senderId);
    if (!isUserPrem) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Fitur background custom kartu khusus untuk Premium User. Silakan hubungi owner untuk upgrade.', { quotedMessageId: ctx.id });
      return;
    }

    const bgUrl = args[0]?.trim();
    if (!bgUrl) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/setbg https://example.com/gambar.jpg`', { quotedMessageId: ctx.id });
      return;
    }

    try {
      const { isSafePublicUrl } = await import('../validators/url.validator.js');
      if (!isSafePublicUrl(bgUrl)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ URL tidak aman atau tidak diizinkan.', { quotedMessageId: ctx.id });
        return;
      }

      await downloadToBuffer(bgUrl);
    } catch (err: any) {
      await adapter.sendMessage(ctx.chatId, `⚠️ Gagal memuat gambar dari URL tersebut. Pastikan URL valid dan dapat diakses publik. Detail: ${err.message}`, { quotedMessageId: ctx.id });
      return;
    }

    await prisma.userProfile.upsert({
      where: { userId: ctx.senderId },
      create: { userId: ctx.senderId, cardBgUrl: bgUrl },
      update: { cardBgUrl: bgUrl }
    });

    await adapter.sendMessage(ctx.chatId, '✅ Background custom kartu Anda berhasil diperbarui!', { quotedMessageId: ctx.id });
  }
}

export class BadgeCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const availableBadges = await achievementService.getUnlockedBadgeOptions(ctx.senderId);
    const profile = await prisma.userProfile.findUnique({ where: { userId: ctx.senderId } });
    const activeBadges = parseJsonStringArray(profile?.badgesJson);
    const sub = args[0]?.toLowerCase();

    if (sub === 'set') {
      const requested = args.slice(1).join(' ').trim();
      if (!requested) {
        await adapter.sendMessage(ctx.chatId, 'Format salah. Contoh: `/badge set FIRST`', { quotedMessageId: ctx.id });
        return;
      }

      const matched = availableBadges.find(badge => badge.toLowerCase() === requested.toLowerCase());
      if (!matched) {
        await adapter.sendMessage(ctx.chatId, 'Badge belum terbuka. Cek daftar badge dengan `/badge`.', { quotedMessageId: ctx.id });
        return;
      }

      const nextBadges = [matched, ...activeBadges.filter(badge => badge !== matched)].slice(0, 6);
      await prisma.userProfile.upsert({
        where: { userId: ctx.senderId },
        create: { userId: ctx.senderId, badgesJson: JSON.stringify(nextBadges) },
        update: { badgesJson: JSON.stringify(nextBadges) }
      });

      await adapter.sendMessage(ctx.chatId, `Badge aktif berhasil dipasang: *${matched}*`, { quotedMessageId: ctx.id });
      return;
    }

    if (sub === 'clear' || sub === 'reset') {
      await prisma.userProfile.upsert({
        where: { userId: ctx.senderId },
        create: { userId: ctx.senderId, badgesJson: JSON.stringify([]) },
        update: { badgesJson: JSON.stringify([]) }
      });
      await adapter.sendMessage(ctx.chatId, 'Semua badge aktif berhasil dihapus.', { quotedMessageId: ctx.id });
      return;
    }

    const activeText = activeBadges.length > 0 ? activeBadges.join(', ') : '-';
    const availableText = availableBadges.length > 0 ? availableBadges.join(', ') : 'Belum ada badge achievement yang terbuka.';
    const text = `*BADGE WARGA*\n\nAktif: ${activeText}\nTersedia: ${availableText}\n\nGunakan: \`/badge set <nama>\``;
    await adapter.sendMessage(ctx.chatId, text, { quotedMessageId: ctx.id });
  }
}

export class SetBadgeCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (args.length === 0) {
      await prisma.userProfile.upsert({
        where: { userId: ctx.senderId },
        create: { userId: ctx.senderId, badgesJson: JSON.stringify([]) },
        update: { badgesJson: JSON.stringify([]) }
      });
      await adapter.sendMessage(ctx.chatId, '✅ Semua badge Anda berhasil dihapus.', { quotedMessageId: ctx.id });
      return;
    }

    const joined = args.join('').trim();
    const emojis = Array.from(joined).slice(0, 6);

    await prisma.userProfile.upsert({
      where: { userId: ctx.senderId },
      create: { userId: ctx.senderId, badgesJson: JSON.stringify(emojis) },
      update: { badgesJson: JSON.stringify(emojis) }
    });

    await adapter.sendMessage(ctx.chatId, `✅ Badge kartu Anda berhasil diperbarui: ${emojis.join(' ')}`, { quotedMessageId: ctx.id });
  }
}

export class TopCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (ctx.isGroup) {
      const flags = await getGroupFeatures(ctx.chatId);
      if (!flags.leveling && !flags.economy) {
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Fitur leveling/ekonomi sedang nonaktif di grup ini. Admin dapat mengaktifkannya menggunakan `/feature leveling on` atau `/feature economy on`.',
          { quotedMessageId: ctx.id }
        );
        return;
      }
    }

    const topUsers = await prisma.userEconomy.findMany({
      take: 10,
      orderBy: [
        { level: 'desc' },
        { xp: 'desc' },
      ],
    });

    if (topUsers.length === 0) {
      await adapter.sendMessage(ctx.chatId, '📭 Belum ada data papan peringkat.', { quotedMessageId: ctx.id });
      return;
    }

    let response = `🏆 *PAPAN PERINGKAT WARGA* 🏆\n\n`;
    const mentions: string[] = [];

    topUsers.forEach((user, index) => {
      const mention = `@${user.userId.split('@')[0]}`;
      mentions.push(user.userId);
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
      response += `${medal} *#${index + 1}* ${mention}\n   └ Level: ${user.level} | Saldo: Rp. ${user.balance.toLocaleString('id-ID')}\n`;
    });

    if (topUsers.length > 0 && topUsers[0].userId === ctx.senderId) {
      await achievementService.unlockAchievement(ctx.senderId, 'top_1_leaderboard', adapter, ctx.isGroup ? ctx.chatId : undefined);
    }

    try {
      const socket = (adapter as any).sock;
      
      const usersWithNames = await Promise.all(topUsers.map(async (user) => {
        let name = user.userId.split('@')[0];
        const isUserPrem = await isPremium(user.userId);
        return {
          name,
          level: user.level,
          balance: user.balance,
          userId: user.userId,
          isPremium: isUserPrem
        };
      }));

      let groupName = 'Papan Peringkat Warga';
      if (ctx.isGroup && socket) {
        try {
          const meta = await socket.groupMetadata(ctx.chatId);
          groupName = meta.subject;
        } catch {}
      }

      const buffer = await renderLeaderboardCard(usersWithNames, groupName);
      await adapter.sendImage(ctx.chatId, buffer, response, {
        quotedMessageId: ctx.id,
        mentions
      });
    } catch (err) {
      console.error('[TopCommand] Failed to render visual leaderboard:', err);
      await adapter.sendMessage(ctx.chatId, response, {
        quotedMessageId: ctx.id,
        mentions,
      });
    }
  }
}

// ==========================================
// ECONOMY EXTENSIONS: SHOP, INVENTORY, PET, DUNGEON
// ==========================================

export class ShopCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const action = args[0]?.toLowerCase();

    if (action === 'buy') {
      const itemName = args.slice(1).join(' ').trim().toLowerCase();
      if (!itemName) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/shop buy makanan pet`', { quotedMessageId: ctx.id });
        return;
      }

      // Match shop items
      const shopItems = [
        { name: 'makanan pet', price: 100, type: 'food' },
        { name: 'title keren', price: 500, type: 'title' },
        { name: 'lootbox', price: 300, type: 'lootbox' }
      ];

      const item = shopItems.find(i => i.name === itemName);
      if (!item) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Barang tidak ditemukan di toko.', { quotedMessageId: ctx.id });
        return;
      }

      const eco = await prisma.userEconomy.findUnique({ where: { userId: ctx.senderId } });
      if (!eco || eco.balance < item.price) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Saldo Anda tidak mencukupi. Harga: *Rp. ${item.price.toLocaleString('id-ID')}*`, { quotedMessageId: ctx.id });
        return;
      }

      await prisma.$transaction([
        prisma.userEconomy.update({
          where: { userId: ctx.senderId },
          data: { balance: { decrement: item.price } }
        }),
        prisma.userInventory.create({
          data: { userId: ctx.senderId, itemId: item.name, quantity: 1 }
        })
      ]);

      await adapter.sendMessage(ctx.chatId, `🛍️ *PEMBELIAN BERHASIL* 🛍️\n\nAnda berhasil membeli *${item.name}* seharga *Rp. ${item.price.toLocaleString('id-ID')}*.`, { quotedMessageId: ctx.id });
      return;
    }

    const shopText = `🛍️ *TOKO WARGA* 🛍️\n\n1. *makanan pet* - Rp. 100\n   └ Kegunaan: Memberi makan pet biar kenyang dan nambah XP.\n2. *title keren* - Rp. 500\n   └ Kegunaan: Mengubah title kostum profil.\n3. *lootbox* - Rp. 300\n   └ Kegunaan: Buka peti berhadiah acak.\n\nKetik \`/shop buy <nama_barang>\` untuk membeli!`;
    await adapter.sendMessage(ctx.chatId, shopText, { quotedMessageId: ctx.id });
  }
}

export class InventoryCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const inv = await prisma.userInventory.findMany({ where: { userId: ctx.senderId } });

    if (inv.length === 0) {
      await adapter.sendMessage(ctx.chatId, '📭 Tas/Inventory Anda kosong.', { quotedMessageId: ctx.id });
      return;
    }

    // Group items
    const counts: Record<string, number> = {};
    inv.forEach(i => {
      counts[i.itemId] = (counts[i.itemId] || 0) + i.quantity;
    });

    let text = `🎒 *INVENTORY ANDA* 🎒\n\n`;
    Object.keys(counts).forEach((key, idx) => {
      text += `${idx + 1}. *${key}* - Jumlah: *${counts[key]}*\n`;
    });

    await adapter.sendMessage(ctx.chatId, text, { quotedMessageId: ctx.id });
  }
}

export class TitleCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cleanBody = ctx.body.trim();
    const firstWord = cleanBody.split(/\s+/)[0] || '';
    const commandName = firstWord.replace(/^[^a-zA-Z0-9]+/, '').toLowerCase();
    const sub = args[0]?.toLowerCase();

    if (args.length === 0) {
      const [profile, unlockedTitles] = await Promise.all([
        prisma.userProfile.findUnique({ where: { userId: ctx.senderId } }),
        achievementService.getUnlockedTitleOptions(ctx.senderId)
      ]);

      const currentTitle = profile?.title || 'Warga Biasa';
      const titleText = unlockedTitles.length > 0 ? unlockedTitles.join(', ') : 'Belum ada title achievement yang terbuka.';
      const text = `*TITLE WARGA*\n\nAktif: *${currentTitle}*\nTersedia dari achievement: ${titleText}\n\nGunakan: \`/title set <nama>\``;
      await adapter.sendMessage(ctx.chatId, text, { quotedMessageId: ctx.id });
      return;
    }

    let val = '';
    if (commandName === 'settitle') {
      val = args.join(' ').trim();
    } else {
      val = args.slice(1).join(' ').trim();
      if (sub !== 'set') {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/title set Warga Kece` atau `/settitle Warga Kece`', { quotedMessageId: ctx.id });
        return;
      }
    }

    if (!val) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Tentukan gelar/title Anda.', { quotedMessageId: ctx.id });
      return;
    }

    const unlockedTitles = await achievementService.getUnlockedTitleOptions(ctx.senderId);
    const matchedAchievementTitle = unlockedTitles.find(title => title.toLowerCase() === val.toLowerCase());

    if (matchedAchievementTitle) {
      val = matchedAchievementTitle;
    } else {
      // Check if user has a custom title item in inventory
      const inventory = await prisma.userInventory.findFirst({
        where: { userId: ctx.senderId, itemId: 'title keren' }
      });

      if (!inventory) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Title belum terbuka dari achievement. Untuk title custom, beli item "title keren" terlebih dahulu di /shop.', { quotedMessageId: ctx.id });
        return;
      }

      // Consume item for custom title only
      await prisma.userInventory.delete({ where: { id: inventory.id } });
    }

    // Save custom title in UserProfile
    await prisma.userProfile.upsert({
      where: { userId: ctx.senderId },
      create: { userId: ctx.senderId, title: val },
      update: { title: val }
    });

    await adapter.sendMessage(ctx.chatId, `🏆 Title profil Anda berhasil diubah menjadi: *${val}*`, { quotedMessageId: ctx.id });
  }
}

export class PetCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const action = args[0]?.toLowerCase();

    if (action === 'adopt') {
      const name = args.slice(1).join(' ').trim() || 'Kocheng';
      try {
        await prisma.pet.create({
          data: { userId: ctx.senderId, name, type: 'Kucing' }
        });
        await adapter.sendMessage(ctx.chatId, `🐱 *PET ADOPTED* 🐱\n\nSelamat! Kamu mengadopsi pet bernama *${name}*!`, { quotedMessageId: ctx.id });
      } catch {
        await adapter.sendMessage(ctx.chatId, '⚠️ Kamu sudah memiliki pet.', { quotedMessageId: ctx.id });
      }
      return;
    }

    const pet = await prisma.pet.findUnique({ where: { userId: ctx.senderId } });
    if (!pet) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Kamu belum memiliki pet. Ketik `/pet adopt <nama>` untuk mengadopsi pet baru.', { quotedMessageId: ctx.id });
      return;
    }

    if (action === 'rename') {
      const newName = args.slice(1).join(' ').trim();
      if (!newName) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/pet rename Garong`', { quotedMessageId: ctx.id });
        return;
      }
      await prisma.pet.update({
        where: { userId: ctx.senderId },
        data: { name: newName }
      });
      await adapter.sendMessage(ctx.chatId, `🐱 Nama pet berhasil diubah menjadi: *${newName}*`, { quotedMessageId: ctx.id });
    }

    else if (action === 'feed') {
      // Find food in inventory
      const food = await prisma.userInventory.findFirst({
        where: { userId: ctx.senderId, itemId: 'makanan pet' }
      });

      if (!food) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Makanan pet kosong. Beli di `/shop` terlebih dahulu.', { quotedMessageId: ctx.id });
        return;
      }

      await prisma.userInventory.delete({ where: { id: food.id } });
      
      const newXp = pet.xp + 20;
      let newLevel = pet.level;
      if (newXp >= pet.level * 100) {
        newLevel++;
      }

      await prisma.pet.update({
        where: { userId: ctx.senderId },
        data: { hunger: 100, xp: newXp % (pet.level * 100), level: newLevel }
      });

      await adapter.sendMessage(ctx.chatId, `🍖 *NYAM NYAM* 🍖\n\nPet *${pet.name}* kenyang!\nLevel: *${newLevel}* | XP: *${newXp % (pet.level * 100)}*`, { quotedMessageId: ctx.id });
    }

    else if (action === 'battle') {
      const rawUser = args[1];
      if (!rawUser) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/pet battle @user`', { quotedMessageId: ctx.id });
        return;
      }

      const targetJid = rawUser.includes('@') ? rawUser.replace('@', '').trim() + '@s.whatsapp.net' : rawUser.trim();
      const enemyPet = await prisma.pet.findUnique({ where: { userId: targetJid } });

      if (!enemyPet) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Lawan belum memiliki pet.', { quotedMessageId: ctx.id });
        return;
      }

      const p1Power = pet.level * 10 + Math.floor(Math.random() * 50);
      const p2Power = enemyPet.level * 10 + Math.floor(Math.random() * 50);

      const win = p1Power > p2Power;
      const reward = win ? 50 : 10;

      await prisma.userEconomy.upsert({
        where: { userId: ctx.senderId },
        create: { userId: ctx.senderId, balance: reward },
        update: { balance: { increment: reward } }
      });

      const response = `⚔️ *PET BATTLE* ⚔️\n\n*${pet.name}* (Lvl ${pet.level}) VS *${enemyPet.name}* (Lvl ${enemyPet.level})\n` +
        `Power: *${p1Power}* vs *${p2Power}*\n\n` +
        (win ? `🏆 *${pet.name} MENANG!* Berhasil membawa pulang *Rp. ${reward}*!` : `😢 *${pet.name} kalah.* Dapatkan reward hiburan *Rp. ${reward}*`);

      await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
    }

    else if (action === 'train') {
      if (ctx.isGroup) {
        const flags = await getGroupFeatures(ctx.chatId);
        if (!flags.rpg && !flags.economy) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Fitur RPG/ekonomi sedang nonaktif di grup ini.', { quotedMessageId: ctx.id });
          return;
        }
      }

      let metadata: any = {};
      try {
        metadata = JSON.parse(pet.metadataJson || '{}');
      } catch {}

      const lastTrain = metadata.lastTrain ? new Date(metadata.lastTrain).getTime() : 0;
      const cd = 5 * 60 * 1000; // 5 minutes
      if (Date.now() - lastTrain < cd) {
        const remaining = Math.ceil((cd - (Date.now() - lastTrain)) / 1000);
        await adapter.sendMessage(ctx.chatId, `⏳ Pet Anda lelah. Silakan latih kembali dalam *${remaining} detik*.`, { quotedMessageId: ctx.id });
        return;
      }

      if (pet.hunger < 15) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Pet *${pet.name}* terlalu lapar untuk berlatih! Beri makan terlebih dahulu dengan \`/pet feed\`.`, { quotedMessageId: ctx.id });
        return;
      }

      const cost = 50;
      const eco = await prisma.userEconomy.findUnique({ where: { userId: ctx.senderId } });
      if (!eco || eco.balance < cost) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Anda membutuhkan *Rp. ${cost}* tunai untuk biaya pelatih pet.`, { quotedMessageId: ctx.id });
        return;
      }

      const xpGain = 30;
      const newXp = pet.xp + xpGain;
      let newLevel = pet.level;
      const xpNeeded = pet.level * 100;
      if (newXp >= xpNeeded) {
        newLevel++;
      }
      metadata.lastTrain = new Date().toISOString();

      await prisma.$transaction([
        prisma.userEconomy.update({
          where: { userId: ctx.senderId },
          data: { balance: { decrement: cost } }
        }),
        prisma.pet.update({
          where: { userId: ctx.senderId },
          data: {
            hunger: Math.max(0, pet.hunger - 15),
            xp: newXp % xpNeeded,
            level: newLevel,
            metadataJson: JSON.stringify(metadata)
          }
        })
      ]);

      await logTransaction(ctx.senderId, ctx.isGroup ? ctx.chatId : null, 'pet_train', -cost, { petName: pet.name, xpGain });

      let resp = `⚔️ *PET TRAINING* ⚔️\n\nPet *${pet.name}* telah selesai berlatih!\n💵 Biaya: *Rp. ${cost}*\n✨ *+${xpGain} XP* | 🍖 Hunger: *-15%* (Sisa: *${Math.max(0, pet.hunger - 15)}%*)\nLevel: *${newLevel}* | XP: *${newXp % xpNeeded} / ${newLevel * 100}*`;
      if (newLevel > pet.level) {
        resp += `\n\n🎉 *PET LEVEL UP!* *${pet.name}* naik ke *Level ${newLevel}*!`;
      }

      await adapter.sendMessage(ctx.chatId, resp, { quotedMessageId: ctx.id });
    }

    else if (action === 'evolve') {
      if (ctx.isGroup) {
        const flags = await getGroupFeatures(ctx.chatId);
        if (!flags.rpg && !flags.economy) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Fitur RPG/ekonomi sedang nonaktif di grup ini.', { quotedMessageId: ctx.id });
          return;
        }
      }

      if (pet.level < 10) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Pet Anda harus mencapai *Level 10* sebelum dapat dievolusikan. Level saat ini: *${pet.level}*.`, { quotedMessageId: ctx.id });
        return;
      }

      const cost = 1000;
      const eco = await prisma.userEconomy.findUnique({ where: { userId: ctx.senderId } });
      if (!eco || eco.balance < cost) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Anda membutuhkan *Rp. ${cost.toLocaleString('id-ID')}* tunai untuk mengevolusikan pet Anda.`, { quotedMessageId: ctx.id });
        return;
      }

      const evolutionMap: Record<string, string> = {
        'Kucing': 'Macan',
        'Macan': 'Singa',
        'Anjing': 'Serigala',
        'Serigala': 'Cerberus',
        'Burung': 'Elang',
        'Elang': 'Phoenix'
      };

      const currentType = pet.type;
      const nextType = evolutionMap[currentType] || `Mega ${currentType}`;

      await prisma.$transaction([
        prisma.userEconomy.update({
          where: { userId: ctx.senderId },
          data: { balance: { decrement: cost } }
        }),
        prisma.pet.update({
          where: { userId: ctx.senderId },
          data: { type: nextType }
        })
      ]);

      await logTransaction(ctx.senderId, ctx.isGroup ? ctx.chatId : null, 'pet_evolve', -cost, { petName: pet.name, from: currentType, to: nextType });

      const resp = `⚡ *PET EVOLUTION* ⚡\n\nPet *${pet.name}* telah berevolusi!\n*${currentType}* ➔ *${nextType}* 🌟\n\n💵 Biaya: *Rp. ${cost.toLocaleString('id-ID')}*`;
      await adapter.sendMessage(ctx.chatId, resp, { quotedMessageId: ctx.id });
    }

    else {
      // Pet status
      const statusText = `🐱 *PET PROFILE: ${pet.name.toUpperCase()}* 🐱\n\n` +
        `- Jenis: *${pet.type}*\n` +
        `- Level: *${pet.level}*\n` +
        `- XP: *${pet.xp} / ${pet.level * 100}*\n` +
        `- Kelaparan: *${pet.hunger}%*\n\n` +
        `💡 _Gunakan \`/pet train\` untuk melatih pet (+XP, CD 5m, Rp. 50).\n` +
        `Gunakan \`/pet evolve\` untuk mengevolusikan pet saat Level 10 (Rp. 1.000)._`;
      await adapter.sendMessage(ctx.chatId, statusText, { quotedMessageId: ctx.id });
    }
  }
}

export class DungeonCommand implements Command {
  private cooldowns = new Map<string, number>();

  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const lastRun = this.cooldowns.get(ctx.senderId) || 0;
    const cooldownMs = 60 * 1000; // 1 min dungeon cd
    if (Date.now() - lastRun < cooldownMs) {
      const remainingSecs = Math.ceil((cooldownMs - (Date.now() - lastRun)) / 1000);
      await adapter.sendMessage(ctx.chatId, `⏳ Dungeon sedang cooldown. Coba lagi dalam *${remainingSecs} detik*.`, { quotedMessageId: ctx.id });
      return;
    }

    this.cooldowns.set(ctx.senderId, Date.now());

    await adapter.sendMessage(ctx.chatId, '⚔️ *MASUK RPG DUNGEON* ⚔️\n\nMenjelajahi lorong dungeon gelap...', { quotedMessageId: ctx.id });

    setTimeout(async () => {
      const isWin = Math.random() > 0.4;
      const gold = isWin ? Math.floor(Math.random() * 150) + 50 : 15;
      const xp = isWin ? 50 : 10;

      await prisma.userEconomy.upsert({
        where: { userId: ctx.senderId },
        create: { userId: ctx.senderId, balance: gold, xp },
        update: { balance: { increment: gold }, xp: { increment: xp } }
      });

      const response = isWin 
        ? `🏆 *DUNGEON CLEAR* 🏆\n\nSelamat! Kamu berhasil menaklukkan dungeon dan membawa pulang:\n💵 *+Rp. ${gold}*\n✨ *+${xp} XP*`
        : `😢 *DUNGEON FAILED* 😢\n\nKamu dikalahkan monster dungeon. Pulang dengan luka dan hanya membawa:\n💵 *+Rp. ${gold}*\n✨ *+${xp} XP*`;

      await adapter.sendMessage(ctx.chatId, response);
    }, 3000);
  }
}

// Transaction Logging Helper
async function logTransaction(userId: string, groupId: string | null, type: string, amount: number, metadata = {}) {
  await prisma.economyTransaction.create({
    data: {
      userId,
      groupId,
      type,
      amount,
      metadataJson: JSON.stringify(metadata)
    }
  }).catch(err => console.error('[Transaction Log Failed]', err));
}

// Beg Cooldown Map
const begCooldowns = new Map<string, number>();

export class WorkCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (ctx.isGroup) {
      const flags = await getGroupFeatures(ctx.chatId);
      if (!flags.economy) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur ekonomi sedang nonaktif di grup ini.', { quotedMessageId: ctx.id });
        return;
      }
    }

    const now = new Date();
    const eco = await prisma.userEconomy.findUnique({ where: { userId: ctx.senderId } });
    if (eco && eco.lastWork) {
      const diff = now.getTime() - eco.lastWork.getTime();
      const cd = 5 * 60 * 1000;
      if (diff < cd) {
        const remaining = Math.ceil((cd - diff) / 1000);
        await adapter.sendMessage(ctx.chatId, `⏳ Anda lelah. Silakan bekerja kembali dalam *${remaining} detik*.`, { quotedMessageId: ctx.id });
        return;
      }
    }

    const reward = Math.floor(Math.random() * 201) + 100;
    const xp = Math.floor(Math.random() * 21) + 10;

    await prisma.userEconomy.upsert({
      where: { userId: ctx.senderId },
      create: { userId: ctx.senderId, balance: reward, xp, lastWork: now },
      update: { balance: { increment: reward }, xp: { increment: xp }, lastWork: now }
    });

    const { newLevel } = await addXpAndBalance(ctx.senderId, 0, 0);
    await logTransaction(ctx.senderId, ctx.isGroup ? ctx.chatId : null, 'work', reward, { xp });

    const jobs = ['Karyawan Toko', 'Supir Angkot', 'Kuli Bangunan', 'Kurir Paket', 'Ojek Online'];
    const job = jobs[Math.floor(Math.random() * jobs.length)];

    let resp = `💼 *PEKERJAAN SELESAI* 💼\n\nAnda bekerja sebagai *${job}* dan mendapatkan:\n💵 *+Rp. ${reward.toLocaleString('id-ID')}*\n✨ *+${xp} XP*`;
    if (newLevel) {
      resp += `\n\n🎉 *LEVEL UP!* Kamu naik ke *Level ${newLevel}*!`;
    }

    await adapter.sendMessage(ctx.chatId, resp, { quotedMessageId: ctx.id });
  }
}

export class MiningCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (ctx.isGroup) {
      const flags = await getGroupFeatures(ctx.chatId);
      if (!flags.economy) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur ekonomi sedang nonaktif di grup ini.', { quotedMessageId: ctx.id });
        return;
      }
    }

    const now = new Date();
    const eco = await prisma.userEconomy.findUnique({ where: { userId: ctx.senderId } });
    if (eco && eco.lastMining) {
      const diff = now.getTime() - eco.lastMining.getTime();
      const cd = 10 * 60 * 1000;
      if (diff < cd) {
        const remaining = Math.ceil((cd - diff) / 1000);
        await adapter.sendMessage(ctx.chatId, `⏳ Tambang sedang runtuh/panas. Silakan menambang kembali dalam *${remaining} detik*.`, { quotedMessageId: ctx.id });
        return;
      }
    }

    const reward = Math.floor(Math.random() * 301) + 200;
    const xp = Math.floor(Math.random() * 31) + 20;

    await prisma.userEconomy.upsert({
      where: { userId: ctx.senderId },
      create: { userId: ctx.senderId, balance: reward, xp, lastMining: now },
      update: { balance: { increment: reward }, xp: { increment: xp }, lastMining: now }
    });

    const { newLevel } = await addXpAndBalance(ctx.senderId, 0, 0);
    await logTransaction(ctx.senderId, ctx.isGroup ? ctx.chatId : null, 'mining', reward, { xp });

    let dropMsg = '';
    const rand = Math.random();
    let itemId = '';
    if (rand < 0.1) {
      itemId = 'emas';
      dropMsg = '\n✨ *Drop Berharga:* 🌟 Anda menemukan bijih *Emas*!';
    } else if (rand < 0.3) {
      itemId = 'besi';
      dropMsg = '\n✨ *Drop Berharga:* ⚙️ Anda menemukan bijih *Besi*!';
    } else if (rand < 0.7) {
      itemId = 'batu';
      dropMsg = '\n✨ *Drop Berharga:* 🪨 Anda menemukan *Batu*!';
    }

    if (itemId) {
      await prisma.userInventory.create({
        data: { userId: ctx.senderId, itemId, quantity: 1 }
      });
    }

    let resp = `⛏️ *PENAMBANGAN SELESAI* ⛏️\n\nAnda menambang di lorong gelap gua dan mendapatkan:\n💵 *+Rp. ${reward.toLocaleString('id-ID')}*\n✨ *+${xp} XP*${dropMsg}`;
    if (newLevel) {
      resp += `\n\n🎉 *LEVEL UP!* Kamu naik ke *Level ${newLevel}*!`;
    }

    await adapter.sendMessage(ctx.chatId, resp, { quotedMessageId: ctx.id });
  }
}

export class FishingCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (ctx.isGroup) {
      const flags = await getGroupFeatures(ctx.chatId);
      if (!flags.economy) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur ekonomi sedang nonaktif di grup ini.', { quotedMessageId: ctx.id });
        return;
      }
    }

    const now = new Date();
    const eco = await prisma.userEconomy.findUnique({ where: { userId: ctx.senderId } });
    if (eco && eco.lastFishing) {
      const diff = now.getTime() - eco.lastFishing.getTime();
      const cd = 10 * 60 * 1000;
      if (diff < cd) {
        const remaining = Math.ceil((cd - diff) / 1000);
        await adapter.sendMessage(ctx.chatId, `⏳ Umpan Anda belum siap. Silakan memancing kembali dalam *${remaining} detik*.`, { quotedMessageId: ctx.id });
        return;
      }
    }

    const reward = Math.floor(Math.random() * 251) + 150;
    const xp = Math.floor(Math.random() * 26) + 15;

    await prisma.userEconomy.upsert({
      where: { userId: ctx.senderId },
      create: { userId: ctx.senderId, balance: reward, xp, lastFishing: now },
      update: { balance: { increment: reward }, xp: { increment: xp }, lastFishing: now }
    });

    const { newLevel } = await addXpAndBalance(ctx.senderId, 0, 0);
    await logTransaction(ctx.senderId, ctx.isGroup ? ctx.chatId : null, 'fishing', reward, { xp });

    let dropMsg = '';
    const rand = Math.random();
    let itemId = '';
    if (rand < 0.5) {
      itemId = 'ikan';
      dropMsg = '\n🐟 *Hasil Pancingan:* Anda mendapatkan *Ikan segar*!';
    } else if (rand < 0.7) {
      itemId = 'sepatu bot';
      dropMsg = '\n🥾 *Hasil Pancingan:* Anda mendapatkan *Sepatu Bot Bekas* (sampah)!';
    }

    if (itemId) {
      await prisma.userInventory.create({
        data: { userId: ctx.senderId, itemId, quantity: 1 }
      });
    }

    let resp = `🎣 *PEMANCINGAN SELESAI* 🎣\n\nAnda memancing di empang warga dan mendapatkan:\n💵 *+Rp. ${reward.toLocaleString('id-ID')}*\n✨ *+${xp} XP*${dropMsg}`;
    if (newLevel) {
      resp += `\n\n🎉 *LEVEL UP!* Kamu naik ke *Level ${newLevel}*!`;
    }

    await adapter.sendMessage(ctx.chatId, resp, { quotedMessageId: ctx.id });
  }
}

export class CrimeCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (ctx.isGroup) {
      const flags = await getGroupFeatures(ctx.chatId);
      if (!flags.economy) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur ekonomi sedang nonaktif di grup ini.', { quotedMessageId: ctx.id });
        return;
      }
      if (flags.crime === false) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur kejahatan (crime) sedang dinonaktifkan di grup ini.', { quotedMessageId: ctx.id });
        return;
      }
    }

    const now = new Date();
    const eco = await prisma.userEconomy.findUnique({ where: { userId: ctx.senderId } });
    if (eco && eco.lastCrime) {
      const diff = now.getTime() - eco.lastCrime.getTime();
      const cd = 15 * 60 * 1000;
      if (diff < cd) {
        const remaining = Math.ceil((cd - diff) / 1000);
        await adapter.sendMessage(ctx.chatId, `⏳ Polisi sedang berpatroli. Silakan beraksi kembali dalam *${remaining} detik*.`, { quotedMessageId: ctx.id });
        return;
      }
    }

    const success = Math.random() > 0.4;
    if (success) {
      const reward = Math.floor(Math.random() * 501) + 300;
      const xp = Math.floor(Math.random() * 51) + 30;

      await prisma.userEconomy.upsert({
        where: { userId: ctx.senderId },
        create: { userId: ctx.senderId, balance: reward, xp, lastCrime: now },
        update: { balance: { increment: reward }, xp: { increment: xp }, lastCrime: now }
      });

      const { newLevel } = await addXpAndBalance(ctx.senderId, 0, 0);
      await logTransaction(ctx.senderId, ctx.isGroup ? ctx.chatId : null, 'crime_success', reward, { xp });

      const crimes = ['Merampok Minimarket', 'Mencuri Jemuran', 'Menjambret Tas', 'Membobol Kos-kosan'];
      const crime = crimes[Math.floor(Math.random() * crimes.length)];

      let resp = `🔫 *KEJAHATAN BERHASIL* 🔫\n\nAnda berhasil melakukan *${crime}* dan meraup:\n💵 *+Rp. ${reward.toLocaleString('id-ID')}*\n✨ *+${xp} XP*`;
      if (newLevel) {
        resp += `\n\n🎉 *LEVEL UP!* Kamu naik ke *Level ${newLevel}*!`;
      }
      await adapter.sendMessage(ctx.chatId, resp, { quotedMessageId: ctx.id });
    } else {
      const fine = Math.floor(Math.random() * 201) + 200;
      const currentBal = eco?.balance ?? 0;
      const finalFine = Math.min(fine, currentBal);

      await prisma.userEconomy.upsert({
        where: { userId: ctx.senderId },
        create: { userId: ctx.senderId, balance: 0, lastCrime: now },
        update: { balance: { decrement: finalFine }, lastCrime: now }
      });

      await logTransaction(ctx.senderId, ctx.isGroup ? ctx.chatId : null, 'crime_failed', -finalFine);

      await adapter.sendMessage(ctx.chatId, `👮 *KEJAHATAN GAGAL* 👮\n\nAnda tertangkap oleh Satpol PP saat mencoba beraksi!\n💸 Denda/Kerugian: *Rp. ${finalFine.toLocaleString('id-ID')}*`, { quotedMessageId: ctx.id });
    }
  }
}

export class BegCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (ctx.isGroup) {
      const flags = await getGroupFeatures(ctx.chatId);
      if (!flags.economy) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur ekonomi sedang nonaktif di grup ini.', { quotedMessageId: ctx.id });
        return;
      }
    }

    const lastBeg = begCooldowns.get(ctx.senderId) || 0;
    const cd = 2 * 60 * 1000;
    if (Date.now() - lastBeg < cd) {
      const remaining = Math.ceil((cd - (Date.now() - lastBeg)) / 1000);
      await adapter.sendMessage(ctx.chatId, `⏳ Orang-orang bosan melihat Anda. Mengemis kembali dalam *${remaining} detik*.`, { quotedMessageId: ctx.id });
      return;
    }

    begCooldowns.set(ctx.senderId, Date.now());

    const reward = Math.floor(Math.random() * 61) + 20;
    const xp = Math.floor(Math.random() * 11) + 5;

    await prisma.userEconomy.upsert({
      where: { userId: ctx.senderId },
      create: { userId: ctx.senderId, balance: reward, xp },
      update: { balance: { increment: reward }, xp: { increment: xp } }
    });

    const { newLevel } = await addXpAndBalance(ctx.senderId, 0, 0);
    await logTransaction(ctx.senderId, ctx.isGroup ? ctx.chatId : null, 'beg', reward, { xp });

    const responses = [
      `🥺 Seseorang merasa kasihan dan memberi Anda *Rp. ${reward}*.`,
      `🥺 Anda memohon di pinggir jalan dan mendapatkan recehan *Rp. ${reward}*.`,
      `🥺 Kakek baik hati melempar koin senilai *Rp. ${reward}* ke mangkok Anda.`
    ];
    const rText = responses[Math.floor(Math.random() * responses.length)];

    let resp = `🙏 *MENGEMIS* 🙏\n\n${rText}\n✨ *+${xp} XP*`;
    if (newLevel) {
      resp += `\n\n🎉 *LEVEL UP!* Kamu naik ke *Level ${newLevel}*!`;
    }

    await adapter.sendMessage(ctx.chatId, resp, { quotedMessageId: ctx.id });
  }
}

export class BankCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (ctx.isGroup) {
      const flags = await getGroupFeatures(ctx.chatId);
      if (!flags.economy) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur ekonomi sedang nonaktif di grup ini.', { quotedMessageId: ctx.id });
        return;
      }
    }

    const eco = await prisma.userEconomy.findUnique({ where: { userId: ctx.senderId } });
    const cash = eco?.balance ?? 0;
    const bank = eco?.bank ?? 0;

    const mention = `@${ctx.senderId.split('@')[0]}`;
    const resp = `🏦 *BANK CENTRAL WARGA* 🏦\n\n👤 *Nasabah:* ${mention}\nDompet (Cash): *Rp. ${cash.toLocaleString('id-ID')}*\nRekening (Bank): *Rp. ${bank.toLocaleString('id-ID')}*\n\n💡 _Gunakan \`/deposit <jumlah>\` untuk menabung dan \`/withdraw <jumlah>\` untuk menarik uang._`;

    await adapter.sendMessage(ctx.chatId, resp, { quotedMessageId: ctx.id, mentions: [ctx.senderId] });
  }
}

export class DepositCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (ctx.isGroup) {
      const flags = await getGroupFeatures(ctx.chatId);
      if (!flags.economy) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur ekonomi sedang nonaktif di grup ini.', { quotedMessageId: ctx.id });
        return;
      }
    }

    const amountStr = args[0]?.trim();
    if (!amountStr) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/deposit 500` atau `/deposit all`', { quotedMessageId: ctx.id });
      return;
    }

    const eco = await prisma.userEconomy.findUnique({ where: { userId: ctx.senderId } });
    if (!eco || eco.balance <= 0) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Saldo dompet Anda kosong.', { quotedMessageId: ctx.id });
      return;
    }

    let amount = 0;
    if (amountStr.toLowerCase() === 'all') {
      amount = eco.balance;
    } else {
      amount = parseInt(amountStr, 10);
    }

    if (isNaN(amount) || amount <= 0) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Jumlah deposit tidak valid.', { quotedMessageId: ctx.id });
      return;
    }

    if (amount > eco.balance) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Uang di dompet Anda tidak cukup.', { quotedMessageId: ctx.id });
      return;
    }

    await prisma.$transaction([
      prisma.userEconomy.update({
        where: { userId: ctx.senderId },
        data: { balance: { decrement: amount }, bank: { increment: amount } }
      })
    ]);

    await logTransaction(ctx.senderId, ctx.isGroup ? ctx.chatId : null, 'deposit', amount);

    await adapter.sendMessage(ctx.chatId, `✅ Berhasil menabung sebesar *Rp. ${amount.toLocaleString('id-ID')}* ke bank.`, { quotedMessageId: ctx.id });
  }
}

export class WithdrawCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (ctx.isGroup) {
      const flags = await getGroupFeatures(ctx.chatId);
      if (!flags.economy) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur ekonomi sedang nonaktif di grup ini.', { quotedMessageId: ctx.id });
        return;
      }
    }

    const amountStr = args[0]?.trim();
    if (!amountStr) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/withdraw 500` atau `/withdraw all`', { quotedMessageId: ctx.id });
      return;
    }

    const eco = await prisma.userEconomy.findUnique({ where: { userId: ctx.senderId } });
    if (!eco || eco.bank <= 0) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Rekening bank Anda kosong.', { quotedMessageId: ctx.id });
      return;
    }

    let amount = 0;
    if (amountStr.toLowerCase() === 'all') {
      amount = eco.bank;
    } else {
      amount = parseInt(amountStr, 10);
    }

    if (isNaN(amount) || amount <= 0) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Jumlah penarikan tidak valid.', { quotedMessageId: ctx.id });
      return;
    }

    if (amount > eco.bank) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Saldo bank Anda tidak mencukupi.', { quotedMessageId: ctx.id });
      return;
    }

    await prisma.$transaction([
      prisma.userEconomy.update({
        where: { userId: ctx.senderId },
        data: { balance: { increment: amount }, bank: { decrement: amount } }
      })
    ]);

    await logTransaction(ctx.senderId, ctx.isGroup ? ctx.chatId : null, 'withdraw', amount);

    await adapter.sendMessage(ctx.chatId, `✅ Berhasil menarik sebesar *Rp. ${amount.toLocaleString('id-ID')}* dari rekening bank ke dompet Anda.`, { quotedMessageId: ctx.id });
  }
}

export class RobCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (ctx.isGroup) {
      const flags = await getGroupFeatures(ctx.chatId);
      if (!flags.economy) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur ekonomi sedang nonaktif di grup ini.', { quotedMessageId: ctx.id });
        return;
      }
      if (flags.rob === false) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur mencuri (rob) sedang dinonaktifkan di grup ini.', { quotedMessageId: ctx.id });
        return;
      }
    }

    const rawUser = args[0]?.trim();
    if (!rawUser) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/rob @user`', { quotedMessageId: ctx.id });
      return;
    }

    const targetUserId = rawUser.includes('@') ? rawUser.replace('@', '').trim() + '@s.whatsapp.net' : rawUser.trim();
    if (targetUserId === ctx.senderId) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Anda tidak bisa merampok diri sendiri.', { quotedMessageId: ctx.id });
      return;
    }

    const now = new Date();
    const ecoSender = await prisma.userEconomy.findUnique({ where: { userId: ctx.senderId } });
    if (ecoSender && ecoSender.lastRob) {
      const diff = now.getTime() - ecoSender.lastRob.getTime();
      const cd = 20 * 60 * 1000;
      if (diff < cd) {
        const remaining = Math.ceil((cd - diff) / 1000);
        await adapter.sendMessage(ctx.chatId, `⏳ Anda bersembunyi dari buronan. Silakan merampok kembali dalam *${remaining} detik*.`, { quotedMessageId: ctx.id });
        return;
      }
    }

    if (!ecoSender || ecoSender.balance < 300) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Anda memerlukan minimal *Rp. 300* tunai di dompet sebagai modal denda jika tertangkap.', { quotedMessageId: ctx.id });
      return;
    }

    const ecoTarget = await prisma.userEconomy.findUnique({ where: { userId: targetUserId } });
    if (!ecoTarget || ecoTarget.balance < 200) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Target terlalu miskin (tunai kurang dari Rp. 200).', { quotedMessageId: ctx.id });
      return;
    }

    const success = Math.random() > 0.5;
    if (success) {
      const maxSteal = Math.min(1000, ecoTarget.balance);
      const minSteal = Math.min(200, ecoTarget.balance);
      const stolen = Math.floor(Math.random() * (maxSteal - minSteal + 1)) + minSteal;

      await prisma.$transaction([
        prisma.userEconomy.update({
          where: { userId: ctx.senderId },
          data: { balance: { increment: stolen }, lastRob: now }
        }),
        prisma.userEconomy.update({
          where: { userId: targetUserId },
          data: { balance: { decrement: stolen } }
        })
      ]);

      await logTransaction(ctx.senderId, ctx.isGroup ? ctx.chatId : null, 'rob_success', stolen, { target: targetUserId });
      await logTransaction(targetUserId, ctx.isGroup ? ctx.chatId : null, 'rob_victim', -stolen, { robber: ctx.senderId });

      const mentionTarget = `@${targetUserId.split('@')[0]}`;
      await adapter.sendMessage(ctx.chatId, `🥷 *PERAMPOKAN BERHASIL* 🥷\n\nAnda berhasil merampok ${mentionTarget} dan menggondol *Rp. ${stolen.toLocaleString('id-ID')}*!`, {
        quotedMessageId: ctx.id,
        mentions: [targetUserId]
      });
    } else {
      const fine = 300;
      await prisma.$transaction([
        prisma.userEconomy.update({
          where: { userId: ctx.senderId },
          data: { balance: { decrement: fine }, lastRob: now }
        }),
        prisma.userEconomy.update({
          where: { userId: targetUserId },
          data: { balance: { increment: fine } }
        })
      ]);

      await logTransaction(ctx.senderId, ctx.isGroup ? ctx.chatId : null, 'rob_failed_fine', -fine, { target: targetUserId });
      await logTransaction(targetUserId, ctx.isGroup ? ctx.chatId : null, 'rob_victim_recompense', fine, { robber: ctx.senderId });

      const mentionTarget = `@${targetUserId.split('@')[0]}`;
      await adapter.sendMessage(ctx.chatId, `👮 *PERAMPOKAN GAGAL* 👮\n\nAnda ketahuan saat merampok ${mentionTarget}!\nAnda dipaksa membayar danti rugi sebesar *Rp. 300* ke target.`, {
        quotedMessageId: ctx.id,
        mentions: [targetUserId]
      });
    }
  }
}

export class SlotCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (ctx.isGroup) {
      const flags = await getGroupFeatures(ctx.chatId);
      if (!flags.economy) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur ekonomi sedang nonaktif di grup ini.', { quotedMessageId: ctx.id });
        return;
      }
    }

    const amountStr = args[0]?.trim();
    if (!amountStr) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/slot 500`', { quotedMessageId: ctx.id });
      return;
    }

    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount <= 0) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Jumlah taruhan tidak valid.', { quotedMessageId: ctx.id });
      return;
    }

    const eco = await prisma.userEconomy.findUnique({ where: { userId: ctx.senderId } });
    if (!eco || eco.balance < amount) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Uang di dompet Anda tidak cukup.', { quotedMessageId: ctx.id });
      return;
    }

    const emojis = ['🍒', '🍋', '🍇', '💎', '🔔', '7️⃣'];
    const r1 = emojis[Math.floor(Math.random() * emojis.length)];
    const r2 = emojis[Math.floor(Math.random() * emojis.length)];
    const r3 = emojis[Math.floor(Math.random() * emojis.length)];

    let win = false;
    let multiplier = 0;
    let title = '';

    if (r1 === r2 && r2 === r3) {
      win = true;
      multiplier = r1 === '7️⃣' ? 5 : r1 === '💎' ? 4 : 3;
      title = 'JACKPOT! 🏆';
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
      win = true;
      multiplier = 1.5;
      title = 'DOUBLE! 🎉';
    }

    const board = `[ ${r1} | ${r2} | ${r3} ]`;

    if (win) {
      const reward = Math.floor(amount * multiplier);
      const netWin = reward - amount;

      await prisma.userEconomy.update({
        where: { userId: ctx.senderId },
        data: { balance: { increment: netWin } }
      });

      await logTransaction(ctx.senderId, ctx.isGroup ? ctx.chatId : null, 'slot_win', netWin, { bet: amount });

      await adapter.sendMessage(ctx.chatId, `🎰 *MESIN SLOT* 🎰\n\n${board}\n\n*${title}*\nAnda menang taruhan dan mendapatkan: *Rp. ${reward.toLocaleString('id-ID')}* (x${multiplier})`, { quotedMessageId: ctx.id });
    } else {
      await prisma.userEconomy.update({
        where: { userId: ctx.senderId },
        data: { balance: { decrement: amount } }
      });

      await logTransaction(ctx.senderId, ctx.isGroup ? ctx.chatId : null, 'slot_lose', -amount, { bet: amount });

      await adapter.sendMessage(ctx.chatId, `🎰 *MESIN SLOT* 🎰\n\n${board}\n\n😢 *ANDA KALAH!*\nAnda kehilangan taruhan sebesar *Rp. ${amount.toLocaleString('id-ID')}*.`, { quotedMessageId: ctx.id });
    }
  }
}

export class CoinflipCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (ctx.isGroup) {
      const flags = await getGroupFeatures(ctx.chatId);
      if (!flags.economy) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur ekonomi sedang nonaktif di grup ini.', { quotedMessageId: ctx.id });
        return;
      }
    }

    const amountStr = args[0]?.trim();
    const choiceStr = args[1]?.toLowerCase().trim();

    if (!amountStr || !choiceStr) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/coinflip 500 h` (h = head, t = tail)', { quotedMessageId: ctx.id });
      return;
    }

    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount <= 0) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Jumlah taruhan tidak valid.', { quotedMessageId: ctx.id });
      return;
    }

    if (choiceStr !== 'h' && choiceStr !== 't' && choiceStr !== 'head' && choiceStr !== 'tail' && choiceStr !== 'heads' && choiceStr !== 'tails') {
      await adapter.sendMessage(ctx.chatId, '⚠️ Pilihan tidak valid. Gunakan `h` (heads) atau `t` (tails).', { quotedMessageId: ctx.id });
      return;
    }

    const eco = await prisma.userEconomy.findUnique({ where: { userId: ctx.senderId } });
    if (!eco || eco.balance < amount) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Uang di dompet Anda tidak cukup.', { quotedMessageId: ctx.id });
      return;
    }

    const isHeads = choiceStr.startsWith('h');
    const resultHeads = Math.random() > 0.5;
    const resultStr = resultHeads ? 'HEADS (GAMBAR)' : 'TAILS (ANGKA)';
    const win = isHeads === resultHeads;

    if (win) {
      await prisma.userEconomy.update({
        where: { userId: ctx.senderId },
        data: { balance: { increment: amount } }
      });

      await logTransaction(ctx.senderId, ctx.isGroup ? ctx.chatId : null, 'coinflip_win', amount, { bet: amount });

      await adapter.sendMessage(ctx.chatId, `🪙 *LEMPAR KOIN* 🪙\n\nKoin berputar... Dan mendarat di *${resultStr}*!\n\n🎉 *ANDA MENANG!* Taruhan Anda berlipat ganda menjadi *Rp. ${(amount * 2).toLocaleString('id-ID')}*!`, { quotedMessageId: ctx.id });
    } else {
      await prisma.userEconomy.update({
        where: { userId: ctx.senderId },
        data: { balance: { decrement: amount } }
      });

      await logTransaction(ctx.senderId, ctx.isGroup ? ctx.chatId : null, 'coinflip_lose', -amount, { bet: amount });

      await adapter.sendMessage(ctx.chatId, `🪙 *LEMPAR KOIN* 🪙\n\nKoin berputar... Dan mendarat di *${resultStr}*!\n\n😢 *ANDA KALAH!* Anda kehilangan *Rp. ${amount.toLocaleString('id-ID')}*.`, { quotedMessageId: ctx.id });
    }
  }
}

export class GiveawayCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const amountStr = args[0]?.trim();
    const winnersCountStr = args[1]?.trim();

    if (!amountStr || !winnersCountStr) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/giveaway 5000 3` (Membagikan Rp 5000 untuk 3 pemenang)', { quotedMessageId: ctx.id });
      return;
    }

    const amount = parseInt(amountStr, 10);
    const winnersCount = parseInt(winnersCountStr, 10);

    if (isNaN(amount) || amount <= 0 || isNaN(winnersCount) || winnersCount <= 0) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Nilai jumlah uang atau jumlah pemenang tidak valid.', { quotedMessageId: ctx.id });
      return;
    }

    const ecoSender = await prisma.userEconomy.findUnique({ where: { userId: ctx.senderId } });
    if (!ecoSender || ecoSender.balance < amount) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Uang di dompet Anda tidak cukup untuk mengadakan giveaway ini.', { quotedMessageId: ctx.id });
      return;
    }

    const socket = (adapter as any).sock;
    if (!socket) {
      await adapter.sendMessage(ctx.chatId, '❌ Gagal mendapatkan metadata grup.', { quotedMessageId: ctx.id });
      return;
    }

    try {
      const groupMetadata = await socket.groupMetadata(ctx.chatId);
      const botId = socket.user.id.split(':')[0] + '@s.whatsapp.net';
      const participants = groupMetadata.participants
        .map((p: any) => p.id)
        .filter((id: string) => id !== ctx.senderId && id !== botId);

      if (participants.length === 0) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada warga lain di grup ini untuk dipilih sebagai pemenang.', { quotedMessageId: ctx.id });
        return;
      }

      const actualWinnersCount = Math.min(winnersCount, participants.length);
      const shuffled = [...participants].sort(() => 0.5 - Math.random());
      const winners = shuffled.slice(0, actualWinnersCount);
      const prizePerWinner = Math.floor(amount / actualWinnersCount);

      await prisma.userEconomy.update({
        where: { userId: ctx.senderId },
        data: { balance: { decrement: amount } }
      });
      await logTransaction(ctx.senderId, ctx.chatId, 'giveaway_host', -amount, { winnersCount: actualWinnersCount });

      await Promise.all(winners.map(async (winnerId) => {
        await prisma.userEconomy.upsert({
          where: { userId: winnerId },
          create: { userId: winnerId, balance: prizePerWinner, xp: 0, level: 1 },
          update: { balance: { increment: prizePerWinner } }
        });
        await logTransaction(winnerId, ctx.chatId, 'giveaway_win', prizePerWinner, { host: ctx.senderId });
      }));

      const mentions = [ctx.senderId, ...winners];
      const hostMention = `@${ctx.senderId.split('@')[0]}`;
      const winnerMentions = winners.map(w => `@${w.split('@')[0]}`).join(', ');

      const resp = `🎉 *GIVEAWAY SELESAI* 🎉\n\n` +
        `👤 *Sponsor:* ${hostMention}\n` +
        `💰 *Total Hadiah:* Rp. ${amount.toLocaleString('id-ID')}\n` +
        `👥 *Pemenang:* ${winnerMentions}\n` +
        `💵 *Masing-masing mendapatkan:* Rp. ${prizePerWinner.toLocaleString('id-ID')}\n\n` +
        `Selamat untuk para pemenang! Uang telah otomatis ditransfer ke dompet digital Anda.`;

      await adapter.sendMessage(ctx.chatId, resp, { mentions });
    } catch (err: any) {
      console.error('[Giveaway Error]', err);
      await adapter.sendMessage(ctx.chatId, `❌ Terjadi kesalahan saat mengadakan giveaway: ${err.message}`, { quotedMessageId: ctx.id });
    }
  }
}

export class RedeemCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (ctx.isGroup) {
      const flags = await getGroupFeatures(ctx.chatId);
      if (!flags.economy) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur ekonomi sedang nonaktif di grup ini.', { quotedMessageId: ctx.id });
        return;
      }
    }

    const code = args[0]?.trim().toUpperCase();
    if (!code) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/redeem PROMO2026`', { quotedMessageId: ctx.id });
      return;
    }

    const redeem = await prisma.redeemCode.findUnique({
      where: { code }
    });

    if (!redeem) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Kode redeem tidak valid atau salah.', { quotedMessageId: ctx.id });
      return;
    }

    if (redeem.expiresAt && redeem.expiresAt.getTime() < Date.now()) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Kode redeem ini telah kadaluarsa.', { quotedMessageId: ctx.id });
      return;
    }

    if (redeem.usedCount >= redeem.maxUses) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Batas penggunaan kode redeem ini telah habis.', { quotedMessageId: ctx.id });
      return;
    }

    const alreadyRedeemed = await prisma.economyTransaction.findFirst({
      where: {
        userId: ctx.senderId,
        type: 'redeem',
        metadataJson: {
          contains: code
        }
      }
    });

    if (alreadyRedeemed) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Anda sudah menukarkan kode redeem ini sebelumnya.', { quotedMessageId: ctx.id });
      return;
    }

    try {
      const reward = JSON.parse(redeem.rewardJson);
      let rewardMsg = '';

      if (reward.balance) {
        await prisma.userEconomy.upsert({
          where: { userId: ctx.senderId },
          create: { userId: ctx.senderId, balance: reward.balance, xp: 0, level: 1 },
          update: { balance: { increment: reward.balance } }
        });
        rewardMsg += `💵 *Rp. ${reward.balance.toLocaleString('id-ID')}*\n`;
      }

      if (reward.item) {
        const qty = reward.quantity || 1;
        await prisma.userInventory.create({
          data: { userId: ctx.senderId, itemId: reward.item, quantity: qty }
        });
        rewardMsg += `📦 *${qty}x ${reward.item}*\n`;
      }

      await prisma.redeemCode.update({
        where: { id: redeem.id },
        data: { usedCount: { increment: 1 } }
      });

      await logTransaction(ctx.senderId, ctx.isGroup ? ctx.chatId : null, 'redeem', reward.balance || 0, { code });

      await adapter.sendMessage(ctx.chatId, `🎉 *REDEEM BERHASIL* 🎉\n\nAnda berhasil menukarkan kode *${code}* dengan hadiah:\n${rewardMsg}`, { quotedMessageId: ctx.id });
    } catch (err: any) {
      console.error('[Redeem Error]', err);
      await adapter.sendMessage(ctx.chatId, '❌ Terjadi kesalahan saat memproses hadiah kode redeem.', { quotedMessageId: ctx.id });
    }
  }
}

export class AddRedeemCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!isOwner(ctx.senderId)) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini khusus untuk Owner.', { quotedMessageId: ctx.id });
      return;
    }

    const code = args[0]?.trim().toUpperCase();
    const rewardJsonStr = args[1]?.trim();
    const maxUsesStr = args[2]?.trim();
    const hoursToExpireStr = args[3]?.trim();

    if (!code || !rewardJsonStr || !maxUsesStr) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/addredeem PROMO2026 {"balance":1000} 50 24`', { quotedMessageId: ctx.id });
      return;
    }

    try {
      JSON.parse(rewardJsonStr);
    } catch {
      await adapter.sendMessage(ctx.chatId, '⚠️ Format JSON reward tidak valid.', { quotedMessageId: ctx.id });
      return;
    }

    const maxUses = parseInt(maxUsesStr, 10);
    if (isNaN(maxUses) || maxUses <= 0) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Jumlah max uses tidak valid.', { quotedMessageId: ctx.id });
      return;
    }

    let expiresAt: Date | null = null;
    if (hoursToExpireStr) {
      const hours = parseInt(hoursToExpireStr, 10);
      if (!isNaN(hours) && hours > 0) {
        expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
      }
    }

    try {
      await prisma.redeemCode.upsert({
        where: { code },
        create: { code, rewardJson: rewardJsonStr, maxUses, expiresAt },
        update: { rewardJson: rewardJsonStr, maxUses, expiresAt }
      });

      await adapter.sendMessage(ctx.chatId, `✅ Kode redeem *${code}* berhasil dibuat/diperbarui dengan max uses: ${maxUses}.`, { quotedMessageId: ctx.id });
    } catch (err: any) {
      await adapter.sendMessage(ctx.chatId, `❌ Gagal membuat kode redeem: ${err.message}`, { quotedMessageId: ctx.id });
    }
  }
}

export class SellCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (ctx.isGroup) {
      const flags = await getGroupFeatures(ctx.chatId);
      if (!flags.economy) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur ekonomi sedang nonaktif di grup ini.', { quotedMessageId: ctx.id });
        return;
      }
    }

    const itemName = args.join(' ').trim().toLowerCase();
    if (!itemName) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/sell makanan pet`', { quotedMessageId: ctx.id });
      return;
    }

    const sellPrices: Record<string, number> = {
      'makanan pet': 50,
      'title keren': 250,
      'lootbox': 150,
      'emas': 400,
      'besi': 150,
      'batu': 30,
      'ikan': 80,
      'sepatu bot': 5,
      'rod pancing premium': 1200,
      'kunci peti': 1300
    };

    const price = sellPrices[itemName];
    if (price === undefined) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Barang ini tidak dapat dijual atau salah nama.', { quotedMessageId: ctx.id });
      return;
    }

    const inventory = await prisma.userInventory.findFirst({
      where: { userId: ctx.senderId, itemId: itemName }
    });

    if (!inventory) {
      await adapter.sendMessage(ctx.chatId, `⚠️ Anda tidak memiliki item "${itemName}" di dalam inventory.`, { quotedMessageId: ctx.id });
      return;
    }

    if (inventory.quantity > 1) {
      await prisma.userInventory.update({
        where: { id: inventory.id },
        data: { quantity: { decrement: 1 } }
      });
    } else {
      await prisma.userInventory.delete({
        where: { id: inventory.id }
      });
    }

    await prisma.userEconomy.upsert({
      where: { userId: ctx.senderId },
      create: { userId: ctx.senderId, balance: price, xp: 0, level: 1 },
      update: { balance: { increment: price } }
    });

    await logTransaction(ctx.senderId, ctx.isGroup ? ctx.chatId : null, 'sell', price, { item: itemName });

    await adapter.sendMessage(ctx.chatId, `💵 Anda berhasil menjual *1x ${itemName}* seharga *Rp. ${price.toLocaleString('id-ID')}*.`, { quotedMessageId: ctx.id });
  }
}

// Helper to get total count of a specific item in inventory
async function getInventoryCount(userId: string, itemId: string): Promise<number> {
  const items = await prisma.userInventory.findMany({
    where: { userId, itemId }
  });
  return items.reduce((acc, curr) => acc + curr.quantity, 0);
}

// Helper to deduct a certain quantity of a specific item from inventory across multiple rows if necessary
async function deductInventory(userId: string, itemId: string, quantity: number): Promise<void> {
  const items = await prisma.userInventory.findMany({
    where: { userId, itemId }
  });
  let remainingToDeduct = quantity;
  for (const item of items) {
    if (remainingToDeduct <= 0) break;
    if (item.quantity > remainingToDeduct) {
      await prisma.userInventory.update({
        where: { id: item.id },
        data: { quantity: { decrement: remainingToDeduct } }
      });
      remainingToDeduct = 0;
    } else {
      remainingToDeduct -= item.quantity;
      await prisma.userInventory.delete({
        where: { id: item.id }
      });
    }
  }
}

interface BossRaidSession {
  chatId: string;
  bossName: string;
  bossMaxHp: number;
  bossHp: number;
  players: Map<string, { name: string; hp: number; damageDealt: number; lastAttack: number }>;
  status: 'lobby' | 'active';
  spawnedBy: string;
  createdAt: number;
}

const activeBossRaids = new Map<string, BossRaidSession>();
const groupBossCooldown = new Map<string, number>();

export class BossCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Boss Raid hanya bisa dimainkan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const flags = await getGroupFeatures(ctx.chatId);
    if (!flags.rpg && !flags.economy) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Fitur RPG/ekonomi sedang nonaktif di grup ini.', { quotedMessageId: ctx.id });
      return;
    }

    const action = args[0]?.toLowerCase();
    const session = activeBossRaids.get(ctx.chatId);

    if (!action) {
      // Show status or spawn boss
      if (session) {
        let playerList = '';
        if (session.players.size === 0) {
          playerList = '_Belum ada pemain yang bergabung._';
        } else {
          playerList = Array.from(session.players.values())
            .map(p => `- ${p.name} (HP: ${p.hp}/100)`)
            .join('\n');
        }

        const stateText = session.status === 'lobby' 
          ? `⏳ *MENUNGGU LOBBY BOSS RAID* ⏳\n\n` +
            `😈 Boss: *${session.bossName}*\n` +
            `❤️ HP Boss: *${session.bossHp} / ${session.bossMaxHp}*\n\n` +
            `👥 *Raid Party:*\n${playerList}\n\n` +
            `💡 _Gunakan \`/boss join\` untuk ikut bertarung!\n` +
            `Gunakan \`/boss start\` (oleh pemanggil) untuk memulai pertempuran._`
          : `⚔️ *BOSS RAID SEDANG BERLANGSUNG* ⚔️\n\n` +
            `😈 Boss: *${session.bossName}*\n` +
            `❤️ HP Boss: *${session.bossHp} / ${session.bossMaxHp}*\n\n` +
            `👥 *Status Party:*\n${playerList}\n\n` +
            `💡 _Gunakan \`/boss attack\` untuk menyerang boss! (CD 5 detik)_`;

        await adapter.sendMessage(ctx.chatId, stateText, { quotedMessageId: ctx.id });
        return;
      }

      // Check group cooldown
      const lastRaid = groupBossCooldown.get(ctx.chatId) || 0;
      const cd = 4 * 60 * 60 * 1000; // 4 hours cooldown
      if (Date.now() - lastRaid < cd) {
        const remainingSec = Math.ceil((cd - (Date.now() - lastRaid)) / 1000);
        const hours = Math.floor(remainingSec / 3600);
        const minutes = Math.floor((remainingSec % 3600) / 60);
        await adapter.sendMessage(ctx.chatId, `⏳ Boss di area ini sedang tidur. Silakan panggil kembali dalam *${hours} jam ${minutes} menit*.`, { quotedMessageId: ctx.id });
        return;
      }

      // Spawn boss!
      const bosses = [
        { name: 'Raksasa Batu', hp: 2000 },
        { name: 'Naga Api', hp: 3000 },
        { name: 'Kraken Purba', hp: 2500 }
      ];
      const boss = bosses[Math.floor(Math.random() * bosses.length)];

      const newSession: BossRaidSession = {
        chatId: ctx.chatId,
        bossName: boss.name,
        bossMaxHp: boss.hp,
        bossHp: boss.hp,
        players: new Map(),
        status: 'lobby',
        spawnedBy: ctx.senderId,
        createdAt: Date.now()
      };

      activeBossRaids.set(ctx.chatId, newSession);

      const spawnMsg = `😈 *BOSS RAID DIMULAI!* 😈\n\n` +
        `Seekor *${boss.name}* telah muncul di daerah kekuasaan grup!\n` +
        `❤️ HP Boss: *${boss.hp}*\n\n` +
        `💡 _Gunakan \`/boss join\` untuk bergabung ke Raid Party!_\n` +
        `Waktu bersiap: *60 detik*.`;

      await adapter.sendMessage(ctx.chatId, spawnMsg, { quotedMessageId: ctx.id });

      // Auto start lobby timer after 60s
      setTimeout(async () => {
        const current = activeBossRaids.get(ctx.chatId);
        if (current && current.status === 'lobby' && current.createdAt === newSession.createdAt) {
          if (current.players.size === 0) {
            activeBossRaids.delete(ctx.chatId);
            await adapter.sendMessage(ctx.chatId, '💨 *Boss Raid dibatalkan* karena tidak ada pemain yang bergabung ke dalam Raid Party.');
          } else {
            current.status = 'active';
            await adapter.sendMessage(ctx.chatId, `⚔️ *PERTARUNGAN DIMULAI!* ⚔️\n\n*${current.bossName}* mengaum keras! Serang dengan \`/boss attack\`!`);
            // Setup absolute timeout of 3 minutes
            setTimeout(async () => {
              const activeSec = activeBossRaids.get(ctx.chatId);
              if (activeSec && activeSec.status === 'active' && activeSec.createdAt === newSession.createdAt) {
                activeBossRaids.delete(ctx.chatId);
                await adapter.sendMessage(ctx.chatId, `💨 Waktu habis! *${activeSec.bossName}* melarikan diri kembali ke sarangnya. Raid gagal!`);
                groupBossCooldown.set(ctx.chatId, Date.now() - (3.5 * 60 * 60 * 1000)); // Set cooldown to 30 mins
              }
            }, 3 * 60 * 1000);
          }
        }
      }, 60 * 1000);
      return;
    }

    if (action === 'join') {
      if (!session) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada Boss Raid yang aktif saat ini. Ketik \`/boss\` untuk memanggil boss.', { quotedMessageId: ctx.id });
        return;
      }
      if (session.status !== 'lobby') {
        await adapter.sendMessage(ctx.chatId, '⚠️ Pendaftaran Raid Party sudah ditutup. Pertempuran sedang berlangsung!', { quotedMessageId: ctx.id });
        return;
      }
      if (session.players.has(ctx.senderId)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Anda sudah bergabung di dalam Raid Party.', { quotedMessageId: ctx.id });
        return;
      }

      session.players.set(ctx.senderId, {
        name: ctx.senderName || ctx.senderId.split('@')[0],
        hp: 100,
        damageDealt: 0,
        lastAttack: 0
      });

      await adapter.sendMessage(ctx.chatId, `✅ @${ctx.senderId.split('@')[0]} bergabung ke dalam Raid Party!`, { quotedMessageId: ctx.id, mentions: [ctx.senderId] });
      return;
    }

    if (action === 'start') {
      if (!session) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada Boss Raid yang aktif saat ini.', { quotedMessageId: ctx.id });
        return;
      }
      if (session.status !== 'lobby') {
        await adapter.sendMessage(ctx.chatId, '⚠️ Boss Raid sudah berjalan.', { quotedMessageId: ctx.id });
        return;
      }
      if (session.spawnedBy !== ctx.senderId) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya pemanggil boss yang dapat memulai pertarungan lebih awal.', { quotedMessageId: ctx.id });
        return;
      }
      if (session.players.size === 0) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Raid Party masih kosong. Tunggu anggota lain bergabung!', { quotedMessageId: ctx.id });
        return;
      }

      session.status = 'active';
      const spawnTime = session.createdAt;
      await adapter.sendMessage(ctx.chatId, `⚔️ *PERTARUNGAN DIMULAI!* ⚔️\n\n*${session.bossName}* bersiap menyerang! Gunakan \`/boss attack\` untuk menyerang!`);
      
      // Setup absolute timeout of 3 minutes
      setTimeout(async () => {
        const activeSec = activeBossRaids.get(ctx.chatId);
        if (activeSec && activeSec.status === 'active' && activeSec.createdAt === spawnTime) {
          activeBossRaids.delete(ctx.chatId);
          await adapter.sendMessage(ctx.chatId, `💨 Waktu habis! *${activeSec.bossName}* melarikan diri. Raid gagal!`);
          groupBossCooldown.set(ctx.chatId, Date.now() - (3.5 * 60 * 60 * 1000)); // Set cooldown to 30 mins
        }
      }, 3 * 60 * 1000);
      return;
    }

    if (action === 'attack') {
      if (!session) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada Boss Raid yang aktif saat ini.', { quotedMessageId: ctx.id });
        return;
      }
      if (session.status !== 'active') {
        await adapter.sendMessage(ctx.chatId, '⚠️ Pertarungan belum dimulai. Tunggu lobby selesai atau ketik \`/boss start\`.', { quotedMessageId: ctx.id });
        return;
      }
      if (!session.players.has(ctx.senderId)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Anda bukan anggota Raid Party ini.', { quotedMessageId: ctx.id });
        return;
      }

      const p = session.players.get(ctx.senderId)!;
      if (p.hp <= 0) {
        await adapter.sendMessage(ctx.chatId, '💀 Anda sudah tumbang dan tidak dapat menyerang boss!', { quotedMessageId: ctx.id });
        return;
      }

      const now = Date.now();
      if (now - p.lastAttack < 5000) {
        const remaining = Math.ceil((5000 - (now - p.lastAttack)) / 1000);
        await adapter.sendMessage(ctx.chatId, `⏳ Anda harus memulihkan tenaga. Coba lagi dalam *${remaining} detik*.`, { quotedMessageId: ctx.id });
        return;
      }
      p.lastAttack = now;

      // Calculate damage
      const pet = await prisma.pet.findUnique({ where: { userId: ctx.senderId } });
      const petLevel = pet?.level ?? 0;
      const petName = pet?.name ?? '';
      
      const baseDmg = Math.floor(Math.random() * 41) + 30; // 30-70
      const petDmg = petLevel * 10;
      const totalDmg = baseDmg + petDmg;

      session.bossHp = Math.max(0, session.bossHp - totalDmg);
      p.damageDealt += totalDmg;

      let attackMsg = `⚔️ *ATTACK!* ⚔️\n👤 @${ctx.senderId.split('@')[0]} menyerang *${session.bossName}*!`;
      if (petLevel > 0) {
        attackMsg += `\n🐾 Pet *${petName}* (Lvl ${petLevel}) membantu menyerang!`;
      }
      attackMsg += `\n💥 Kerusakan: *- ${totalDmg} HP*\n👿 Sisa HP Boss: *${session.bossHp} / ${session.bossMaxHp}*`;

      // Boss counter attack!
      let counterMsg = '';
      if (session.bossHp > 0 && Math.random() < 0.4) {
        const livingPlayers = Array.from(session.players.entries()).filter(([_, player]) => player.hp > 0);
        if (livingPlayers.length > 0) {
          const [targetId, targetPlayer] = livingPlayers[Math.floor(Math.random() * livingPlayers.length)];
          const bossDmg = Math.floor(Math.random() * 11) + 15; // 15-25 dmg
          targetPlayer.hp = Math.max(0, targetPlayer.hp - bossDmg);
          counterMsg = `\n\n⚡ *COUNTER ATTACK!* ⚡\n👿 *${session.bossName}* menyerang balik @${targetId.split('@')[0]}!\n💔 Kerusakan: *- ${bossDmg} HP* (Sisa HP: *${targetPlayer.hp}/100*)`;
          if (targetPlayer.hp <= 0) {
            counterMsg += `\n💀 @${targetId.split('@')[0]} telah tumbang!`;
          }
        }
      }

      await adapter.sendMessage(ctx.chatId, attackMsg + counterMsg, {
        quotedMessageId: ctx.id,
        mentions: [ctx.senderId].concat(counterMsg ? [counterMsg.match(/@\d+/)?.[0]?.replace('@', '') + '@s.whatsapp.net' || ''] : [])
      });

      // Check win/lose
      if (session.bossHp <= 0) {
        // Victory!
        activeBossRaids.delete(ctx.chatId);
        groupBossCooldown.set(ctx.chatId, Date.now());

        // Distribute rewards
        let rewardMsg = `🏆 *VICTORY! BOSS DEFEATED!* 🏆\n\n` +
          `Pasukan grup berhasil mengalahkan *${session.bossName}*!\n\n` +
          `💰 *HADIAH PERTEMPURAN:*`;

        const rewardMentions: string[] = [];
        for (const [id, player] of session.players.entries()) {
          if (player.damageDealt > 0) {
            const rewardBalance = Math.floor(Math.random() * 301) + 300; // Rp 300 - 600
            
            // Item drop chance
            let dropItem = '';
            const dropRand = Math.random();
            if (dropRand < 0.1) dropItem = 'emas';
            else if (dropRand < 0.4) dropItem = 'besi';
            else if (dropRand < 0.8) dropItem = 'batu';

            await prisma.userEconomy.upsert({
              where: { userId: id },
              create: { userId: id, balance: rewardBalance },
              update: { balance: { increment: rewardBalance } }
            });

            if (dropItem) {
              await prisma.userInventory.create({
                data: { userId: id, itemId: dropItem, quantity: 1 }
              });
            }

            await logTransaction(id, ctx.chatId, 'boss_reward', rewardBalance, { boss: session.bossName, dropItem });

            rewardMentions.push(id);
            rewardMsg += `\n👤 @${id.split('@')[0]} (Dealt: ${player.damageDealt})\n   └ 💵 *+Rp. ${rewardBalance}*` + (dropItem ? ` | 📦 *+1x ${dropItem}*` : '');
          }
        }

        await adapter.sendMessage(ctx.chatId, rewardMsg, { mentions: rewardMentions });
        return;
      }

      // Check if all players dead
      const allDead = Array.from(session.players.values()).every(player => player.hp <= 0);
      if (allDead) {
        activeBossRaids.delete(ctx.chatId);
        groupBossCooldown.set(ctx.chatId, Date.now() - (3.5 * 60 * 60 * 1000)); // Set cooldown to 30 mins
        await adapter.sendMessage(ctx.chatId, `😢 *DEFEAT!* *${session.bossName}* mengalahkan seluruh anggota party! Boss merajalela dan melarikan diri.`);
        return;
      }
    }
  }
}

export class CraftCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (ctx.isGroup) {
      const flags = await getGroupFeatures(ctx.chatId);
      if (!flags.economy && !flags.rpg) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur ekonomi/RPG sedang nonaktif di grup ini.', { quotedMessageId: ctx.id });
        return;
      }
    }

    const targetItem = args.join(' ').trim().toLowerCase();

    const recipes: Record<string, { desc: string, ingredients: { itemId: string; qty: number }[] }> = {
      'rod pancing premium': {
        desc: 'Alat pancing premium untuk menaikkan rezeki Anda.',
        ingredients: [
          { itemId: 'besi', qty: 5 },
          { itemId: 'emas', qty: 1 }
        ]
      },
      'kunci peti': {
        desc: 'Kunci emas untuk membuka peti lootbox berharga.',
        ingredients: [
          { itemId: 'batu', qty: 10 },
          { itemId: 'emas', qty: 2 }
        ]
      }
    };

    if (!targetItem || !recipes[targetItem]) {
      let recipeText = `🛠️ *CRAFTING TABLE WARGA* 🛠️\n\nTersedia resep kerajinan premium berikut:\n\n`;
      Object.entries(recipes).forEach(([name, recipe], idx) => {
        recipeText += `${idx + 1}. *${name}*\n   ├ 📝 _${recipe.desc}_\n   ├ 📦 *Bahan:* \n` +
          recipe.ingredients.map(ing => `   │  └ ${ing.qty}x ${ing.itemId}`).join('\n') +
          `\n   └ 💡 _Ketik \`/craft ${name}\`_\n\n`;
      });
      await adapter.sendMessage(ctx.chatId, recipeText, { quotedMessageId: ctx.id });
      return;
    }

    const recipe = recipes[targetItem];

    // Check if player has enough materials
    for (const ing of recipe.ingredients) {
      const count = await getInventoryCount(ctx.senderId, ing.itemId);
      if (count < ing.qty) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Bahan tidak cukup! Anda butuh *${ing.qty}x ${ing.itemId}*, tetapi hanya memiliki *${count}x*.`, { quotedMessageId: ctx.id });
        return;
      }
    }

    // Deduct materials
    for (const ing of recipe.ingredients) {
      await deductInventory(ctx.senderId, ing.itemId, ing.qty);
    }

    // Create crafted item
    await prisma.userInventory.create({
      data: { userId: ctx.senderId, itemId: targetItem, quantity: 1 }
    });

    await logTransaction(ctx.senderId, ctx.isGroup ? ctx.chatId : null, 'craft', 0, { craftedItem: targetItem });

    const resp = `🛠️ *CRAFTING BERHASIL* 🛠️\n\nSelamat! Anda berhasil merakit *1x ${targetItem}*!\nItem ini telah masuk to inventory Anda.`;
    await adapter.sendMessage(ctx.chatId, resp, { quotedMessageId: ctx.id });
  }
}

export class MarketCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (ctx.isGroup) {
      const flags = await getGroupFeatures(ctx.chatId);
      if (!flags.economy) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur ekonomi sedang nonaktif di grup ini.', { quotedMessageId: ctx.id });
        return;
      }
    }

    const action = args[0]?.toLowerCase();

    if (!action) {
      // Show active listings
      const listings = await prisma.marketListing.findMany({
        orderBy: { createdAt: 'desc' },
        take: 15
      });

      if (listings.length === 0) {
        const emptyMsg = `🏪 *PASAR WARGA (MARKET)* 🏪\n\n` +
          `Belum ada barang yang dijual saat ini.\n\n` +
          `💡 _Gunakan \`/market sell <item> <harga>\` untuk menjual barang Anda._`;
        await adapter.sendMessage(ctx.chatId, emptyMsg, { quotedMessageId: ctx.id });
        return;
      }

      let msg = `🏪 *PASAR WARGA (MARKET)* 🏪\n\n`;
      const mentions: string[] = [];
      listings.forEach((list) => {
        const sellerMention = `@${list.sellerId.split('@')[0]}`;
        mentions.push(list.sellerId);
        msg += `📦 *ID: ${list.id.slice(0, 8)}* - *${list.itemId}* (x${list.quantity})\n` +
          `   ├ 💵 Harga: *Rp. ${list.price.toLocaleString('id-ID')}*\n` +
          `   ├ 👤 Penjual: ${sellerMention}\n` +
          `   └ 💡 _Ketik \`/market buy ${list.id.slice(0, 8)}\` untuk membeli_\n\n`;
      });

      await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id, mentions });
      return;
    }

    if (action === 'sell') {
      // Format: /market sell <item> <harga>
      const priceStr = args[args.length - 1]?.trim();
      const price = parseInt(priceStr, 10);
      const itemName = args.slice(1, -1).join(' ').trim().toLowerCase();

      if (!itemName || isNaN(price) || price <= 0) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: \`/market sell emas 500\`', { quotedMessageId: ctx.id });
        return;
      }

      // Limit listing count to 3
      const sellerListings = await prisma.marketListing.count({
        where: { sellerId: ctx.senderId }
      });
      if (sellerListings >= 3) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Anda hanya dapat memasang maksimal *3 listing* aktif secara bersamaan.', { quotedMessageId: ctx.id });
        return;
      }

      // Check if item in inventory
      const invCount = await getInventoryCount(ctx.senderId, itemName);
      if (invCount < 1) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Anda tidak memiliki item "${itemName}" di dalam inventory.`, { quotedMessageId: ctx.id });
        return;
      }

      // Deduct item from seller inventory
      await deductInventory(ctx.senderId, itemName, 1);

      // Create market listing
      const newListing = await prisma.marketListing.create({
        data: {
          sellerId: ctx.senderId,
          itemId: itemName,
          price,
          quantity: 1
        }
      });

      await logTransaction(ctx.senderId, ctx.isGroup ? ctx.chatId : null, 'market_sell', 0, { itemId: itemName, price });

      await adapter.sendMessage(ctx.chatId, `✅ Berhasil memasang *1x ${itemName}* ke pasar seharga *Rp. ${price.toLocaleString('id-ID')}*!\nID Listing: *${newListing.id.slice(0, 8)}*`, { quotedMessageId: ctx.id });
      return;
    }

    if (action === 'buy') {
      const idInput = args[1]?.trim().toLowerCase();
      if (!idInput) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tentukan ID Listing. Contoh: \`/market buy 3a5b8c9d\`', { quotedMessageId: ctx.id });
        return;
      }

      // Find listing where id starts with idInput (since we display sliced ID)
      const listing = await prisma.marketListing.findFirst({
        where: { id: { startsWith: idInput } }
      });

      if (!listing) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Listing tidak ditemukan atau telah terjual.', { quotedMessageId: ctx.id });
        return;
      }

      if (listing.sellerId === ctx.senderId) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Anda tidak dapat membeli barang Anda sendiri. Gunakan \`/market cancel <ID>\` untuk membatalkannya.', { quotedMessageId: ctx.id });
        return;
      }

      // Check buyer cash balance
      const buyerEco = await prisma.userEconomy.findUnique({ where: { userId: ctx.senderId } });
      if (!buyerEco || buyerEco.balance < listing.price) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Uang tunai Anda tidak mencukupi untuk membeli barang ini (Harga: *Rp. ${listing.price.toLocaleString('id-ID')}*).`, { quotedMessageId: ctx.id });
        return;
      }

      // Transfer funds and transfer items
      await prisma.$transaction([
        // Decrement buyer balance
        prisma.userEconomy.update({
          where: { userId: ctx.senderId },
          data: { balance: { decrement: listing.price } }
        }),
        // Increment seller balance
        prisma.userEconomy.upsert({
          where: { userId: listing.sellerId },
          create: { userId: listing.sellerId, balance: listing.price },
          update: { balance: { increment: listing.price } }
        }),
        // Delete market listing
        prisma.marketListing.delete({
          where: { id: listing.id }
        })
      ]);

      // Add item to buyer inventory
      await prisma.userInventory.create({
        data: { userId: ctx.senderId, itemId: listing.itemId, quantity: listing.quantity }
      });

      await logTransaction(ctx.senderId, ctx.isGroup ? ctx.chatId : null, 'market_buy_buyer', -listing.price, { sellerId: listing.sellerId, itemId: listing.itemId });
      await logTransaction(listing.sellerId, ctx.isGroup ? ctx.chatId : null, 'market_buy_seller', listing.price, { buyerId: ctx.senderId, itemId: listing.itemId });

      const buyerMention = `@${ctx.senderId.split('@')[0]}`;
      const sellerMention = `@${listing.sellerId.split('@')[0]}`;
      const successMsg = `🛒 *TRANSAKSI BERHASIL* 🛒\n\n` +
        `${buyerMention} membeli *${listing.itemId}* dari ${sellerMention} seharga *Rp. ${listing.price.toLocaleString('id-ID')}*!`;

      await adapter.sendMessage(ctx.chatId, successMsg, { mentions: [ctx.senderId, listing.sellerId] });
      return;
    }

    if (action === 'cancel') {
      const idInput = args[1]?.trim().toLowerCase();
      if (!idInput) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tentukan ID Listing. Contoh: \`/market cancel 3a5b8c9d\`', { quotedMessageId: ctx.id });
        return;
      }

      const listing = await prisma.marketListing.findFirst({
        where: { id: { startsWith: idInput } }
      });

      if (!listing) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Listing tidak ditemukan.', { quotedMessageId: ctx.id });
        return;
      }

      if (listing.sellerId !== ctx.senderId) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Anda hanya dapat membatalkan listing milik Anda sendiri.', { quotedMessageId: ctx.id });
        return;
      }

      // Return item to seller inventory
      await prisma.$transaction([
        prisma.marketListing.delete({ where: { id: listing.id } }),
        prisma.userInventory.create({
          data: { userId: ctx.senderId, itemId: listing.itemId, quantity: listing.quantity }
        })
      ]);

      await logTransaction(ctx.senderId, ctx.isGroup ? ctx.chatId : null, 'market_cancel', 0, { itemId: listing.itemId });

      await adapter.sendMessage(ctx.chatId, `✅ Berhasil membatalkan penjualan *${listing.itemId}*. Item dikembalikan ke inventory Anda.`, { quotedMessageId: ctx.id });
      return;
    }

    // Help message if invalid subcommand
    const helpMsg = `🏪 *PANDUAN MARKET WARGA* 🏪\n\n` +
      `• \`/market\` - Melihat barang yang dijual\n` +
      `• \`/market sell <nama_item> <harga>\` - Menjual barang\n` +
      `• \`/market buy <ID_Listing>\` - Membeli barang\n` +
      `• \`/market cancel <ID_Listing>\` - Membatalkan penjualan barang`;
    await adapter.sendMessage(ctx.chatId, helpMsg, { quotedMessageId: ctx.id });
  }
}

export class ResetecoCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
    const isSenderOwner = isOwner(ctx.senderId);
    if (!isAdmin && !isSenderOwner) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Admin grup yang dapat menggunakan command ini.', { quotedMessageId: ctx.id });
      return;
    }

    const targetInput = args[0]?.trim();
    if (!targetInput) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan \`/reseteco @user\` atau \`/reseteco all\` untuk mereset seluruh grup.', { quotedMessageId: ctx.id });
      return;
    }

    if (targetInput.toLowerCase() === 'all') {
      const socket = (adapter as any).sock;
      if (!socket) {
        await adapter.sendMessage(ctx.chatId, '❌ Kesalahan internal adapter socket.', { quotedMessageId: ctx.id });
        return;
      }

      try {
        const groupMetadata = await socket.groupMetadata(ctx.chatId);
        const participantIds = groupMetadata.participants.map((p: any) => p.id);

        await prisma.userEconomy.updateMany({
          where: { userId: { in: participantIds } },
          data: {
            balance: 0,
            bank: 0,
            xp: 0,
            level: 1,
            lastClaim: null,
            lastWork: null,
            lastMining: null,
            lastFishing: null,
            lastCrime: null,
            lastRob: null
          }
        });

        // Clear their inventory items
        await prisma.userInventory.deleteMany({
          where: { userId: { in: participantIds } }
        });

        // Clear their pets
        await prisma.pet.deleteMany({
          where: { userId: { in: participantIds } }
        });

        await adapter.sendMessage(ctx.chatId, '✅ *RESET EKONOMI GRUP BERHASIL* ✅\n\nSeluruh data ekonomi, inventory, dan pet anggota grup ini telah direset ke awal.', { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal mereset ekonomi grup: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // User mention
    const targetJid = targetInput.includes('@') ? targetInput.replace('@', '').trim() + '@s.whatsapp.net' : targetInput.trim();

    try {
      await prisma.userEconomy.upsert({
        where: { userId: targetJid },
        create: { userId: targetJid, balance: 0, bank: 0, xp: 0, level: 1 },
        update: {
          balance: 0,
          bank: 0,
          xp: 0,
          level: 1,
          lastClaim: null,
          lastWork: null,
          lastMining: null,
          lastFishing: null,
          lastCrime: null,
          lastRob: null
        }
      });

      await prisma.userInventory.deleteMany({ where: { userId: targetJid } });
      await prisma.pet.deleteMany({ where: { userId: targetJid } });

      await adapter.sendMessage(ctx.chatId, `✅ Data ekonomi, inventory, dan pet untuk @${targetJid.split('@')[0]} berhasil direset ke awal.`, { quotedMessageId: ctx.id, mentions: [targetJid] });
    } catch (err: any) {
      await adapter.sendMessage(ctx.chatId, `❌ Gagal mereset: ${err.message}`, { quotedMessageId: ctx.id });
    }
  }
}

// Register economy/leveling commands
registerCommand(['balance', 'bal'], new BalanceCommand());
registerCommand(['claim', 'daily'], new ClaimCommand());
registerCommand(['transfer'], new TransferCommand());
registerCommand(['rank', 'level'], new RankCommand());
registerCommand(['top', 'leaderboard'], new TopCommand());
registerCommand(['shop'], new ShopCommand());
registerCommand(['inventory', 'inv'], new InventoryCommand());
registerCommand(['title', 'settitle'], new TitleCommand());
registerCommand(['achievement', 'achievements'], new AchievementCommand());
registerCommand(['badge'], new BadgeCommand());
registerCommand(['pet'], new PetCommand());
registerCommand(['dungeon'], new DungeonCommand());
registerCommand(['profile'], new ProfileCommand());
registerCommand(['card'], new CardCustomizationCommand());
registerCommand(['setbg'], new SetBgCommand());
registerCommand(['setbadge'], new SetBadgeCommand());
registerCommand(['work'], new WorkCommand());
registerCommand(['mining'], new MiningCommand());
registerCommand(['fishing'], new FishingCommand());
registerCommand(['crime'], new CrimeCommand());
registerCommand(['beg'], new BegCommand());
registerCommand(['bank'], new BankCommand());
registerCommand(['deposit', 'dep'], new DepositCommand());
registerCommand(['withdraw', 'wd'], new WithdrawCommand());
registerCommand(['rob'], new RobCommand());
registerCommand(['slot'], new SlotCommand());
registerCommand(['coinflip', 'cf'], new CoinflipCommand());
registerCommand(['giveaway'], new GiveawayCommand());
registerCommand(['redeem'], new RedeemCommand());
registerCommand(['addredeem'], new AddRedeemCommand());
registerCommand(['sell'], new SellCommand());
registerCommand(['boss'], new BossCommand());
registerCommand(['craft'], new CraftCommand());
registerCommand(['market'], new MarketCommand());
registerCommand(['reseteco'], new ResetecoCommand());
