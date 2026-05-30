import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';
import { isPremium } from '../../bot/permission.js';
import { runOcr } from '../../services/ocr/ocr.service.js';
import {
  correctTypos,
  rewriteText,
  summarizeExtractive,
  translateText
} from '../../services/text/free-text.service.js';

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
        await adapter.sendMessage(ctx.chatId, `❌ Gagal menerjemahkan: ${err.message}. Jika memakai self-hosted, pastikan LIBRETRANSLATE_URL benar.`, { quotedMessageId: ctx.id });
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

      const summary = summarizeExtractive(text, isPrem ? 6 : 4);
      await adapter.sendMessage(ctx.chatId, `📌 *RANGKUMAN:*\n${summary}`, { quotedMessageId: ctx.id });
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

    if (cmd === 'jelaskan' || cmd === 'rangkum') {
      const topic = args.join(' ').trim();
      if (!topic) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Format salah. Contoh: \`/${cmd} fotosintesis\``, { quotedMessageId: ctx.id });
        return;
      }

      const explanation = `📘 *Eksplanasi: ${topic.toUpperCase()}*\n\n${topic} adalah topik yang perlu dipahami melalui definisi, contoh, dan latihan.\n\n*Rangkuman Belajar:* cari kata kunci utama, pahami hubungan antar konsep, lalu buat contoh sendiri.`;
      await adapter.sendMessage(ctx.chatId, explanation, { quotedMessageId: ctx.id });
      return;
    }

    if (cmd === 'quiz' || cmd === 'belajar') {
      const subject = args[0]?.toLowerCase() || 'matematika';
      if (subject !== 'matematika') {
        await adapter.sendMessage(ctx.chatId, `📚 *PANDUAN BELAJAR: ${subject.toUpperCase()}*\n\nMulai dari konsep dasar, catat istilah penting, lalu uji diri dengan contoh soal.`, { quotedMessageId: ctx.id });
        return;
      }

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
            adapter.sendMessage(ctx.chatId, '⏰ Waktu quiz habis! Tidak ada yang berhasil menjawab tepat waktu.');
          }
        }, 60000)
      };

      activeQuizzes.set(ctx.chatId, quizData);
      await adapter.sendMessage(ctx.chatId, `📝 *KUIS MATEMATIKA*\n\n${quizData.question}\n\nJawab dengan command: \`/jawab <angka>\` (Waktu: 60 detik)`);
      return;
    }

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
        `🎉 *JAWABAN BENAR!*\n\nSelamat ${mention}, jawaban Anda tepat: *${quiz.answer}*!\n\n💡 *Penjelasan:* ${quiz.explanation}\n💰 Hadiah: *+${quiz.points} Saldo* dan *+20 XP*`,
        { mentions: [ctx.senderId] }
      );
    }
  }
}

const textSuite = new TextSuiteCommand();
registerCommand(
  ['ocr', 'translate', 'tr', 'ringkas', 'summarize', 'ubah', 'typo', 'koreksi', 'balas', 'jelaskan', 'rangkum', 'quiz', 'belajar', 'jawab'],
  textSuite
);
