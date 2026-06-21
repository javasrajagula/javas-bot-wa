import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';

interface DailyMission {
  id: string;
  name: string;
  desc: string;
  target: number;
  type: 'msg' | 'cmd' | 'sticker';
  xpReward: number;
  balReward: number;
}

export const DAILY_MISSIONS: DailyMission[] = [
  { id: 'msg_10', name: 'Chatter Mania 💬', desc: 'Kirim 10 pesan di grup', target: 10, type: 'msg', xpReward: 50, balReward: 200 },
  { id: 'cmd_3', name: 'Command Explorer 🤖', desc: 'Gunakan 3 command bot', target: 3, type: 'cmd', xpReward: 75, balReward: 300 },
  { id: 'sticker_1', name: 'Sticker Maker 🎨', desc: 'Buat 1 stiker', target: 1, type: 'sticker', xpReward: 50, balReward: 200 }
];

interface SeasonTier {
  tier: number;
  xpNeeded: number;
  rewardDesc: string;
  rewardType: 'balance' | 'title' | 'badge';
  rewardValue: string;
}

export const SEASON_TIERS: SeasonTier[] = [
  { tier: 1, xpNeeded: 100, rewardDesc: 'Rp 500', rewardType: 'balance', rewardValue: '500' },
  { tier: 2, xpNeeded: 150, rewardDesc: 'Title "Petualang"', rewardType: 'title', rewardValue: 'Petualang' },
  { tier: 3, xpNeeded: 200, rewardDesc: 'Rp 1,000', rewardType: 'balance', rewardValue: '1000' },
  { tier: 4, xpNeeded: 250, rewardDesc: 'Badge ⚔️', rewardType: 'badge', rewardValue: '⚔️' },
  { tier: 5, xpNeeded: 300, rewardDesc: 'Rp 2,000 & Title "Elite"', rewardType: 'balance', rewardValue: '2000' }
];

export async function resetDailyMissionsIfNewDay(userId: string): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  const dateVar = await prisma.customVariable.findUnique({
    where: { groupId_userId_key: { groupId: 'global', userId, key: 'mission:date' } }
  });

  if (!dateVar || dateVar.value !== today) {
    await prisma.customVariable.upsert({
      where: { groupId_userId_key: { groupId: 'global', userId, key: 'mission:date' } },
      create: { groupId: 'global', userId, key: 'mission:date', value: today },
      update: { value: today }
    });
    await prisma.customVariable.upsert({
      where: { groupId_userId_key: { groupId: 'global', userId, key: 'mission:msg_count' } },
      create: { groupId: 'global', userId, key: 'mission:msg_count', value: '0' },
      update: { value: '0' }
    });
    await prisma.customVariable.upsert({
      where: { groupId_userId_key: { groupId: 'global', userId, key: 'mission:cmd_count' } },
      create: { groupId: 'global', userId, key: 'mission:cmd_count', value: '0' },
      update: { value: '0' }
    });
    await prisma.customVariable.upsert({
      where: { groupId_userId_key: { groupId: 'global', userId, key: 'mission:sticker_count' } },
      create: { groupId: 'global', userId, key: 'mission:sticker_count', value: '0' },
      update: { value: '0' }
    });
    await prisma.customVariable.upsert({
      where: { groupId_userId_key: { groupId: 'global', userId, key: 'mission:claimed' } },
      create: { groupId: 'global', userId, key: 'mission:claimed', value: '[]' },
      update: { value: '[]' }
    });
  }
  return today;
}

export async function updateDailyMissionMsgCount(userId: string) {
  try {
    await resetDailyMissionsIfNewDay(userId);
    const countVar = await prisma.customVariable.findUnique({
      where: { groupId_userId_key: { groupId: 'global', userId, key: 'mission:msg_count' } }
    });
    const current = countVar ? parseInt(countVar.value, 10) || 0 : 0;
    await prisma.customVariable.upsert({
      where: { groupId_userId_key: { groupId: 'global', userId, key: 'mission:msg_count' } },
      create: { groupId: 'global', userId, key: 'mission:msg_count', value: '1' },
      update: { value: String(current + 1) }
    });
  } catch (err) {
    console.error('[Mission Msg Log Fail]', err);
  }
}

