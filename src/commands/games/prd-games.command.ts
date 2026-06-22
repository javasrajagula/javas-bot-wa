import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import { PRD_CATALOG } from '../prd/prd-feature-catalog.js';
import { GameRoom, rewardPlayer, recordGameStats } from '../../services/games/game-engine.js';
import { gameSessionService, GameAnswerHandler } from '../../services/games/game-session.service.js';
import { normalizeJid } from '../../utils/jid.util.js';

// In-memory active game rooms mapping chatId -> GameRoom
export const activeRooms = new Map<string, GameRoom>();

// Word Pools
const WORDLE_WORDS = [
  'gajah', 'hujan', 'lampu', 'pohon', 'surat', 'tanah', 'kelas', 'dapur', 'kasur', 'kamus',
  'waktu', 'dunia', 'bunga', 'candi', 'mesin', 'gurun', 'pasir', 'danau', 'sudah', 'hutan'
];

const HANGMAN_WORDS = [
  'antigravity', 'matematika', 'teknologi', 'indonesia', 'komunitas',
  'pendidikan', 'keamanan', 'ekonomi', 'komputer', 'informasi'
];

const ANAGRAM_WORDS = [
  'sepeda', 'jakarta', 'jerapah', 'lemari', 'belajar', 'pintar', 'kucing', 'anjing', 'harimau', 'singa'
];

