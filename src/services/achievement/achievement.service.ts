import prisma from '../../db/client.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';

export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  reward: {
    balance?: number;
    badge?: string;
    title?: string;
  };
}

export const DEFAULT_ACHIEVEMENTS: AchievementDef[] = [
  {
    key: 'first_command',
    name: 'Langkah Pertama',
    description: 'Menjalankan perintah bot pertama kali.',
    rarity: 'common',
    reward: { balance: 100, badge: 'FIRST' }
  },
  {
    key: 'active_7_days',
    name: 'Prajurit Setia',
    description: 'Aktif menggunakan bot selama 7 hari berbeda.',
    rarity: 'rare',
    reward: { balance: 500, badge: 'ACTIVE7' }
  },
  {
    key: 'active_30_days',
    name: 'Veteran Javas',
    description: 'Aktif menggunakan bot selama 30 hari berbeda.',
    rarity: 'epic',
    reward: { balance: 2000, badge: 'ACTIVE30', title: 'Veteran Javas' }
  },
  {
    key: 'messages_100',
    name: 'Chatterbox',
    description: 'Mengirimkan 100 perintah bot.',
    rarity: 'common',
    reward: { balance: 200, badge: '100CMD' }
  },
  {
    key: 'messages_1000',
    name: 'Spam Master',
    description: 'Mengirimkan 1000 perintah bot.',
    rarity: 'rare',
    reward: { balance: 1000, badge: '1000CMD', title: 'Spam Master' }
  },
  {
    key: 'sticker_maker',
    name: 'Sticker Enthusiast',
    description: 'Membuat stiker pertama kali.',
    rarity: 'common',
    reward: { balance: 150, badge: 'STICKER' }
  },
  {
    key: 'game_master',
    name: 'Werewolf Champion',
    description: 'Memenangkan permainan Werewolf.',
    rarity: 'epic',
    reward: { balance: 1000, badge: 'WWCHAMP', title: 'Game Master' }
  },
  {
    key: 'rich_user',
    name: 'Konglomerat Warga',
    description: 'Memiliki total saldo (dompet + bank) sebesar Rp. 10.000.',
    rarity: 'rare',
    reward: { balance: 1000, badge: 'RICH', title: 'Konglomerat Warga' }
  },
  {
    key: 'top_1_leaderboard',
    name: 'Penguasa Kota',
    description: 'Menjadi nomor 1 di Leaderboard global.',
    rarity: 'legendary',
    reward: { balance: 5000, badge: 'TOP1', title: 'Penguasa Kota' }
  },
  {
    key: 'admin_helper',
    name: 'Tangan Kanan Owner',
    description: 'Menjalankan perintah administrasi grup.',
    rarity: 'common',
    reward: { balance: 100, badge: 'ADMIN' }
  },
  {
    key: 'antispam_defender',
    name: 'Penjaga Ketertiban',
    description: 'Menjadi admin saat sistem menghukum spammer.',
    rarity: 'rare',
    reward: { balance: 500, badge: 'DEFENDER' }
  },
  {
    key: 'streak_7',
    name: 'Pengklaim Konsisten',
    description: 'Mencapai 7 hari streak claim harian.',
    rarity: 'rare',
    reward: { balance: 500, badge: 'STREAK7' }
  },
  {
    key: 'streak_30',
    name: 'Dewa Harian',
    description: 'Mencapai 30 hari streak claim harian.',
    rarity: 'legendary',
    reward: { balance: 3000, badge: 'STREAK30', title: 'Dewa Harian' }
  }
];

export interface UserAchievementView {
  key: string;
  name: string;
  description: string;
  rarity: string;
  reward: AchievementDef['reward'];
  unlocked: boolean;
  unlockedAt?: Date;
}

class AchievementService {
  /**
   * Seed / initialize default achievements in database
   */
  public async initAchievements(): Promise<void> {
    for (const def of DEFAULT_ACHIEVEMENTS) {
      await prisma.achievement.upsert({
        where: { key: def.key },
        create: {
          key: def.key,
          name: def.name,
          description: def.description,
          rarity: def.rarity,
          rewardJson: JSON.stringify(def.reward)
        },
        update: {
          name: def.name,
          description: def.description,
          rarity: def.rarity,
          rewardJson: JSON.stringify(def.reward)
        }
      });
    }
    console.log('[System] Default achievements seeded/initialized in database.');
  }

  public parseReward(rewardJson: string): AchievementDef['reward'] {
    try {
      const parsed = JSON.parse(rewardJson || '{}');
      return {
        balance: Number(parsed.balance || 0),
        badge: typeof parsed.badge === 'string' ? parsed.badge : undefined,
        title: typeof parsed.title === 'string' ? parsed.title : undefined
      };
    } catch {
      return {};
    }
  }

