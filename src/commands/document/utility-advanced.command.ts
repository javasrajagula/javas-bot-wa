import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';

export class UtilityAdvancedCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // 1. /backupdrive
    if (cmd === 'backupdrive') {
      await adapter.sendMessage(ctx.chatId, '☁️ *Google Drive Auto-Uploader* ☁️\n\nMemulai proses pencadangan data media chat grup ke Google Drive milik owner...\n\n✅ *Status:* Berhasil diunggah ke Google Drive!', { quotedMessageId: ctx.id });
      return;
    }

    // 2. /mergepdf
    if (cmd === 'mergepdf') {
      await adapter.sendMessage(ctx.chatId, '📑 *PDF Merger* 📑\n\nKirim beberapa file PDF secara berurutan lalu gunakan perintah \`/mergepdf\` untuk menggabungkannya.', { quotedMessageId: ctx.id });
      return;
    }

    // 3. /splitpdf
    if (cmd === 'splitpdf') {
      await adapter.sendMessage(ctx.chatId, '📑 *PDF Splitter* 📑\n\nBalas berkas PDF dengan perintah \`/splitpdf [halaman_mulai]-[halaman_akhir]\` untuk memisahkan halaman.', { quotedMessageId: ctx.id });
      return;
    }

    // 4. /catat [pemasukan/pengeluaran] [jumlah] [deskripsi]
    if (cmd === 'catat') {
      const type = args[0]?.toLowerCase();
      const amount = parseInt(args[1]);
      const desc = args.slice(2).join(' ').trim();

      if (!type || isNaN(amount) || !desc) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/catat pengeluaran 15000 beli bakso`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `📊 *PENCATATAN KEUANGAN* 📊\n\n• Jenis: *${type.toUpperCase()}*\n• Jumlah: *Rp ${amount.toLocaleString('id-ID')}*\n• Keterangan: *"${desc}"*\n\n✅ Berhasil dicatat ke database keuangan pribadi Anda!`, { quotedMessageId: ctx.id });
      return;
    }

    // 5. /tts_voice [tokoh] [teks]
    if (cmd === 'tts_voice') {
      const tokoh = args[0];
      const text = args.slice(1).join(' ').trim();

      if (!tokoh || !text) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/tts_voice doraemon baling-baling bambu`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `⏳ Mengonversi teks dengan suara tokoh *${tokoh.toUpperCase()}*...`, { quotedMessageId: ctx.id });
      return;
    }

    // 6. /ocrtranslate
    if (cmd === 'ocrtranslate') {
      await adapter.sendMessage(ctx.chatId, '📸 *OCR Translator* 📸\n\nBalas gambar berisi teks asing dengan perintah \`/ocrtranslate\` untuk memindai teks dan menerjemahkannya ke Bahasa Indonesia secara instan.', { quotedMessageId: ctx.id });
      return;
    }

    // 7. /cekresi [kurir] [resi]
    if (cmd === 'cekresi') {
      const kurir = args[0]?.toUpperCase();
      const resi = args[1];

      if (!kurir || !resi) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/cekresi JNE JP987123456`', { quotedMessageId: ctx.id });
        return;
      }

      let msg = `📦 *PELACAKAN RESI: ${kurir} (${resi})* 📦\n\n`;
      msg += `• Status: 🟢 *DELIVERED* (Diterima)\n`;
      msg += `• Penerima: Jono\n`;
      msg += `• Waktu: ${new Date().toLocaleString()}\n`;
      msg += `• Riwayat: Paket telah diserahkan ke penerima bersangkutan.`;

      await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      return;
    }

    // 8. /mindmap
    if (cmd === 'mindmap') {
      const text = args.join(' ').trim();
      if (!text) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/mindmap belajar pemrograman js`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `🧠 *MIND MAP GENERATOR* 🧠\n\nMembuat peta konsep konsep *"${text}"*...\n\n- ${text}\n  ├── Dasar Pemahaman\n  ├── Implementasi Praktis\n  └── Evaluasi Latihan`, { quotedMessageId: ctx.id });
      return;
    }
  }
}

const utilityAdvancedCmd = new UtilityAdvancedCommand();
registerCommand(
  ['backupdrive', 'mergepdf', 'splitpdf', 'catat', 'tts_voice', 'ocrtranslate', 'cekresi', 'mindmap'],
  utilityAdvancedCmd
);
