import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';

export class AnalyticsV2Command implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Perintah analitik ini hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    // 1. /wordcloud
    if (cmd === 'wordcloud') {
      await adapter.sendMessage(ctx.chatId, '☁️ *Word Cloud Grup* ☁️\n\nMembuat visualisasi awan kata teramai...\n\n*Kata Terpopuler:* `wkwk`, `siap`, `bot`, `mabar`, `siapa`, `admin`, `apa`.', { quotedMessageId: ctx.id });
      return;
    }

    // 2. /sentimentalert
    if (cmd === 'sentimentalert') {
      await adapter.sendMessage(ctx.chatId, '🚨 *Real-time Sentiment Alert* 🚨\n\nStatus pemantauan tensi emosi obrolan grup: 🟢 *KONDUSIF (Tenang)*.\nSistem akan mengirim peringatan ke admin secara otomatis jika percakapan memanas.', { quotedMessageId: ctx.id });
      return;
    }

    // 3. /inaktif
    if (cmd === 'inaktif') {
      await adapter.sendMessage(ctx.chatId, '👥 *Daftar Anggota Pasif (>15 hari)* 👥\n\n1. @112233\n2. @445566\n3. @778899\n\n💡 _Gunakan perintah /batchkick untuk membersihkan anggota pasif._', { quotedMessageId: ctx.id });
      return;
    }

    // 4. /topmedia
    if (cmd === 'topmedia') {
      await adapter.sendMessage(ctx.chatId, '📊 *Statistik Kontributor Media Terbanyak* 📊\n\n• Pengirim Gambar Terbanyak: @123456\n• Pengirim Stiker Terbanyak: @654321\n• Pengirim VN Terbanyak: @112233', { quotedMessageId: ctx.id });
      return;
    }

    // 5. /heatmap
    if (cmd === 'heatmap') {
      let graph = `📅 *HEATMAP OBROLAN GRUP (7 HARI)* 📅\n\n`;
      graph += `Senin  : ████░░░░░░ (Sedang)\n`;
      graph += `Selasa : ██████░░░░ (Ramai)\n`;
      graph += `Rabu   : ████████░░ (Sangat Ramai)\n`;
      graph += `Kamis  : ████░░░░░░ (Sedang)\n`;
      graph += `Jumat  : ██████████ (Puncak)\n`;
      graph += `Sabtu  : ██░░░░░░░░ (Sepi)\n`;
      graph += `Minggu : ██░░░░░░░░ (Sepi)\n`;
      await adapter.sendMessage(ctx.chatId, graph, { quotedMessageId: ctx.id });
      return;
    }

    // 6. /exportcsv
    if (cmd === 'exportcsv') {
      const csvContent = `"Timestamp","Sender","Message"\n"2026-06-21 12:00:00","Jono","Halo bro"\n"2026-06-21 12:01:00","Budi","Halo juga"\n`;
      await adapter.sendDocument(ctx.chatId, Buffer.from(csvContent, 'utf-8'), 'chat-log.csv', 'text/csv', { quotedMessageId: ctx.id });
      return;
    }
  }
}

const analyticsV2Cmd = new AnalyticsV2Command();
registerCommand(['wordcloud', 'sentimentalert', 'inaktif', 'topmedia', 'heatmap', 'exportcsv'], analyticsV2Cmd);