export class PrdGamesSuiteCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const rawCmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();
    const commandName = rawCmd.toLowerCase();

    // Special handle: If the user sends choice, process it immediately
    if (commandName === 'pilihtourney' || (commandName === 'suittournament' && args[0]?.toLowerCase() === 'pilih')) {
      await this.handleSuitChoice(ctx, args, adapter);
      return;
    }

    // Map command name or alias to catalog entry
    const entry = PRD_CATALOG.find(e => e.name.toLowerCase() === commandName || e.aliases.map(a => a.toLowerCase()).includes(commandName));
    if (!entry) return;

    // Check if the command is one of the 5 implemented games
    const implementedIds = new Set(['G016', 'G020', 'G021', 'G022', 'G030']);
    if (!implementedIds.has(entry.id)) {
      // Fallback scaffold message for 45 unimplemented games
      await adapter.sendMessage(
        ctx.chatId,
        `⚠️ Game /${commandName} (coming soon / scaffold ready) sedang dalam pengembangan.`,
        { quotedMessageId: ctx.id }
      );
      return;
    }

    // Handle the 5 implemented games
    const gameId = entry.id;
    if (gameId === 'G020') {
      await this.playWordle(ctx, args, adapter);
    } else if (gameId === 'G021') {
      await this.playHangman(ctx, args, adapter);
    } else if (gameId === 'G022') {
      await this.playAnagram(ctx, args, adapter);
    } else if (gameId === 'G016') {
      await this.playMathSprint(ctx, args, adapter);
    } else if (gameId === 'G030') {
      await this.playSuitTournament(ctx, args, adapter);
    }
  }

  // ─── Wordle Indonesia (G020) ────────────────────────────────────────────────
  private async playWordle(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const action = args[0]?.toLowerCase();

    if (action === 'cancel' || action === 'stop') {
      const room = activeRooms.get(ctx.chatId);
      if (room && room.gameType === 'G020') {
        room.cancel();
        activeRooms.delete(ctx.chatId);
        await adapter.sendMessage(ctx.chatId, '🛑 Game Wordle Indonesia telah dibatalkan.', { quotedMessageId: ctx.id });
      } else {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada sesi Wordle aktif yang bisa dibatalkan.', { quotedMessageId: ctx.id });
      }
      return;
    }

    if (activeRooms.has(ctx.chatId)) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Ada game lain yang sedang aktif di grup ini. Selesaikan atau batalkan dulu.', { quotedMessageId: ctx.id });
      return;
    }

    // Start new Wordle game
    const targetWord = WORDLE_WORDS[Math.floor(Math.random() * WORDLE_WORDS.length)];
    const room = new GameRoom({
      id: ctx.chatId,
      gameType: 'G020',
      gameName: 'Wordle Indonesia',
      hostId: ctx.senderId
    });

    room.state = {
      targetWord,
      guesses: [] as string[],
      maxGuesses: 6,
      ended: false
    };

    room.status = 'playing';
    activeRooms.set(ctx.chatId, room);

    // Timeout in 3 minutes
    room.setAfkTimeout(180000, async () => {
      if (activeRooms.get(ctx.chatId) === room) {
        activeRooms.delete(ctx.chatId);
        await adapter.sendMessage(ctx.chatId, `⏰ *Wordle Timeout!* Waktu habis. Kata yang benar adalah: *${targetWord.toUpperCase()}*`);
      }
    });

    const initMsg = `🟩 *WORDLE INDONESIA* 🟩\n\n` +
      `Tebak kata *5 HURUf* Bahasa Indonesia.\n` +
      `Anda memiliki *6 kesempatan*.\n\n` +
      `Ketik kata 5 huruf langsung untuk menebak, atau gunakan:\n` +
      `\`/wordleindo tebak <kata>\`\n` +
      `\`/wordleindo stop\` untuk membatalkan.`;
    await adapter.sendMessage(ctx.chatId, initMsg, { quotedMessageId: ctx.id });
  }

  // ─── Hangman Indonesia (G021) ────────────────────────────────────────────────
  private async playHangman(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const action = args[0]?.toLowerCase();

    if (action === 'cancel' || action === 'stop') {
      const room = activeRooms.get(ctx.chatId);
      if (room && room.gameType === 'G021') {
        room.cancel();
        activeRooms.delete(ctx.chatId);
        await adapter.sendMessage(ctx.chatId, '🛑 Game Hangman Indonesia telah dibatalkan.', { quotedMessageId: ctx.id });
      } else {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada sesi Hangman aktif yang bisa dibatalkan.', { quotedMessageId: ctx.id });
      }
      return;
    }

    if (activeRooms.has(ctx.chatId)) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Ada game lain yang sedang aktif di grup ini.', { quotedMessageId: ctx.id });
      return;
    }

    const targetWord = HANGMAN_WORDS[Math.floor(Math.random() * HANGMAN_WORDS.length)];
    const room = new GameRoom({
      id: ctx.chatId,
      gameType: 'G021',
      gameName: 'Hangman Indonesia',
      hostId: ctx.senderId
    });

    room.state = {
      targetWord,
      guessedLetters: [] as string[],
      lives: 6
    };

    room.status = 'playing';
    activeRooms.set(ctx.chatId, room);

    room.setAfkTimeout(180000, async () => {
      if (activeRooms.get(ctx.chatId) === room) {
        activeRooms.delete(ctx.chatId);
        await adapter.sendMessage(ctx.chatId, `⏰ *Hangman Timeout!* Waktu habis. Kata yang benar adalah: *${targetWord.toUpperCase()}*`);
      }
    });

    const display = this.renderHangmanDisplay(room.state);
    const initMsg = `🎭 *HANGMAN INDONESIA* 🎭\n\n` +
      `${display}\n\n` +
      `Tebak huruf langsung (1 huruf) atau gunakan \`/hangmanindo tebak <huruf>\`.\n` +
      `Gunakan \`/hangmanindo stop\` untuk membatalkan.`;
    await adapter.sendMessage(ctx.chatId, initMsg, { quotedMessageId: ctx.id });
  }

  private renderHangmanDisplay(state: any): string {
    const revealed = state.targetWord
      .split('')
      .map((char: string) => state.guessedLetters.includes(char) ? char.toUpperCase() : '_')
      .join(' ');
    
    const hearts = '❤️'.repeat(state.lives) + '🖤'.repeat(6 - state.lives);
    return `Kata: *${revealed}*\nNyawa: ${hearts}\nHuruf Tertebak: ${state.guessedLetters.map((l: string) => l.toUpperCase()).join(', ') || '-'}`;
  }

  // ─── Anagram Race (G022) ────────────────────────────────────────────────────
  private async playAnagram(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const action = args[0]?.toLowerCase();

    if (action === 'cancel' || action === 'stop') {
      const room = activeRooms.get(ctx.chatId);
      if (room && room.gameType === 'G022') {
        room.cancel();
        activeRooms.delete(ctx.chatId);
        await adapter.sendMessage(ctx.chatId, '🛑 Game Anagram Race telah dibatalkan.', { quotedMessageId: ctx.id });
      } else {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada sesi Anagram Race aktif yang bisa dibatalkan.', { quotedMessageId: ctx.id });
      }
      return;
    }

    if (activeRooms.has(ctx.chatId)) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Ada game lain yang sedang aktif di grup ini.', { quotedMessageId: ctx.id });
      return;
    }

    const targetWord = ANAGRAM_WORDS[Math.floor(Math.random() * ANAGRAM_WORDS.length)];
    // Scramble targetWord
    let scrambled = targetWord;
    while (scrambled === targetWord) {
      scrambled = targetWord.split('').sort(() => Math.random() - 0.5).join('-');
    }

    const room = new GameRoom({
      id: ctx.chatId,
      gameType: 'G022',
      gameName: 'Anagram Race',
      hostId: ctx.senderId
    });

    room.state = {
      targetWord,
      scrambled
    };

    room.status = 'playing';
    activeRooms.set(ctx.chatId, room);

    // End after 60 seconds
    room.setAfkTimeout(60000, async () => {
      if (activeRooms.get(ctx.chatId) === room) {
        activeRooms.delete(ctx.chatId);
        await adapter.sendMessage(ctx.chatId, `⏰ *Anagram Waktu Habis!* Tidak ada yang berhasil menebak. Kata yang benar adalah: *${targetWord.toUpperCase()}*`);
      }
    });

    const initMsg = `🏃‍♂️ *ANAGRAM RACE* 🏃‍♂️\n\n` +
      `Susun ulang huruf-huruf berikut menjadi kata yang benar:\n` +
      `🌀 *${scrambled.toUpperCase()}*\n\n` +
      `Kirim jawaban langsung ke grup atau gunakan \`/anagramrace <jawaban>\`!\n` +
      `Waktu Anda *60 detik*.`;
    await adapter.sendMessage(ctx.chatId, initMsg, { quotedMessageId: ctx.id });
  }

  // ─── Math Sprint (G016) ─────────────────────────────────────────────────────
  private async playMathSprint(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const action = args[0]?.toLowerCase();

    if (action === 'cancel' || action === 'stop') {
      const room = activeRooms.get(ctx.chatId);
      if (room && room.gameType === 'G016') {
        room.cancel();
        activeRooms.delete(ctx.chatId);
        await adapter.sendMessage(ctx.chatId, '🛑 Game Math Sprint telah dibatalkan.', { quotedMessageId: ctx.id });
      } else {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada sesi Math Sprint aktif yang bisa dibatalkan.', { quotedMessageId: ctx.id });
      }
      return;
    }

    if (activeRooms.has(ctx.chatId)) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Ada game lain yang sedang aktif di grup ini.', { quotedMessageId: ctx.id });
      return;
    }

    const room = new GameRoom({
      id: ctx.chatId,
      gameType: 'G016',
      gameName: 'Math Sprint',
      hostId: ctx.senderId
    });

    const q = this.generateMathQuestion();
    room.state = {
      score: 0,
      streak: 0,
      maxStreak: 0,
      currentAns: q.answer,
      currentEq: q.equation,
      startTime: Date.now()
    };

    room.status = 'playing';
    activeRooms.set(ctx.chatId, room);

    // End after 60 seconds
    room.setAfkTimeout(60000, async () => {
      if (activeRooms.get(ctx.chatId) === room) {
        activeRooms.delete(ctx.chatId);
        
        // Award final score reward
        const coins = room.state.score * 5;
        const xp = room.state.score * 3;
        if (room.state.score > 0) {
          await rewardPlayer(ctx.senderId, coins, xp);
          await recordGameStats(ctx.senderId, ctx.chatId, 'mathsprint', true, room.state.score);
        }

        const endMsg = `🏁 *MATH SPRINT SELESAI* 🏁\n\n` +
          `*Pemain:* @${ctx.senderId.split('@')[0]}\n` +
          `*Total Soal Terjawab:* ${room.state.score}\n` +
          `*Streak Maksimum:* ${room.state.maxStreak}\n` +
          `💰 *Reward:* +${coins} Koin | +${xp} XP`;
        await adapter.sendMessage(ctx.chatId, endMsg, { mentions: [ctx.senderId] });
      }
    });

    const initMsg = `⚡ *MATH SPRINT 60 DETIK* ⚡\n\n` +
      `Jawab soal matematika secepat mungkin!\n` +
      `Pertanyaan Pertama:\n` +
      `🔢 *${q.equation} = ?*\n\n` +
      `Jawab langsung ke grup!`;
    await adapter.sendMessage(ctx.chatId, initMsg, { quotedMessageId: ctx.id });
  }

  public generateMathQuestion(): { equation: string, answer: number } {
    const ops = ['+', '-', '*'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let n1 = 0, n2 = 0;
    if (op === '+') {
      n1 = Math.floor(Math.random() * 80) + 10;
      n2 = Math.floor(Math.random() * 80) + 10;
      return { equation: `${n1} + ${n2}`, answer: n1 + n2 };
    } else if (op === '-') {
      n1 = Math.floor(Math.random() * 80) + 20;
      n2 = Math.floor(Math.random() * (n1 - 10)) + 5;
      return { equation: `${n1} - ${n2}`, answer: n1 - n2 };
    } else {
      n1 = Math.floor(Math.random() * 12) + 2;
      n2 = Math.floor(Math.random() * 10) + 2;
      return { equation: `${n1} * ${n2}`, answer: n1 * n2 };
    }
  }

  // ─── Suit Tournament (G030) ─────────────────────────────────────────────────
  private async playSuitTournament(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const action = args[0]?.toLowerCase();

    if (action === 'join') {
      const room = activeRooms.get(ctx.chatId);
      if (!room || room.gameType !== 'G030') {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada turnamen suit yang sedang membuka pendaftaran.', { quotedMessageId: ctx.id });
        return;
      }
      if (room.status !== 'lobby') {
        await adapter.sendMessage(ctx.chatId, '⚠️ Turnamen sudah dimulai.', { quotedMessageId: ctx.id });
        return;
      }
      const success = room.join(ctx.senderId);
      if (success) {
        await adapter.sendMessage(
          ctx.chatId,
          `✅ @${ctx.senderId.split('@')[0]} bergabung ke turnamen! (Total pemain: ${room.players.length})`,
          { mentions: [ctx.senderId] }
        );
      } else {
        await adapter.sendMessage(ctx.chatId, '⚠️ Anda sudah bergabung atau lobby sudah penuh.', { quotedMessageId: ctx.id });
      }
      return;
    }

    if (action === 'leave') {
      const room = activeRooms.get(ctx.chatId);
      if (room && room.gameType === 'G030' && room.status === 'lobby') {
        const success = room.leave(ctx.senderId);
        if (success) {
          await adapter.sendMessage(ctx.chatId, `👋 @${ctx.senderId.split('@')[0]} keluar dari lobby.`, { mentions: [ctx.senderId] });
        }
      }
      return;
    }

    if (action === 'start') {
      const room = activeRooms.get(ctx.chatId);
      if (!room || room.gameType !== 'G030') {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada turnamen suit.', { quotedMessageId: ctx.id });
        return;
      }
      if (room.hostId !== ctx.senderId) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya pembuat lobby (Host) yang bisa memulai turnamen.', { quotedMessageId: ctx.id });
        return;
      }
      if (room.players.length < 2) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Butuh minimal 2 pemain untuk memulai turnamen.', { quotedMessageId: ctx.id });
        return;
      }

      room.start();
      room.state = {
        round: 1,
        activePlayers: [...room.players],
        matches: [] as any[]
      };

      await this.setupSuitRound(room, adapter);
      return;
    }

    if (action === 'cancel' || action === 'stop') {
      const room = activeRooms.get(ctx.chatId);
      if (room && room.gameType === 'G030') {
        room.cancel();
        activeRooms.delete(ctx.chatId);
        await adapter.sendMessage(ctx.chatId, '🛑 Turnamen Suit telah dibatalkan.', { quotedMessageId: ctx.id });
      } else {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada sesi Turnamen Suit aktif.', { quotedMessageId: ctx.id });
      }
      return;
    }

    // Default: Create Lobby
    if (activeRooms.has(ctx.chatId)) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Ada game lain yang sedang aktif di grup ini.', { quotedMessageId: ctx.id });
      return;
    }

    const room = new GameRoom({
      id: ctx.chatId,
      gameType: 'G030',
      gameName: 'Suit Tournament',
      hostId: ctx.senderId,
      minPlayers: 2,
      maxPlayers: 8
    });

    activeRooms.set(ctx.chatId, room);

    // Timeout lobby in 3 minutes if not started
    room.setAfkTimeout(180000, async () => {
      if (activeRooms.get(ctx.chatId) === room && room.status === 'lobby') {
        activeRooms.delete(ctx.chatId);
        await adapter.sendMessage(ctx.chatId, '⏰ *Suit Lobby Timeout!* Lobi dibatalkan karena tidak dimulai.');
      }
    });

    const initMsg = `🏆 *SUIT TOURNAMENT LOBBY* 🏆\n\n` +
      `Host: @${ctx.senderId.split('@')[0]}\n` +
      `Pemain saat ini: 1/8\n\n` +
      `Hubungi anggota lain untuk ikut bergabung!\n` +
      `Ketik \`/suittournament join\` untuk mendaftar.\n` +
      `Host ketik \`/suittournament start\` untuk memulai.`;
    await adapter.sendMessage(ctx.chatId, initMsg, { mentions: [ctx.senderId], quotedMessageId: ctx.id });
  }

  private async setupSuitRound(room: GameRoom, adapter: WhatsAppAdapter): Promise<void> {
    const state = room.state;
    if (state.activePlayers.length === 1) {
      // Winner found
      const winner = state.activePlayers[0];
      activeRooms.delete(room.id);

      await rewardPlayer(winner, 250, 100);
      await recordGameStats(winner, room.id, 'suittournament', true, 50);

      const winMsg = `👑 *TURNAMEN SUIT SELESAI* 👑\n\n` +
        `🏆 Pemenang Utama: @${winner.split('@')[0]}!\n` +
        `💰 Hadiah Utama: *+250 Koin* dan *+100 XP*`;
      await adapter.sendMessage(room.id, winMsg, { mentions: [winner] });
      return;
    }

    state.matches = [];
    const playersToMatch = [...state.activePlayers];
    // Shuffle
    playersToMatch.sort(() => Math.random() - 0.5);

    let infoMsg = `⚔️ *BABAK ${state.round} SUIT TOURNAMENT* ⚔️\n\nMatchup Babak Ini:\n`;
    const mentions: string[] = [];

    for (let i = 0; i < playersToMatch.length; i += 2) {
      if (i + 1 < playersToMatch.length) {
        const p1 = playersToMatch[i];
        const p2 = playersToMatch[i + 1];
        state.matches.push({ p1, p2, p1Choice: undefined, p2Choice: undefined, winner: undefined });
        infoMsg += `👉 @${p1.split('@')[0]} vs @${p2.split('@')[0]}\n`;
        mentions.push(p1, p2);
      } else {
        const p = playersToMatch[i];
        state.matches.push({ p1: p, p2: undefined, winner: p, bye: true });
        infoMsg += `👉 @${p.split('@')[0]} mendapatkan BYE (otomatis lolos)\n`;
        mentions.push(p);
      }
    }

    infoMsg += `\n✉️ *Penting:* Silakan pilih \`batu\`, \`gunting\`, atau \`kertas\` dengan cara membalas ke bot via chat pribadi (DM) dengan mengetik:\n` +
      `\`/suittournament pilih <pilihan>\`\n\n` +
      `Waktu berpikir: *60 detik*. Jika diam, bot akan menentukan pemenang secara acak.`;

    await adapter.sendMessage(room.id, infoMsg, { mentions });

    room.setAfkTimeout(60000, async () => {
      // AFK Handler: auto-resolve remaining matches
      let changed = false;
      for (const m of state.matches) {
        if (!m.winner) {
          const choices = ['batu', 'gunting', 'kertas'];
          if (!m.p1Choice) m.p1Choice = choices[Math.floor(Math.random() * 3)];
          if (!m.p2Choice) m.p2Choice = choices[Math.floor(Math.random() * 3)];
          m.winner = this.evaluateSuit(m.p1, m.p2, m.p1Choice, m.p2Choice);
          changed = true;
        }
      }
      if (changed) {
        await adapter.sendMessage(room.id, '⏱️ Waktu babak habis! Pemain yang diam telah dipilihkan secara acak.');
        await this.checkRoundStatus(room, adapter);
      }
    });
  }

  private evaluateSuit(p1: string, p2: string, c1: string, c2: string): string {
    if (c1 === c2) {
      // If draw in tournament, random win to prevent infinite loop
      return Math.random() > 0.5 ? p1 : p2;
    }
    if (
      (c1 === 'batu' && c2 === 'gunting') ||
      (c1 === 'gunting' && c2 === 'kertas') ||
      (c1 === 'kertas' && c2 === 'batu')
    ) {
      return p1;
    }
    return p2;
  }

  private async checkRoundStatus(room: GameRoom, adapter: WhatsAppAdapter): Promise<void> {
    const state = room.state;
    const unresolved = state.matches.some((m: any) => !m.winner);
    if (unresolved) return;

    room.clearAfkTimeout();

    // Print round summary
    let summaryMsg = `📊 *HASIL BABAK ${state.round}* 📊\n\n`;
    const mentions: string[] = [];

    for (const m of state.matches) {
      if (m.bye) continue;
      summaryMsg += `@${m.p1.split('@')[0]} (${m.p1Choice}) vs @${m.p2.split('@')[0]} (${m.p2Choice})\n` +
        `🏆 Pemenang: @${m.winner.split('@')[0]}\n\n`;
      mentions.push(m.p1, m.p2, m.winner);
    }

    await adapter.sendMessage(room.id, summaryMsg, { mentions });

    // Advance round
    state.activePlayers = state.matches.map((m: any) => m.winner);
    state.round += 1;

    // Small delay before next round
    setTimeout(async () => {
      await this.setupSuitRound(room, adapter);
    }, 3000);
  }

  // Handle choice sent via DM or group
  private async handleSuitChoice(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const choice = args[1]?.toLowerCase() || args[0]?.toLowerCase();
    const valid = ['batu', 'gunting', 'kertas'];
    if (!valid.includes(choice)) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Pilihan salah. Pilih: `batu`, `gunting`, `kertas`', { quotedMessageId: ctx.id });
      return;
    }

    // Find active G030 room where the sender is active in a match
    let matchedRoom: GameRoom | null = null;
    let matchedMatch: any = null;

    for (const room of activeRooms.values()) {
      if (room.gameType === 'G030' && room.status === 'playing') {
        const match = room.state.matches.find((m: any) => (m.p1 === ctx.senderId || m.p2 === ctx.senderId) && !m.winner);
        if (match) {
          matchedRoom = room;
          matchedMatch = match;
          break;
        }
      }
    }

    if (!matchedRoom || !matchedMatch) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Anda tidak sedang berada dalam babak aktif turnamen suit.', { quotedMessageId: ctx.id });
      return;
    }

    if (matchedMatch.p1 === ctx.senderId) {
      matchedMatch.p1Choice = choice;
    } else {
      matchedMatch.p2Choice = choice;
    }

    await adapter.sendMessage(ctx.chatId, `✅ Pilihan \`${choice}\` tersimpan!`);

    if (matchedMatch.p1Choice && matchedMatch.p2Choice) {
      matchedMatch.winner = this.evaluateSuit(matchedMatch.p1, matchedMatch.p2, matchedMatch.p1Choice, matchedMatch.p2Choice);
      await adapter.sendMessage(
        matchedRoom.id,
        `⚔️ Matchup selesai! @${matchedMatch.p1.split('@')[0]} vs @${matchedMatch.p2.split('@')[0]} terpecahkan.`,
        { mentions: [matchedMatch.p1, matchedMatch.p2] }
      );
      await this.checkRoundStatus(matchedRoom, adapter);
    }
  }
}