  public async getUserAchievementView(userId: string): Promise<UserAchievementView[]> {
    const [achievements, unlockedRows] = await Promise.all([
      prisma.achievement.findMany({
        orderBy: [
          { rarity: 'asc' },
          { name: 'asc' }
        ]
      }),
      prisma.userAchievement.findMany({
        where: { userId }
      })
    ]);

    const unlockedByKey = new Map(unlockedRows.map(row => [row.achievementKey, row]));
    return achievements.map(ach => {
      const unlocked = unlockedByKey.get(ach.key);
      return {
        key: ach.key,
        name: ach.name,
        description: ach.description,
        rarity: ach.rarity,
        reward: this.parseReward(ach.rewardJson),
        unlocked: Boolean(unlocked),
        unlockedAt: unlocked?.unlockedAt
      };
    });
  }

  public async getUnlockedBadgeOptions(userId: string): Promise<string[]> {
    const view = await this.getUserAchievementView(userId);
    return view
      .filter(item => item.unlocked && item.reward.badge)
      .map(item => item.reward.badge!)
      .filter((badge, index, list) => list.indexOf(badge) === index);
  }

  public async getUnlockedTitleOptions(userId: string): Promise<string[]> {
    const view = await this.getUserAchievementView(userId);
    return view
      .filter(item => item.unlocked && item.reward.title)
      .map(item => item.reward.title!)
      .filter((title, index, list) => list.indexOf(title) === index);
  }

  public async checkEconomyAchievements(
    userId: string,
    adapter: WhatsAppAdapter,
    chatIdForNotify?: string
  ): Promise<void> {
    const economy = await prisma.userEconomy.findUnique({ where: { userId } });
    if (!economy) return;

    if ((economy.balance + economy.bank) >= 10000) {
      await this.unlockAchievement(userId, 'rich_user', adapter, chatIdForNotify);
    }
  }

  /**
   * Check and unlock achievement for a user
   */
  public async unlockAchievement(
    userId: string,
    key: string,
    adapter: WhatsAppAdapter,
    chatIdForNotify?: string
  ): Promise<boolean> {
    try {
      const ach = await prisma.achievement.findUnique({ where: { key } });
      if (!ach) return false;

      // Check if already unlocked
      const existing = await prisma.userAchievement.findUnique({
        where: {
          userId_achievementKey: {
            userId,
            achievementKey: key
          }
        }
      });

      if (existing) return false;

      // Unlock!
      await prisma.userAchievement.create({
        data: {
          userId,
          achievementKey: key
        }
      });

      // Parse reward
      const reward = this.parseReward(ach.rewardJson);
      const rewardBal = reward.balance || 0;

      if (rewardBal > 0) {
        await prisma.userEconomy.upsert({
          where: { userId },
          create: { userId, balance: rewardBal },
          update: { balance: { increment: rewardBal } }
        });

        // Log transaction
        await prisma.economyTransaction.create({
          data: {
            userId,
            groupId: chatIdForNotify || null,
            type: 'achievement_reward',
            amount: rewardBal,
            metadataJson: JSON.stringify({ achievementKey: key })
          }
        }).catch(err => console.error('[Achievement Log Failed]', err));
      }

      await this.applyCosmeticRewards(userId, reward);

      // Notify
      const rarityLabels: Record<string, string> = {
        common: '🟢 Common',
        rare: '🔵 Rare',
        epic: '🟣 Epic',
        legendary: '👑 Legendary'
      };

      const rarityLabel = rarityLabels[ach.rarity] || ach.rarity.toUpperCase();
      const mention = `@${userId.split('@')[0]}`;
      const notifyMsg = `🌟 *ACHIEVEMENT UNLOCKED!* 🌟\n\n` +
        `Selamat ${mention}! Anda berhasil membuka pencapaian:\n` +
        `🏆 *${ach.name}* (${rarityLabel})\n` +
        `├ 📝 _${ach.description}_\n` +
        `└ 🎁 Hadiah: *Rp. ${rewardBal.toLocaleString('id-ID')}*`;

      const targetChat = chatIdForNotify || userId;
      await adapter.sendMessage(targetChat, notifyMsg, {
        mentions: [userId]
      });

      return true;
    } catch (err) {
      console.error(`[Achievement Service] Failed to unlock ${key} for ${userId}:`, err);
      return false;
    }
  }

  private async applyCosmeticRewards(userId: string, reward: AchievementDef['reward']): Promise<void> {
    if (!reward.badge && !reward.title) return;

    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    const currentBadges = this.parseStringArray(profile?.badgesJson || '[]');
    const updateData: { badgesJson?: string; title?: string } = {};

    if (reward.badge && !currentBadges.includes(reward.badge)) {
      updateData.badgesJson = JSON.stringify([...currentBadges, reward.badge].slice(0, 6));
    }

    if (reward.title && !profile?.title) {
      updateData.title = reward.title;
    }

    if (!profile) {
      await prisma.userProfile.create({
        data: {
          userId,
          badgesJson: updateData.badgesJson || JSON.stringify([]),
          title: updateData.title
        }
      });
      return;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.userProfile.update({
        where: { userId },
        data: updateData
      });
    }
  }

  private parseStringArray(value: string): string[] {
    try {
      const parsed = JSON.parse(value || '[]');
      return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }
}

export const achievementService = new AchievementService();
export default achievementService;
