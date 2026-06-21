import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';

// In-memory states
const activeTrivias = new Map<string, { answer: string; points: number }>();
const activeSongGames = new Map<string, { answer: string; points: number }>();
const activeEmojiGames = new Map<string, { answer: string; points: number }>();
const duelSessions = new Map<string, { challenger: string; target: string; challengerHp: number; targetHp: number; turn: string }>();
const activeWordChains = new Map<string, { lastWord: string; players: Set<string> }>();
const activeHangmans = new Map<string, { word: string; guessed: string[]; remainingAttempts: number }>();
const activeTyperaces = new Map<string, { sentence: string; startTime: number }>();

export class GamesAdvancedCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // 1. /trivia
    if (cmd === 'trivia') {
      const questions = [
        { q: 'Apakah ibukota dari Perancis?', a: 'Paris', pts: 10 },
        { q: 'Planet terdekat dari Matahari adalah...', a: 'Merkurius', pts: 10 },
        { q: 'Berapakah hasil dari 12 x 12?', a: '144', pts: 10 }
      ];
      const chosen = questions[Math.floor(Math.random() * questions.length)];
      activeTrivias.set(ctx.chatId, { answer: chosen.a.toLowerCase(), points: chosen.pts });

      await adapter.sendMessage(ctx.chatId, `🧩 *TRIVIA BATTLE* 🧩\n\n*Pertanyaan:* ${chosen.q}\n\nJawab dengan: \`/jawab ${chosen.q.includes('Pilihan') ? 'A/B/C/D' : '<jawaban>'}\``, { quotedMessageId: ctx.id });
      return;
    }

    // 2. /tebaklagu
    if (cmd === 'tebaklagu') {
      const songs = [
        { lyric: '...ku menangis membayangkan betapa kejamnya dirimu atas diriku...', title: 'Hati Yang Kau Sakiti', pts: 20 },
        { lyric: '...aku tak sing ngalah, trimo mundur timbang loro ati...', title: 'Mundur Alon Alon', pts: 20 }
      ];
      const chosen = songs[Math.floor(Math.random() * songs.length)];
      activeSongGames.set(ctx.chatId, { answer: chosen.title.toLowerCase(), points: chosen.pts });

      await adapter.sendMessage(ctx.chatId, `🎵 *TEBAK LAGU* 🎵\n\n*Lirik:* "${chosen.lyric}"\n\nJawab dengan: \`/jawab <judul lagu>\``, { quotedMessageId: ctx.id });
      return;
    }

    // 3. /tebakemoji
    if (cmd === 'tebakemoji') {
      const emojis = [
        { clue: '⚡️👓🧹', answer: 'Harry Potter', pts: 15 },
        { clue: '🦁👑', answer: 'The Lion King', pts: 15 },
        { clue: '🕷️👨🏼', answer: 'Spider Man', pts: 15 }
      ];
      const chosen = emojis[Math.floor(Math.random() * emojis.length)];
      activeEmojiGames.set(ctx.chatId, { answer: chosen.answer.toLowerCase(), points: chosen.pts });

      await adapter.sendMessage(ctx.chatId, `❓ *TEBAK EMOJI* ❓\n\n*Emoji:* ${chosen.clue}\n\nJawab dengan: \`/jawab <judul film/kata>\``, { quotedMessageId: ctx.id });
      return;
    }

    // 4. /roulette
    if (cmd === 'roulette') {
      const chamber = Math.floor(Math.random() * 6);
      if (chamber === 0) {
        const { stateStore } = await import('../../services/state/state-store.js');
        await stateStore.set(`mute:${ctx.chatId}:${ctx.senderId}`, true, 60); // Mute 1 menit
        await adapter.sendMessage(ctx.chatId, `💥 *BANG!* Anda tertembak dan di-mute selama 1 menit!`, { quotedMessageId: ctx.id });
      } else {
        await adapter.sendMessage(ctx.chatId, `*Klik.* Anda selamat! Koin keberuntungan bertambah.`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 5. /duel @user
    if (cmd === 'duel') {
      const mention = ctx.body.match(/@\d+/g)?.[0];
      if (!mention) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tag lawan duel Anda. Contoh: `/duel @user`', { quotedMessageId: ctx.id });
        return;
      }
      const targetId = mention.replace('@', '') + '@s.whatsapp.net';
      duelSessions.set(ctx.chatId, {
        challenger: ctx.senderId,
        target: targetId,
        challengerHp: 100,
        targetHp: 100,
        turn: ctx.senderId
      });

      await adapter.sendMessage(ctx.chatId, `⚔️ *TANTANGAN DUEL* ⚔️\n\n@${ctx.senderId.split('@')[0]} menantang @${targetId.split('@')[0]}!\nKetik \`/serang\` untuk menyerang saat giliran Anda.`, { mentions: [ctx.senderId, targetId] });
      return;
    }

    // 6. /serang
    if (cmd === 'serang') {
      const duel = duelSessions.get(ctx.chatId);
      if (!duel) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada sesi duel aktif di grup ini.', { quotedMessageId: ctx.id });
        return;
      }

      if (ctx.senderId !== duel.turn) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Bukan giliran Anda!', { quotedMessageId: ctx.id });
        return;
      }

      const damage = Math.floor(Math.random() * 30) + 10;
      let msg = '';
      if (ctx.senderId === duel.challenger) {
        duel.targetHp = Math.max(0, duel.targetHp - damage);
        duel.turn = duel.target;
        msg = `💥 @${duel.challenger.split('@')[0]} menyerang @${duel.target.split('@')[0]} sebesar *${damage} HP*!\n\n*HP @${duel.target.split('@')[0]}:* ${duel.targetHp}\n*HP @${duel.challenger.split('@')[0]}:* ${duel.challengerHp}`;
      } else {
        duel.challengerHp = Math.max(0, duel.challengerHp - damage);
        duel.turn = duel.challenger;
        msg = `💥 @${duel.target.split('@')[0]} menyerang @${duel.challenger.split('@')[0]} sebesar *${damage} HP*!\n\n*HP @${duel.challenger.split('@')[0]}:* ${duel.challengerHp}\n*HP @${duel.target.split('@')[0]}:* ${duel.targetHp}`;
      }

      if (duel.targetHp <= 0 || duel.challengerHp <= 0) {
        const winner = duel.targetHp <= 0 ? duel.challenger : duel.target;
        duelSessions.delete(ctx.chatId);
        msg += `\n\n🏆 *DUEL SELESAI!* @${winner.split('@')[0]} memenangkan duel!`;
        await prisma.userEconomy.upsert({
          where: { userId: winner },
          create: { userId: winner, balance: 50 },
          update: { balance: { increment: 50 } }
        });
      }

      await adapter.sendMessage(ctx.chatId, msg, { mentions: [duel.challenger, duel.target] });
      return;
    }

    // 7. /bingo
    if (cmd === 'bingo') {
      const num = Math.floor(Math.random() * 100) + 1;
      await adapter.sendMessage(ctx.chatId, `🎲 *BINGO GRUP* 🎲\n\nAngka Keberuntungan Bingo: *${num}*!`, { quotedMessageId: ctx.id });
      return;
    }

    // 8. /keretakata
    if (cmd === 'keretakata') {
      const word = args[0]?.toLowerCase().trim();
      if (!word) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Mulai game dengan kata awal. Contoh: `/keretakata buku`', { quotedMessageId: ctx.id });
        return;
      }
      activeWordChains.set(ctx.chatId, { lastWord: word, players: new Set([ctx.senderId]) });
      await adapter.sendMessage(ctx.chatId, `🚂 *KERETA KATA* 🚂\n\nKata saat ini: *${word}*\nKata berikutnya harus dimulai dengan huruf *${word.slice(-1).toUpperCase()}*!`, { quotedMessageId: ctx.id });
      return;
    }

    // 9. /hangman
    if (cmd === 'hangman') {
      const words = ['whatsapp', 'database', 'developer', 'antigravity'];
      const chosen = words[Math.floor(Math.random() * words.length)];
      activeHangmans.set(ctx.chatId, {
        word: chosen,
        guessed: [],
        remainingAttempts: 6
      });

      const display = '_ '.repeat(chosen.length).trim();
      await adapter.sendMessage(ctx.chatId, `💀 *HANGMAN GAME* 💀\n\nKata: *${display}*\nPercobaan tersisa: *6*\nKetik \`/tebak <huruf>\` untuk menebak!`, { quotedMessageId: ctx.id });
      return;
    }

    // 10. /tebak
    if (cmd === 'tebak') {
      const hang = activeHangmans.get(ctx.chatId);
      if (!hang) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada sesi Hangman aktif di grup ini.', { quotedMessageId: ctx.id });
        return;
      }

      const char = args[0]?.toLowerCase().trim();
      if (!char || char.length !== 1) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tebak satu huruf saja. Contoh: `/tebak a`', { quotedMessageId: ctx.id });
        return;
      }

      if (hang.guessed.includes(char)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Huruf ini sudah pernah ditebak.', { quotedMessageId: ctx.id });
        return;
      }

      hang.guessed.push(char);

      if (hang.word.includes(char)) {
        let display = '';
        let allGuessed = true;
        for (const c of hang.word) {
          if (hang.guessed.includes(c)) {
            display += c + ' ';
          } else {
            display += '_ ';
            allGuessed = false;
          }
        }

        if (allGuessed) {
          activeHangmans.delete(ctx.chatId);
          await adapter.sendMessage(ctx.chatId, `🎉 *Selamat!* Anda berhasil menebak kata *"${hang.word.toUpperCase()}"*!`, { quotedMessageId: ctx.id });
        } else {
          await adapter.sendMessage(ctx.chatId, `✅ Tebakan benar!\n\nKata: *${display.trim()}*\nPercobaan tersisa: *${hang.remainingAttempts}*`, { quotedMessageId: ctx.id });
        }
      } else {
        hang.remainingAttempts--;
        if (hang.remainingAttempts <= 0) {
          activeHangmans.delete(ctx.chatId);
          await adapter.sendMessage(ctx.chatId, `💀 *GAME OVER!* Anda kehabisan percobaan. Kata yang benar adalah *"${hang.word.toUpperCase()}"*`, { quotedMessageId: ctx.id });
        } else {
          await adapter.sendMessage(ctx.chatId, `❌ Tebakan salah!\nPercobaan tersisa: *${hang.remainingAttempts}*`, { quotedMessageId: ctx.id });
        }
      }
      return;
    }

    // 11. /typerace
    if (cmd === 'typerace') {
      const sentences = [
        'Kucing meloncat di atas atap rumah kemarin malam.',
        'Belajar pemrograman Javascript membutuhkan latihan konsisten.'
      ];
      const chosen = sentences[Math.floor(Math.random() * sentences.length)];
      activeTyperaces.set(ctx.chatId, { sentence: chosen, startTime: Date.now() });

      await adapter.sendMessage(ctx.chatId, `🏎️ *TYPERACE* 🏎️\n\nKetik kalimat berikut secepat mungkin:\n\n👉 *${chosen}*\n\n(Balas dengan mengetik persis kalimat di atas)`, { quotedMessageId: ctx.id });
      return;
    }

    // 12. /turnamen
    if (cmd === 'turnamen') {
      await adapter.sendMessage(ctx.chatId, `🏆 *TURNAMEN MINI* 🏆\n\nMembuat bracket turnamen baru untuk grup ini. Silakan daftar menggunakan perintah \`/daftar_turnamen\`.`, { quotedMessageId: ctx.id });
      return;
    }

    // INTERCEPT RESPONSES FOR TRIVIA/SONG/EMOJI/TYPERACE
    if (cmd === 'jawab') {
      const ans = args.join(' ').toLowerCase().trim();
      
      // Trivia check
      const triv = activeTrivias.get(ctx.chatId);
      if (triv && triv.answer === ans) {
        activeTrivias.delete(ctx.chatId);
        await prisma.userEconomy.upsert({
          where: { userId: ctx.senderId },
          create: { userId: ctx.senderId, balance: triv.points },
          update: { balance: { increment: triv.points } }
        });
        await adapter.sendMessage(ctx.chatId, `🎉 Jawaban benar! +${triv.points} Saldo.`, { quotedMessageId: ctx.id });
        return;
      }

      // Song check
      const song = activeSongGames.get(ctx.chatId);
      if (song && song.answer === ans) {
        activeSongGames.delete(ctx.chatId);
        await prisma.userEconomy.upsert({
          where: { userId: ctx.senderId },
          create: { userId: ctx.senderId, balance: song.points },
          update: { balance: { increment: song.points } }
        });
        await adapter.sendMessage(ctx.chatId, `🎉 Judul lagu benar! +${song.points} Saldo.`, { quotedMessageId: ctx.id });
        return;
      }

      // Emoji check
      const em = activeEmojiGames.get(ctx.chatId);
      if (em && em.answer === ans) {
        activeEmojiGames.delete(ctx.chatId);
        await prisma.userEconomy.upsert({
          where: { userId: ctx.senderId },
          create: { userId: ctx.senderId, balance: em.points },
          update: { balance: { increment: em.points } }
        });
        await adapter.sendMessage(ctx.chatId, `🎉 Tebakan emoji benar! +${em.points} Saldo.`, { quotedMessageId: ctx.id });
        return;
      }
    }

    // Intercept Typerace directly in message body matching
    const race = activeTyperaces.get(ctx.chatId);
    if (race && ctx.body.trim() === race.sentence) {
      activeTyperaces.delete(ctx.chatId);
      const seconds = ((Date.now() - race.startTime) / 1000).toFixed(2);
      await prisma.userEconomy.upsert({
        where: { userId: ctx.senderId },
        create: { userId: ctx.senderId, balance: 20 },
        update: { balance: { increment: 20 } }
      });
      await adapter.sendMessage(ctx.chatId, `🏎️ @${ctx.senderId.split('@')[0]} mengetik dengan benar dalam waktu *${seconds} detik*! Hadiah +20 koin.`, { mentions: [ctx.senderId] });
      return;
    }
  }
}

const gamesAdvancedCmd = new GamesAdvancedCommand();
registerCommand(
  ['trivia', 'tebaklagu', 'tebakemoji', 'roulette', 'duel', 'serang', 'bingo', 'keretakata', 'hangman', 'tebak', 'typerace', 'turnamen'],
  gamesAdvancedCmd
);