// Intercept game answers
class PrdGameAnswerHandler implements GameAnswerHandler {
  public async canHandle(ctx: MessageContext): Promise<boolean> {
    // Suit tournament choices should be parsed by execute/command, not intercept
    const room = activeRooms.get(ctx.chatId);
    if (!room || room.status !== 'playing') return false;

    // Check if message is a command first, if it has command prefix and is recognized, skip intercept
    if (ctx.command?.isCommand) {
      const cmdName = ctx.command.commandName?.toLowerCase();
      // Allow /wordleindo tebak, /hangmanindo tebak, /anagramrace, /mathsprint to fall through
      if (['wordleindo', 'hangmanindo', 'anagramrace', 'mathsprint'].includes(cmdName)) {
        return false;
      }
    }
    return true;
  }

  public async handleAnswer(ctx: MessageContext, adapter: WhatsAppAdapter): Promise<boolean> {
    const room = activeRooms.get(ctx.chatId);
    if (!room || room.status !== 'playing') return false;

    const text = ctx.body.trim().toLowerCase();
    
    // Ignore commands starting with prefix unless it is a play command handled by execute
    if (['/', '!', '.', '#'].includes(ctx.body.trim().charAt(0))) {
      return false;
    }

    if (room.gameType === 'G020') {
      // Wordle: 5 letter word guess
      if (text.length === 5 && /^[a-zA-Z]+$/.test(text)) {
        await this.handleWordleGuess(room, text, ctx, adapter);
        return true;
      }
    } else if (room.gameType === 'G021') {
      // Hangman: single letter guess
      if (text.length === 1 && /^[a-zA-Z]$/.test(text)) {
        await this.handleHangmanGuess(room, text, ctx, adapter);
        return true;
      }
    } else if (room.gameType === 'G022') {
      // Anagram: guess the whole word
      if (text === room.state.targetWord.toLowerCase()) {
        await this.handleAnagramSolve(room, ctx, adapter);
        return true;
      }
    } else if (room.gameType === 'G016') {
      // Math Sprint: numeric guess
      const num = parseInt(text, 10);
      if (!isNaN(num) && num === room.state.currentAns) {
        await this.handleMathSolve(room, ctx, adapter);
        return true;
      }
    }

    return false;
  }