export async function updateDailyMissionCmdCount(userId: string) {
  try {
    await resetDailyMissionsIfNewDay(userId);
    const countVar = await prisma.customVariable.findUnique({
      where: { groupId_userId_key: { groupId: 'global', userId, key: 'mission:cmd_count' } }
    });
    const current = countVar ? parseInt(countVar.value, 10) || 0 : 0;
    await prisma.customVariable.upsert({
      where: { groupId_userId_key: { groupId: 'global', userId, key: 'mission:cmd_count' } },
      create: { groupId: 'global', userId, key: 'mission:cmd_count', value: '1' },
      update: { value: String(current + 1) }
    });
  } catch (err) {
    console.error('[Mission Cmd Log Fail]', err);
  }
}

export async function updateDailyMissionStickerCount(userId: string) {
  try {
    await resetDailyMissionsIfNewDay(userId);
    const countVar = await prisma.customVariable.findUnique({
      where: { groupId_userId_key: { groupId: 'global', userId, key: 'mission:sticker_count' } }
    });
    const current = countVar ? parseInt(countVar.value, 10) || 0 : 0;
    await prisma.customVariable.upsert({
      where: { groupId_userId_key: { groupId: 'global', userId, key: 'mission:sticker_count' } },
      create: { groupId: 'global', userId, key: 'mission:sticker_count', value: '1' },
      update: { value: String(current + 1) }
    });
  } catch (err) {
    console.error('[Mission Sticker Log Fail]', err);
  }
}

async function grantSeasonReward(userId: string, tier: SeasonTier, adapter: WhatsAppAdapter, chatId: string) {
  try {
    if (tier.rewardType === 'balance') {
      const amount = parseInt(tier.rewardValue, 10);
      await prisma.userEconomy.upsert({
        where: { userId },
        create: { userId, balance: amount, xp: 0, level: 1 },
        update: { balance: { increment: amount } }
      });
      await adapter.sendMessage(chatId, `🎁 Hadiah Tier ${tier.tier} diklaim: *Rp ${amount.toLocaleString('id-ID')}*!`, { mentions: [userId] });
    } else if (tier.rewardType === 'title') {
      await prisma.userProfile.upsert({
        where: { userId },
        create: { userId, title: tier.rewardValue },
        update: { title: tier.rewardValue }
      });
      await adapter.sendMessage(chatId, `🎁 Hadiah Tier ${tier.tier} diklaim: Gelar baru *"${tier.rewardValue}"*!`, { mentions: [userId] });
    } else if (tier.rewardType === 'badge') {
      const profile = await prisma.userProfile.findUnique({ where: { userId } });
      const badges: string[] = JSON.parse(profile?.badgesJson || '[]');
      if (!badges.includes(tier.rewardValue)) {
        badges.push(tier.rewardValue);
        await prisma.userProfile.upsert({
          where: { userId },
          create: { userId, badgesJson: JSON.stringify(badges) },
          update: { badgesJson: JSON.stringify(badges) }
        });
      }
      await adapter.sendMessage(chatId, `🎁 Hadiah Tier ${tier.tier} diklaim: Badge baru *"${tier.rewardValue}"*!`, { mentions: [userId] });
    }
  } catch (err) {
    console.error('Failed to grant season reward:', err);
  }
}

async function addSeasonXp(userId: string, xpToAdd: number, adapter: WhatsAppAdapter, chatId: string): Promise<string> {
  const xpVar = await prisma.customVariable.findUnique({
    where: { groupId_userId_key: { groupId: 'global', userId, key: 'season:xp' } }
  });
  const tierVar = await prisma.customVariable.findUnique({
    where: { groupId_userId_key: { groupId: 'global', userId, key: 'season:tier' } }
  });

  let currentXp = xpVar ? parseInt(xpVar.value, 10) || 0 : 0;
  let currentTier = tierVar ? parseInt(tierVar.value, 10) || 1 : 1;

  currentXp += xpToAdd;
  let messages = '';

  while (true) {
    const nextTierConfig = SEASON_TIERS.find(t => t.tier === currentTier);
    if (!nextTierConfig) break; // max tier reached
    if (currentXp >= nextTierConfig.xpNeeded) {
      currentXp -= nextTierConfig.xpNeeded;
      currentTier += 1;
      
      // Grant Reward
      await grantSeasonReward(userId, nextTierConfig, adapter, chatId);
      messages += `\n🎉 *SEASON PASS UPGRADE!* Kamu naik ke *Tier ${currentTier}*!`;
    } else {
      break;
    }
  }

  await prisma.customVariable.upsert({
    where: { groupId_userId_key: { groupId: 'global', userId, key: 'season:xp' } },
    create: { groupId: 'global', userId, key: 'season:xp', value: String(currentXp) },
    update: { value: String(currentXp) }
  });

  await prisma.customVariable.upsert({
    where: { groupId_userId_key: { groupId: 'global', userId, key: 'season:tier' } },
    create: { groupId: 'global', userId, key: 'season:tier', value: String(currentTier) },
    update: { value: String(currentTier) }
  });

  return messages;
}

