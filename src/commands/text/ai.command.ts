import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import { aiProviderService } from '../../services/ai/ai-provider.service.js';
import { stateStore } from '../../services/state/state-store.js';
import { isOwner } from '../../bot/permission.js';
import prisma from '../../db/client.js';
import axios from 'axios';

export class AiCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    // --- 1. /ai <pertanyaan> ---
    if (cmd === 'ai') {
      const prompt = args.join(' ').trim();
      if (!prompt) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Harap masukkan pertanyaan Anda.\nContoh: `/ai Jelaskan teori relativitas Einstein secara singkat.`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⏳ Sedang berpikir...', { quotedMessageId: ctx.id });
      
      try {
        const response = await aiProviderService.generateText(prompt);
        await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Terjadi kesalahan: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // --- 2. /chatmode [on|off] ---
    if (cmd === 'chatmode') {
      const mode = args[0]?.toLowerCase().trim();
      const scopeKey = ctx.isGroup ? `chatmode:${ctx.chatId}` : `chatmode:${ctx.senderId}`;

      if (!mode) {
        const current = await stateStore.get(scopeKey);
        await adapter.sendMessage(
          ctx.chatId,
          `💬 *Status Chat Mode:* *${current ? 'ON (AKTIF)' : 'OFF (NONAKTIF)'}*\n\nKetik \`/chatmode on\` untuk mengaktifkan bot menjawab semua pesan tanpa prefix.`,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      if (mode === 'on') {
        await stateStore.set(scopeKey, true);
        await adapter.sendMessage(ctx.chatId, '✅ *Chat Mode diaktifkan.* Bot sekarang akan merespon setiap pesan di obrolan ini menggunakan AI.', { quotedMessageId: ctx.id });
      } else if (mode === 'off') {
        await stateStore.delete(scopeKey);
        await adapter.sendMessage(ctx.chatId, '✅ *Chat Mode dinonaktifkan.* Bot hanya merespon command saja.', { quotedMessageId: ctx.id });
      } else {
        await adapter.sendMessage(ctx.chatId, '⚠️ Mode tidak valid. Gunakan: `/chatmode on` atau `/chatmode off`', { quotedMessageId: ctx.id });
      }
      return;
    }

    // --- 3. /provider list ---
    // --- 4. /provider set ai <provider> ---
    if (cmd === 'provider') {
      const action = args[0]?.toLowerCase().trim();

      if (!action || action === 'list') {
        const activeSetting = await prisma.botSetting.findUnique({ where: { key: 'ai_provider' } });
        let currentProvider = 'none (default)';
        if (activeSetting) {
          try {
            const parsed = JSON.parse(activeSetting.valueJson);
            currentProvider = parsed.provider;
          } catch {}
        }

        let msg = `🤖 *AI PROVIDER SETTINGS* 🤖\n\n`;
        msg += `• Provider Aktif: *${currentProvider.toUpperCase()}*\n\n`;
        msg += `*Daftar Provider Tersedia:*\n`;
        msg += `1. *none* — Mode offline / simulasi static responses\n`;
        msg += `2. *openai* — OpenAI GPT APIs\n`;
        msg += `3. *local* — Local LLMs (Ollama / LM Studio)\n`;
        msg += `4. *custom* — Custom OpenAI compatible endpoint\n\n`;
        msg += `💡 _Catatan: Hanya Owner yang dapat mengganti provider menggunakan command:_ \`/provider set ai <nama_provider>\``;

        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        return;
      }

      if (action === 'set') {
        const isUserOwner = isOwner(ctx.senderId);
        if (!isUserOwner) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Owner yang dapat mengatur AI Provider.', { quotedMessageId: ctx.id });
          return;
        }

        const type = args[1]?.toLowerCase().trim();
        const providerName = args[2]?.toLowerCase().trim();

        if (type !== 'ai' || !providerName || !['none', 'openai', 'local', 'custom'].includes(providerName)) {
          await adapter.sendMessage(
            ctx.chatId,
            '⚠️ Format salah.\nGunakan: `/provider set ai [none|openai|local|custom]`',
            { quotedMessageId: ctx.id }
          );
          return;
        }

        await prisma.botSetting.upsert({
          where: { key: 'ai_provider' },
          create: {
            key: 'ai_provider',
            valueJson: JSON.stringify({ provider: providerName })
          },
          update: {
            valueJson: JSON.stringify({ provider: providerName })
          }
        });

        await adapter.sendMessage(
          ctx.chatId,
          `✅ AI Provider berhasil diperbarui ke *${providerName.toUpperCase()}*.\nRestart bot mungkin diperlukan jika menggunakan cache global.`,
          { quotedMessageId: ctx.id }
        );
        return;
      }
    }

    // --- 5. /providerstatus ---
    if (cmd === 'providerstatus') {
      const activeSetting = await prisma.botSetting.findUnique({ where: { key: 'ai_provider' } });
      let providerName = 'none';
      if (activeSetting) {
        try {
          const parsed = JSON.parse(activeSetting.valueJson);
          providerName = parsed.provider;
        } catch {}
      }

      let statusMsg = `ℹ️ *STATUS AI PROVIDER* ℹ️\n\n`;
      statusMsg += `• Active Provider: *${providerName.toUpperCase()}*\n`;
      
      if (providerName === 'none') {
        statusMsg += `• Status: 🟢 *Offline/Simulation Mode Active*\n`;
        await adapter.sendMessage(ctx.chatId, statusMsg, { quotedMessageId: ctx.id });
        return;
      }

      statusMsg += `• Menghubungi API Endpoint... `;
      const testStart = Date.now();

      try {
        // Run a lightweight test request
        const testResp = await aiProviderService.generateText('test connection, answer with "OK"');
        const latency = Date.now() - testStart;
        statusMsg += `🟢 *ONLINE*\n`;
        statusMsg += `• Latency: *${latency}ms*\n`;
        statusMsg += `• Response: *"${testResp}"*`;
      } catch (err: any) {
        statusMsg += `🔴 *DOWN/ERROR*\n`;
        statusMsg += `• Error: _${err.message}_`;
      }

      await adapter.sendMessage(ctx.chatId, statusMsg, { quotedMessageId: ctx.id });
      return;
    }
  }
}

const aiCmd = new AiCommand();
registerCommand(['ai', 'chatmode', 'provider', 'providerstatus'], aiCmd);
