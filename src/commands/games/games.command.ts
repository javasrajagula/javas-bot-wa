import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';

// In-memory games state
const tttGames = new Map<string, {
  player1: string;
  player2: string;
  board: string[]; // 9 slots
  turn: string; // userId
}>();

const suitGames = new Map<string, {
  player1: string;
  player2: string;
  p1Choice?: string;
  p2Choice?: string;
}>();

const activeWordGames = new Map<string, {
  clue: string;
  answer: string;
  points: number;
}>();

const truthPrompts = [
  'Siapa orang yang paling kamu takuti di grup ini?',
  'Apa kebohongan terbesar yang pernah kamu katakan kepada orang tuamu?',
  'Apa kebiasaan terburukmu saat sendirian di kamar?'
];

const darePrompts = [
  'Kirim voice note bernyanyi lagu balonku dengan vokal O selama 15 detik.',
  'Sebutkan 3 kekurangan diri sendiri dengan jujur di grup ini.',
  'Chat kontak WhatsApp terakhirmu dan katakan "Aku sayang kamu".'
];

export class GamesSuiteCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    // 1. Truth or Dare: /tod, /truth, /dare
    if (cmd === 'tod' || cmd === 'truth' || cmd === 'dare') {
      const isTruth = cmd === 'truth' || (cmd === 'tod' && Math.random() > 0.5);
      const prompt = isTruth
        ? truthPrompts[Math.floor(Math.random() * truthPrompts.length)]
        : darePrompts[Math.floor(Math.random() * darePrompts.length)];

      await adapter.sendMessage(
        ctx.chatId,
        `🎲 *TRUTH OR DARE* 🎲\n\n*Pilihan:* ${isTruth ? '🟢 TRUTH' : '🔴 DARE'}\n\n*Pertanyaan/Tantangan:*\n"${prompt}"`,
        { quotedMessageId: ctx.id }
      );
      return;
    }

    // 2. Tebak Kata: /tebakkata
    if (cmd === 'tebakkata') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Game ini hanya dapat dimainkan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      const words = [
        { clue: 'Alat transportasi roda dua tanpa mesin', answer: 'sepeda' },
        { clue: 'Ibu kota negara Indonesia saat ini', answer: 'jakarta' },
        { clue: 'Hewan berkaki empat pemakan rumput yang berleher panjang', answer: 'jerapah' }
      ];

      const chosen = words[Math.floor(Math.random() * words.length)];
      activeWordGames.set(ctx.chatId, { clue: chosen.clue, answer: chosen.answer, points: 15 });

      await adapter.sendMessage(
        ctx.chatId,
        `🎮 *TEBAK KATA* 🎮\n\n*Petunjuk:* ${chosen.clue}\n\nJawab dengan command: \`/jawab <jawaban>\``
      );
      return;
    }

    // 3. Slot: /slot
    if (cmd === 'slot') {
      const items = ['🍒', '🍋', '🍇', '💎', '⭐️'];
      const r1 = items[Math.floor(Math.random() * items.length)];
      const r2 = items[Math.floor(Math.random() * items.length)];
      const r3 = items[Math.floor(Math.random() * items.length)];

      const isWin = r1 === r2 && r2 === r3;
      const points = isWin ? 100 : 0;

      if (points > 0) {
        await prisma.userEconomy.upsert({
          where: { userId: ctx.senderId },
          create: { userId: ctx.senderId, balance: points },
          update: { balance: { increment: points } }
        });
      }

      const response = `🎰 *MESIN SLOT* 🎰\n\n[ ${r1} | ${r2} | ${r3} ]\n\n` + (isWin ? `🎉 *MENANG JACKPOT!* 🎉\nAnda mendapatkan *+${points} Saldo Economy!*` : '😢 *Kalah.* Coba keberuntunganmu lagi nanti!');
      await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
      return;
    }

    // 4. Suit PvP: /suit @user
    if (cmd === 'suit') {
      const rawUser = args[0];
      if (!rawUser) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/suit @user`', { quotedMessageId: ctx.id });
        return;
      }
      const targetJid = rawUser.includes('@') ? rawUser.replace('@', '').trim() + '@s.whatsapp.net' : rawUser.trim();

      suitGames.set(ctx.chatId, { player1: ctx.senderId, player2: targetJid });
      await adapter.sendMessage(ctx.chatId, `⚔️ *SUIT CHALLENGE* ⚔️\n\n@${ctx.senderId.split('@')[0]} menantang @${targetJid.split('@')[0]} bertanding!\nKetik \`/pilih <batu/gunting/kertas>\` secara privat ke bot.`, { mentions: [ctx.senderId, targetJid] });
      return;
    }

    if (cmd === 'pilih') {
      const choice = args[0]?.toLowerCase();
      const valid = ['batu', 'gunting', 'kertas'];
      if (!valid.includes(choice)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Pilihan tidak valid. Pilihan: `batu`, `gunting`, `kertas`', { quotedMessageId: ctx.id });
        return;
      }

      // Check active suit games where user is a participant
      let matchedGroup: string | null = null;
      for (const [gid, g] of suitGames.entries()) {
        if (g.player1 === ctx.senderId || g.player2 === ctx.senderId) {
          matchedGroup = gid;
          break;
        }
      }

      if (!matchedGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Anda tidak sedang berada dalam suit PvP aktif.', { quotedMessageId: ctx.id });
        return;
      }

      const game = suitGames.get(matchedGroup)!;
      if (game.player1 === ctx.senderId) game.p1Choice = choice;
      else game.p2Choice = choice;

      if (game.p1Choice && game.p2Choice) {
        suitGames.delete(matchedGroup);
        const c1 = game.p1Choice;
        const c2 = game.p2Choice;

        let winner = 'draw';
        if (c1 === c2) winner = 'draw';
        else if (
          (c1 === 'batu' && c2 === 'gunting') ||
          (c1 === 'gunting' && c2 === 'kertas') ||
          (c1 === 'kertas' && c2 === 'batu')
        ) {
          winner = game.player1;
        } else {
          winner = game.player2;
        }

        const msg = `🏁 *HASIL SUIT PVP* 🏁\n\n@${game.player1.split('@')[0]}: ${c1}\n@${game.player2.split('@')[0]}: ${c2}\n\n` + (winner === 'draw' ? '⚖️ Hasil seimbang (Draw)!' : `🏆 Pemenang: @${winner.split('@')[0]}!`);
        await adapter.sendMessage(matchedGroup, msg, { mentions: [game.player1, game.player2] });
      } else {
        await adapter.sendMessage(ctx.chatId, '✅ Pilihan Anda berhasil disimpan. Menunggu lawan memilih...');
      }
      return;
    }

    // 5. Tic-Tac-Toe: /ttt @user
    if (cmd === 'ttt') {
      const sub = args[0]?.toLowerCase();
      if (sub === 'move') {
        const game = tttGames.get(ctx.chatId);
        if (!game) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada game TTT aktif di grup ini.', { quotedMessageId: ctx.id });
          return;
        }

        if (ctx.senderId !== game.turn) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Bukan giliran Anda!', { quotedMessageId: ctx.id });
          return;
        }

        const pos = parseInt(args[1], 10) - 1;
        if (isNaN(pos) || pos < 0 || pos > 8 || game.board[pos] !== '') {
          await adapter.sendMessage(ctx.chatId, '⚠️ Posisi tidak valid atau sudah terisi.', { quotedMessageId: ctx.id });
          return;
        }

        const marker = game.turn === game.player1 ? 'X' : 'O';
        game.board[pos] = marker;

        // Check win
        const winPatterns = [
          [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
          [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
          [0, 4, 8], [2, 4, 6]            // Diag
        ];

        const isWin = winPatterns.some(p => game.board[p[0]] === marker && game.board[p[1]] === marker && game.board[p[2]] === marker);
        const isDraw = !isWin && game.board.every(cell => cell !== '');

        if (isWin) {
          tttGames.delete(ctx.chatId);
          await adapter.sendMessage(ctx.chatId, `🎉 *GAME OVER!* 🎉\nPemenang: @${game.turn.split('@')[0]}!\n\n${renderBoard(game.board)}`, { mentions: [game.turn] });
        } else if (isDraw) {
          tttGames.delete(ctx.chatId);
          await adapter.sendMessage(ctx.chatId, `⚖️ *GAME OVER!* \nHasil seri (Draw)!\n\n${renderBoard(game.board)}`);
        } else {
          game.turn = game.turn === game.player1 ? game.player2 : game.player1;
          await adapter.sendMessage(ctx.chatId, `🎮 *TIC TAC TOE* 🎮\n\nGiliran: @${game.turn.split('@')[0]}\n\n${renderBoard(game.board)}`, { mentions: [game.turn] });
        }
      } else {
        const rawUser = args[0];
        if (!rawUser) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/ttt @user`', { quotedMessageId: ctx.id });
          return;
        }
        const targetJid = rawUser.includes('@') ? rawUser.replace('@', '').trim() + '@s.whatsapp.net' : rawUser.trim();

        const newGame = {
          player1: ctx.senderId,
          player2: targetJid,
          board: new Array(9).fill(''),
          turn: ctx.senderId
        };
        tttGames.set(ctx.chatId, newGame);
        await adapter.sendMessage(ctx.chatId, `🎮 *TIC TAC TOE DIMULAI* 🎮\n\nGiliran pertama: @${ctx.senderId.split('@')[0]}\n\n${renderBoard(newGame.board)}\nKetik \`/ttt move <1-9>\` untuk menaruh bidak!`, { mentions: [ctx.senderId] });
      }
      return;
    }

    // 6. Werewolf rank/stats: /wwrank, /wwstats
    if (cmd === 'wwrank' || cmd === 'wwstats') {
      const stats = await prisma.gameStats.findMany({
        where: { gameType: 'werewolf' },
        orderBy: { points: 'desc' },
        take: 10
      });

      if (stats.length === 0) {
        await adapter.sendMessage(ctx.chatId, '📭 Belum ada data statistik Werewolf.', { quotedMessageId: ctx.id });
        return;
      }

      let text = `🏆 *WEREWOLF LEADERBOARD* 🏆\n\n`;
      const mentions: string[] = [];

      stats.forEach((s, idx) => {
        const mention = `@${s.userId.split('@')[0]}`;
        mentions.push(s.userId);
        text += `#${idx + 1}. ${mention} - Win: *${s.wins}* | Lose: *${s.losses}* | Point: *${s.points}*\n`;
      });

      await adapter.sendMessage(ctx.chatId, text, { mentions, quotedMessageId: ctx.id });
      return;
    }

    // 7. Couple / Jodoh: /couple, /jodoh
    if (cmd === 'couple' || cmd === 'jodoh') {
      const user1 = ctx.senderId;
      const targetUser = args[0];
      if (!targetUser) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/jodoh @user`', { quotedMessageId: ctx.id });
        return;
      }

      const user2 = targetUser.includes('@') ? targetUser.replace('@', '').trim() + '@s.whatsapp.net' : targetUser.trim();
      const percent = Math.floor(Math.random() * 101);

      const response = `❤️ *COMPATIBILITY CHECK* ❤️\n\n@${user1.split('@')[0]} & @${user2.split('@')[0]}\n🎯 Kecocokan: *${percent}%*`;
      await adapter.sendMessage(ctx.chatId, response, { mentions: [user1, user2], quotedMessageId: ctx.id });
      return;
    }
  }
}

function renderBoard(board: string[]): string {
  const rendered = board.map((cell, idx) => cell === '' ? String(idx + 1) : cell);
  return `  ${rendered[0]} | ${rendered[1]} | ${rendered[2]} \n ---+---+---\n  ${rendered[3]} | ${rendered[4]} | ${rendered[5]} \n ---+---+---\n  ${rendered[6]} | ${rendered[7]} | ${rendered[8]} `;
}

const gamesSuite = new GamesSuiteCommand();
registerCommand(['tod', 'truth', 'dare', 'tebakkata', 'slot', 'suit', 'pilih', 'ttt', 'wwrank', 'wwstats', 'couple', 'jodoh'], gamesSuite);
