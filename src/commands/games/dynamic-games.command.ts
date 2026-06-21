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

const DYNAMIC_GAMES_ALL = [...RPG_PRIMARY_LIST, ...RPG_SECONDARY_LIST];

export class DynamicGamesCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName?.toLowerCase() || '';
    const textArg = args.join(' ').trim();

    // Get or Create user economy record for state modification
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

    const action = cmd.toUpperCase();

    // Custom output simulation for major commands
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
