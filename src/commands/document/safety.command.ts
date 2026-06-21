import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import axios from 'axios';
import { isSafePublicUrl, assertSafePublicUrl, validateUrlRedirects } from '../../validators/url.validator.js';
import { runOcr } from '../../services/ocr/ocr.service.js';

export class SafetyCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // --- 1. /readqr [safe] ---
    if (cmd === 'readqr') {
      const media = ctx.media || ctx.quotedMessage?.media;
      if (!media || media.type !== 'image') {
        await adapter.sendMessage(ctx.chatId, '⚠️ Reply gambar QR Code terlebih dahulu.', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⏳ Membaca QR Code...', { quotedMessageId: ctx.id });
      try {
        const imageBuffer = await media.getBuffer();
        const boundary = '----JavasBoundary' + Math.random().toString(36).slice(2);
        const payload = Buffer.concat([
          Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="qr.png"\r\nContent-Type: image/png\r\n\r\n`),
          imageBuffer,
          Buffer.from(`\r\n--${boundary}--\r\n`)
        ]);
        
        const response = await axios.post('https://api.qrserver.com/v1/read-qr-code/', payload, {
          headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
          timeout: 15000
        });

        const resultText = response.data?.[0]?.symbol?.[0]?.data;

        if (!resultText) {
          await adapter.sendMessage(ctx.chatId, '⚠️ QR Code tidak terdeteksi atau gagal dibaca.', { quotedMessageId: ctx.id });
          return;
        }

        const isUrl = /^https?:\/\//i.test(resultText.trim()) || /^(www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/i.test(resultText.trim());
        const forceSafeCheck = args[0]?.toLowerCase().trim() === 'safe';

        if (isUrl || forceSafeCheck) {
          await adapter.sendMessage(ctx.chatId, '🔍 Menganalisis keamanan URL dari QR Code...', { quotedMessageId: ctx.id });
          try {
            // Normalize & validate URL safety
            let targetUrl = resultText.trim();
            if (!/^https?:\/\//i.test(targetUrl)) {
              targetUrl = 'https://' + targetUrl;
            }
            
            const checkedUrl = await assertSafePublicUrl(targetUrl);
            const finalUrl = await validateUrlRedirects(checkedUrl);

            await adapter.sendMessage(
              ctx.chatId,
              `✅ *QR Code Berhasil Dibaca & Aman!*\n\n` +
              `📝 *Hasil:* ${resultText}\n` +
              `🔗 *URL Akhir:* ${finalUrl}\n` +
              `🛡️ *Status:* *AMAN* (Lulus validasi SSRF, Local IP, dan Loop Redirect).`,
              { quotedMessageId: ctx.id }
            );
          } catch (urlErr: any) {
            await adapter.sendMessage(
              ctx.chatId,
              `⚠️ *QR Code Berhasil Dibaca, TAPI BERBAHAYA!*\n\n` +
              `📝 *Hasil:* ${resultText}\n` +
              `🚫 *Status:* *BERBAHAYA / TIDAK AMAN*\n` +
              `❌ *Alasan:* ${urlErr.message}`,
              { quotedMessageId: ctx.id }
            );
          }
        } else {
          await adapter.sendMessage(
            ctx.chatId,
            `✅ *QR Code Berhasil Dibaca!*\n\n` +
            `📝 *Hasil:* ${resultText}\n` +
            `ℹ️ *Tipe:* Teks Biasa (Bukan URL).`,
            { quotedMessageId: ctx.id }
          );
        }
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal membaca QR Code: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // --- 2. /checklink <url> ---
    if (cmd === 'checklink') {
      let targetUrl = args[0]?.trim();
      if (!targetUrl) {
        // Fallback: check if quoting a message containing URL
        if (ctx.quotedMessage?.body) {
          const match = ctx.quotedMessage.body.match(/(https?:\/\/[^\s]+|www\.[^\s]+)/i);
          if (match) {
            targetUrl = match[1];
          }
        }
      }

      if (!targetUrl) {
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Harap masukkan URL yang ingin diperiksa.\nContoh: `/checklink https://google.com` atau reply pesan berisi link.',
          { quotedMessageId: ctx.id }
        );
        return;
      }

      await adapter.sendMessage(ctx.chatId, `⏳ Memeriksa keamanan link: *${targetUrl}*...`, { quotedMessageId: ctx.id });

      try {
        let cleanUrl = targetUrl;
        if (!/^https?:\/\//i.test(cleanUrl)) {
          cleanUrl = 'https://' + cleanUrl;
        }

        const checkedUrl = await assertSafePublicUrl(cleanUrl);
        const finalUrl = await validateUrlRedirects(checkedUrl);

        await adapter.sendMessage(
          ctx.chatId,
          `✅ *Hasil Pemeriksaan Link: AMAN*\n\n` +
          `🔗 *URL Input:* ${targetUrl}\n` +
          `🎯 *URL Akhir:* ${finalUrl}\n` +
          `🛡️ *Status:* Bebas dari potensi serangan SSRF, loop redirect, dan tidak menggunakan IP Lokal / Privat.`,
          { quotedMessageId: ctx.id }
        );
      } catch (err: any) {
        await adapter.sendMessage(
          ctx.chatId,
          `❌ *Hasil Pemeriksaan Link: TIDAK AMAN / DIBLOKIR*\n\n` +
          `🔗 *URL Input:* ${targetUrl}\n` +
          `⚠️ *Detail:* ${err.message}`,
          { quotedMessageId: ctx.id }
        );
      }
      return;
    }

    // --- 3. /cekpenipuan or /scamcheck ---
    if (cmd === 'cekpenipuan' || cmd === 'scamcheck') {
      let textToAnalyze = args.join(' ').trim();
      const media = ctx.media || ctx.quotedMessage?.media;

      // Jika tidak ada argumen teks, cek apakah reply teks
      if (!textToAnalyze && ctx.quotedMessage?.body) {
        textToAnalyze = ctx.quotedMessage.body.trim();
      }

      // Jika ada media gambar, coba ekstrak teks menggunakan OCR
      if (media && media.type === 'image') {
        await adapter.sendMessage(ctx.chatId, '⏳ Mengekstrak teks dari screenshot (OCR)...', { quotedMessageId: ctx.id });
        try {
          const imageBuffer = await media.getBuffer();
          const ocrText = await runOcr(imageBuffer);
          if (ocrText && ocrText.trim()) {
            textToAnalyze = (textToAnalyze ? textToAnalyze + '\n' : '') + ocrText;
          } else {
            await adapter.sendMessage(ctx.chatId, '⚠️ OCR selesai, namun tidak terdeteksi teks di dalam gambar.', { quotedMessageId: ctx.id });
          }
        } catch (ocrErr: any) {
          await adapter.sendMessage(
            ctx.chatId,
            `⚠️ Gagal melakukan OCR otomatis: ${ocrErr.message}.\nAnalisis akan dilanjutkan hanya menggunakan teks yang Anda masukkan (jika ada).`,
            { quotedMessageId: ctx.id }
          );
        }
      }

      if (!textToAnalyze || textToAnalyze.trim().length === 0) {
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Harap masukkan teks percakapan yang dicurigai atau reply screenshot bukti percakapan dengan command `/cekpenipuan`.',
          { quotedMessageId: ctx.id }
        );
        return;
      }

      await adapter.sendMessage(ctx.chatId, '🔍 Menganalisis potensi penipuan (Scam Analyzer)...', { quotedMessageId: ctx.id });

      // Run keyword analysis & scoring logic
      const analysis = analyzeScamText(textToAnalyze);

      let msg = `🕵️‍♂️ *ANALISIS ANTISCAM / PENIPUAN* 🕵️‍♂️\n\n`;
      msg += `📈 *Scam Score:* *${analysis.score}/100*\n`;
      msg += `🚨 *Tingkat Risiko:* *${analysis.riskLevel}*\n\n`;

      if (analysis.matchedKeywords.length > 0) {
        msg += `🔑 *Indikator Berbahaya yang Ditemukan:*\n`;
        analysis.matchedKeywords.forEach(kw => {
          msg += `• *${kw.category}*: "${kw.matched}" (+${kw.weight} poin)\n`;
        });
        msg += `\n`;
      } else {
        msg += `✅ Tidak ditemukan kata kunci mencurigakan yang signifikan.\n\n`;
      }

      msg += `💡 *Rekomendasi Keamanan:*\n`;
      if (analysis.score >= 60) {
        msg += `🔴 *SANGAT BERBAHAYA!* Ini memiliki karakteristik penipuan yang sangat kuat.\n`;
        msg += `• JANGAN transfer uang, jangan berikan OTP/PIN.\n`;
        msg += `• JANGAN klik link apa pun atau instal file .APK yang dikirimkan.\n`;
        msg += `• Blokir kontak pengirim segera.`;
      } else if (analysis.score >= 30) {
        msg += `🟡 *MENCURIGAKAN!* Waspadai penawaran paruh waktu, giveaway, atau pinjaman cepat.\n`;
        msg += `• Selalu verifikasi ke saluran resmi perusahaan bersangkutan.\n`;
        msg += `• Jangan terburu-buru mengambil keputusan karena tekanan/iming-iming bonus.`;
      } else if (analysis.score >= 10) {
        msg += `🔵 *WASPADA!* Ada sedikit indikator tidak wajar.\n`;
        msg += `• Berhati-hatilah saat membagikan informasi pribadi atau nomor rekening.`;
      } else {
        msg += `🟢 *AMAN.* Teks tidak menunjukkan pola penipuan yang terdeteksi. Namun tetaplah bijak dan berhati-hati.`;
      }

      await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      return;
    }
  }
}

