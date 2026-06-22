import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';

const RPG_PRIMARY_LIST = [
  'raid', 'mancing', 'hatch', 'pet', 'blackjack', 'mining', 'craft', 'dungeon', 'kerja',
  'realestate', 'buyproperty', 'triviabattle', 'wordchain', 'tebakemoji', 'slot', 'duel',
  'bingo', 'typerace', 'truthordare', 'bracket', 'werewolfv2', 'petmarket', 'trade', 'guildwar',
  'dailyquest', 'season-event', 'alchemy', 'farming', 'stocks', 'stockmarket', 'russianroulette',
  'rpgclass', 'bounty', 'gachacard', 'skilltree', 'petbreed', 'roulette', 'weightlimit',
  'dungeonmaster', 'bankinterest', 'durability', 'guessnumber', 'rpginsurance', 'rankedquiz',
  'blueprint', 'tictactoe', 'chess', 'rpgleaderboard', 'auction', 'monsterpedia', 'petadventure',
  'wordsearch', 'rpgstatus', 'wheelfortune'
];

const RPG_SECONDARY_LIST = [
  'dungeonguide', 'bosslist', 'weaponshop', 'armorupgrade', 'healrpg', 'sellitem', 'fishmarket',
  'cooldownrpg', 'guildcreate', 'guildjoin', 'guildlist', 'guilddonate', 'seasonpass', 'claimreward',
  'alchemyrecipes', 'croplist', 'harvest', 'cryptomarket', 'cryptosell', 'cryptobuy', 'cardfight',
  'cardlist', 'cardpack', 'cardtrade', 'resetrpg', 'petlist', 'petrename', 'petfeed', 'slotsstats',
  'bjstats', 'claimbank', 'rpgprofile', 'rpgstatuseffect', 'minegem', 'smithing', 'dailybonus',
  'weeklybonus', 'bountylist', 'claimbounty', 'tictactoestats', 'chessstats', 'quizstats',
  'reputationshop', 'asuransiinfo', 'leaderboardcoin', 'leaderboardxp', 'wheelstats', 'auctionlist',
  'auctionbid', 'auctioncreate'
];

const ADDITIONAL_ALIASES = ['bj', 'rr', 'tebakangka', 'spin', 'portfolio'];
const DYNAMIC_GAMES_ALL = [...RPG_PRIMARY_LIST, ...RPG_SECONDARY_LIST, ...ADDITIONAL_ALIASES];

// ─── Blackjack Memory Store ──────────────────────────────────────────────────
interface BlackjackGame {
  bet: number;
  playerHand: string[];
  dealerHand: string[];
  deck: string[];
}
const blackjackSessions = new Map<string, BlackjackGame>();

