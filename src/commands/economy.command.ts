import { Command, registerCommand } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import { getGroupFeatures } from '../config/feature-flags.js';
import prisma from '../db/client.js';

// Cooldown helper for XP gain (to prevent spamming)
const xpCooldowns = new Map<string, number>();

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

    await prisma.userEconomy.upsert({
      where: { userId: ctx.senderId },
      create: {
        userId: ctx.senderId,
        balance: randomBalance,
        xp: claimXp,
        level: 1,
        lastClaim: now,
      },
      update: {
        balance: { increment: randomBalance },
        xp: { increment: claimXp },
        lastClaim: now,
      },
    });

    // Check level up as well
    const { newLevel } = await addXpAndBalance(ctx.senderId, 0, 0);

    let response = `🎁 *DAILY CLAIM* 🎁\n\nSelamat! Kamu mendapatkan:\n💵 *+Rp. ${randomBalance.toLocaleString('id-ID')}*\n📊 *+${claimXp} XP*`;
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

    // Find rank globally
    const allUsers = await prisma.userEconomy.findMany({
      orderBy: [
        { level: 'desc' },
        { xp: 'desc' },
      ],
    });

    const rankPos = allUsers.findIndex(u => u.userId === ctx.senderId) + 1 || allUsers.length + 1;

    const mention = `@${ctx.senderId.split('@')[0]}`;
    const response = `📊 *RANKING WARGA* 📊

👤 *Pengguna:* ${mention}
📊 *Level:* ${level}
✨ *XP:* ${xp} / ${xpNeeded}
🏆 *Peringkat Global:* #${rankPos} dari ${allUsers.length} warga`;

    await adapter.sendMessage(ctx.chatId, response, {
      quotedMessageId: ctx.id,
      mentions: [ctx.senderId],
    });
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

    await adapter.sendMessage(ctx.chatId, response, {
      quotedMessageId: ctx.id,
      mentions,
    });
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
    const sub = args[0]?.toLowerCase();
    const val = args.slice(1).join(' ').trim();

    if (sub !== 'set' || !val) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/title set Warga Kece`', { quotedMessageId: ctx.id });
      return;
    }

    // Check if user has a custom title item in inventory
    const inventory = await prisma.userInventory.findFirst({
      where: { userId: ctx.senderId, itemId: 'title keren' }
    });

    if (!inventory) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Anda harus membeli item "title keren" terlebih dahulu di /shop.', { quotedMessageId: ctx.id });
      return;
    }

    // Consume item
    await prisma.userInventory.delete({ where: { id: inventory.id } });

    // Save custom title in UserProfile metadata JSON
    await prisma.userProfile.upsert({
      where: { userId: ctx.senderId },
      create: { userId: ctx.senderId, language: 'id', isPremium: false },
      update: {}
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

    else {
      // Pet status
      const statusText = `🐱 *PET PROFILE: ${pet.name.toUpperCase()}* 🐱\n\n` +
        `- Jenis: *${pet.type}*\n` +
        `- Level: *${pet.level}*\n` +
        `- XP: *${pet.xp} / ${pet.level * 100}*\n` +
        `- Kelaparan: *${pet.hunger}%*`;
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
        ? `🏆 *DUNGEON BERSIH!* 🏆\n\nAnda mengalahkan Goblin Boss!\n💰 Reward: *+Rp. ${gold}*\n✨ XP: *+${xp}*`
        : `💀 *KALAH BATTLE!* 💀\n\nAnda babak belur diserang Slime.\n💰 Reward Hiburan: *+Rp. ${gold}*\n✨ XP: *+${xp}*`;

      await adapter.sendMessage(ctx.chatId, response);
    }, 3000);
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
registerCommand(['title'], new TitleCommand());
registerCommand(['pet'], new PetCommand());
registerCommand(['dungeon'], new DungeonCommand());