interface ScamIndicator {
  category: string;
  matched: string;
  weight: number;
}

function analyzeScamText(text: string): { score: number; riskLevel: string; matchedKeywords: ScamIndicator[] } {
  const textLower = text.toLowerCase();
  const matchedKeywords: ScamIndicator[] = [];
  let score = 0;

  // 1. Deteksi file APK palsu (Critical)
  const apkRegex = /\b[\w-]+\.apk\b/i;
  const apkKeywords = ['undangan pernikahan', 'resi paket', 'foto paket', 'surat tilang', 'tagihan pln', 'update aplikasi', 'unduh aplikasi'];
  if (apkRegex.test(text)) {
    const matchedApk = text.match(apkRegex)?.[0] || '.apk';
    matchedKeywords.push({ category: 'File APK Palsu (Backdoor/RAT)', matched: matchedApk, weight: 40 });
    score += 40;
  } else {
    for (const kw of apkKeywords) {
      if (textLower.includes(kw) && textLower.includes('install')) {
        matchedKeywords.push({ category: 'Modus Instalasi Aplikasi Ilegal', matched: kw, weight: 30 });
        score += 30;
        break;
      }
    }
  }

  // 2. Deteksi Judi Online / Slot (High)
  const slotKeywords = ['slot gacor', 'scatter', 'maxwin', 'depo wd', 'pola slot', 'jp paus', 'zeus olympus', 'bocoran admin slot'];
  for (const kw of slotKeywords) {
    if (textLower.includes(kw)) {
      matchedKeywords.push({ category: 'Judi Online / Judi Slot', matched: kw, weight: 35 });
      score += 35;
      break; // Avoid double counting within the same category
    }
  }

  // 3. Deteksi Like & Subscribe / Tugas Komisi (High)
  const taskKeywords = ['like dan subscribe', 'tugas screenshot', 'komisi harian', 'kerja paruh waktu', 'gaji harian', 'like tiktok', 'tonton video youtube'];
  for (const kw of taskKeywords) {
    if (textLower.includes(kw)) {
      matchedKeywords.push({ category: 'Penipuan Kerja Paruh Waktu / Task Scam', matched: kw, weight: 30 });
      score += 30;
      break;
    }
  }

  // 4. Deteksi Pinjol / Investasi Bodong / Titip Dana (Medium-High)
  const pinjolKeywords = ['pinjol', 'cair cepat', 'tanpa jaminan', 'titip dana', 'investasi modal', 'lunas kilat', 'profit harian', 'investasi aman 100%'];
  for (const kw of pinjolKeywords) {
    if (textLower.includes(kw)) {
      matchedKeywords.push({ category: 'Pinjaman Online Ilegal / Investasi Bodong', matched: kw, weight: 25 });
      score += 25;
      break;
    }
  }

  // 5. Deteksi Tekanan / Phishing / OTP (Medium)
  const urgentKeywords = ['segera', 'cepat sebelum hangus', 'limit waktu', 'kode otp', 'jangan bagikan', 'm-banking', 'blokir rekening', 'share screen', 'ambil alih'];
  for (const kw of urgentKeywords) {
    if (textLower.includes(kw)) {
      matchedKeywords.push({ category: 'Modus Phishing / Desakan Urgensi', matched: kw, weight: 15 });
      score += 15;
      break;
    }
  }

  // 6. Deteksi Klaim Hadiah / Giveaway Palsu (Medium)
  const prizeKeywords = ['pemenang giveaway', 'hadiah shopee', 'undian kupon', 'selamat anda terpilih', 'klaim bonus', 'hadiah resmi whatsapp'];
  for (const kw of prizeKeywords) {
    if (textLower.includes(kw)) {
      matchedKeywords.push({ category: 'Modus Menang Undian / Hadiah Palsu', matched: kw, weight: 20 });
      score += 20;
      break;
    }
  }

  // Cap score at 100
  if (score > 100) score = 100;

  // Determine Risk Level
  let riskLevel = 'RENDAH';
  if (score >= 60) {
    riskLevel = '🔴 SANGAT TINGGI (CRITICAL)';
  } else if (score >= 30) {
    riskLevel = '🟡 SEDANG-TINGGI (MODERATE-HIGH)';
  } else if (score >= 10) {
    riskLevel = '🔵 RENDAH-SEDANG (LOW-MODERATE)';
  } else {
    riskLevel = '🟢 AMAN (LOW)';
  }

  return {
    score,
    riskLevel,
    matchedKeywords
  };
}

const safetyCmd = new SafetyCommand();
registerCommand(['readqr', 'checklink', 'cekpenipuan', 'scamcheck'], safetyCmd);
