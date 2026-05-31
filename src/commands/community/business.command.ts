import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import { checkIfAdmin } from '../index.js';
import prisma from '../../db/client.js';
import crypto from 'crypto';

export class BusinessCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    // Helper untuk mengecek blacklist
    const isUserBlacklisted = async (userId: string): Promise<boolean> => {
      const b = await prisma.blacklist.findFirst({
        where: { userId }
      });
      return !!b;
    };

    // Helper anti-scam keywords
    const isScamContent = (text: string): boolean => {
      const keywords = ['pinjol', 'slot', 'judi', 'casino', 'depo judi', 'cheat', 'scam', 'cepat kaya', 'investasi bodong', 'no rate', 'dana gaib'];
      const lowercaseText = text.toLowerCase();
      return keywords.some(kw => lowercaseText.includes(kw));
    };

    // --- 1. /jual atau /produk add ---
    if (cmd === 'jual' || (cmd === 'produk' && args[0]?.toLowerCase().trim() === 'add')) {
      // Check blacklist
      if (await isUserBlacklisted(ctx.senderId)) {
        await adapter.sendMessage(ctx.chatId, '❌ Anda terdaftar di dalam blacklist database dan tidak diperbolehkan menjual barang.', { quotedMessageId: ctx.id });
        return;
      }

      // Ambil teks setelah command atau args jika /produk add
      let content = '';
      if (cmd === 'produk') {
        content = args.slice(1).join(' ');
      } else {
        content = args.join(' ');
      }

      if (!content) {
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Format salah.\nGunakan: `/jual [nama_barang] | [harga] | [deskripsi]`\nContoh: `/jual HP Samsung S22 | 8000000 | Bekas mulus, garansi resmi.`',
          { quotedMessageId: ctx.id }
        );
        return;
      }

      const parts = content.split('|');
      if (parts.length < 2) {
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Format salah. Gunakan pembatas pipa `|` untuk memisahkan nama barang dan harga.\nContoh: `/jual Nama | Harga | Deskripsi`',
          { quotedMessageId: ctx.id }
        );
        return;
      }

      const nameStr = parts[0].trim();
      const priceStr = parts[1].trim().replace(/[^0-9]/g, '');
      const priceNum = parseInt(priceStr, 10);
      const descStr = parts[2]?.trim() || 'Tidak ada deskripsi.';

      if (!nameStr || Number.isNaN(priceNum) || priceNum <= 0) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Nama barang atau harga tidak valid. Pastikan harga berupa angka positif.', { quotedMessageId: ctx.id });
        return;
      }

      // Anti-scam check
      if (isScamContent(nameStr) || isScamContent(descStr)) {
        await adapter.sendMessage(ctx.chatId, '❌ Penjualan ditolak. Deskripsi mengandung kata-kata mencurigakan atau dilarang (Anti-Scam).', { quotedMessageId: ctx.id });
        return;
      }

      const itemId = crypto.randomBytes(3).toString('hex').toUpperCase();
      const itemData = {
        id: itemId,
        name: nameStr,
        price: priceNum,
        description: descStr,
        sellerId: ctx.senderId,
        status: 'active',
        createdAt: Date.now()
      };

      try {
        await prisma.customVariable.create({
          data: {
            groupId: ctx.isGroup ? ctx.chatId : 'private',
            userId: ctx.senderId,
            key: `jual:${itemId}`,
            value: JSON.stringify(itemData)
          }
        });

        const response = `✅ *PRODUK BERHASIL DIDAFTARKAN!* 🛍️\n\n• *ID Produk:* \`${itemId}\`\n• *Nama:* ${nameStr}\n• *Harga:* Rp ${priceNum.toLocaleString('id-ID')}\n• *Deskripsi:* ${descStr}\n• *Penjual:* @${ctx.senderId.split('@')[0]}\n\nKetik \`/sold ${itemId}\` jika sudah terjual, atau \`/hapusjual ${itemId}\` untuk membatalkan.`;
        await adapter.sendMessage(ctx.chatId, response, { mentions: [ctx.senderId], quotedMessageId: ctx.id });
      } catch (err: any) {
        console.error('[Business] Failed to register product:', err);
        await adapter.sendMessage(ctx.chatId, `❌ Gagal mendaftarkan produk: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // --- 2. /listjual atau /produk list ---
    if (cmd === 'listjual' || (cmd === 'produk' && args[0]?.toLowerCase().trim() === 'list')) {
      try {
        const dbItems = await prisma.customVariable.findMany({
          where: {
            groupId: ctx.isGroup ? ctx.chatId : 'private',
            key: { startsWith: 'jual:' }
          }
        });

        const activeItems: any[] = [];
        for (const item of dbItems) {
          try {
            const parsed = JSON.parse(item.value);
            if (parsed.status === 'active') {
              activeItems.push(parsed);
            }
          } catch {
            // Ignore corrupted json
          }
        }

        if (activeItems.length === 0) {
          await adapter.sendMessage(ctx.chatId, 'ℹ️ Tidak ada produk aktif yang sedang dijual di grup ini.', { quotedMessageId: ctx.id });
          return;
        }

        let response = `🛍️ *DAFTAR PRODUK AKTIF DI GRUP* 🛍️\n\n`;
        const mentions: string[] = [];

        activeItems.forEach((item, index) => {
          response += `${index + 1}. *[ID: ${item.id}]* *${item.name}*\n`;
          response += `   • *Harga:* Rp ${item.price.toLocaleString('id-ID')}\n`;
          response += `   • *Deskripsi:* ${item.description}\n`;
          response += `   • *Penjual:* @${item.sellerId.split('@')[0]}\n\n`;
          mentions.push(item.sellerId);
        });

        response += `💡 Hubungi penjual di atas atau ketik \`/sold [ID]\` jika Anda penjualnya dan barang sudah laku.`;
        await adapter.sendMessage(ctx.chatId, response, { mentions, quotedMessageId: ctx.id });
      } catch (err: any) {
        console.error('[Business] Failed to list products:', err);
        await adapter.sendMessage(ctx.chatId, `❌ Gagal memuat daftar produk: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // --- 3. /cariitem <keyword> atau /produk cari <keyword> ---
    if (cmd === 'cariitem' || (cmd === 'produk' && args[0]?.toLowerCase().trim() === 'cari')) {
      let keyword = '';
      if (cmd === 'produk') {
        keyword = args.slice(1).join(' ').trim();
      } else {
        keyword = args.join(' ').trim();
      }

      if (!keyword) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Silakan masukkan kata kunci pencarian. Contoh: `/cariitem samsung`', { quotedMessageId: ctx.id });
        return;
      }

      try {
        const dbItems = await prisma.customVariable.findMany({
          where: {
            groupId: ctx.isGroup ? ctx.chatId : 'private',
            key: { startsWith: 'jual:' }
          }
        });

        const matchedItems: any[] = [];
        for (const item of dbItems) {
          try {
            const parsed = JSON.parse(item.value);
            if (
              parsed.status === 'active' &&
              (parsed.name.toLowerCase().includes(keyword.toLowerCase()) ||
                parsed.description.toLowerCase().includes(keyword.toLowerCase()))
            ) {
              matchedItems.push(parsed);
            }
          } catch {
            // Ignore
          }
        }

        if (matchedItems.length === 0) {
          await adapter.sendMessage(ctx.chatId, `ℹ️ Tidak ada produk aktif yang cocok dengan kata kunci *"${keyword}"*.`, { quotedMessageId: ctx.id });
          return;
        }

        let response = `🔍 *HASIL PENCARIAN PRODUK ("${keyword}")* 🔍\n\n`;
        const mentions: string[] = [];

        matchedItems.forEach((item, index) => {
          response += `${index + 1}. *[ID: ${item.id}]* *${item.name}*\n`;
          response += `   • *Harga:* Rp ${item.price.toLocaleString('id-ID')}\n`;
          response += `   • *Deskripsi:* ${item.description}\n`;
          response += `   • *Penjual:* @${item.sellerId.split('@')[0]}\n\n`;
          mentions.push(item.sellerId);
        });

        await adapter.sendMessage(ctx.chatId, response, { mentions, quotedMessageId: ctx.id });
      } catch (err: any) {
        console.error('[Business] Failed to search products:', err);
        await adapter.sendMessage(ctx.chatId, `❌ Gagal melakukan pencarian: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // --- 4. /sold <id> ---
    if (cmd === 'sold') {
      const id = args[0]?.trim().toUpperCase();
      if (!id) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Silakan masukkan ID produk yang sudah terjual. Contoh: `/sold A3F4E2`', { quotedMessageId: ctx.id });
        return;
      }

      try {
        const itemRecord = await prisma.customVariable.findFirst({
          where: {
            groupId: ctx.isGroup ? ctx.chatId : 'private',
            key: `jual:${id}`
          }
        });

        if (!itemRecord) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Produk tidak ditemukan atau sudah dihapus.', { quotedMessageId: ctx.id });
          return;
        }

        const parsed = JSON.parse(itemRecord.value);

        if (parsed.sellerId !== ctx.senderId) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya penjual barang ini yang dapat menandainya sebagai terjual.', { quotedMessageId: ctx.id });
          return;
        }

        if (parsed.status === 'sold') {
          await adapter.sendMessage(ctx.chatId, 'ℹ️ Produk ini memang sudah berstatus terjual.', { quotedMessageId: ctx.id });
          return;
        }

        parsed.status = 'sold';
        parsed.soldAt = Date.now();

        await prisma.customVariable.upsert({
          where: { id: itemRecord.id },
          update: { value: JSON.stringify(parsed) },
          create: {
            groupId: ctx.isGroup ? ctx.chatId : 'private',
            userId: ctx.senderId,
            key: `jual:${id}`,
            value: JSON.stringify(parsed)
          }
        });

        await adapter.sendMessage(ctx.chatId, `🎉 *PRODUK TERJUAL!* 🎉\n\nProduk *${parsed.name}* [ID: \`${id}\`] telah ditandai sebagai *TERJUAL* oleh penjualnya @${ctx.senderId.split('@')[0]}. Terima kasih!`, { mentions: [ctx.senderId], quotedMessageId: ctx.id });
      } catch (err: any) {
        console.error('[Business] Failed to mark product as sold:', err);
        await adapter.sendMessage(ctx.chatId, `❌ Gagal mengupdate status terjual: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // --- 5. /hapusjual <id> atau /produk hapus <id> ---
    if (cmd === 'hapusjual' || (cmd === 'produk' && args[0]?.toLowerCase().trim() === 'hapus')) {
      let id = '';
      if (cmd === 'produk') {
        id = args[1]?.trim().toUpperCase();
      } else {
        id = args[0]?.trim().toUpperCase();
      }

      if (!id) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Silakan masukkan ID produk yang ingin dihapus. Contoh: `/hapusjual A3F4E2`', { quotedMessageId: ctx.id });
        return;
      }

      try {
        const itemRecord = await prisma.customVariable.findFirst({
          where: {
            groupId: ctx.isGroup ? ctx.chatId : 'private',
            key: `jual:${id}`
          }
        });

        if (!itemRecord) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Produk tidak ditemukan.', { quotedMessageId: ctx.id });
          return;
        }

        const parsed = JSON.parse(itemRecord.value);
        const isAdmin = ctx.isGroup ? await checkIfAdmin(ctx.chatId, ctx.senderId, adapter) : false;
        const isUserOwner = ctx.senderId === itemRecord.userId; // user pemilik record

        if (parsed.sellerId !== ctx.senderId && !isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya penjual atau Admin grup yang dapat menghapus produk ini.', { quotedMessageId: ctx.id });
          return;
        }

        // Hapus custom variable record
        await prisma.customVariable.delete({
          where: { id: itemRecord.id }
        });

        await adapter.sendMessage(ctx.chatId, `✅ Produk *${parsed.name}* [ID: \`${id}\`] berhasil dihapus dari listing jualan.`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        console.error('[Business] Failed to delete product listing:', err);
        await adapter.sendMessage(ctx.chatId, `❌ Gagal menghapus produk: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // --- 6. /formatjual <item> | <harga> | <kondisi> ---
    if (cmd === 'formatjual') {
      const content = args.join(' ');
      if (!content) {
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Format salah.\nGunakan: `/formatjual [nama_barang] | [harga] | [kondisi]`\nContoh: `/formatjual HP Xiaomi | 2000000 | Bekas mulus 90%`',
          { quotedMessageId: ctx.id }
        );
        return;
      }

      const parts = content.split('|');
      const item = parts[0]?.trim() || '[Nama Barang]';
      const harga = parts[1]?.trim() || '[Harga]';
      const kondisi = parts[2]?.trim() || '[Kondisi]';

      const phone = ctx.senderId.split('@')[0];
      const formatText = `🛍️ *PROMOSI JUALAN* 🛍️\n\n• *Barang:* ${item}\n• *Harga:* Rp ${harga}\n• *Kondisi:* ${kondisi}\n• *Hubungi Penjual:* wa.me/${phone}\n\n_Promosi dibuat via Javas Bot WA_`;
      
      await adapter.sendMessage(ctx.chatId, formatText, { quotedMessageId: ctx.id });
      return;
    }
  }
}

const businessCmd = new BusinessCommand();
registerCommand(['jual', 'listjual', 'cariitem', 'hapusjual', 'sold', 'formatjual', 'produk'], businessCmd);
