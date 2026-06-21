import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';

// In-memory states
const activeAuctions = new Map<string, { item: string; owner: string; highestBid: number; highestBidder?: string }>();
const guildList = new Map<string, { owner: string; members: Set<string> }>();
const farmStates = new Map<string, { crop: string; stage: 'seed' | 'growing' | 'ready'; plantedAt: number }>();
const stockMarket = new Map<string, number>([
  ['BTC', 95000],
  ['ETH', 3500],
  ['SOL', 250],
  ['AAPL', 180]
]);

export class EconomyAdvancedCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // 1. /upgradeskill
    if (cmd === 'upgradeskill') {
      const skill = args[0]?.toLowerCase();
      if (!['kekuatan', 'keberuntungan', 'pertahanan'].includes(skill)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Pilih skill yang valid: `kekuatan`, `keberuntungan`, `pertahanan`. Contoh: `/upgradeskill kekuatan`', { quotedMessageId: ctx.id });
        return;
      }

      const econ = await prisma.userEconomy.findUnique({ where: { userId: ctx.senderId } });
      const balance = econ?.balance || 0;
      if (balance < 100) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Saldo koin Anda kurang dari 100 untuk upgrade skill.', { quotedMessageId: ctx.id });
        return;
      }

      await prisma.userEconomy.update({
        where: { userId: ctx.senderId },
        data: { balance: { decrement: 100 } }
      });

      await adapter.sendMessage(ctx.chatId, `✅ Berhasil meng-upgrade skill *${skill.toUpperCase()}*! (-100 koin)`, { quotedMessageId: ctx.id });
      return;
    }

    // 2. /lelang
    if (cmd === 'lelang') {
      const item = args[0];
      const price = parseInt(args[1]);
      if (!item || isNaN(price)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/lelang [nama_item] [harga_awal]`', { quotedMessageId: ctx.id });
        return;
      }

      const inv = await prisma.userInventory.findFirst({ where: { userId: ctx.senderId, itemId: item } });
      if (!inv || inv.quantity <= 0) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Anda tidak memiliki item "${item}" di inventory.`, { quotedMessageId: ctx.id });
        return;
      }

      activeAuctions.set(ctx.chatId, {
        item,
        owner: ctx.senderId,
        highestBid: price
      });

      await adapter.sendMessage(ctx.chatId, `📢 *LELANG DIMULAI* 📢\n\nItem: *${item}*\nHarga Awal: *${price} koin*\nPenjual: @${ctx.senderId.split('@')[0]}\n\nKetik \`/bid [jumlah]\` untuk menawar!`, { mentions: [ctx.senderId] });
      return;
    }

    // 3. /bid
    if (cmd === 'bid') {
      const bidVal = parseInt(args[0]);
      const auc = activeAuctions.get(ctx.chatId);
      if (!auc) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada lelang aktif di grup ini.', { quotedMessageId: ctx.id });
        return;
      }

      if (isNaN(bidVal) || bidVal <= auc.highestBid) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Penawaran harus lebih tinggi dari penawaran saat ini (*${auc.highestBid} koin*).`, { quotedMessageId: ctx.id });
        return;
      }

      const econ = await prisma.userEconomy.findUnique({ where: { userId: ctx.senderId } });
      if ((econ?.balance || 0) < bidVal) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Koin Anda tidak cukup untuk melakukan bid ini.', { quotedMessageId: ctx.id });
        return;
      }

      auc.highestBid = bidVal;
      auc.highestBidder = ctx.senderId;

      await adapter.sendMessage(ctx.chatId, `⚔️ *BID BARU* ⚔️\n\n@${ctx.senderId.split('@')[0]} menawar *${bidVal} koin* untuk item *${auc.item}*!`, { mentions: [ctx.senderId] });
      return;
    }

    // 4. /craft
    if (cmd === 'craft') {
      const item1 = args[0];
      const item2 = args[1];
      if (!item1 || !item2) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/craft [item1] [item2]`', { quotedMessageId: ctx.id });
        return;
      }

      const inv1 = await prisma.userInventory.findFirst({ where: { userId: ctx.senderId, itemId: item1 } });
      const inv2 = await prisma.userInventory.findFirst({ where: { userId: ctx.senderId, itemId: item2 } });

      if (!inv1 || inv1.quantity <= 0 || !inv2 || inv2.quantity <= 0) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Bahan crafting Anda tidak cukup di inventory.', { quotedMessageId: ctx.id });
        return;
      }

      // Remove materials
      await prisma.userInventory.delete({ where: { id: inv1.id } });
      await prisma.userInventory.delete({ where: { id: inv2.id } });

      const resultItem = `${item1}-${item2} premium`;
      await prisma.userInventory.create({
        data: { userId: ctx.senderId, itemId: resultItem, quantity: 1 }
      });

      await adapter.sendMessage(ctx.chatId, `🔨 *CRAFTING BERHASIL* 🔨\n\nAnda menggabungkan *${item1}* + *${item2}* menjadi *${resultItem}*!`, { quotedMessageId: ctx.id });
      return;
    }

    // 5. /guild
    if (cmd === 'guild') {
      const action = args[0]?.toLowerCase();
      const guildName = args.slice(1).join(' ').trim();

      if (action === 'create') {
        if (!guildName) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan nama guild. Contoh: `/guild create Ksatria`', { quotedMessageId: ctx.id });
          return;
        }
        guildList.set(guildName.toLowerCase(), { owner: ctx.senderId, members: new Set([ctx.senderId]) });
        await adapter.sendMessage(ctx.chatId, `🏰 Guild *${guildName}* berhasil dibuat!`, { quotedMessageId: ctx.id });
        return;
      }

      if (action === 'join') {
        if (!guildName) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan nama guild yang ingin diikuti.', { quotedMessageId: ctx.id });
          return;
        }
        const g = guildList.get(guildName.toLowerCase());
        if (!g) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Guild "${guildName}" tidak ditemukan.`, { quotedMessageId: ctx.id });
          return;
        }
        g.members.add(ctx.senderId);
        await adapter.sendMessage(ctx.chatId, `🏰 Anda bergabung dengan guild *${guildName}*!`, { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `🏰 *MENU GUILD* 🏰\n\n1. \`/guild create <nama_guild>\`\n2. \`/guild join <nama_guild>\``, { quotedMessageId: ctx.id });
      return;
    }

    // 6. /trade @user
    if (cmd === 'trade') {
      const mention = ctx.body.match(/@\d+/g)?.[0];
      const item = args.slice(1).join(' ').trim();
      if (!mention || !item) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/trade @user [item]`', { quotedMessageId: ctx.id });
        return;
      }

      const targetId = mention.replace('@', '') + '@s.whatsapp.net';
      const inv = await prisma.userInventory.findFirst({ where: { userId: ctx.senderId, itemId: item } });
      if (!inv || inv.quantity <= 0) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Anda tidak memiliki item "${item}" di inventory.`, { quotedMessageId: ctx.id });
        return;
      }

      await prisma.userInventory.delete({ where: { id: inv.id } });
      await prisma.userInventory.create({ data: { userId: targetId, itemId: item, quantity: 1 } });

      await adapter.sendMessage(ctx.chatId, `🔄 *BARTER BERHASIL* 🔄\n\n@${ctx.senderId.split('@')[0]} mengirimkan item *${item}* kepada @${targetId.split('@')[0]}!`, { mentions: [ctx.senderId, targetId] });
      return;
    }

    // 7. /event
    if (cmd === 'event') {
      await adapter.sendMessage(ctx.chatId, `🎃 *SEASONAL EVENT: HALLOWEEN* 🎃\n\nDapatkan quest khusus dengan mengetik \`/rpg adventure\`. Selesaikan quest untuk mendapat *Labu Emas*!`, { quotedMessageId: ctx.id });
      return;
    }

    // 8. /farm
    if (cmd === 'farm') {
      const action = args[0]?.toLowerCase();
      const key = `${ctx.chatId}:${ctx.senderId}`;

      if (action === 'plant') {
        const crop = args[1] || 'padi';
        farmStates.set(key, { crop, stage: 'seed', plantedAt: Date.now() });
        await adapter.sendMessage(ctx.chatId, `🌱 Anda menanam bibit *${crop}* di kebun virtual!`, { quotedMessageId: ctx.id });
        return;
      }

      if (action === 'water') {
        const plant = farmStates.get(key);
        if (!plant) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Anda belum menanam apapun. Ketik `/farm plant padi`', { quotedMessageId: ctx.id });
          return;
        }
        plant.stage = 'growing';
        await adapter.sendMessage(ctx.chatId, `💦 Anda menyiram kebun! Tanaman *${plant.crop}* Anda tumbuh subur.`, { quotedMessageId: ctx.id });
        return;
      }

      if (action === 'harvest') {
        const plant = farmStates.get(key);
        if (!plant || plant.stage !== 'growing') {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tanaman belum siap panen atau belum disiram.', { quotedMessageId: ctx.id });
          return;
        }
        farmStates.delete(key);
        await prisma.userInventory.create({ data: { userId: ctx.senderId, itemId: plant.crop, quantity: 5 } });
        await adapter.sendMessage(ctx.chatId, `🌾 *PANEN BERHASIL!* Anda memanen 5 *${plant.crop}*!`, { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `🌾 *KEBUN VIRTUAL* 🌾\n\n1. \`/farm plant <tanaman>\`\n2. \`/farm water\`\n3. \`/farm harvest\``, { quotedMessageId: ctx.id });
      return;
    }

    // 9. /gacha
    if (cmd === 'gacha') {
      const ratings = ['Common', 'Rare', 'Epic', 'Legendary'];
      const weight = [0.70, 0.20, 0.08, 0.02];
      
      const r = Math.random();
      let selected = ratings[0];
      let sum = 0;
      for (let i = 0; i < ratings.length; i++) {
        sum += weight[i];
        if (r <= sum) {
          selected = ratings[i];
          break;
        }
      }

      const cardName = `${selected} Card Hero`;
      await prisma.userInventory.create({ data: { userId: ctx.senderId, itemId: cardName, quantity: 1 } });
      await adapter.sendMessage(ctx.chatId, `🃏 *GACHA KARTU* 🃏\n\nSelamat! Anda mendapatkan kartu: *[${selected.toUpperCase()}] ${cardName}*!`, { quotedMessageId: ctx.id });
      return;
    }

    // 10. /saham
    if (cmd === 'saham') {
      const action = args[0]?.toLowerCase();
      const symbol = args[1]?.toUpperCase();
      const qty = parseInt(args[2]);

      if (action === 'list' || !action) {
        let msg = `📈 *PASAR SAHAM & CRYPTO* 📈\n\n`;
        stockMarket.forEach((price, sym) => {
          msg += `• *${sym}*: $${price.toLocaleString()} (${price * 15} koin)\n`;
        });
        msg += `\nCara beli: \`/saham buy BTC 1\``;
        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        return;
      }

      const price = stockMarket.get(symbol);
      if (!price) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Simbol aset tidak ditemukan.', { quotedMessageId: ctx.id });
        return;
      }

      const totalCost = price * 15 * qty;

      if (action === 'buy') {
        const econ = await prisma.userEconomy.findUnique({ where: { userId: ctx.senderId } });
        if ((econ?.balance || 0) < totalCost) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Saldo kurang. Butuh *${totalCost} koin* untuk membeli ${qty} ${symbol}.`, { quotedMessageId: ctx.id });
          return;
        }

        await prisma.userEconomy.update({
          where: { userId: ctx.senderId },
          data: { balance: { decrement: totalCost } }
        });

        await prisma.userInventory.create({ data: { userId: ctx.senderId, itemId: `saham-${symbol}`, quantity: qty } });
        await adapter.sendMessage(ctx.chatId, `💸 Berhasil membeli *${qty} ${symbol}* seharga *${totalCost} koin*!`, { quotedMessageId: ctx.id });
        return;
      }

      if (action === 'sell') {
        const inv = await prisma.userInventory.findFirst({ where: { userId: ctx.senderId, itemId: `saham-${symbol}` } });
        if (!inv || inv.quantity < qty) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Aset saham ${symbol} Anda tidak cukup.`, { quotedMessageId: ctx.id });
          return;
        }

        await prisma.userInventory.delete({ where: { id: inv.id } });
        await prisma.userEconomy.update({
          where: { userId: ctx.senderId },
          data: { balance: { increment: totalCost } }
        });

        await adapter.sendMessage(ctx.chatId, `💸 Berhasil menjual *${qty} ${symbol}* seharga *${totalCost} koin*!`, { quotedMessageId: ctx.id });
        return;
      }
    }
  }
}

const econAdvancedCmd = new EconomyAdvancedCommand();
registerCommand(
  ['upgradeskill', 'lelang', 'bid', 'craft', 'guild', 'trade', 'event', 'farm', 'gacha', 'saham'],
  econAdvancedCmd
);
