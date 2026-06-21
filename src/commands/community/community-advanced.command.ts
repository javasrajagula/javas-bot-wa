import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';

// In-memory fallback/storage for announcements, wiki, todo, and countdowns
const groupTodos = new Map<string, string[]>();
const groupWiki = new Map<string, Map<string, string>>();
const groupCountdowns = new Map<string, { title: string; time: number }>();

export class CommunityAdvancedCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // 1. /polling
    if (cmd === 'polling') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Polling hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      const fullInput = args.join(' ');
      const parts = fullInput.split('|');
      if (parts.length < 3) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/polling [pertanyaan] | [opsi 1] | [opsi 2]`', { quotedMessageId: ctx.id });
        return;
      }

      const question = parts[0].trim();
      const options = parts.slice(1).map(o => o.trim());

      try {
        const poll = await prisma.poll.create({
          data: {
            groupId: ctx.chatId,
            question,
            optionsJson: JSON.stringify(options),
            votesJson: JSON.stringify(options.reduce((acc, opt) => ({ ...acc, [opt]: [] }), {})),
            createdBy: ctx.senderId
          }
        });

        let msg = `📊 *POLLING GRUP* 📊\n\n*${question}*\n\n`;
        options.forEach((opt, idx) => {
          msg += `${idx + 1}. *${opt}*\n`;
        });
        msg += `\nKetik \`/vote ${poll.id} | <nomor_opsi>\` untuk memberikan suara.`;

        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal membuat polling: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // vote command helper
    if (cmd === 'vote') {
      const parts = args.join(' ').split('|');
      const pollId = parts[0]?.trim();
      const optIdx = parseInt(parts[1]?.trim()) - 1;

      if (!pollId || isNaN(optIdx)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/vote [poll_id] | [nomor_opsi]`', { quotedMessageId: ctx.id });
        return;
      }

      try {
        const poll = await prisma.poll.findUnique({ where: { id: pollId } });
        if (!poll || poll.status === 'closed') {
          await adapter.sendMessage(ctx.chatId, '⚠️ Polling tidak ditemukan atau sudah ditutup.', { quotedMessageId: ctx.id });
          return;
        }

        const options: string[] = JSON.parse(poll.optionsJson);
        const votes: Record<string, string[]> = JSON.parse(poll.votesJson);

        if (optIdx < 0 || optIdx >= options.length) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Opsi tidak valid.', { quotedMessageId: ctx.id });
          return;
        }

        // Clean user's previous votes
        const userJid = ctx.senderId;
        options.forEach(opt => {
          votes[opt] = (votes[opt] || []).filter(v => v !== userJid);
        });

        // Add vote
        const chosenOption = options[optIdx];
        votes[chosenOption].push(userJid);

        await prisma.poll.update({
          where: { id: pollId },
          data: { votesJson: JSON.stringify(votes) }
        });

        await adapter.sendMessage(ctx.chatId, `✅ Berhasil memberikan suara Anda pada opsi: *${chosenOption}*!`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal memproses vote: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 2. /announce
    if (cmd === 'announce') {
      const msg = args.join(' ');
      if (!msg) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/announce [isi pesan pengumuman]`', { quotedMessageId: ctx.id });
        return;
      }
      await adapter.sendMessage(ctx.chatId, `📢 *PENGUMUMAN RESMI GRUP* 📢\n\n${msg}`, { quotedMessageId: ctx.id });
      return;
    }

    // 3. /todo
    if (cmd === 'todo') {
      const sub = args[0]?.toLowerCase().trim();
      const val = args.slice(1).join(' ').trim();
      const todos = groupTodos.get(ctx.chatId) || [];

      if (sub === 'add') {
        if (!val) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan tugas baru.', { quotedMessageId: ctx.id });
          return;
        }
        todos.push(val);
        groupTodos.set(ctx.chatId, todos);
        await adapter.sendMessage(ctx.chatId, `✅ Berhasil menambahkan tugas: *"${val}"*`, { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'list' || !sub) {
        if (todos.length === 0) {
          await adapter.sendMessage(ctx.chatId, 'ℹ️ Belum ada tugas di daftar To-Do grup ini.', { quotedMessageId: ctx.id });
          return;
        }
        let msg = `📝 *TO-DO LIST GRUP* 📝\n\n`;
        todos.forEach((t, i) => {
          msg += `${i + 1}. [ ] ${t}\n`;
        });
        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'done') {
        const idx = parseInt(val) - 1;
        if (isNaN(idx) || idx < 0 || idx >= todos.length) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Indeks tidak valid.', { quotedMessageId: ctx.id });
          return;
        }
        const doneTask = todos.splice(idx, 1)[0];
        groupTodos.set(ctx.chatId, todos);
        await adapter.sendMessage(ctx.chatId, `✅ Selesai mengerjakan: *"${doneTask}"*!`, { quotedMessageId: ctx.id });
        return;
      }
    }

    // 4. /wiki
    if (cmd === 'wiki') {
      const sub = args[0]?.toLowerCase().trim();
      const title = args[1]?.toLowerCase().trim();
      const val = args.slice(2).join(' ').trim();

      let wikiMap = groupWiki.get(ctx.chatId);
      if (!wikiMap) {
        wikiMap = new Map();
        groupWiki.set(ctx.chatId, wikiMap);
      }

      if (sub === 'add') {
        if (!title || !val) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/wiki add [judul] [deskripsi]`', { quotedMessageId: ctx.id });
          return;
        }
        wikiMap.set(title, val);
        await adapter.sendMessage(ctx.chatId, `✅ Artikel wiki *"${title.toUpperCase()}"* berhasil disimpan!`, { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'get') {
        if (!title) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan judul wiki.', { quotedMessageId: ctx.id });
          return;
        }
        const content = wikiMap.get(title);
        if (!content) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Artikel wiki "${title}" tidak ditemukan.`, { quotedMessageId: ctx.id });
          return;
        }
        await adapter.sendMessage(ctx.chatId, `📚 *WIKI GRUP: ${title.toUpperCase()}* 📚\n\n${content}`, { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `📚 *WIKI DATABASE GRUP* 📚\n\n1. \`/wiki add [judul] [isi]\`\n2. \`/wiki get [judul]\``, { quotedMessageId: ctx.id });
      return;
    }

    // 5. /galeri
    if (cmd === 'galeri') {
      await adapter.sendMessage(ctx.chatId, `🖼️ *GALERI MEDIA GRUP* 🖼️\n\nKetik \`/galeri foto\` atau \`/galeri link\` untuk menyaring media terbaru.`, { quotedMessageId: ctx.id });
      return;
    }

    // 6. /hitungmundur
    if (cmd === 'hitungmundur') {
      const title = args[0];
      const days = parseInt(args[1]);
      if (!title || isNaN(days)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/hitungmundur [nama_event] [jumlah_hari]`', { quotedMessageId: ctx.id });
        return;
      }

      const targetTime = Date.now() + days * 24 * 60 * 60 * 1000;
      groupCountdowns.set(`${ctx.chatId}:${title}`, { title, time: targetTime });

      await adapter.sendMessage(ctx.chatId, `⏳ *COUNTDOWN DITETAPKAN* ⏳\n\nEvent: *${title}*\nSisa waktu: *${days} hari*!`, { quotedMessageId: ctx.id });
      return;
    }
  }
}

const communityAdvancedCmd = new CommunityAdvancedCommand();
registerCommand(
  ['polling', 'vote', 'announce', 'todo', 'wiki', 'galeri', 'hitungmundur'],
  communityAdvancedCmd
);