  private async handleWordleGuess(room: GameRoom, guess: string, ctx: MessageContext, adapter: WhatsAppAdapter): Promise<void> {
    room.updateActivity();
    const state = room.state;
    const target = state.targetWord.toLowerCase();
    
    state.guesses.push(guess);

    // Render color grid
    let result = '';
    for (let i = 0; i < 5; i++) {
      if (guess[i] === target[i]) {
        result += '🟩';
      } else if (target.includes(guess[i])) {
        result += '🟨';
      } else {
        result += '⬛';
      }
    }

    const grid = state.guesses.map((g: string) => {
      let row = '';
      for (let i = 0; i < 5; i++) {
        if (g[i] === target[i]) row += '🟩';
        else if (target.includes(g[i])) row += '🟨';
        else row += '⬛';
      }
      return `${row}  (${g.toUpperCase()})`;
    }).join('\n');

    if (guess === target) {
      room.clearAfkTimeout();
      activeRooms.delete(room.id);
      
      const coins = 100 - (state.guesses.length - 1) * 15;
      await rewardPlayer(ctx.senderId, coins, 30);
      await recordGameStats(ctx.senderId, room.id, 'wordleindo', true, coins);

      const winMsg = `🎉 *CONGRATULATIONS! WORDLE SOLVED!* 🎉\n\n` +
        `@${ctx.senderId.split('@')[0]} menebak dengan tepat: *${target.toUpperCase()}*\n\n` +
        `${grid}\n\n` +
        `💰 *Reward:* +${coins} Koin | +30 XP`;
      await adapter.sendMessage(room.id, winMsg, { mentions: [ctx.senderId], quotedMessageId: ctx.id });
    } else if (state.guesses.length >= state.maxGuesses) {
      room.clearAfkTimeout();
      activeRooms.delete(room.id);

      const loseMsg = `😢 *GAME OVER! Kesempatan habis.* 😢\n\n` +
        `${grid}\n\n` +
        `Kata yang benar adalah: *${target.toUpperCase()}*`;
      await adapter.sendMessage(room.id, loseMsg, { quotedMessageId: ctx.id });
    } else {
      const remaining = state.maxGuesses - state.guesses.length;
      const progressMsg = `🟩 *WORDLE INDONESIA* 🟩\n\n` +
        `${grid}\n\n` +
        `Sisa kesempatan: *${remaining}*`;
      await adapter.sendMessage(room.id, progressMsg, { quotedMessageId: ctx.id });
    }
  }