const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck(): string[] {
  const deck: string[] = [];
  for (const s of SUITS) {
    for (const v of VALUES) {
      deck.push(`${v}${s}`);
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function calculateHandValue(hand: string[]): number {
  let val = 0;
  let aces = 0;
  for (const card of hand) {
    const v = card.slice(0, -1);
    if (['J', 'Q', 'K'].includes(v)) {
      val += 10;
    } else if (v === 'A') {
      val += 11;
      aces += 1;
    } else {
      val += parseInt(v, 10);
    }
  }
  while (val > 21 && aces > 0) {
    val -= 10;
    aces -= 1;
  }
  return val;
}

// ─── Stock Market Simulator Config ───────────────────────────────────────────
interface Stock {
  symbol: string;
  name: string;
  basePrice: number;
  volatility: number;
}

const STOCKS: Stock[] = [
  { symbol: 'JAVAS', name: 'Javas Tech Corp', basePrice: 500, volatility: 0.15 },
  { symbol: 'EMAS',  name: 'Gold Mining Corp', basePrice: 1000, volatility: 0.05 },
  { symbol: 'MEME',  name: 'Meme Doge Coin', basePrice: 50, volatility: 0.40 },
  { symbol: 'SOAP',  name: 'Soap Industry Corp', basePrice: 200, volatility: 0.08 }
];

function getStockPrice(stock: Stock): { price: number; changePercent: number } {
  const timeBlock = Math.floor(Date.now() / 600000); // 10-minute changes
  let seed = 0;
  for (let i = 0; i < stock.symbol.length; i++) {
    seed += stock.symbol.charCodeAt(i);
  }
  const val = Math.sin(timeBlock * 0.05 + seed) * Math.cos(timeBlock * 0.02 - seed * 0.1);
  const changePercent = val * stock.volatility * 100;
  const price = Math.max(10, Math.round(stock.basePrice * (1 + (changePercent / 100))));
  return { price, changePercent };
}

// ─── Russian Roulette & Guess Number State ───────────────────────────────────
const rrCooldowns = new Map<string, number>();
const guessGames = new Map<string, { target: number; attempts: number }>();

// ─── Custom Variable DB Helpers ──────────────────────────────────────────────
async function getUserVariable(userId: string, key: string, defaultValue: any): Promise<any> {
  const record = await prisma.customVariable.findUnique({
    where: {
      groupId_userId_key: {
        groupId: 'global',
        userId,
        key
      }
    }
  });
  if (!record) return defaultValue;
  try {
    return JSON.parse(record.value);
  } catch {
    return record.value;
  }
}

async function setUserVariable(userId: string, key: string, value: any): Promise<void> {
  const strVal = typeof value === 'string' ? value : JSON.stringify(value);
  await prisma.customVariable.upsert({
    where: {
      groupId_userId_key: {
        groupId: 'global',
        userId,
        key
      }
    },
    create: {
      groupId: 'global',
      userId,
      key,
      value: strVal
    },
    update: {
      value: strVal
    }
  });
}

// ─── Main Class ──────────────────────────────────────────────────────────────
export class DynamicGamesCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName?.toLowerCase() || '';
    const textArg = args.join(' ').trim();

    // Get or Create user economy record
    let userEco = await prisma.userEconomy.findUnique({
      where: { userId: ctx.senderId }
    });
    if (!userEco) {
      userEco = await prisma.userEconomy.create({
        data: {
          userId: ctx.senderId,
          balance: 1000,
          bank: 0,
          xp: 0,
          level: 1
        }
      });
    }

    // 1. BLACKJACK (BJ) GAME
    if (cmd === 'blackjack' || cmd === 'bj') {
      const sub = args[0]?.toLowerCase().trim();

      if (sub === 'hit') {
        const game = blackjackSessions.get(ctx.senderId);
        if (!game) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Anda tidak sedang dalam permainan Blackjack. Ketik `/bj <taruhan>` untuk memulai!', { quotedMessageId: ctx.id });
          return;
        }

        const newCard = game.deck.pop()!;
        game.playerHand.push(newCard);
        const playerVal = calculateHandValue(game.playerHand);

        if (playerVal > 21) {
          blackjackSessions.delete(ctx.senderId);
          const msg = `💥 *BUST!* (Lebih dari 21)\n\n` +
            `🃏 *Kartu Anda:* [ ${game.playerHand.join(', ')} ] (Total: *${playerVal}*)\n` +
            `🃏 *Kartu Dealer:* [ ${game.dealerHand.join(', ')} ] (Total: *${calculateHandValue(game.dealerHand)}*)\n\n` +
            `💀 Anda kalah dan kehilangan taruhan sebesar *Rp. ${game.bet.toLocaleString('id-ID')}*.`;
          await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        } else if (playerVal === 21) {
          // Auto stand
          args[0] = 'stand';
          return this.execute(ctx, args, adapter);
        } else {
          const msg = `🃏 *[BLACKJACK GAME]* 🃏\n\n` +
            `👤 *Pemain:* @${ctx.senderId.split('@')[0]}\n` +
            `💵 *Taruhan:* Rp. ${game.bet.toLocaleString('id-ID')}\n\n` +
            `│  Kartu Anda: [ ${game.playerHand.join(', ')} ] (Total: *${playerVal}*)\n` +
            `│  Kartu Dealer: [ ${game.dealerHand[0]}, ❓ ]\n\n` +
            `Ketik \`/bj hit\` untuk tambah kartu, atau \`/bj stand\` untuk bertahan!`;
          await adapter.sendMessage(ctx.chatId, msg, { mentions: [ctx.senderId], quotedMessageId: ctx.id });
        }
        return;
      }

      if (sub === 'stand') {
        const game = blackjackSessions.get(ctx.senderId);
        if (!game) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Anda tidak sedang dalam permainan Blackjack.', { quotedMessageId: ctx.id });
          return;
        }

        blackjackSessions.delete(ctx.senderId);
        let dealerVal = calculateHandValue(game.dealerHand);

        while (dealerVal < 17) {
          game.dealerHand.push(game.deck.pop()!);
          dealerVal = calculateHandValue(game.dealerHand);
        }

        const playerVal = calculateHandValue(game.playerHand);
        let resultMsg = '';
        let multiplier = 0;

        if (dealerVal > 21) {
          resultMsg = `🎉 *DEALER BUST!* Anda menang!`;
          multiplier = 2;
        } else if (playerVal > dealerVal) {
          resultMsg = `🏆 *ANDA MENANG!* Nilai kartu Anda lebih tinggi dari Dealer.`;
          multiplier = 2;
        } else if (playerVal < dealerVal) {
          resultMsg = `😢 *DEALER MENANG!* Nilai kartu Dealer lebih tinggi.`;
          multiplier = 0;
        } else {
          resultMsg = `⚖️ *SERI (PUSH)!* Taruhan dikembalikan.`;
          multiplier = 1;
        }

        if (multiplier > 0) {
          await prisma.userEconomy.update({
            where: { userId: ctx.senderId },
            data: { balance: { increment: game.bet * multiplier } }
          });
        }

        const payoutText = multiplier === 2 
          ? `💰 Anda memenangkan *+Rp. ${(game.bet).toLocaleString('id-ID')}*!` 
          : multiplier === 1 
          ? `💵 Taruhan Rp. ${game.bet.toLocaleString('id-ID')} dikembalikan.` 
          : `💸 Anda kehilangan *Rp. ${game.bet.toLocaleString('id-ID')}*.`;

        const msg = `🃏 *[HASIL BLACKJACK]* 🃏\n\n` +
          `${resultMsg}\n\n` +
          `👤 *Kartu Anda:* [ ${game.playerHand.join(', ')} ] (Total: *${playerVal}*)\n` +
          `🤖 *Kartu Dealer:* [ ${game.dealerHand.join(', ')} ] (Total: *${dealerVal}*)\n\n` +
          `${payoutText}`;
        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        return;
      }

      // Start new game
      if (blackjackSessions.has(ctx.senderId)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Selesaikan game Blackjack Anda yang sedang berjalan terlebih dahulu!', { quotedMessageId: ctx.id });
        return;
      }

      const betAmount = parseInt(args[0]?.replace(/[^0-9]/g, '') || '100', 10);
      if (isNaN(betAmount) || betAmount <= 0) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan jumlah taruhan yang valid. Contoh: `/bj 500`', { quotedMessageId: ctx.id });
        return;
      }

      if (userEco.balance < betAmount) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Saldo Anda tidak mencukupi untuk taruhan Rp. ${betAmount.toLocaleString('id-ID')}.`, { quotedMessageId: ctx.id });
        return;
      }

      // Deduct bet from DB economy
      await prisma.userEconomy.update({
        where: { userId: ctx.senderId },
        data: { balance: { decrement: betAmount } }
      });

      const deck = createDeck();
      const playerHand = [deck.pop()!, deck.pop()!];
      const dealerHand = [deck.pop()!, deck.pop()!];

      const playerVal = calculateHandValue(playerHand);

      if (playerVal === 21) {
        // Natural Blackjack
        const dealerVal = calculateHandValue(dealerHand);
        if (dealerVal === 21) {
          // Push
          await prisma.userEconomy.update({
            where: { userId: ctx.senderId },
            data: { balance: { increment: betAmount } }
          });
          const msg = `🃏 *[BLACKJACK NATURAL]* 🃏\n\n` +
            `⚖️ *SERI (PUSH)!* Keduanya memiliki Blackjack Natural.\n\n` +
            `👤 Kartu Anda: [ ${playerHand.join(', ')} ] (21)\n` +
            `🤖 Kartu Dealer: [ ${dealerHand.join(', ')} ] (21)\n\n` +
            `💵 Taruhan Rp. ${betAmount.toLocaleString('id-ID')} dikembalikan.`;
          await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        } else {
          // 2.5x payout
          const winAmt = Math.round(betAmount * 2.5);
          await prisma.userEconomy.update({
            where: { userId: ctx.senderId },
            data: { balance: { increment: winAmt } }
          });
          const msg = `🏆 *BLACKJACK NATURAL!* 🎉\n\n` +
            `👤 Kartu Anda: [ ${playerHand.join(', ')} ] (21)\n` +
            `🤖 Kartu Dealer: [ ${dealerHand.join(', ')} ] (Total: *${dealerVal}*)\n\n` +
            `💰 Anda memenangkan *+Rp. ${(winAmt - betAmount).toLocaleString('id-ID')}*! (Payout 3:2)`;
          await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        }
      } else {
        // Store game session
        blackjackSessions.set(ctx.senderId, {
          bet: betAmount,
          playerHand,
          dealerHand,
          deck
        });

        const msg = `🃏 *[BLACKJACK GAME]* 🃏\n\n` +
          `👤 *Pemain:* @${ctx.senderId.split('@')[0]}\n` +
          `💵 *Taruhan:* Rp. ${betAmount.toLocaleString('id-ID')}\n\n` +
          `│  Kartu Anda: [ ${playerHand.join(', ')} ] (Total: *${playerVal}*)\n` +
          `│  Kartu Dealer: [ ${dealerHand[0]}, ❓ ]\n\n` +
          `Ketik \`/bj hit\` untuk tambah kartu, atau \`/bj stand\` untuk bertahan!`;
        await adapter.sendMessage(ctx.chatId, msg, { mentions: [ctx.senderId], quotedMessageId: ctx.id });
      }
      return;
    }

    // 2. RUSSIAN ROULETTE (RR) GAME
    if (cmd === 'russianroulette' || cmd === 'rr') {
      const now = Date.now();
      const lastDeath = rrCooldowns.get(ctx.senderId) || 0;
      if (now - lastDeath < 60000) {
        const remaining = Math.ceil((60000 - (now - lastDeath)) / 1000);
        await adapter.sendMessage(ctx.chatId, `💀 *COOLDOWN MAUT!* Anda telah tewas sebelumnya. Silakan tunggu *${remaining} detik* sebelum menantang maut kembali.`, { quotedMessageId: ctx.id });
        return;
      }

      const betAmount = parseInt(args[0]?.replace(/[^0-9]/g, '') || '100', 10);
      if (isNaN(betAmount) || betAmount <= 0) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan jumlah taruhan yang valid. Contoh: `/rr 500`', { quotedMessageId: ctx.id });
        return;
      }

      if (userEco.balance < betAmount) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Saldo Anda tidak mencukupi untuk bertaruh Rp. ${betAmount.toLocaleString('id-ID')}.`, { quotedMessageId: ctx.id });
        return;
      }

      const triggerPull = Math.random();
      const isDead = triggerPull < (1 / 6); // 16.67% chance

      if (isDead) {
        await prisma.userEconomy.update({
          where: { userId: ctx.senderId },
          data: { balance: { decrement: betAmount } }
        });
        rrCooldowns.set(ctx.senderId, Date.now());

        const msg = `🔫 *[RUSSIAN ROULETTE]* 🔫\n\n` +
          `*Pemain:* @${ctx.senderId.split('@')[0]}\n` +
          `*Taruhan:* Rp. ${betAmount.toLocaleString('id-ID')}\n\n` +
          `*klik...*\n` +
          `*DOOORRR!* 💥💀\n\n` +
          `Peluru menembus kepala Anda! Anda tewas mengenaskan, kehilangan *Rp. ${betAmount.toLocaleString('id-ID')}*, dan dikunci dalam Cooldown Maut selama 1 menit!`;
        await adapter.sendMessage(ctx.chatId, msg, { mentions: [ctx.senderId], quotedMessageId: ctx.id });
      } else {
        const reward = Math.round(betAmount * 0.2);
        await prisma.userEconomy.update({
          where: { userId: ctx.senderId },
          data: { balance: { increment: reward } }
        });

        const msg = `🔫 *[RUSSIAN ROULETTE]* 🔫\n\n` +
          `*Pemain:* @${ctx.senderId.split('@')[0]}\n` +
          `*Taruhan:* Rp. ${betAmount.toLocaleString('id-ID')}\n\n` +
          `*klik...*\n` +
          `💨 *Chamber Kosong!* Anda selamat dari maut!\n\n` +
          `💰 Anda mendapat reward bertahan hidup sebesar *+Rp. ${reward.toLocaleString('id-ID')}*!`;
        await adapter.sendMessage(ctx.chatId, msg, { mentions: [ctx.senderId], quotedMessageId: ctx.id });
      }
      return;
    }

    // 3. GUESS THE NUMBER (TEBAK ANGKA) GAME
    if (cmd === 'guessnumber' || cmd === 'tebakangka') {
      const input = args[0]?.trim();

      if (!input || input === 'start') {
        if (guessGames.has(ctx.chatId)) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Game Tebak Angka sedang berlangsung di grup ini. Silakan langsung tebak!', { quotedMessageId: ctx.id });
          return;
        }

        const target = Math.floor(Math.random() * 100) + 1;
        guessGames.set(ctx.chatId, { target, attempts: 0 });

        const msg = `🎮 *[TEBAK ANGKA]* 🎮\n\n` +
          `Bot telah memikirkan angka antara *1 sampai 100* untuk grup ini.\n` +
          `Tebak sekarang juga dengan mengetik: \`/guessnumber [angka]\`!`;
        await adapter.sendMessage(ctx.chatId, msg);
        return;
      }

      const guessVal = parseInt(input, 10);
      if (isNaN(guessVal) || guessVal < 1 || guessVal > 100) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tebaklah dengan angka antara 1 sampai 100!', { quotedMessageId: ctx.id });
        return;
      }

      const game = guessGames.get(ctx.chatId);
      if (!game) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada game aktif. Ketik `/guessnumber start` untuk memulai!', { quotedMessageId: ctx.id });
        return;
      }

      game.attempts++;

      if (guessVal === game.target) {
        guessGames.delete(ctx.chatId);

        // Award balance & XP
        await prisma.userEconomy.upsert({
          where: { userId: ctx.senderId },
          create: { userId: ctx.senderId, balance: 100, xp: 30 },
          update: { balance: { increment: 100 }, xp: { increment: 30 } }
        });

        const msg = `🎉 *TEBAKAN BENAR!* 🎉\n\n` +
          `Selamat @${ctx.senderId.split('@')[0]}! Angka yang benar adalah *${game.target}*.\n` +
          `💰 Hadiah: *+Rp. 100* & *+30 XP*!\n` +
          `Total percobaan grup: *${game.attempts}* kali.`;
        await adapter.sendMessage(ctx.chatId, msg, { mentions: [ctx.senderId], quotedMessageId: ctx.id });
      } else if (guessVal > game.target) {
        await adapter.sendMessage(ctx.chatId, `📉 *[TEBAK ANGKA]*\n\nAngka *${guessVal}* terlalu *BESAR*! Coba angka yang lebih kecil.`, { quotedMessageId: ctx.id });
      } else {
        await adapter.sendMessage(ctx.chatId, `📈 *[TEBAK ANGKA]*\n\nAngka *${guessVal}* terlalu *KECIL*! Coba angka yang lebih besar.`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 4. STOCK MARKET SIMULATOR
    if (cmd === 'stocks' || cmd === 'stockmarket' || cmd === 'portfolio') {
      const sub = cmd === 'portfolio' ? 'portfolio' : args[0]?.toLowerCase().trim();

      if (sub === 'portfolio' || sub === 'pf') {
        const portfolio = await getUserVariable(ctx.senderId, 'stocks:portfolio', {});
        let totalVal = 0;
        let pLine = '';

        for (const [symbol, qty] of Object.entries(portfolio)) {
          const count = qty as number;
          if (count <= 0) continue;
          const config = STOCKS.find(s => s.symbol === symbol)!;
          const { price } = getStockPrice(config);
          const currentVal = count * price;
          totalVal += currentVal;

          pLine += ` • *$${symbol}* (${config.name})\n`;
          pLine += `    Jumlah: *${count} lembar* | Nilai: *Rp. ${currentVal.toLocaleString('id-ID')}*\n`;
        }

        const msg = `💼 *PORTFOLIO SAHAM ANDA* 💼\n\n` +
          `👤 *Investor:* @${ctx.senderId.split('@')[0]}\n` +
          `💵 *Kas Dompet:* Rp. ${userEco.balance.toLocaleString('id-ID')}\n` +
          `📈 *Total Nilai Saham:* Rp. ${totalVal.toLocaleString('id-ID')}\n\n` +
          `*Aset Dimiliki:*\n` +
          (pLine || ` _Belum memiliki aset saham._`);
        await adapter.sendMessage(ctx.chatId, msg, { mentions: [ctx.senderId], quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'buy' || sub === 'sell') {
        const symbol = args[1]?.toUpperCase().trim();
        const qty = parseInt(args[2]?.replace(/[^0-9]/g, '') || '1', 10);

        if (!symbol || isNaN(qty) || qty <= 0) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Format salah. Contoh: \`/stocks buy JAVAS 5\``, { quotedMessageId: ctx.id });
          return;
        }

        const stock = STOCKS.find(s => s.symbol === symbol);
        if (!stock) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Saham $${symbol} tidak terdaftar.`, { quotedMessageId: ctx.id });
          return;
        }

        const { price } = getStockPrice(stock);
        const cost = price * qty;

        if (sub === 'buy') {
          if (userEco.balance < cost) {
            await adapter.sendMessage(ctx.chatId, `⚠️ Saldo Anda tidak mencukupi. Pembelian ini butuh Rp. ${cost.toLocaleString('id-ID')}.`, { quotedMessageId: ctx.id });
            return;
          }

          // Deduct balance
          await prisma.userEconomy.update({
            where: { userId: ctx.senderId },
            data: { balance: { decrement: cost } }
          });

          // Add to portfolio
          const portfolio = await getUserVariable(ctx.senderId, 'stocks:portfolio', {});
          portfolio[symbol] = (portfolio[symbol] || 0) + qty;
          await setUserVariable(ctx.senderId, 'stocks:portfolio', portfolio);

          const msg = `📈 *[STOCK PURCHASE]*\n\n` +
            `Berhasil membeli *${qty}* lembar *$${symbol}* seharga *Rp. ${cost.toLocaleString('id-ID')}*.\n` +
            `Kas dompet tersisa: *Rp. ${(userEco.balance - cost).toLocaleString('id-ID')}*.`;
          await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        } else {
          // sell
          const portfolio = await getUserVariable(ctx.senderId, 'stocks:portfolio', {});
          const currentQty = portfolio[symbol] || 0;

          if (currentQty < qty) {
            await adapter.sendMessage(ctx.chatId, `⚠️ Anda tidak memiliki cukup lembar saham untuk dijual. Dimiliki: ${currentQty} lembar.`, { quotedMessageId: ctx.id });
            return;
          }

          // Credit balance
          await prisma.userEconomy.update({
            where: { userId: ctx.senderId },
            data: { balance: { increment: cost } }
          });

          // Remove from portfolio
          portfolio[symbol] = currentQty - qty;
          if (portfolio[symbol] <= 0) delete portfolio[symbol];
          await setUserVariable(ctx.senderId, 'stocks:portfolio', portfolio);

          const msg = `📉 *[STOCK SALE]*\n\n` +
            `Berhasil menjual *${qty}* lembar *$${symbol}* seharga *Rp. ${cost.toLocaleString('id-ID')}*.\n` +
            `Kas dompet baru: *Rp. ${(userEco.balance + cost).toLocaleString('id-ID')}*.`;
          await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        }
        return;
      }

      // Default stock list
      let stockList = `📈 *BURSA SAHAM DETIK-DETIK* 📈\n` +
        `_Harga terupdate otomatis setiap 10 menit_\n\n`;

      for (const st of STOCKS) {
        const { price, changePercent } = getStockPrice(st);
        const icon = changePercent >= 0 ? '📈' : '📉';
        const sign = changePercent >= 0 ? '+' : '';
        stockList += ` ${icon} *$${st.symbol}* · ${st.name}\n`;
        stockList += `    Harga: *Rp. ${price.toLocaleString('id-ID')}* (${sign}${changePercent.toFixed(1)}%)\n\n`;
      }

      stockList += `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n` +
        `💡 *Panduan bertransaksi:*\n` +
        ` • Beli: \`/stocks buy [symbol] [jumlah]\`\n` +
        ` • Jual: \`/stocks sell [symbol] [jumlah]\`\n` +
        ` • Portfolio: \`/portfolio\` atau \`/stocks pf\``;

      await adapter.sendMessage(ctx.chatId, stockList, { quotedMessageId: ctx.id });
      return;
    }

    // 5. WHEEL OF FORTUNE
    if (cmd === 'wheelfortune' || cmd === 'spin') {
      const now = Date.now();
      const lastFree = await getUserVariable(ctx.senderId, 'wheelfortune:lastfree', 0);
      const isFreeMode = args.length === 0;

      let betAmount = 0;

      if (isFreeMode) {
        const sixHours = 6 * 3600 * 1000;
        if (now - lastFree < sixHours) {
          const diff = sixHours - (now - lastFree);
          const hrs = Math.floor(diff / 3600000);
          const mins = Math.ceil((diff % 3600000) / 60000);
          await adapter.sendMessage(ctx.chatId, `⏳ *COOLDOWN SPIN GRATIS!* Anda dapat memutar spin gratis kembali dalam *${hrs} jam ${mins} menit*. Atau spin berbayar dengan: \`/spin <bet>\`.`, { quotedMessageId: ctx.id });
          return;
        }
        betAmount = 200; // Free spin base value
        await setUserVariable(ctx.senderId, 'wheelfortune:lastfree', now);
      } else {
        betAmount = parseInt(args[0]?.replace(/[^0-9]/g, '') || '100', 10);
        if (isNaN(betAmount) || betAmount <= 0) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan jumlah taruhan yang valid. Contoh: `/spin 500`', { quotedMessageId: ctx.id });
          return;
        }

        if (userEco.balance < betAmount) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Saldo Anda tidak mencukupi untuk taruhan Rp. ${betAmount.toLocaleString('id-ID')}.`, { quotedMessageId: ctx.id });
          return;
        }

        // Deduct bet
        await prisma.userEconomy.update({
          where: { userId: ctx.senderId },
          data: { balance: { decrement: betAmount } }
        });
      }

      // Spin Multiplier math
      const roll = Math.random();
      let mult = 0;

      if (roll < 0.25) mult = 0;       // 25% chance
      else if (roll < 0.45) mult = 0.5; // 20% chance
      else if (roll < 0.70) mult = 1.2; // 25% chance
      else if (roll < 0.85) mult = 1.5; // 15% chance
      else if (roll < 0.95) mult = 2.0; // 10% chance
      else if (roll < 0.99) mult = 5.0; // 4% chance
      else mult = 10.0;                 // 1% chance

      const winAmt = Math.round(betAmount * mult);

      if (winAmt > 0) {
        await prisma.userEconomy.update({
          where: { userId: ctx.senderId },
          data: { balance: { increment: winAmt } }
        });
      }

      const outcomeText = mult > 1 
        ? `🎉 *ANDA UNTUNG!* Mendapatkan *+Rp. ${(winAmt - (isFreeMode ? 0 : betAmount)).toLocaleString('id-ID')}*!` 
        : mult === 1.2
        ? `👍 *SELAMAT!* Kembali modal dan untung sedikit.`
        : mult === 0.5
        ? `⚠️ *RUGI SEBAGIAN!* Hanya kembali setengah modal.`
        : `😢 *RUGI TOTAL!* Taruhan Anda hangus.`;

      const msg = `🎡 *[WHEEL OF FORTUNE]* 🎡\n` +
        `*Pemain:* @${ctx.senderId.split('@')[0]}\n` +
        `*Taruhan:* ${isFreeMode ? 'GRATIS (Base Rp. 200)' : `Rp. ${betAmount.toLocaleString('id-ID')}`}\n\n` +
        `*Memutar Roda Keberuntungan...*\n` +
        `[ 🔴 0x | 🟡 0.5x | 🟢 1.2x | 🔵 1.5x | 🟣 2x | 👑 10x ]\n\n` +
        `🎯 Roda mendarat pada multiplier: *${mult}x*\n` +
        `💰 Total didapat: *Rp. ${winAmt.toLocaleString('id-ID')}*\n` +
        `${outcomeText}`;

      await adapter.sendMessage(ctx.chatId, msg, { mentions: [ctx.senderId], quotedMessageId: ctx.id });
      return;
    }

    // ─── Existing mancing and raid simulation ───
    if (cmd === 'mancing') {
      const chance = Math.random();
      let fishType = '🐟 Ikan Mujair (Common)';
      let xpGained = 15;
      let coinGained = 20;

      if (chance > 0.95) {
        fishType = '🦈 Hiu Megalodon (Mythical)';
        xpGained = 200;
        coinGained = 500;
      } else if (chance > 0.8) {
        fishType = '🐠 Ikan Nemo Emas (Rare)';
        xpGained = 60;
        coinGained = 150;
      } else if (chance > 0.5) {
        fishType = '🦑 Cumi-Cumi Raksasa (Uncommon)';
        xpGained = 30;
        coinGained = 50;
      }

      await prisma.userEconomy.update({
        where: { userId: ctx.senderId },
        data: {
          balance: { increment: coinGained },
          xp: { increment: xpGained }
        }
      });

      const mancingMsg = `🎣 *[FISHING LAUT DALAM V2]*\n\n` +
        `*Hasil Pancingan:* ${fishType}\n` +
        `*XP Diperoleh:* +${xpGained} XP\n` +
        `*Koin Diperoleh:* +${coinGained} Koin\n\n` +
        `*Pancingan:* Carbon Fiber Rod + Bait Grade A\n` +
        `*Cuaca:* 🌊 Berombak Sedang (Meningkatkan chance Rare)`;
      await adapter.sendMessage(ctx.chatId, mancingMsg, { quotedMessageId: ctx.id });
      return;
    }

    if (cmd === 'raid') {
      const raidMsg = `⚔️ *[BOSS RAID MULTIPLAYER]*\n\n` +
        `🛡️ *Boss:* Dragon Lord Bahamut [HP: 15,400/50,000]\n` +
        `*Fase:* Rage Mode (Attack 1.5x)\n` +
        `*Daftar Penyerang:* \n` +
        `1. @${ctx.senderId.split('@')[0]} (Damage: 1,240)\n` +
        `2. Bot Helper (Damage: 850)\n\n` +
        `*Status:* ⏳ Menunggu giliran serang berikutnya. Ketik \`/raid serang\` untuk menyerang!`;
      await adapter.sendMessage(ctx.chatId, raidMsg, { quotedMessageId: ctx.id });
      return;
    }

    // Default simulation for game/rpg commands
    const action = cmd.toUpperCase();
    const responseMsg = `🎮 *[RPG ADVENTURE & GAMES: ${action}]*\n\n` +
      `✅ Perintah RPG dijalankan successfully!\n` +
      `*Pemain:* @${ctx.senderId.split('@')[0]}\n` +
      `*Detail Operasi:* Memproses parameter \`${textArg || 'default'}\`.\n` +
      `*Koin Saat Ini:* ${userEco.balance} Koin\n` +
      `*Level RPG:* Level ${userEco.level} (${userEco.xp} XP)`;

    await adapter.sendMessage(ctx.chatId, responseMsg, { quotedMessageId: ctx.id });
  }
}

// Register commands
registerCommand(DYNAMIC_GAMES_ALL, new DynamicGamesCommand());
