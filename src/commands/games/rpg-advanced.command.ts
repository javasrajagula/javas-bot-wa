import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';

// In-memory RPG game stats fallbacks
const activeRaids = new Map<string, { bossName: string; hp: number; maxHp: number; participants: Set<string> }>();
const petInventories = new Map<string, { petName: string; level: number; exp: number }>();
const activeDungeons = new Map<string, { floor: number; hp: number }>();

export class RpgAdvancedCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // 1. /raid
    if (cmd === 'raid') {
      const action = args[0]?.toLowerCase();
      const key = ctx.chatId;

      if (action === 'start' || !action) {
        const bossName = 'Naga Merah Purba';
        activeRaids.set(key, { bossName, hp: 1000, maxHp: 1000, participants: new Set([ctx.senderId]) });
        await adapter.sendMessage(ctx.chatId, `🐉 *RAID BOSS GRUP* 🐉\n\nBos *${bossName}* muncul!\nHP: *1000/1000*\n\nKetik \`/raid serang\` untuk ikut menyerang bos bersama grup!`, { quotedMessageId: ctx.id });
        return;
      }

      if (action === 'serang') {
        const raid = activeRaids.get(key);
        if (!raid) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada bos raid aktif di grup ini. Ketik `/raid` untuk memanggil bos!', { quotedMessageId: ctx.id });
          return;
        }

        const dmg = Math.floor(Math.random() * 80) + 20;
        raid.hp = Math.max(0, raid.hp - dmg);
        raid.participants.add(ctx.senderId);

        let msg = `💥 @${ctx.senderId.split('@')[0]} memberikan *${dmg} DMG* kepada *${raid.bossName}*!\nHP Sisa Bos: *${raid.hp}/${raid.maxHp}*`;

        if (raid.hp <= 0) {
          activeRaids.delete(key);
          msg += `\n\n🏆 *BOS DIKALAHKAN!* Semua peserta mendapatkan hadiah *100 koin*!`;
          for (const p of Array.from(raid.participants)) {
            await prisma.userEconomy.upsert({
              where: { userId: p },
              create: { userId: p, balance: 100 },
              update: { balance: { increment: 100 } }
            });
          }
        }
        await adapter.sendMessage(ctx.chatId, msg, { mentions: [ctx.senderId], quotedMessageId: ctx.id });
        return;
      }
      return;
    }

    // 2. /mancing
    if (cmd === 'mancing') {
      const fishes = [
        { name: 'Ikan Mas', price: 10, rarity: 'Common' },
        { name: 'Ikan Lele', price: 15, rarity: 'Common' },
        { name: 'Ikan Gurame', price: 30, rarity: 'Rare' },
        { name: 'Ikan Salmon', price: 80, rarity: 'Epic' },
        { name: 'Hiu Emas Magis', price: 300, rarity: 'Legendary' }
      ];

      const roll = Math.random();
      let chosen = fishes[0];
      if (roll > 0.98) chosen = fishes[4]; // Legendary
      else if (roll > 0.90) chosen = fishes[3]; // Epic
      else if (roll > 0.70) chosen = fishes[2]; // Rare
      else if (roll > 0.35) chosen = fishes[1]; // Common Lele

      await prisma.userEconomy.upsert({
        where: { userId: ctx.senderId },
        create: { userId: ctx.senderId, balance: chosen.price },
        update: { balance: { increment: chosen.price } }
      });

      await adapter.sendMessage(ctx.chatId, `🎣 *MEMANCING MANIA* 🎣\n\nSelamat @${ctx.senderId.split('@')[0]} mendapatkan:\n🐟 *${chosen.name}* [${chosen.rarity}]\nHarga Jual: *${chosen.price} koin* (Langsung masuk ke saldo)`, { mentions: [ctx.senderId], quotedMessageId: ctx.id });
      return;
    }

    // 3. /pet [adopt/train/stats]
    if (cmd === 'pet') {
      const action = args[0]?.toLowerCase();
      const petName = args.slice(1).join(' ').trim();
      const key = ctx.senderId;

      let pet = petInventories.get(key);

      if (action === 'adopt') {
        if (!petName) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tentukan nama pet. Contoh: `/pet adopt Ciko`', { quotedMessageId: ctx.id });
          return;
        }
        if (pet) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Anda sudah memiliki pet bernama *${pet.petName}*.`, { quotedMessageId: ctx.id });
          return;
        }
        petInventories.set(key, { petName, level: 1, exp: 0 });
        await adapter.sendMessage(ctx.chatId, `🐾 Berhasil mengadopsi pet bernama *${petName}*! Rawat baik-baik ya.`, { quotedMessageId: ctx.id });
        return;
      }

      if (!pet) {
        await adapter.sendMessage(ctx.chatId, '🐾 Anda belum memiliki pet. Ketik `/pet adopt <nama>` untuk mengadopsi pet baru!', { quotedMessageId: ctx.id });
        return;
      }

      if (action === 'train') {
        pet.exp += 40;
        let msg = `🏋️ Anda melatih *${pet.petName}*! (+40 EXP)\n`;
        if (pet.exp >= 100) {
          pet.level++;
          pet.exp = 0;
          msg += `🎉 *LEVEL UP!* *${pet.petName}* naik ke *Level ${pet.level}*!`;
        } else {
          msg += `EXP Saat ini: *${pet.exp}/100*`;
        }
        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        return;
      }

      // Default stats
      await adapter.sendMessage(ctx.chatId, `🐾 *STATUS PET ANDA* 🐾\n\nNama: *${pet.petName}*\nLevel: *${pet.level}*\nEXP: *${pet.exp}/100*`, { quotedMessageId: ctx.id });
      return;
    }

    // 4. /blackjack <taruhan>
    if (cmd === 'blackjack') {
      const bet = parseInt(args[0]) || 10;
      const econ = await prisma.userEconomy.findUnique({ where: { userId: ctx.senderId } });
      const balance = econ?.balance || 0;

      if (balance < bet) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Saldo Anda kurang untuk melakukan blackjack sebesar *${bet} koin*.`, { quotedMessageId: ctx.id });
        return;
      }

      const playerVal = Math.floor(Math.random() * 10) + 12; // 12-21
      const dealerVal = Math.floor(Math.random() * 10) + 12; // 12-21

      let msg = `🃏 *BLACKJACK CASINO* 🃏\n\n*Kartu Anda:* ${playerVal}\n*Kartu Dealer:* ${dealerVal}\n\n`;

      if (playerVal > 21) {
        await prisma.userEconomy.update({ where: { userId: ctx.senderId }, data: { balance: { decrement: bet } } });
        msg += `❌ *BUST!* Anda kalah. (-${bet} koin)`;
      } else if (dealerVal > 21 || playerVal > dealerVal) {
        await prisma.userEconomy.update({ where: { userId: ctx.senderId }, data: { balance: { increment: bet } } });
        msg += `🏆 *MENANG!* Anda mengalahkan dealer. (+${bet} koin)`;
      } else if (playerVal === dealerVal) {
        msg += `⚖️ *SERI!* Koin Anda dikembalikan.`;
      } else {
        await prisma.userEconomy.update({ where: { userId: ctx.senderId }, data: { balance: { decrement: bet } } });
        msg += `❌ *KALAH!* Dealer menang. (-${bet} koin)`;
      }

      await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      return;
    }

    // 5. /tambang
    if (cmd === 'tambang') {
      const minerals = ['Batu Bara', 'Besi', 'Emas', 'Berlian'];
      const weight = [0.60, 0.25, 0.12, 0.03];
      const r = Math.random();
      let selected = minerals[0];
      let sum = 0;
      for (let i = 0; i < minerals.length; i++) {
        sum += weight[i];
        if (r <= sum) {
          selected = minerals[i];
          break;
        }
      }

      await prisma.userInventory.create({
        data: { userId: ctx.senderId, itemId: selected, quantity: 1 }
      });

      await adapter.sendMessage(ctx.chatId, `⛏️ *PERTAMBANGAN Virtual* ⛏️\n\nAnda menggali dan mendapatkan *1x ${selected}*! Berhasil dimasukkan ke inventory.`, { quotedMessageId: ctx.id });
      return;
    }

    // 6. /dungeon
    if (cmd === 'dungeon') {
      const key = `${ctx.chatId}:${ctx.senderId}`;
      let dg = activeDungeons.get(key);
      if (!dg) {
        dg = { floor: 1, hp: 100 };
        activeDungeons.set(key, dg);
      }

      const isWin = Math.random() > 0.3;
      if (isWin) {
        dg.floor++;
        const prize = dg.floor * 15;
        await prisma.userEconomy.upsert({
          where: { userId: ctx.senderId },
          create: { userId: ctx.senderId, balance: prize },
          update: { balance: { increment: prize } }
        });
        await adapter.sendMessage(ctx.chatId, `🏰 *DUNGEON FLOOR ${dg.floor - 1} CLEAR!* 🏰\n\nSelamat Anda lolos ke lantai berikutnya! Hadiah: *${prize} koin*. Sisa HP Anda: *${dg.hp}/100*`, { quotedMessageId: ctx.id });
      } else {
        dg.hp = Math.max(0, dg.hp - 40);
        if (dg.hp <= 0) {
          activeDungeons.delete(key);
          await adapter.sendMessage(ctx.chatId, `💀 *DUNGEON DEFEAT!* 💀\n\nKarakter Anda tumbang di lantai *${dg.floor}*! Sesi dungeon disetel ulang.`, { quotedMessageId: ctx.id });
        } else {
          await adapter.sendMessage(ctx.chatId, `⚔️ Anda terluka di lantai *${dg.floor}*! Sisa HP Anda: *${dg.hp}/100*`, { quotedMessageId: ctx.id });
        }
      }
      return;
    }

    // 7. /kerja
    if (cmd === 'kerja') {
      const jobs = [
        { name: 'Koki Restoran', salary: 30 },
        { name: 'Supir Taksi', salary: 35 },
        { name: 'Polisi Pamong', salary: 40 },
        { name: 'Programmer Magang', salary: 50 }
      ];
      const job = jobs[Math.floor(Math.random() * jobs.length)];
      await prisma.userEconomy.upsert({
        where: { userId: ctx.senderId },
        create: { userId: ctx.senderId, balance: job.salary },
        update: { balance: { increment: job.salary } }
      });

      await adapter.sendMessage(ctx.chatId, `💼 *BEKERJA DENGAN GIAT* 💼\n\nAnda bekerja sebagai *${job.name}* hari ini dan mendapatkan gaji sebesar *${job.salary} koin*!`, { quotedMessageId: ctx.id });
      return;
    }

    // 8. /bisnis
    if (cmd === 'bisnis') {
      const price = 500;
      const profit = 40;
      const key = `bisnis-${ctx.senderId}`;

      const action = args[0]?.toLowerCase();
      if (action === 'beli') {
        const econ = await prisma.userEconomy.findUnique({ where: { userId: ctx.senderId } });
        if ((econ?.balance || 0) < price) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Saldo koin Anda kurang dari *${price}* untuk membeli Toko Virtual.`, { quotedMessageId: ctx.id });
          return;
        }

        await prisma.userEconomy.update({
          where: { userId: ctx.senderId },
          data: { balance: { decrement: price } }
        });

        await prisma.userInventory.create({
          data: { userId: ctx.senderId, itemId: key, quantity: 1 }
        });

        await adapter.sendMessage(ctx.chatId, `🏢 *INVESTASI BISNIS* 🏢\n\nSelamat! Anda membeli *Toko Virtual* seharga *500 koin*. Toko ini akan memberi Anda profit pasif jika Anda memanennya via \`/bisnis panen\`.`, { quotedMessageId: ctx.id });
        return;
      }

      if (action === 'panen') {
        const inv = await prisma.userInventory.findFirst({ where: { userId: ctx.senderId, itemId: key } });
        if (!inv || inv.quantity <= 0) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Anda belum memiliki bisnis Toko Virtual. Beli terlebih dahulu dengan `/bisnis beli`', { quotedMessageId: ctx.id });
          return;
        }

        await prisma.userEconomy.update({
          where: { userId: ctx.senderId },
          data: { balance: { increment: profit } }
        });

        await adapter.sendMessage(ctx.chatId, `💰 *PANEN PROFIT* 💰\n\nAnda memanen keuntungan toko sebesar *${profit} koin*!`, { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `🏢 *TYCOON BISNIS VIRTUAL* 🏢\n\n1. \`/bisnis beli\` — Beli Toko Virtual (Harga: 500 koin)\n2. \`/bisnis panen\` — Ambil profit bisnis (Profit: 40 koin)`, { quotedMessageId: ctx.id });
      return;
    }
  }
}

const rpgAdvancedCmd = new RpgAdvancedCommand();
registerCommand(['raid', 'mancing', 'pet', 'blackjack', 'tambang', 'dungeon', 'kerja', 'bisnis'], rpgAdvancedCmd);