  private async handleHangmanGuess(room: GameRoom, letter: string, ctx: MessageContext, adapter: WhatsAppAdapter): Promise<void> {
    room.updateActivity();
    const state = room.state;
    const target = state.targetWord.toLowerCase();

    if (state.guessedLetters.includes(letter)) {
      await adapter.sendMessage(room.id, `⚠️ Huruf *${letter.toUpperCase()}* sudah pernah ditebak.`, { quotedMessageId: ctx.id });
      return;
    }

    state.guessedLetters.push(letter);

    if (target.includes(letter)) {
      // Check win
      const won = target.split('').every((char: string) => state.guessedLetters.includes(char));
      if (won) {
        room.clearAfkTimeout();
        activeRooms.delete(room.id);

        const coins = 80;
        await rewardPlayer(ctx.senderId, coins, 20);
        await recordGameStats(ctx.senderId, room.id, 'hangmanindo', true, coins);

        const winMsg = `🎉 *CONGRATULATIONS! HANGMAN WIN!* 🎉\n\n` +
          `Kata berhasil ditebak: *${target.toUpperCase()}*\n` +
          `💰 *Reward:* +${coins} Koin | +20 XP`;
        await adapter.sendMessage(room.id, winMsg, { mentions: [ctx.senderId], quotedMessageId: ctx.id });
      } else {
        const display = this.renderHangmanDisplay(state);
        await adapter.sendMessage(room.id, `✅ Huruf *${letter.toUpperCase()}* benar!\n\n${display}`, { quotedMessageId: ctx.id });
      }
    } else {
      state.lives -= 1;
      if (state.lives <= 0) {
        room.clearAfkTimeout();
        activeRooms.delete(room.id);

        const loseMsg = `☠️ *HANGMAN GAME OVER!* ☠️\n\n` +
          `Anda kehabisan nyawa.\n` +
          `Kata yang benar adalah: *${target.toUpperCase()}*`;
        await adapter.sendMessage(room.id, loseMsg, { quotedMessageId: ctx.id });
      } else {
        const display = this.renderHangmanDisplay(state);
        await adapter.sendMessage(room.id, `❌ Huruf *${letter.toUpperCase()}* salah!\n\n${display}`, { quotedMessageId: ctx.id });
      }
    }
  }

