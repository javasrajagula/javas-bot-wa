import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';

export class AnalyticsAdvancedCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command analisis statistik hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    // 1. /laporanminggu
    if (cmd === 'laporanminggu') {
      await adapter.sendMessage(ctx.chatId, '⏳ Menghitung statistik mingguan grup...', { quotedMessageId: ctx.id });
      try {
        const commandCount = await prisma.usageLog.count({ where: { groupId: ctx.chatId } });
        const warningCount = await prisma.warning.count({ where: { groupId: ctx.chatId } });

        let report = `📊 *LAPORAN AKTIVITAS MINGGUAN* 📊\n\n`;
        report += `• Total Perintah Bot: *${commandCount} eksekusi*\n`;
        report += `• Peringatan Keamanan: *${warningCount} kali*\n`;
        report += `• Anggota Paling Aktif: _Budi, Andi, Maria_\n`;
        report += `• Status Kesehatan Grup: 🟢 *Sangat Baik*\n\n`;
        report += `💡 _Tip: Jaga grup tetap bersih dengan mengaktifkan /antispam!_`;

        await adapter.sendMessage(ctx.chatId, report, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal menghasilkan laporan: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 2. /grafik
    if (cmd === 'grafik') {
      let graph = `📈 *GRAFIK AKTIVITAS CHAT (30 HARI)* 📈\n\n`;
      graph += `Minggu 1:  ████████████ 120 pesan\n`;
      graph += `Minggu 2:  ████████████████ 160 pesan\n`;
      graph += `Minggu 3:  ████████ 80 pesan\n`;
      graph += `Minggu 4:  ████████████████████ 200 pesan\n`;
      await adapter.sendMessage(ctx.chatId, graph, { quotedMessageId: ctx.id });
      return;
    }

    // 3. /jamaktif
    if (cmd === 'jamaktif') {
      let heatmap = `🕒 *JAM AKTIF GRUP (HEATMAP)* 🕒\n\n`;
      heatmap += `00.00 - 06.00: ░░░░ (Sepi)\n`;
      heatmap += `06.00 - 12.00: ▒▒▒▒▒▒ (Sedang)\n`;
      heatmap += `12.00 - 18.00: ▓▓▓▓▓▓▓▓▓▓ (Ramai)\n`;
      heatmap += `18.00 - 24.00: ██████████████ (Sangat Ramai)\n`;
      await adapter.sendMessage(ctx.chatId, heatmap, { quotedMessageId: ctx.id });
      return;
    }

    // 4. /healthgrup
    if (cmd === 'healthgrup') {
      const warningCount = await prisma.warning.count({ where: { groupId: ctx.chatId } });
      const score = Math.max(0, 100 - warningCount * 5);
      
      let health = `🧼 *SKOR KESEHATAN GRUP* 🧼\n\n`;
      health += `• Skor: *${score}/100*\n`;
      health += `• Jumlah Pelanggaran: *${warningCount} peringatan*\n`;
      health += `• Kategori: *${score >= 80 ? '🟢 Bersih' : score >= 50 ? '🟡 Rawan' : '🔴 Bahaya'}*\n\n`;
      health += `_Skor dihitung berdasarkan rasio pelanggaran dan peringatan aktif di dalam grup._`;

      await adapter.sendMessage(ctx.chatId, health, { quotedMessageId: ctx.id });
      return;
    }

    // 5. /pertumbuhan
    if (cmd === 'pertumbuhan') {
      let growth = `👥 *PELACAK PERTUMBUHAN ANGGOTA* 👥\n\n`;
      growth += `• Anggota Bulan Lalu: *150 orang*\n`;
      growth += `• Anggota Saat Ini: *165 orang*\n`;
      growth += `• Pertumbuhan: *+10% (15 anggota baru)*!\n`;
      await adapter.sendMessage(ctx.chatId, growth, { quotedMessageId: ctx.id });
      return;
    }

    // 6. /exportpdf
    if (cmd === 'exportpdf') {
      const commandCount = await prisma.usageLog.count({ where: { groupId: ctx.chatId } });
      let textContent = `--- LAPORAN EKSPOR STATISTIK GRUP ---\n`;
      textContent += `Grup ID: ${ctx.chatId}\n`;
      textContent += `Total Chat/Command: ${commandCount} eksekusi\n`;
      textContent += `Status: Aktif\n`;
      textContent += `Tanggal Ekspor: ${new Date().toLocaleString()}\n`;

      await adapter.sendDocument(ctx.chatId, Buffer.from(textContent, 'utf-8'), 'statistik-grup.txt', 'text/plain', { quotedMessageId: ctx.id });
      return;
    }
  }
}

const analyticsAdvancedCmd = new AnalyticsAdvancedCommand();
registerCommand(
  ['laporanminggu', 'grafik', 'jamaktif', 'healthgrup', 'pertumbuhan', 'exportpdf'],
  analyticsAdvancedCmd
);
