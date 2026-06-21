import { Command, registerCommand, checkIfAdmin } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';

export class NotesCommand implements Command {
  private generateShortId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // --- 1. NOTES SYSTEM (/note, /notes) ---
    if (cmd === 'note' || cmd === 'notes') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      const action = args[0]?.toLowerCase().trim();

      // /note add <key> <value> or /note add <key> = <value>
      if (action === 'add' || action === 'set') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat membuat note grup.', { quotedMessageId: ctx.id });
          return;
        }

        const fullArgs = args.slice(1).join(' ').trim();
        let key = '';
        let value = '';

        if (fullArgs.includes('=')) {
          const parts = fullArgs.split('=').map(p => p.trim());
          key = parts[0];
          value = parts.slice(1).join('=');
        } else {
          const parts = fullArgs.split(/\s+/);
          key = parts[0];
          value = parts.slice(1).join(' ');
        }

        if (!key || !value) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/note add <nama> <isi>` atau `/note add <nama> = <isi>`', { quotedMessageId: ctx.id });
          return;
        }

        const noteKey = `note:${key.toLowerCase()}`;
        const noteData = {
          content: value,
          createdBy: ctx.senderId,
          createdAt: Date.now()
        };

        await prisma.customVariable.upsert({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId,
              userId: 'group',
              key: noteKey
            }
          },
          create: {
            groupId: ctx.chatId,
            userId: 'group',
            key: noteKey,
            value: JSON.stringify(noteData)
          },
          update: {
            value: JSON.stringify(noteData)
          }
        });

        await adapter.sendMessage(ctx.chatId, `✅ Catatan *"${key}"* berhasil disimpan.`, { quotedMessageId: ctx.id });
        return;
      }

      // /note delete <key> or /note del <key>
      if (action === 'delete' || action === 'del') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat menghapus note grup.', { quotedMessageId: ctx.id });
          return;
        }

        const key = args.slice(1).join(' ').trim();
        if (!key) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan nama catatan yang ingin dihapus.', { quotedMessageId: ctx.id });
          return;
        }

        const noteKey = `note:${key.toLowerCase()}`;
        const existing = await prisma.customVariable.findUnique({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId,
              userId: 'group',
              key: noteKey
            }
          }
        });

        if (!existing) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Catatan *"${key}"* tidak ditemukan.`, { quotedMessageId: ctx.id });
          return;
        }

        await prisma.customVariable.delete({ where: { id: existing.id } });
        await adapter.sendMessage(ctx.chatId, `✅ Catatan *"${key}"* berhasil dihapus.`, { quotedMessageId: ctx.id });
        return;
      }

      // /note list or /notes
      if (!action || action === 'list') {
        const notes = await prisma.customVariable.findMany({
          where: {
            groupId: ctx.chatId,
            userId: 'group',
            key: { startsWith: 'note:' }
          }
        });

        if (notes.length === 0) {
          await adapter.sendMessage(ctx.chatId, '📭 Belum ada catatan grup terdaftar.', { quotedMessageId: ctx.id });
          return;
        }

        let msg = `📝 *DAFTAR CATATAN GRUP* 📝\n\n`;
        notes.forEach((n, i) => {
          const name = n.key.slice(5); // remove 'note:'
          msg += `${i + 1}. *${name}*\n`;
        });
        msg += `\nGunakan \`/note get <nama>\` untuk membaca catatan.`;

        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        return;
      }

      // /note get <key> or /note <key>
      const key = action === 'get' ? args.slice(1).join(' ').trim() : args.join(' ').trim();
      if (!key) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan nama catatan. Contoh: `/note get jadwal`', { quotedMessageId: ctx.id });
        return;
      }

      const noteKey = `note:${key.toLowerCase()}`;
      const note = await prisma.customVariable.findUnique({
        where: {
          groupId_userId_key: {
            groupId: ctx.chatId,
            userId: 'group',
            key: noteKey
          }
        }
      });

      if (!note) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Catatan *"${key}"* tidak ditemukan.`, { quotedMessageId: ctx.id });
        return;
      }

      try {
        const parsed = JSON.parse(note.value);
        await adapter.sendMessage(ctx.chatId, parsed.content, { quotedMessageId: ctx.id });
      } catch {
        await adapter.sendMessage(ctx.chatId, note.value, { quotedMessageId: ctx.id });
      }
      return;
    }

    // --- 2. FAQ SYSTEM (/faq) ---
    if (cmd === 'faq') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      const action = args[0]?.toLowerCase().trim();

      // /faq add <key> <answer>
      if (action === 'add') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat menambahkan FAQ.', { quotedMessageId: ctx.id });
          return;
        }

        const fullArgs = args.slice(1).join(' ').trim();
        let key = '';
        let answer = '';

        if (fullArgs.includes('=')) {
          const parts = fullArgs.split('=').map(p => p.trim());
          key = parts[0];
          answer = parts.slice(1).join('=');
        } else {
          const parts = fullArgs.split(/\s+/);
          key = parts[0];
          answer = parts.slice(1).join(' ');
        }

        if (!key || !answer) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/faq add <pertanyaan> <jawaban>` atau `/faq add <pertanyaan> = <jawaban>`', { quotedMessageId: ctx.id });
          return;
        }

        const faqKey = `faq:${key.toLowerCase()}`;
        const faqData = {
          answer,
          createdBy: ctx.senderId,
          createdAt: Date.now()
        };

        await prisma.customVariable.upsert({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId,
              userId: 'group',
              key: faqKey
            }
          },
          create: {
            groupId: ctx.chatId,
            userId: 'group',
            key: faqKey,
            value: JSON.stringify(faqData)
          },
          update: {
            value: JSON.stringify(faqData)
          }
        });

        await adapter.sendMessage(ctx.chatId, `✅ FAQ *"${key}"* berhasil disimpan.`, { quotedMessageId: ctx.id });
        return;
      }

      // /faq list
      if (!action || action === 'list') {
        const faqs = await prisma.customVariable.findMany({
          where: {
            groupId: ctx.chatId,
            userId: 'group',
            key: { startsWith: 'faq:' }
          }
        });

        if (faqs.length === 0) {
          await adapter.sendMessage(ctx.chatId, '📭 Belum ada FAQ terdaftar.', { quotedMessageId: ctx.id });
          return;
        }

        let msg = `❓ *DAFTAR FAQ GRUP* ❓\n\n`;
        faqs.forEach((f, i) => {
          const name = f.key.slice(4); // remove 'faq:'
          msg += `${i + 1}. *${name}*\n`;
        });
        msg += `\nGunakan \`/faq <pertanyaan>\` untuk melihat jawaban.`;

        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        return;
      }

      // /faq <key>
      const key = action === 'get' ? args.slice(1).join(' ').trim() : args.join(' ').trim();
      const faqKey = `faq:${key.toLowerCase()}`;
      const faq = await prisma.customVariable.findUnique({
        where: {
          groupId_userId_key: {
            groupId: ctx.chatId,
            userId: 'group',
            key: faqKey
          }
        }
      });

      if (!faq) {
        await adapter.sendMessage(ctx.chatId, `⚠️ FAQ *"${key}"* tidak ditemukan.`, { quotedMessageId: ctx.id });
        return;
      }

      try {
        const parsed = JSON.parse(faq.value);
        await adapter.sendMessage(ctx.chatId, `❓ *Q:* ${key}\n💡 *A:* ${parsed.answer}`, { quotedMessageId: ctx.id });
      } catch {
        await adapter.sendMessage(ctx.chatId, `❓ *Q:* ${key}\n💡 *A:* ${faq.value}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // --- 3. WIKI SYSTEM (/wiki) ---
    if (cmd === 'wiki') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      const action = args[0]?.toLowerCase().trim();

      // /wiki add <page> <content> or /wiki edit <page> <content>
      if (action === 'add' || action === 'edit') {
        const fullArgs = args.slice(1).join(' ').trim();
        let key = '';
        let content = '';

        if (fullArgs.includes('=')) {
          const parts = fullArgs.split('=').map(p => p.trim());
          key = parts[0];
          content = parts.slice(1).join('=');
        } else {
          const parts = fullArgs.split(/\s+/);
          key = parts[0];
          content = parts.slice(1).join(' ');
        }

        if (!key || !content) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/wiki add <halaman> <konten>` atau `/wiki add <halaman> = <konten>`', { quotedMessageId: ctx.id });
          return;
        }

        const wikiKey = `wiki:${key.toLowerCase()}`;
        const wikiData = {
          content,
          createdBy: ctx.senderId,
          updatedAt: Date.now()
        };

        await prisma.customVariable.upsert({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId,
              userId: 'group',
              key: wikiKey
            }
          },
          create: {
            groupId: ctx.chatId,
            userId: 'group',
            key: wikiKey,
            value: JSON.stringify(wikiData)
          },
          update: {
            value: JSON.stringify(wikiData)
          }
        });

        await adapter.sendMessage(ctx.chatId, `📖 Halaman wiki *"${key}"* berhasil diperbarui.`, { quotedMessageId: ctx.id });
        return;
      }

      // /wiki search <keyword>
      if (action === 'search' || action === 'cari') {
        const query = args.slice(1).join(' ').trim().toLowerCase();
        if (!query) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan kata kunci pencarian.', { quotedMessageId: ctx.id });
          return;
        }

        const pages = await prisma.customVariable.findMany({
          where: {
            groupId: ctx.chatId,
            userId: 'group',
            key: { startsWith: 'wiki:' }
          }
        });

        const results = pages.filter(p => {
          const pageName = p.key.slice(5).toLowerCase();
          let pageContent = '';
          try {
            pageContent = JSON.parse(p.value).content.toLowerCase();
          } catch {
            pageContent = p.value.toLowerCase();
          }
          return pageName.includes(query) || pageContent.includes(query);
        });

        if (results.length === 0) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Tidak ada halaman wiki yang cocok dengan *"${query}"*.`, { quotedMessageId: ctx.id });
          return;
        }

        let msg = `🔍 *HASIL PENCARIAN WIKI ("${query}")* 🔍\n\n`;
        results.forEach((p, i) => {
          const name = p.key.slice(5);
          msg += `${i + 1}. *${name}*\n`;
        });

        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        return;
      }

      // /wiki <page>
      const key = action === 'get' ? args.slice(1).join(' ').trim() : args.join(' ').trim();
      if (!key) {
        // Show home / list
        const pages = await prisma.customVariable.findMany({
          where: {
            groupId: ctx.chatId,
            userId: 'group',
            key: { startsWith: 'wiki:' }
          }
        });

        if (pages.length === 0) {
          await adapter.sendMessage(ctx.chatId, '📖 *WIKI GRUP KOSONG*\n\nKetik `/wiki add <halaman> <konten>` untuk membuat halaman wiki pertama!', { quotedMessageId: ctx.id });
          return;
        }

        let msg = `📖 *WIKI GRUP* 📖\n\n`;
        pages.forEach((p, i) => {
          const name = p.key.slice(5);
          msg += `- *${name}*\n`;
        });
        msg += `\nGunakan \`/wiki <halaman>\` untuk membaca halaman wiki, atau \`/wiki search <kata_kunci>\` untuk mencari.`;
        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        return;
      }

      const wikiKey = `wiki:${key.toLowerCase()}`;
      const wiki = await prisma.customVariable.findUnique({
        where: {
          groupId_userId_key: {
            groupId: ctx.chatId,
            userId: 'group',
            key: wikiKey
          }
        }
      });

      if (!wiki) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Halaman wiki *"${key}"* tidak ditemukan.\nKetik \`/wiki add ${key} <isi>\` untuk membuatnya!`, { quotedMessageId: ctx.id });
        return;
      }

      try {
        const parsed = JSON.parse(wiki.value);
        let detailMsg = `📖 *WIKI: ${key.toUpperCase()}* 📖\n\n`;
        detailMsg += parsed.content;
        await adapter.sendMessage(ctx.chatId, detailMsg, { quotedMessageId: ctx.id });
      } catch {
        await adapter.sendMessage(ctx.chatId, wiki.value, { quotedMessageId: ctx.id });
      }
      return;
    }

    // --- 4. BOOKMARKS SYSTEM (/bookmark, /bookmarks) ---
    if (cmd === 'bookmark' || cmd === 'bookmarks') {
      const action = args[0]?.toLowerCase().trim();

      // /bookmark delete <id> or /bookmark del <id>
      if (action === 'delete' || action === 'del') {
        const id = args[1]?.trim().toUpperCase();
        if (!id) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan ID bookmark yang ingin dihapus. Contoh: `/bookmark delete AB12`', { quotedMessageId: ctx.id });
          return;
        }

        const bKey = `bookmark:${id}`;
        const existing = await prisma.customVariable.findUnique({
          where: {
            groupId_userId_key: {
              groupId: ctx.isGroup ? ctx.chatId : 'private',
              userId: ctx.senderId,
              key: bKey
            }
          }
        });

        if (!existing) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Bookmark dengan ID *"${id}"* tidak ditemukan.`, { quotedMessageId: ctx.id });
          return;
        }

        await prisma.customVariable.delete({ where: { id: existing.id } });
        await adapter.sendMessage(ctx.chatId, `✅ Bookmark *"${id}"* berhasil dihapus.`, { quotedMessageId: ctx.id });
        return;
      }

      // /bookmarks list or /bookmarks
      if (cmd === 'bookmarks' || !action || action === 'list') {
        const bookmarks = await prisma.customVariable.findMany({
          where: {
            groupId: ctx.isGroup ? ctx.chatId : 'private',
            userId: ctx.senderId,
            key: { startsWith: 'bookmark:' }
          }
        });

        if (bookmarks.length === 0) {
          await adapter.sendMessage(ctx.chatId, '📭 Daftar bookmark Anda kosong.\nSimpan bookmark dengan mengetik: `/bookmark <url/teks>`', { quotedMessageId: ctx.id });
          return;
        }

        let msg = `🔖 *DAFTAR BOOKMARK PRIBADI* 🔖\n\n`;
        bookmarks.forEach((b) => {
          const id = b.key.slice(9);
          try {
            const parsed = JSON.parse(b.value);
            msg += `• *[ID: ${id}]* ${parsed.content}\n`;
          } catch {
            msg += `• *[ID: ${id}]* ${b.value}\n`;
          }
        });
        msg += `\nHapus bookmark dengan: \`/bookmark delete <ID>\``;

        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        return;
      }

      // /bookmark <urlOrText>
      const content = args.join(' ').trim();
      if (!content) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan URL atau teks yang ingin disimpan. Contoh: `/bookmark https://google.com`', { quotedMessageId: ctx.id });
        return;
      }

      const id = this.generateShortId().slice(0, 4);
      const bKey = `bookmark:${id}`;
      const bData = {
        content,
        createdAt: Date.now()
      };

      await prisma.customVariable.create({
        data: {
          groupId: ctx.isGroup ? ctx.chatId : 'private',
          userId: ctx.senderId,
          key: bKey,
          value: JSON.stringify(bData)
        }
      });

      await adapter.sendMessage(ctx.chatId, `✅ Berhasil menyimpan bookmark!\n🔖 ID Bookmark: *${id}*\n📌 Konten: ${content}`, { quotedMessageId: ctx.id });
      return;
    }

    // --- 5. PINBOT / VIRTUAL PINS SYSTEM (/pinbot, /pinlist, /unpinbot) ---
    if (cmd === 'pinbot' || cmd === 'pinlist' || cmd === 'unpinbot') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      // /pinbot
      if (cmd === 'pinbot') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat menggunakan pinbot.', { quotedMessageId: ctx.id });
          return;
        }

        let content = args.join(' ').trim();
        
        // Check if quoting a message
        if (ctx.quotedMessage && !content) {
          content = ctx.quotedMessage.body || '';
        }

        if (!content) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan pesan yang ingin dipin, atau quote sebuah pesan dan ketik `/pinbot`.', { quotedMessageId: ctx.id });
          return;
        }

        const pinId = this.generateShortId().slice(0, 4);
        const pinKey = `pin:${pinId}`;
        const pinData = {
          content,
          pinnedBy: ctx.senderId,
          createdAt: Date.now()
        };

        await prisma.customVariable.create({
          data: {
            groupId: ctx.chatId,
            userId: 'group',
            key: pinKey,
            value: JSON.stringify(pinData)
          }
        });

        await adapter.sendMessage(ctx.chatId, `📌 *PESAN BERHASIL DIPIN VIRTUAL*\n\nID Pin: *${pinId}*\nKetik \`/pinlist\` untuk melihat semua pin.`, { quotedMessageId: ctx.id });
        return;
      }

      // /pinlist
      if (cmd === 'pinlist') {
        const pins = await prisma.customVariable.findMany({
          where: {
            groupId: ctx.chatId,
            userId: 'group',
            key: { startsWith: 'pin:' }
          }
        });

        if (pins.length === 0) {
          await adapter.sendMessage(ctx.chatId, '📌 Belum ada pesan terpin secara virtual di grup ini.', { quotedMessageId: ctx.id });
          return;
        }

        let msg = `📌 *PESAN TERPIN VIRTUAL GRUP* 📌\n\n`;
        pins.forEach((p) => {
          const id = p.key.slice(4);
          try {
            const parsed = JSON.parse(p.value);
            msg += `• *[ID: ${id}]*\n   "${parsed.content}"\n\n`;
          } catch {
            msg += `• *[ID: ${id}]*\n   "${p.value}"\n\n`;
          }
        });
        msg += `💡 Gunakan \`/unpinbot <ID>\` untuk melepas pin (Admin).`;

        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        return;
      }

      // /unpinbot <id>
      if (cmd === 'unpinbot') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat melepas pin.', { quotedMessageId: ctx.id });
          return;
        }

        const id = args[0]?.toUpperCase().trim();
        if (!id) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan ID Pin yang ingin dilepas. Contoh: `/unpinbot A5B1`', { quotedMessageId: ctx.id });
          return;
        }

        const pinKey = `pin:${id}`;
        const existing = await prisma.customVariable.findUnique({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId,
              userId: 'group',
              key: pinKey
            }
          }
        });

        if (!existing) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Pin dengan ID *"${id}"* tidak ditemukan.`, { quotedMessageId: ctx.id });
          return;
        }

        await prisma.customVariable.delete({ where: { id: existing.id } });
        await adapter.sendMessage(ctx.chatId, `✅ Pin virtual *"${id}"* berhasil dilepas.`, { quotedMessageId: ctx.id });
        return;
      }
    }
  }
}

const notesCmd = new NotesCommand();
registerCommand(['note', 'notes', 'faq', 'wiki', 'bookmark', 'bookmarks', 'pinbot', 'pinlist', 'unpinbot'], notesCmd);