  private renderHangmanDisplay(state: any): string {
    const revealed = state.targetWord
      .split('')
      .map((char: string) => state.guessedLetters.includes(char) ? char.toUpperCase() : '_')
      .join(' ');
    const hearts = '❤️'.repeat(state.lives) + '🖤'.repeat(6 - state.lives);
    return `Kata: *${revealed}*\nNyawa: ${hearts}\nHuruf Tertebak: ${state.guessedLetters.map((l: string) => l.toUpperCase()).join(', ')}`;
  }

  private async handleAnagramSolve(room: GameRoom, ctx: MessageContext, adapter: WhatsAppAdapter): Promise<void> {
    room.clearAfkTimeout();
    activeRooms.delete(room.id);

    const coins = 60;
    await rewardPlayer(ctx.senderId, coins, 15);
    await recordGameStats(ctx.senderId, room.id, 'anagramrace', true, coins);

    const winMsg = `🎉 *ANAGRAM RACE TERJAWAB!* 🎉\n\n` +
      `Selamat @${ctx.senderId.split('@')[0]}, Anda berhasil menebak: *${room.state.targetWord.toUpperCase()}*\n` +
      `💰 *Hadiah:* +${coins} Koin | +15 XP`;
    await adapter.sendMessage(room.id, winMsg, { mentions: [ctx.senderId], quotedMessageId: ctx.id });
  }

