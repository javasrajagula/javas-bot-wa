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
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // --- 1. /ai <pertanyaan> ---
    if (cmd === 'ai') {
      const { privacyPolicyService } = await import('../../services/system/privacy-policy.service.js');
      const policy = await privacyPolicyService.getPolicy(ctx.isGroup ? ctx.chatId : null, ctx.senderId);
      if (!policy.canUseAi) {
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Fitur AI dinonaktifkan di grup ini karena pengaturan Privasi Strict.\nAnggota grup harus memberikan persetujuan data terlebih dahulu dengan mengetik `/consent ai on`.',
          { quotedMessageId: ctx.id }
        );
        return;
      }

      const prompt = args.join(' ').trim();
      if (!prompt) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Harap masukkan pertanyaan Anda.\nContoh: `/ai Jelaskan teori relativitas Einstein secara singkat.`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⏳ Sedang berpikir...', { quotedMessageId: ctx.id });
      
      try {
        let systemPrompt = "Anda adalah asisten pintar. Deteksi bahasa dari input pengguna dan balas dalam bahasa yang sama.";
        if (ctx.isGroup) {
          const { getGroupFeatures } = await import('../../config/feature-flags.js');
          const flags = await getGroupFeatures(ctx.chatId);
          const pName = flags.persona_name || 'Javas AI';
          const pPrompt = flags.persona_prompt || 'Anda adalah Javas AI, asisten pintar.';
          const pStyle = flags.persona_style || 'formal';

          let styleDesc = '';
          if (pStyle === 'santai') {
            styleDesc = 'Gunakan gaya bahasa santai, kasual, gaul, dan bersahabat seperti mengobrol dengan teman dekat.';
          } else if (pStyle === 'sopan') {
            styleDesc = 'Gunakan gaya bahasa sangat sopan, hormat, dan santun.';
          } else if (pStyle === 'singkat') {
            styleDesc = 'Berikan jawaban yang sangat singkat, padat, langsung pada intinya, tanpa basa-basi.';
          } else {
            styleDesc = 'Gunakan gaya bahasa formal, sopan, dan terstruktur.';
          }

          systemPrompt = `Nama Anda adalah ${pName}.\nKarakter/Kepribadian Anda: ${pPrompt}\n${styleDesc}\nDeteksi bahasa dari input pengguna dan balas dalam bahasa yang sama.`;
        }

        const response = await aiProviderService.generateText(prompt, systemPrompt);
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

      const { privacyPolicyService } = await import('../../services/system/privacy-policy.service.js');
      const policy = await privacyPolicyService.getPolicy(ctx.isGroup ? ctx.chatId : null, ctx.senderId);

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
        if (!policy.canUseAi) {
          await adapter.sendMessage(
            ctx.chatId,
            '⚠️ Chat Mode tidak dapat diaktifkan karena pengaturan Privasi Strict grup.\nSilakan berikan persetujuan data terlebih dahulu dengan mengetik `/consent ai on`.',
            { quotedMessageId: ctx.id }
          );
          return;
        }
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

    // --- 6. /setpersona ---
    if (cmd === 'setpersona') {
      const { checkIfAdmin } = await import('../index.js');
      const isAdmin = ctx.isGroup ? await checkIfAdmin(ctx.chatId, ctx.senderId, adapter) : isOwner(ctx.senderId);
      if (!isAdmin) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang dapat mengatur AI Persona.', { quotedMessageId: ctx.id });
        return;
      }

      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      const sub = args[0]?.toLowerCase().trim();
      const value = args.slice(1).join(' ').trim();

      const { getGroupFeatures, setGroupFeature } = await import('../../config/feature-flags.js');
      const flags = await getGroupFeatures(ctx.chatId);

      if (!sub || sub === 'status') {
        let msg = `🤖 *AI PERSONA SETTINGS* 🤖\n\n`;
        msg += `• Nama Persona: *${flags.persona_name || 'Javas AI'}*\n`;
        msg += `• Gaya Bahasa: *${flags.persona_style || 'formal'}*\n`;
        msg += `• Prompt/Karakter: _${flags.persona_prompt || 'Anda adalah Javas AI, asisten pintar.'}_\n\n`;
        msg += `*Cara Mengatur:*\n`;
        msg += `1. \`/setpersona name [nama_baru]\`\n`;
        msg += `2. \`/setpersona style [formal|santai|sopan|singkat]\`\n`;
        msg += `3. \`/setpersona prompt [prompt_baru]\``;

        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'name') {
        if (!value) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Harap masukkan nama baru untuk persona AI.', { quotedMessageId: ctx.id });
          return;
        }
        await setGroupFeature(ctx.chatId, 'persona_name', value);
        await adapter.sendMessage(ctx.chatId, `✅ Nama persona AI berhasil diubah menjadi *${value}*.`, { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'style') {
        const styleVal = value.toLowerCase();
        if (!['formal', 'santai', 'sopan', 'singkat'].includes(styleVal)) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Gaya bahasa tidak valid. Pilih salah satu: `formal`, `santai`, `sopan`, `singkat`.', { quotedMessageId: ctx.id });
          return;
        }
        await setGroupFeature(ctx.chatId, 'persona_style', styleVal);
        await adapter.sendMessage(ctx.chatId, `✅ Gaya bahasa AI berhasil diubah menjadi *${styleVal}*.`, { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'prompt') {
        if (!value) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Harap masukkan deskripsi prompt/karakter baru.', { quotedMessageId: ctx.id });
          return;
        }
        await setGroupFeature(ctx.chatId, 'persona_prompt', value);
        await adapter.sendMessage(ctx.chatId, `✅ Prompt/karakter AI berhasil diubah.\n\n_New Prompt:_ "${value}"`, { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⚠️ Sub-command tidak dikenal. Gunakan `/setpersona status` untuk info.', { quotedMessageId: ctx.id });
      return;
    }
  }
}

const aiCmd = new AiCommand();
registerCommand(['ai', 'chatmode', 'provider', 'providerstatus', 'setpersona'], aiCmd);