export class MissionCommand implements Command {
  private getProgressBar(current: number, target: number): string {
    const bars = 10;
    const progress = Math.min(bars, Math.round((current / target) * bars));
    const empty = bars - progress;
    return '[' + '█'.repeat(progress) + '░'.repeat(empty) + ']';
  }

  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // Reset daily logs if it is a new day
    await resetDailyMissionsIfNewDay(ctx.senderId);

    // --- 1. /mission ---
    if (cmd === 'mission' || cmd === 'misi') {
      const [msgCountVar, cmdCountVar, stickerCountVar, claimedVar] = await Promise.all([
        prisma.customVariable.findUnique({ where: { groupId_userId_key: { groupId: 'global', userId: ctx.senderId, key: 'mission:msg_count' } } }),
        prisma.customVariable.findUnique({ where: { groupId_userId_key: { groupId: 'global', userId: ctx.senderId, key: 'mission:cmd_count' } } }),
        prisma.customVariable.findUnique({ where: { groupId_userId_key: { groupId: 'global', userId: ctx.senderId, key: 'mission:sticker_count' } } }),
        prisma.customVariable.findUnique({ where: { groupId_userId_key: { groupId: 'global', userId: ctx.senderId, key: 'mission:claimed' } } })
      ]);

      const msgCount = msgCountVar ? parseInt(msgCountVar.value, 10) || 0 : 0;
      const cmdCount = cmdCountVar ? parseInt(cmdCountVar.value, 10) || 0 : 0;
      const stickerCount = stickerCountVar ? parseInt(stickerCountVar.value, 10) || 0 : 0;
      const claimed: string[] = claimedVar ? JSON.parse(claimedVar.value) || [] : [];

      let msg = `📅 *MISI HARIAN WARGA* 📅\n\n`;

      DAILY_MISSIONS.forEach((m, idx) => {
        let current = 0;
        if (m.type === 'msg') current = msgCount;
        if (m.type === 'cmd') current = cmdCount;
        if (m.type === 'sticker') current = stickerCount;

        const isCompleted = current >= m.target;
        const isClaimed = claimed.includes(m.id);

        let statusStr = '❌ Belum Selesai';
        if (isClaimed) statusStr = '✅ Sudah Diklaim';
        else if (isCompleted) statusStr = '🎁 Siap Klaim (ketik `/claimmission ' + m.id + '`)';

        msg += `*${idx + 1}. ${m.name}*\n`;
        msg += `   └ Deskripsi: ${m.desc}\n`;
        msg += `   └ Progress: ${this.getProgressBar(current, m.target)} ${current}/${m.target}\n`;
        msg += `   └ Reward: Rp ${m.balReward} & ${m.xpReward} Season XP\n`;
        msg += `   └ Status: *${statusStr}*\n\n`;
      });

      await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      return;
    }

    // --- 2. /claimmission <mission_id> ---
    if (cmd === 'claimmission' || cmd === 'klaimmisi') {
      const missionId = args[0]?.trim();
      if (!missionId) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan ID Misi yang ingin diklaim. Contoh: `/claimmission msg_10`', { quotedMessageId: ctx.id });
        return;
      }

      const mission = DAILY_MISSIONS.find(m => m.id === missionId);
      if (!mission) {
        await adapter.sendMessage(ctx.chatId, '⚠️ ID Misi tidak valid.', { quotedMessageId: ctx.id });
        return;
      }

      // Check current counts
      const [msgCountVar, cmdCountVar, stickerCountVar, claimedVar] = await Promise.all([
        prisma.customVariable.findUnique({ where: { groupId_userId_key: { groupId: 'global', userId: ctx.senderId, key: 'mission:msg_count' } } }),
        prisma.customVariable.findUnique({ where: { groupId_userId_key: { groupId: 'global', userId: ctx.senderId, key: 'mission:cmd_count' } } }),
        prisma.customVariable.findUnique({ where: { groupId_userId_key: { groupId: 'global', userId: ctx.senderId, key: 'mission:sticker_count' } } }),
        prisma.customVariable.findUnique({ where: { groupId_userId_key: { groupId: 'global', userId: ctx.senderId, key: 'mission:claimed' } } })
      ]);