  private async handleMathSolve(room: GameRoom, ctx: MessageContext, adapter: WhatsAppAdapter): Promise<void> {
    room.updateActivity();
    const state = room.state;
    state.score += 1;
    state.streak += 1;
    if (state.streak > state.maxStreak) {
      state.maxStreak = state.streak;
    }

    const prdGames = new PrdGamesSuiteCommand();
    const q = prdGames.generateMathQuestion();
    state.currentAns = q.answer;
    state.currentEq = q.equation;

    const streakBonus = state.streak >= 5 ? `🔥 *Streak x${state.streak}!*` : '';
    const msg = `✅ Jawaban tepat!\n` +
      `Skor saat ini: *${state.score}* ${streakBonus}\n\n` +
      `Soal berikutnya:\n` +
      `🔢 *${q.equation} = ?*`;
    await adapter.sendMessage(room.id, msg, { quotedMessageId: ctx.id });
  }
}

// Initialize and Register the command suite
const prdGames = new PrdGamesSuiteCommand();

// Register all 50 games dynamically at module load
const prdGameAliases: string[] = [];
for (const entry of PRD_CATALOG) {
  if (entry.id.startsWith('G')) {
    prdGameAliases.push(entry.name.toLowerCase());
    for (const alias of entry.aliases) {
      prdGameAliases.push(alias.toLowerCase());
    }
  }
}
// Add special suittournament choice alias
prdGameAliases.push('pilihtourney');

registerCommand(prdGameAliases, prdGames);

// Register answer interceptor
gameSessionService.registerHandler(new PrdGameAnswerHandler());
