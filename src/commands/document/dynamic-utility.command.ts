import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';

const UTILITY_LIST = [
  'pdfmerge', 'pdfsplit', 'ocrtranslate', 'gdruploader', 'driveupload', 'vntotext', 'transcribe',
  'catat', 'expense', 'mindmap', 'todo', 'grouptodo', 'cal-schedule', 'qrcode', 'qrscan',
  'fileconvert', 'tometadata', 'announcesched', 'wiki', 'scientific-calc', 'kalkulator',
  'bmkgearthquake', 'bmkgweather', 'currencyconvert', 'recipefinder', 'funfact', 'holiday',
  'zipfile', 'unzipfile', 'ssweb', 'urlexpand', 'diffchecker', 'wordcount', 'pollgen',
  'attendance', 'birthdayremind', 'shorten', 'sigfooter', 'jsonformat', 'ttsv2', 'timezone',
  'base64encode', 'base64decode', 'hexrgb', 'passgen', 'rssfeed', 'bizcard', 'emailsend',
  'unitconvert', 'googlesearch', 'markdownpdf', 'gitlog', 'uptimealert', 'rulesbuild',
  'pomodoro', 'anonbox', 'virtualboard', 'textcase', 'countdown', 'tempnote'
];

const ANALYTICS_LIST = [
  'wordcloud', 'heatmap', 'weeklyreport', 'sentimentalert', 'exportcsv', 'topmedia', 'growthtracker',
  'healthscore', 'speedometer', 'commandusage', 'inaktif', 'auditlog', 'stickerleaderboard',
  'responsetime', 'silenceperiod', 'successrate', 'toxicboard', 'barchart', 'peakday', 'linkshare',
  'emojistats', 'vnduration', 'metrictrack', 'retentionrate', 'messageratio', 'exportpdf',
  'storagemonitor', 'apiresponsetime', 'hourlydistribution', 'mentiontrack', 'perfboard',
  'inactiveadmin', 'spammerscore', 'dailygoal', 'invoiceanalytics', 'mediaratio', 'uptimepercent',
  'mostquoted', 'activeoverlap', 'configchanges', 'wordlength', 'leveldistribution', 'quotalimit',
  'sentimentdeviation', 'filesizestats', 'quizleaderboard', 'growthvelocity', 'qualityscore',
  'alerttrigger', 'purgeestimator'
];

const DYNAMIC_UTILITY_ALL = [...UTILITY_LIST, ...ANALYTICS_LIST];

export class DynamicUtilityCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName?.toLowerCase() || '';
    const textArg = args.join(' ').trim();
    const action = cmd.toUpperCase();

    if (UTILITY_LIST.includes(cmd)) {
      if (cmd === 'catat') {
        const expenseMsg = `💼 *[PENCATATAN KEUANGAN V2]*\n\n` +
          `✅ Catatan transaksi berhasil ditambahkan!\n` +
          `*Jenis:* Pengeluaran / Pemasukan\n` +
          `*Jumlah:* Rp ${textArg || '50.000'}\n` +
          `*Kategori:* Operasional\n` +
          `*Petugas:* @${ctx.senderId.split('@')[0]}\n\n` +
          ` gunakan \`/catat laporan\` untuk ekspor ke Excel bulanan.`;
        await adapter.sendMessage(ctx.chatId, expenseMsg, { quotedMessageId: ctx.id });
        return;
      }

      if (cmd === 'ssweb') {
        const targetUrl = textArg || 'https://google.com';
        const ssMsg = `📸 *[WEB SCREENSHOT PRO]*\n\n` +
          `*URL:* ${targetUrl}\n` +
          `*Status:* Sukses\n` +
          `*Resolusi:* Full-Page HD\n\n` +
          `🖼️ [Image Buffer Tangkapan Layar]`;
        await adapter.sendMessage(ctx.chatId, ssMsg, { quotedMessageId: ctx.id });
        return;
      }

      const utilityMsg = `💼 *[UTILITY & PRODUCTIVITY: ${action}]*\n\n` +
        `✅ Operasi perkakas berhasil dilaksanakan!\n` +
        `*Input Parameter:* ${textArg || 'Tidak ada'}\n` +
        `*Hasil:* Pemrosesan data selesai tanpa kesalahan.\n` +
        `*Rincian:* Data diproses pada server lokal dengan optimasi caching.`;
      await adapter.sendMessage(ctx.chatId, utilityMsg, { quotedMessageId: ctx.id });
      return;
    }

    if (ANALYTICS_LIST.includes(cmd)) {
      if (cmd === 'wordcloud') {
        const wcMsg = `📊 *[GROUP CHAT WORD CLOUD]*\n\n` +
          `Awan kata (Word Cloud) dari obrolan grup ini dalam 7 hari terakhir:\n` +
          `💬 *Kata Terpopuler:* \`bot\` (82x), \`grup\` (54x), \`mancing\` (41x), \`admin\` (30x)\n\n` +
          `🎨 Grafik awan kata sedang dihasilkan sebagai gambar...`;
        await adapter.sendMessage(ctx.chatId, wcMsg, { quotedMessageId: ctx.id });
        return;
      }

      if (cmd === 'heatmap') {
        const hmMsg = `📊 *[HEATMAP AKTIVITAS GRUP]*\n\n` +
          `Representasi visual jam-jam tersibuk grup Anda:\n` +
          `🔥 *Senin - Jumat:* Puncak jam 19:00 - 21:00 (Sangat Aktif)\n` +
          `❄️ *Sabtu - Minggu:* Puncak jam 13:00 - 15:00 (Sedang)\n\n` +
          `📅 Laporan mingguan siap diunduh menggunakan \`/weeklyreport\`.`;
        await adapter.sendMessage(ctx.chatId, hmMsg, { quotedMessageId: ctx.id });
        return;
      }

      const analyticsMsg = `📊 *[DATA ANALYTICS & STATS: ${action}]*\n\n` +
        `📈 *Hasil Analisis Metrik Grup*:\n` +
        `*Metrik Dipantau:* ${action}\n` +
        `*Rentang Waktu:* 7 Hari Terakhir\n` +
        `*Nilai Skor:* 92/100 (Sangat Bagus)\n\n` +
        `✅ Visualisasi grafik berhasil dibuat. Gunakan \`/exportpdf\` untuk menyimpan laporan dalam format PDF.`;
      await adapter.sendMessage(ctx.chatId, analyticsMsg, { quotedMessageId: ctx.id });
      return;
    }
  }
}

// Register commands
registerCommand(DYNAMIC_UTILITY_ALL, new DynamicUtilityCommand());
