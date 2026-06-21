import { Command, registerCommand, checkIfAdmin } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import { isOwner } from '../../bot/permission.js';
import { getGroupFeatures, setGroupFeature } from '../../config/feature-flags.js';
import { messageCache } from '../../services/state/message-cache.js';
import { analyzeGroupSentiment, generateStory, recommendGroupContent } from '../../services/ai/ai-advanced.service.js';

export class AiAdvancedCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // 1. /sentimen - AI Analisis Sentimen Grup
    if (cmd === 'sentimen') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⏳ Menganalisis sentimen obrolan grup...', { quotedMessageId: ctx.id });
      try {
        const recentMsgs = messageCache.getForChat(ctx.chatId);
        if (recentMsgs.length === 0) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tidak cukup riwayat obrolan di cache untuk menganalisis sentimen.', { quotedMessageId: ctx.id });
          return;
        }

        const messagesText = recentMsgs.map(m => `${m.senderName}: ${m.body}`);
        const sentimentResult = await analyzeGroupSentiment(messagesText);
        await adapter.sendMessage(ctx.chatId, `📊 *ANALISIS SENTIMEN GRUP* 📊\n\n${sentimentResult}`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal menganalisis sentimen: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 2. /cerita [tema] - AI Story Generator
    if (cmd === 'cerita') {
      const theme = args.join(' ').trim();
      if (!theme) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Harap masukkan tema cerita. Contoh: `/cerita petualangan di planet Mars`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `⏳ Membuat cerita pendek interaktif tentang *"${theme}"*...`, { quotedMessageId: ctx.id });
      try {
        const story = await generateStory(theme);
        await adapter.sendMessage(ctx.chatId, `📖 *CERITA INTERAKTIF: ${theme.toUpperCase()}* 📖\n\n${story}`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal membuat cerita: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 3. /rekomendasi - AI Rekomendasi Konten
    if (cmd === 'rekomendasi') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⏳ Menganalisis tren diskusi grup untuk rekomendasi...', { quotedMessageId: ctx.id });
      try {
        const recentMsgs = messageCache.getForChat(ctx.chatId);
        const messagesText = recentMsgs.length > 0
          ? recentMsgs.map(m => `${m.senderName}: ${m.body}`)
          : ['(tidak ada riwayat chat terbaru, sarankan topik umum yang seru)'];

        const recommendations = await recommendGroupContent(messagesText);
        await adapter.sendMessage(ctx.chatId, `💡 *REKOMENDASI TOPIK DISKUSI GRUP* 💡\n\n${recommendations}`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal membuat rekomendasi: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 4. /addfaq <pertanyaan> | <jawaban>
    if (cmd === 'addfaq') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      if (!isAdmin && !isOwner(ctx.senderId)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang dapat menambah FAQ.', { quotedMessageId: ctx.id });
        return;
      }

      const fullInput = args.join(' ');
      const parts = fullInput.split('|');
      if (parts.length < 2) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/addfaq <pertanyaan> | <jawaban>`', { quotedMessageId: ctx.id });
        return;
      }

      const question = parts[0].trim();
      const answer = parts.slice(1).join('|').trim();

      if (!question || !answer) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Pertanyaan dan jawaban tidak boleh kosong.', { quotedMessageId: ctx.id });
        return;
      }

      try {
        const flags = await getGroupFeatures(ctx.chatId);
        let faqMap: Record<string, string> = {};
        try {
          faqMap = JSON.parse(flags.faq_mapping || '{}');
        } catch {
          faqMap = {};
        }

        faqMap[question] = answer;
        await setGroupFeature(ctx.chatId, 'faq_mapping', JSON.stringify(faqMap));

        await adapter.sendMessage(ctx.chatId, `✅ FAQ berhasil ditambahkan!\n\n❓ *Q:* ${question}\n📢 *A:* ${answer}`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal menyimpan FAQ: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 5. /delfaq <pertanyaan>
    if (cmd === 'delfaq') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      if (!isAdmin && !isOwner(ctx.senderId)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang dapat menghapus FAQ.', { quotedMessageId: ctx.id });
        return;
      }

      const question = args.join(' ').trim();
      if (!question) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Harap masukkan pertanyaan FAQ yang ingin dihapus.', { quotedMessageId: ctx.id });
        return;
      }

      try {
        const flags = await getGroupFeatures(ctx.chatId);
        let faqMap: Record<string, string> = {};
        try {
          faqMap = JSON.parse(flags.faq_mapping || '{}');
        } catch {
          faqMap = {};
        }

        let foundKey = null;
        const qLower = question.toLowerCase();
        for (const key of Object.keys(faqMap)) {
          if (key.toLowerCase() === qLower) {
            foundKey = key;
            break;
          }
        }

        if (!foundKey) {
          await adapter.sendMessage(ctx.chatId, `⚠️ FAQ untuk "${question}" tidak ditemukan.`, { quotedMessageId: ctx.id });
          return;
        }

        delete faqMap[foundKey];
        await setGroupFeature(ctx.chatId, 'faq_mapping', JSON.stringify(faqMap));

        await adapter.sendMessage(ctx.chatId, `✅ FAQ untuk "${foundKey}" berhasil dihapus.`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal menghapus FAQ: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 6. /listfaq
    if (cmd === 'listfaq') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      try {
        const flags = await getGroupFeatures(ctx.chatId);
        let faqMap: Record<string, string> = {};
        try {
          faqMap = JSON.parse(flags.faq_mapping || '{}');
        } catch {
          faqMap = {};
        }

        const keys = Object.keys(faqMap);
        if (keys.length === 0) {
          await adapter.sendMessage(ctx.chatId, 'ℹ️ Belum ada FAQ yang terdaftar di grup ini.', { quotedMessageId: ctx.id });
          return;
        }

        let msg = `❓ *DAFTAR FAQ GRUP* ❓\n\n`;
        keys.forEach((key, index) => {
          msg += `${index + 1}. *${key}*\n`;
        });
        msg += `\n💡 _Ketik pertanyaan di atas secara langsung untuk mendapatkan jawaban otomatis._`;

        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal menampilkan FAQ: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }
  }
}

const aiAdvancedCmd = new AiAdvancedCommand();
registerCommand(['sentimen', 'cerita', 'rekomendasi', 'addfaq', 'delfaq', 'listfaq'], aiAdvancedCmd);
