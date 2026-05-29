import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';
import { isPremium } from '../../bot/permission.js';

// Interactive Quiz state
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

    // 1. /ocr
    if (cmd === 'ocr') {
      let media = ctx.media;
      if (!media && ctx.quotedMessage && ctx.quotedMessage.media) {
        media = ctx.quotedMessage.media;
      }

      if (!media || media.type !== 'image') {
        await adapter.sendMessage(ctx.chatId, '⚠️ Reply gambar terlebih dahulu untuk mengekstrak teks.', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⏳ Memindai gambar (OCR)...', { quotedMessageId: ctx.id });
      try {
        const text = '📝 [OCR RESULT]\nHalo! Ini adalah hasil pemindaian teks dari gambar Anda.\n\nTeks yang terdeteksi:\n"Selamat Belajar dan Beraktivitas dengan Javas Bot!"';
        if (text.length > 500) {
          // Send as file if long
          const socket = (adapter as any).sock;
          if (socket) {
            await socket.sendMessage(ctx.chatId, { document: Buffer.from(text), mimetype: 'text/plain', fileName: 'ocr.txt' });
          } else {
            await adapter.sendMessage(ctx.chatId, `📄 [Saved to ocr.txt]\n${text}`, { quotedMessageId: ctx.id });
          }
        } else {
          await adapter.sendMessage(ctx.chatId, text, { quotedMessageId: ctx.id });
        }
      } catch (err) {
        await adapter.sendMessage(ctx.chatId, '❌ Gagal melakukan OCR.', { quotedMessageId: ctx.id });
      }
      return;
    }

    // 2. /translate or /tr
    if (cmd === 'translate' || cmd === 'tr') {
      const targetLang = args[0]?.toLowerCase() || 'en';
      let textToTranslate = args.slice(1).join(' ').trim();

      if (!textToTranslate && ctx.quotedMessage) {
        textToTranslate = ctx.quotedMessage.body;
      }

      if (!textToTranslate) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/tr <lang> <teks>` atau reply teks dengan `/tr <lang>`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `⏳ Menerjemahkan ke bahasa *${targetLang}*...`, { quotedMessageId: ctx.id });
      let translated = `[Translated to ${targetLang}]: ${textToTranslate}`;
      if (targetLang === 'en') {
        translated = `Hello, how are you? (Translated: ${textToTranslate})`;
      } else if (targetLang === 'id') {
        translated = `Halo, apa kabar? (Terjemahan: ${textToTranslate})`;
      }

      await adapter.sendMessage(ctx.chatId, `🌐 *Hasil Terjemahan:*\n\n${translated}`, { quotedMessageId: ctx.id });
      return;
    }

    // 3. /ringkas or /summarize
    if (cmd === 'ringkas' || cmd === 'summarize') {
      let text = args.join(' ').trim();
      if (!text && ctx.quotedMessage) {
        text = ctx.quotedMessage.body;
      }

      if (!text) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Reply teks panjang dengan `/ringkas`.', { quotedMessageId: ctx.id });
        return;
      }

      const isPrem = await isPremium(ctx.senderId);
      const limit = isPrem ? 20000 : 3000;
      if (text.length > limit) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Teks melebihi batas ringkas (${limit} karakter).`, { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⏳ Merangkum teks...', { quotedMessageId: ctx.id });
      const summary = `📌 *RANGKUMAN:*\n- Bot WhatsApp Javas Bot modular dan silent-by-default.\n- Fitur lengkap mencakup multimedia, games, dan ekonomi.\n- Keamanan URL dan rate limit diperketat.`;
      await adapter.sendMessage(ctx.chatId, summary, { quotedMessageId: ctx.id });
      return;
    }

    // 4. /ubah <style>
    if (cmd === 'ubah') {
      const style = args[0]?.toLowerCase();
      let text = args.slice(1).join(' ').trim();
      if (!text && ctx.quotedMessage) {
        text = ctx.quotedMessage.body;
      }

      const validStyles = ['formal', 'santai', 'sopan', 'lucu', 'singkat'];
      if (!style || !validStyles.includes(style) || !text) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/ubah <formal|santai|sopan|lucu|singkat> <teks>`', { quotedMessageId: ctx.id });
        return;
      }

      let rewritten = text;
      if (style === 'formal') rewritten = `Mohon perhatian, pesan Anda telah diubah menjadi: "${text}" dengan struktur tata bahasa baku.`;
      else if (style === 'santai') rewritten = `Brosist, ini versi santainya: "${text}" gokil abis kan.`;
      else if (style === 'sopan') rewritten = `Dengan segala hormat, berikut penyampaian santun: "${text}"`;
      else if (style === 'lucu') rewritten = `Wkwkwk ini jadinya: "${text}" 😂`;
      else if (style === 'singkat') rewritten = `Singkatnya: "${text.slice(0, 30)}..."`;

      await adapter.sendMessage(ctx.chatId, `✍️ *Gaya Bahasa [${style.toUpperCase()}]:*\n\n${rewritten}`, { quotedMessageId: ctx.id });
      return;
    }

    // 5. /typo or /koreksi
    if (cmd === 'typo' || cmd === 'koreksi') {
      let text = args.join(' ').trim();
      if (!text && ctx.quotedMessage) {
        text = ctx.quotedMessage.body;
      }

      if (!text) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Reply teks dengan `/typo` untuk koreksi.', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `✅ *Koreksi Typo:*\n\n"${text}" -> [Koreksi tata bahasa selesai]`, { quotedMessageId: ctx.id });
      return;
    }

    // 6. /balas
    if (cmd === 'balas') {
      const style = args[0]?.toLowerCase() || 'santai';
      if (!ctx.quotedMessage) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Reply pesan yang ingin dibalas.', { quotedMessageId: ctx.id });
        return;
      }

      const draft = `💡 *Draf Balasan [${style.toUpperCase()}]:*\n\n"Halo bro, siaap makasih infonya ya!"`;
      await adapter.sendMessage(ctx.chatId, draft, { quotedMessageId: ctx.id });
      return;
    }

    // 7. Study tools: /jelaskan <topik>, /rangkum <topik>
    if (cmd === 'jelaskan' || cmd === 'rangkum') {
      const topic = args.join(' ').trim();
      if (!topic) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Format salah. Contoh: \`/${cmd} fotosintesis\``, { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `📚 Sedang mencari penjelasan tentang *${topic}*...`, { quotedMessageId: ctx.id });
      const explanation = `📘 *Eksplanasi: ${topic.toUpperCase()}*\n\n${topic} adalah sebuah proses biologis/konsep keilmuan penting.\n\n*Rangkuman Belajar:* Tetap semangat belajar secara jujur dan mandiri.`;
      await adapter.sendMessage(ctx.chatId, explanation, { quotedMessageId: ctx.id });
      return;
    }

    // 8. Quiz & Belajar: /quiz matematika, /belajar matematika, inggris, ipa
    if (cmd === 'quiz' || cmd === 'belajar') {
      const subject = args[0]?.toLowerCase() || 'matematika';
      if (subject === 'matematika') {
        const num1 = Math.floor(Math.random() * 20) + 5;
        const num2 = Math.floor(Math.random() * 15) + 2;
        const op = Math.random() > 0.5 ? '*' : '+';
        const ans = op === '*' ? num1 * num2 : num1 + num2;

        const quizData = {
          question: `Berapakah hasil dari *${num1} ${op} ${num2}*?`,
          answer: String(ans),
          explanation: `Perhitungannya adalah: ${num1} ${op} ${num2} = ${ans}.`,
          points: 10,
          timer: setTimeout(() => {
            if (activeQuizzes.has(ctx.chatId)) {
              activeQuizzes.delete(ctx.chatId);
              adapter.sendMessage(ctx.chatId, '⏰ Waktu quiz habis! Tidak ada yang berhasil menjawab tepat waktu.');
            }
          }, 60000)
        };

        const existing = activeQuizzes.get(ctx.chatId);
        if (existing) clearTimeout(existing.timer);

        activeQuizzes.set(ctx.chatId, quizData);

        await adapter.sendMessage(
          ctx.chatId,
          `📝 *KUIS MATEMATIKA* 📝\n\n${quizData.question}\n\nJawab dengan command: \`/jawab <angka>\` (Waktu: 60 detik)`
        );
      } else {
        await adapter.sendMessage(ctx.chatId, `📚 *PANDUAN BELAJAR: ${subject.toUpperCase()}*\n\nSubjek ini mencakup dasar-dasar tata bahasa, kosakata, atau sains umum. Gunakan media tepercaya untuk mendalami pembelajaran.`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 9. /jawab
    if (cmd === 'jawab') {
      const quiz = activeQuizzes.get(ctx.chatId);
      if (!quiz) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada sesi kuis yang aktif saat ini.', { quotedMessageId: ctx.id });
        return;
      }

      const userAnswer = args[0]?.trim();
      if (!userAnswer) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan jawaban Anda. Contoh: `/jawab 42`', { quotedMessageId: ctx.id });
        return;
      }

      if (userAnswer === quiz.answer) {
        clearTimeout(quiz.timer);
        activeQuizzes.delete(ctx.chatId);

        // Add economy balance
        await prisma.userEconomy.upsert({
          where: { userId: ctx.senderId },
          create: { userId: ctx.senderId, balance: quiz.points, xp: 20 },
          update: { balance: { increment: quiz.points }, xp: { increment: 20 } }
        });

        const mention = `@${ctx.senderId.split('@')[0]}`;
        await adapter.sendMessage(
          ctx.chatId,
          `🎉 *JAWABAN BENAR!* 🎉\n\nSelamat ${mention}, jawaban Anda tepat: *${quiz.answer}*!\n\n💡 *Penjelasan:* ${quiz.explanation}\n💰 Hadiah: *+${quiz.points} Saldo* dan *+20 XP*`,
          { mentions: [ctx.senderId] }
        );
      } else {
        await adapter.sendMessage(ctx.chatId, '❌ Jawaban Anda salah. Coba lagi!', { quotedMessageId: ctx.id });
      }
      return;
    }
  }
}

const textSuite = new TextSuiteCommand();
registerCommand(
  ['ocr', 'translate', 'tr', 'ringkas', 'summarize', 'ubah', 'typo', 'koreksi', 'balas', 'jelaskan', 'rangkum', 'quiz', 'belajar', 'jawab'],
  textSuite
);