      const msgCount = msgCountVar ? parseInt(msgCountVar.value, 10) || 0 : 0;
      const cmdCount = cmdCountVar ? parseInt(cmdCountVar.value, 10) || 0 : 0;
      const stickerCount = stickerCountVar ? parseInt(stickerCountVar.value, 10) || 0 : 0;
      const claimed: string[] = claimedVar ? JSON.parse(claimedVar.value) || [] : [];

      if (claimed.includes(missionId)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Misi ini sudah kamu klaim sebelumnya.', { quotedMessageId: ctx.id });
        return;
      }

      let current = 0;
      if (mission.type === 'msg') current = msgCount;
      if (mission.type === 'cmd') current = cmdCount;
      if (mission.type === 'sticker') current = stickerCount;

      if (current < mission.target) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Misi belum selesai. Progress: ${current}/${mission.target}`, { quotedMessageId: ctx.id });
        return;
      }

      // Mark as claimed
      claimed.push(missionId);
      await prisma.customVariable.upsert({
        where: { groupId_userId_key: { groupId: 'global', userId: ctx.senderId, key: 'mission:claimed' } },
        create: { groupId: 'global', userId: ctx.senderId, key: 'mission:claimed', value: JSON.stringify(claimed) },
        update: { value: JSON.stringify(claimed) }
      });

      // Grant rewards
      await prisma.userEconomy.upsert({
        where: { userId: ctx.senderId },
        create: { userId: ctx.senderId, balance: mission.balReward, xp: 0, level: 1 },
        update: { balance: { increment: mission.balReward } }
      });

      let response = `✅ *KLAIM MISI HARIAN BERHASIL!* ✅\n\n`;
      response += `• Misi: *${mission.name}*\n`;
      response += `• Hadirkan: *+Rp ${mission.balReward}* & *+${mission.xpReward}* Season XP`;

      const seasonMsg = await addSeasonXp(ctx.senderId, mission.xpReward, adapter, ctx.chatId);
      response += seasonMsg;

      await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
      return;
    }

    // --- 3. /season ---
    if (cmd === 'season') {
      const [xpVar, tierVar] = await Promise.all([
        prisma.customVariable.findUnique({ where: { groupId_userId_key: { groupId: 'global', userId: ctx.senderId, key: 'season:xp' } } }),
        prisma.customVariable.findUnique({ where: { groupId_userId_key: { groupId: 'global', userId: ctx.senderId, key: 'season:tier' } } })
      ]);

      const currentXp = xpVar ? parseInt(xpVar.value, 10) || 0 : 0;
      const currentTier = tierVar ? parseInt(tierVar.value, 10) || 1 : 1;

      const tierConfig = SEASON_TIERS.find(t => t.tier === currentTier);
      const xpNeeded = tierConfig ? tierConfig.xpNeeded : 0;

      let msg = `🏆 *SEASON PASS: DAWN OF WARGA* 🏆\n\n`;
      msg += `• Tier saat ini: *Tier ${currentTier}*\n`;
      if (tierConfig) {
        msg += `• XP saat ini: *${currentXp}/${xpNeeded} XP*\n`;
        msg += `• Progress Tier: ${this.getProgressBar(currentXp, xpNeeded)}\n`;
        msg += `• Hadiah Tier Berikutnya (${currentTier}): *${tierConfig.rewardDesc}*\n`;
      } else {
        msg += `• XP saat ini: *${currentXp} XP* (Tier Maksimal Tercapai! 👑)\n`;
      }
      msg += `\nKetik \`/pass\` untuk melihat daftar seluruh tier dan hadiah season.`;

      await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      return;
    }

    // --- 4. /pass ---
    if (cmd === 'pass') {
      let msg = `🎟️ *DAFTAR TIER & HADIAH SEASON PASS* 🎟️\n\n`;
      SEASON_TIERS.forEach(t => {
        msg += `⭐ *Tier ${t.tier}* (Butuh ${t.xpNeeded} XP)\n`;
        msg += `   └ Hadiah: *${t.rewardDesc}*\n\n`;
      });
      msg += `💡 Selesaikan misi harian (\`/mission\`) untuk mendapatkan Season XP!`;

      await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      return;
    }
  }
}

const missionCmd = new MissionCommand();
registerCommand(['mission', 'misi', 'claimmission', 'klaimmisi', 'season', 'pass'], missionCmd);
