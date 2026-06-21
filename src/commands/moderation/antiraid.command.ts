import { Command, registerCommand, checkIfAdmin } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import { setGroupFeature, getGroupFeatures } from '../../config/feature-flags.js';
import prisma from '../../db/client.js';

export class AntiRaidCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Perintah ini hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
    if (!isAdmin) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang memiliki wewenang untuk perintah ini.', { quotedMessageId: ctx.id });
      return;
    }

    const cmd = ctx.command?.commandName || 'antiraid';

    if (cmd === 'lockdown') {
      const action = args[0]?.toLowerCase();
      if (action !== 'on' && action !== 'off') {
        const features = await getGroupFeatures(ctx.chatId);
        const status = features.lockdown ? '🔴 TERKUNCI (Lockdown Aktif)' : '🟢 NORMAL';
        await adapter.sendMessage(
          ctx.chatId,
          `🔒 *LOCKDOWN GROUP* 🔒\n\nStatus saat ini: *${status}*\n\nPerintah:\n• \`/lockdown on\` — Kunci total grup (hanya Admin yang dapat chat)\n• \`/lockdown off\` — Buka kunci grup`,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      const socket = (adapter as any).sock;
      if (!socket || typeof socket.groupSettingUpdate !== 'function') {
        await adapter.sendMessage(ctx.chatId, '❌ Fitur tidak didukung oleh adapter saat ini.', { quotedMessageId: ctx.id });
        return;
      }

      const features = await getGroupFeatures(ctx.chatId);
      if (action === 'on') {
        await socket.groupSettingUpdate(ctx.chatId, 'announcement');
        await setGroupFeature(ctx.chatId, 'lockdown', true);
        await adapter.sendMessage(ctx.chatId, '🔒 *Lockdown diaktifkan!* Grup telah ditutup dari kiriman pesan oleh anggota biasa.', { quotedMessageId: ctx.id });
      } else {
        await socket.groupSettingUpdate(ctx.chatId, 'not_announcement');
        await setGroupFeature(ctx.chatId, 'lockdown', false);
        await adapter.sendMessage(ctx.chatId, '🔓 *Lockdown dinonaktifkan!* Anggota biasa sekarang dapat mengirim pesan kembali.', { quotedMessageId: ctx.id });
      }
      return;
    }

    if (cmd === 'allowedtypes') {
      const type = args[0]?.toLowerCase();
      const validTypes = ['all', 'text_only', 'media_only', 'no_stickers', 'no_audio'];
      if (!type || !validTypes.includes(type)) {
        const features = await getGroupFeatures(ctx.chatId);
        const current = features.allowed_message_types || 'all';
        await adapter.sendMessage(
          ctx.chatId,
          `⚙️ *IZIN JENIS PESAN* ⚙️\n\n` +
          `Pengaturan saat ini: *${current}*\n\n` +
          `Opsi Perintah:\n` +
          `• \`/allowedtypes all\` — Izinkan semua jenis pesan\n` +
          `• \`/allowedtypes text_only\` — Hanya izinkan pesan teks (media didelete)\n` +
          `• \`/allowedtypes media_only\` — Hanya izinkan pesan media (teks murni didelete)\n` +
          `• \`/allowedtypes no_stickers\` — Larang pengiriman stiker\n` +
          `• \`/allowedtypes no_audio\` — Larang pengiriman audio/voice note`,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      await setGroupFeature(ctx.chatId, 'allowed_message_types', type);
      await adapter.sendMessage(ctx.chatId, `✅ Izin jenis pesan berhasil diubah menjadi: *${type}*`, { quotedMessageId: ctx.id });
      return;
    }

    // antiraid command
    const sub = args[0]?.toLowerCase();

    if (!sub) {
      const features = await getGroupFeatures(ctx.chatId);
      const status = features.antiraid ? '🟢 AKTIF' : '🔴 NONAKTIF';
      const limit = features.antiraidLimit || 10;
      const duration = features.antiraidDuration || 60;

      const response = `🛡️ *ANTI-RAID SHIELD CONFIG* 🛡️\n\n` +
        `• Status: *${status}*\n` +
        `• Batas Join: *${limit}* pengguna\n` +
        `• Durasi Deteksi: *${duration}* detik\n\n` +
        `Panduan Perintah:\n` +
        `👉 \`/antiraid on\` — Mengaktifkan Anti-Raid\n` +
        `👉 \`/antiraid off\` — Menonaktifkan Anti-Raid\n` +
        `👉 \`/antiraid limit <jumlah>\` — Mengatur batas join (contoh: \`/antiraid limit 5\`)\n` +
        `👉 \`/antiraid duration <detik>\` — Mengatur durasi waktu deteksi (contoh: \`/antiraid duration 30\`)`;

      await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
      return;
    }

    if (sub === 'on' || sub === 'off') {
      const value = sub === 'on';
      await setGroupFeature(ctx.chatId, 'antiraid', value);
      await adapter.sendMessage(ctx.chatId, `✅ Anti-Raid Shield berhasil diubah menjadi: *${sub.toUpperCase()}*`, { quotedMessageId: ctx.id });
      return;
    }

    if (sub === 'limit') {
      const val = parseInt(args[1] || '', 10);
      if (isNaN(val) || val <= 0) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan jumlah limit yang valid (angka > 0).', { quotedMessageId: ctx.id });
        return;
      }

      await setGroupFeature(ctx.chatId, 'antiraidLimit', val);
      await adapter.sendMessage(ctx.chatId, `✅ Batas join Anti-Raid berhasil diubah menjadi: *${val}* pengguna.`, { quotedMessageId: ctx.id });
      return;
    }

    if (sub === 'duration') {
      const val = parseInt(args[1] || '', 10);
      if (isNaN(val) || val <= 0) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan durasi yang valid (angka detik > 0).', { quotedMessageId: ctx.id });
        return;
      }

      await setGroupFeature(ctx.chatId, 'antiraidDuration', val);
      await adapter.sendMessage(ctx.chatId, `✅ Durasi deteksi Anti-Raid berhasil diubah menjadi: *${val}* detik.`, { quotedMessageId: ctx.id });
      return;
    }

    await adapter.sendMessage(ctx.chatId, '⚠️ Perintah tidak dikenal. Gunakan `/antiraid` untuk melihat panduan.', { quotedMessageId: ctx.id });
  }
}

const commandInstance = new AntiRaidCommand();
registerCommand(['antiraid', 'lockdown', 'allowedtypes'], commandInstance);
