import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';
import { isPremium } from '../../bot/permission.js';
import { runOcr } from '../../services/ocr/ocr.service.js';
import {
  correctTypos,
  rewriteText,
  summarizeText,
  translateText
} from '../../services/text/text.service.js';

const activeQuizzes = new Map<string, {
  question: string;
  answer: string;
  explanation: string;
  points: number;
  timer: NodeJS.Timeout;
}>();

export class TextSuiteCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    if (cmd === 'ocr') {
      let media = ctx.media || ctx.quotedMessage?.media;
      if (!media || media.type !== 'image') {
        await adapter.sendMessage(ctx.chatId, '⚠️ Reply gambar terlebih dahulu untuk mengekstrak teks.', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⏳ Memindai gambar (OCR lokal)...', { quotedMessageId: ctx.id });
      try {
        const imageBuffer = await media.getBuffer();
        const limit = (await isPremium(ctx.senderId)) ? 12 * 1024 * 1024 : 4 * 1024 * 1024;
        if (imageBuffer.length > limit) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Ukuran gambar OCR melebihi batas ${Math.round(limit / 1024 / 1024)} MB.`, { quotedMessageId: ctx.id });
          return;
        }

        const text = await runOcr(imageBuffer);
        if (!text) {
          await adapter.sendMessage(ctx.chatId, '⚠️ OCR selesai, tetapi tidak ada teks yang terdeteksi.', { quotedMessageId: ctx.id });
          return;
        }

        if (text.length > 500) {
          await adapter.sendDocument(ctx.chatId, Buffer.from(text, 'utf-8'), 'ocr.txt', 'text/plain', { quotedMessageId: ctx.id });
        } else {
          await adapter.sendMessage(ctx.chatId, `📝 *OCR RESULT*\n\n${text}`, { quotedMessageId: ctx.id });
        }
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal melakukan OCR: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    if (cmd === 'translate' || cmd === 'tr') {
      const targetLang = args[0]?.toLowerCase() || 'en';
      let textToTranslate = args.slice(1).join(' ').trim() || ctx.quotedMessage?.body || '';

      if (!textToTranslate) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/tr <lang> <teks>` atau reply teks dengan `/tr <lang>`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `⏳ Menerjemahkan ke bahasa *${targetLang}*...`, { quotedMessageId: ctx.id });
      try {
        const translated = await translateText(textToTranslate, targetLang);
        await adapter.sendMessage(ctx.chatId, `🌐 *Hasil Terjemahan (${translated.provider}):*\n\n${translated.text}`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal menerjemahkan: ${err.message || err}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    if (cmd === 'ringkas' || cmd === 'summarize') {
      let text = args.join(' ').trim() || ctx.quotedMessage?.body || '';
      if (!text) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Reply teks panjang dengan `/ringkas` atau kirim `/ringkas <teks>`.', { quotedMessageId: ctx.id });
        return;
      }

      const isPrem = await isPremium(ctx.senderId);
      const limit = isPrem ? 20000 : 3000;
      if (text.length > limit) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Teks melebihi batas ringkas (${limit} karakter).`, { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⏳ Merangkum teks...', { quotedMessageId: ctx.id });
      try {
        const result = await summarizeText(text);
        await adapter.sendMessage(ctx.chatId, `${result.summary}\n\n_(Diringkas via: ${result.provider})_`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal merangkum teks: ${err.message || err}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    if (cmd === 'ubah') {
      const style = args[0]?.toLowerCase();
      const text = args.slice(1).join(' ').trim() || ctx.quotedMessage?.body || '';
      const validStyles = ['formal', 'santai', 'sopan', 'singkat'];

      if (!style || !validStyles.includes(style) || !text) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/ubah <formal|santai|sopan|singkat> <teks>`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `✍️ *Gaya Bahasa [${style.toUpperCase()}]:*\n\n${rewriteText(style, text)}`, { quotedMessageId: ctx.id });
      return;
    }

    if (cmd === 'typo' || cmd === 'koreksi') {
      const text = args.join(' ').trim() || ctx.quotedMessage?.body || '';
      if (!text) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Reply teks dengan `/typo` untuk koreksi.', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `✅ *Koreksi Typo:*\n\n${correctTypos(text)}`, { quotedMessageId: ctx.id });
      return;
    }

    if (cmd === 'balas') {
      const style = args[0]?.toLowerCase() || 'santai';
      if (!ctx.quotedMessage) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Reply pesan yang ingin dibalas.', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `💡 *Draf Balasan [${style.toUpperCase()}]:*\n\n${rewriteText(style, ctx.quotedMessage.body)}`, { quotedMessageId: ctx.id });
      return;
    }

    // --- 13.3 LEARNING AI COMMANDS ---

    // /jelaskan <topik>
    if (cmd === 'jelaskan') {
      const topic = args.join(' ').trim();
      if (!topic) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan topik yang ingin dijelaskan. Contoh: `/jelaskan fotosintesis`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `⏳ Sedang mengumpulkan informasi tentang *${topic}*...`, { quotedMessageId: ctx.id });
      try {
        const { aiProviderService } = await import('../../services/ai/ai-provider.service.js');
        const prompt = `Jelaskan topik berikut secara lengkap, mendalam, terstruktur, mudah dipahami, dan sertakan contoh konkret:\n\nTopik: ${topic}`;
        const explanation = await aiProviderService.generateText(prompt, "Anda adalah asisten guru sekolah pintar yang ramah dan menggunakan Bahasa Indonesia.");
        await adapter.sendMessage(ctx.chatId, `📘 *PENJELASAN TOPIK: ${topic.toUpperCase()}* 📘\n\n${explanation}`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal menjelaskan topik: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // /rangkum <teks/topik>
    if (cmd === 'rangkum') {
      let text = args.join(' ').trim() || ctx.quotedMessage?.body || '';
      if (!text) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Reply teks panjang dengan `/rangkum` atau kirim `/rangkum <teks>`.', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⏳ Merangkum teks menggunakan AI...', { quotedMessageId: ctx.id });
      try {
        const { aiProviderService } = await import('../../services/ai/ai-provider.service.js');
        const prompt = `Rangkum teks berikut secara padat, jelas, terstruktur (poin-per-poin) tanpa menghilangkan esensi pentingnya:\n\nTeks:\n${text}`;
        const summary = await aiProviderService.generateText(prompt, "Anda adalah asisten pintar yang ahli dalam merangkum artikel panjang.");
        await adapter.sendMessage(ctx.chatId, `📌 *RANGKUMAN AI:*\n\n${summary}`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal merangkum: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // /belajar <topik>
    if (cmd === 'belajar') {
      const topic = args.join(' ').trim();
      if (!topic) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan topik yang ingin dipelajari. Contoh: `/belajar fisika kuantum`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `⏳ Menyiapkan materi belajar untuk *${topic}*...`, { quotedMessageId: ctx.id });
      try {
        const { aiProviderService } = await import('../../services/ai/ai-provider.service.js');
        const prompt = `Buatlah silabus/rancangan materi belajar singkat untuk pemula tentang topik: ${topic}.
Tuliskan 3 konsep kunci dasar dan berikan 1 analogi dunia nyata untuk mempermudah pemahaman.`;
        const lesson = await aiProviderService.generateText(prompt, "Anda adalah asisten tutor yang ahli menyederhanakan konsep rumit.");
        await adapter.sendMessage(ctx.chatId, `📚 *MATERI BELAJAR: ${topic.toUpperCase()}* 📚\n\n${lesson}`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal memuat materi: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // /buatsoal <mapel> [level]
    // /latihan <mapel> [level]
    if (cmd === 'buatsoal' || cmd === 'latihan' || cmd === 'quiz') {
      const mapel = args[0] || 'umum';
      const level = args[1] || 'sedang';

      await adapter.sendMessage(ctx.chatId, `⏳ Membuat soal *${mapel}* (Level: *${level}*)...`, { quotedMessageId: ctx.id });
      try {
        const { aiProviderService } = await import('../../services/ai/ai-provider.service.js');
        const prompt = `Buatlah 1 soal pilihan ganda tentang pelajaran ${mapel} tingkat kesulitan ${level} beserta kunci jawabannya.
Format response harus berupa JSON mentah saja dengan schema berikut (tanpa markdown backticks):
{
  "soal": "Pertanyaan soal...",
  "opsi": ["A. ...", "B. ...", "C. ...", "D. ..."],
  "kunci": "A" atau "B" atau "C" atau "D",
  "penjelasan": "Penjelasan detail kenapa opsi tersebut benar..."
}`;
        const rawJson = await aiProviderService.generateText(prompt, "Anda adalah asisten pembuat soal ujian yang hanya membalas dengan format JSON saja.");

        // Clean JSON formatting if model added markdown codeblock
        const cleanJson = rawJson.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        const data = JSON.parse(cleanJson);

        const existing = activeQuizzes.get(ctx.chatId);
        if (existing) clearTimeout(existing.timer);

        const quizData = {
          question: `${data.soal}\n\n${data.opsi.join('\n')}`,
          answer: data.kunci.toUpperCase().trim(),
          explanation: data.penjelasan,
          points: 20,
          timer: setTimeout(() => {
            if (activeQuizzes.has(ctx.chatId)) {
              activeQuizzes.delete(ctx.chatId);
              adapter.sendMessage(ctx.chatId, `⏰ Waktu kuis habis! Jawabannya adalah *${data.kunci}*.\n\n💡 *Penjelasan:* ${data.penjelasan}`);
            }
          }, 90000)
        };

        activeQuizzes.set(ctx.chatId, quizData);

        let quizMsg = `📝 *KUIS BARU: ${mapel.toUpperCase()}* 📝\n\n`;
        quizMsg += quizData.question;
        quizMsg += `\n\nJawab dengan command: \`/jawab <A/B/C/D>\` (Waktu: 90 detik)`;

        await adapter.sendMessage(ctx.chatId, quizMsg, { quotedMessageId: ctx.id });
      } catch (err: any) {
        console.error('[Quiz Gen Fail]', err);
        // Fallback to offline math quiz if AI fails or offline
        const num1 = Math.floor(Math.random() * 20) + 5;
        const num2 = Math.floor(Math.random() * 15) + 2;
        const op = Math.random() > 0.5 ? '*' : '+';
        const ans = op === '*' ? num1 * num2 : num1 + num2;

        const existing = activeQuizzes.get(ctx.chatId);
        if (existing) clearTimeout(existing.timer);

        const quizData = {
          question: `Berapakah hasil dari *${num1} ${op} ${num2}*?`,
          answer: String(ans),
          explanation: `Perhitungannya adalah: ${num1} ${op} ${num2} = ${ans}.`,
          points: 10,
          timer: setTimeout(() => {
            if (activeQuizzes.has(ctx.chatId)) {
              activeQuizzes.delete(ctx.chatId);
              adapter.sendMessage(ctx.chatId, '⏰ Waktu kuis habis! Tidak ada yang berhasil menjawab tepat waktu.');
            }
          }, 60000)
        };

        activeQuizzes.set(ctx.chatId, quizData);
        await adapter.sendMessage(ctx.chatId, `📝 *KUIS MATEMATIKA (OFFLINE FALLBACK)* 📝\n\n${quizData.question}\n\nJawab dengan: \`/jawab <angka>\``, { quotedMessageId: ctx.id });
      }
      return;
    }

    // /jawab <jawaban>
    if (cmd === 'jawab') {
      const quiz = activeQuizzes.get(ctx.chatId);
      if (!quiz) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada sesi kuis yang aktif saat ini.', { quotedMessageId: ctx.id });
        return;
      }

      const userAnswer = args[0]?.toUpperCase().trim();
      if (!userAnswer) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan jawaban Anda. Contoh: `/jawab A` atau `/jawab 15`', { quotedMessageId: ctx.id });
        return;
      }

      if (userAnswer !== quiz.answer) {
        await adapter.sendMessage(ctx.chatId, '❌ Jawaban Anda salah. Coba lagi!', { quotedMessageId: ctx.id });
        return;
      }

      clearTimeout(quiz.timer);
      activeQuizzes.delete(ctx.chatId);
      await prisma.userEconomy.upsert({
        where: { userId: ctx.senderId },
        create: { userId: ctx.senderId, balance: quiz.points, xp: 20 },
        update: { balance: { increment: quiz.points }, xp: { increment: 20 } }
      });

      const mention = `@${ctx.senderId.split('@')[0]}`;
      await adapter.sendMessage(
        ctx.chatId,
        `🎉 *JAWABAN BENAR!* 🎉\n\nSelamat ${mention}, jawaban Anda tepat: *${quiz.answer}*!\n\n💡 *Penjelasan:* ${quiz.explanation}\n💰 Hadiah: *+${quiz.points} Saldo* dan *+20 XP*`,
        { quotedMessageId: ctx.id, mentions: [ctx.senderId] }
      );
      return;
    }

    // /bahas <pertanyaan/topik>
    if (cmd === 'bahas') {
      const query = args.join(' ').trim();
      if (!query) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan topik atau pertanyaan yang ingin dibahas.', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⏳ Sedang merumuskan pembahasan...', { quotedMessageId: ctx.id });
      try {
        const { aiProviderService } = await import('../../services/ai/ai-provider.service.js');
        const prompt = `Berikan pembahasan mendalam, analisis, pro/kontra, dan solusi logis untuk masalah/topik berikut:\n\nTopik: ${query}`;
        const discussion = await aiProviderService.generateText(prompt, "Anda adalah asisten panel diskusi ahli.");
        await adapter.sendMessage(ctx.chatId, `💬 *PEMBAHASAN INTERAKTIF: ${query.toUpperCase()}* 💬\n\n${discussion}`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal membuat pembahasan: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // /koreksiesai
    if (cmd === 'koreksiesai') {
      const essay = args.join(' ').trim() || ctx.quotedMessage?.body || '';
      if (!essay) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Reply teks esai Anda dengan `/koreksiesai` atau kirim `/koreksiesai <teks_esai>`.', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⏳ Menganalisis dan mengoreksi esai Anda...', { quotedMessageId: ctx.id });
      try {
        const { aiProviderService } = await import('../../services/ai/ai-provider.service.js');
        const prompt = `Koreksi esai di bawah ini. Berikan penilaian skor dari 0 sampai 100, sebutkan kelebihan esai, kelemahannya, serta saran perbaikan detail per aspek (tata bahasa, struktur, argumentasi):\n\nEsai:\n${essay}`;
        const review = await aiProviderService.generateText(prompt, "Anda adalah dosen bahasa dan penilai esai akademik profesional.");
        await adapter.sendMessage(ctx.chatId, `✍️ *KOREKSI & REVIEW ESAI* ✍️\n\n${review}`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal mengoreksi esai: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // /flashcard <topik>
    if (cmd === 'flashcard') {
      const topic = args.join(' ').trim();
      if (!topic) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan topik flashcard. Contoh: `/flashcard kosakata biologi`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `⏳ Menyiapkan flashcard tentang *${topic}*...`, { quotedMessageId: ctx.id });
      try {
        const { aiProviderService } = await import('../../services/ai/ai-provider.service.js');
        const prompt = `Buatlah 3 flashcard belajar untuk topik: ${topic}.
Format response harus berupa JSON mentah saja dengan schema berikut (tanpa markdown backticks):
[
  {"depan": "Istilah/Konsep", "belakang": "Definisi/Penjelasan singkat"},
  {"depan": "...", "belakang": "..."},
  {"depan": "...", "belakang": "..."}
]`;
        const rawJson = await aiProviderService.generateText(prompt, "Anda adalah tutor flashcard yang hanya membalas dengan format JSON.");
        const cleanJson = rawJson.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        const flashcards = JSON.parse(cleanJson);

        let msg = `🎴 *FLASHCARDS BELAJAR: ${topic.toUpperCase()}* 🎴\n\n`;
        flashcards.forEach((fc: any, i: number) => {
          msg += `*=== CARD #${i + 1} ===*\n`;
          msg += `👉 *DEPAN (Konsep):* ${fc.depan}\n`;
          msg += `👉 *BELAKANG (Definisi):* ||${fc.belakang}||\n\n`;
        });
        msg += `💡 _Tip: Ketuk bagian belakang untuk membaca penjelasan!_`;

        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal memuat flashcard: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }
  }
}

const textSuite = new TextSuiteCommand();
registerCommand(
  ['ocr', 'translate', 'tr', 'ringkas', 'summarize', 'ubah', 'typo', 'koreksi', 'balas', 'jelaskan', 'rangkum', 'quiz', 'belajar', 'jawab', 'buatsoal', 'latihan', 'bahas', 'koreksiesai', 'flashcard'],
  textSuite
);
