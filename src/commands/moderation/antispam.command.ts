import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import { isGroupAdmin } from '../../bot/permission.js';
import { getGroupFeatures, setGroupFeature } from '../../config/feature-flags.js';

export class AntiSpamSuiteCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const isAdmin = await isGroupAdmin(ctx.chatId, ctx.senderId, adapter);
    if (!isAdmin) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang dapat mengakses pengaturan moderasi.', { quotedMessageId: ctx.id });
      return;
    }

    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();
    const flags = await getGroupFeatures(ctx.chatId);

    // 1. /antispam
    if (cmd === 'antispam') {
      const sub = args[0]?.toLowerCase();
      if (!sub || sub === 'status') {
        const status = flags.antispam ? '🟢 AKTIF' : '🔴 NONAKTIF';
        const mode = flags.antispamMode || 'warn';
        const limit = flags.antispamLimit || 5;
        const dur = flags.antispamDuration || 10;
        await adapter.sendMessage(ctx.chatId, `🛡️ *STATUS ANTI-SPAM GRUP*\n\n• Status: ${status}\n• Aksi: *${mode.toUpperCase()}*\n• Batas: *${limit} pesan / ${dur} detik*`, { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'on') {
        await setGroupFeature(ctx.chatId, 'antispam', true);
        await adapter.sendMessage(ctx.chatId, '✅ Fitur Anti-Spam berhasil *DIAKTIFKAN*.', { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'off') {
        await setGroupFeature(ctx.chatId, 'antispam', false);
        await adapter.sendMessage(ctx.chatId, '✅ Fitur Anti-Spam berhasil *DINONAKTIFKAN*.', { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'mode') {
        const mode = args[1]?.toLowerCase();
        if (!mode || !['delete', 'warn', 'mute', 'kick'].includes(mode)) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/antispam mode warn` (Pilihan: delete, warn, mute, kick)', { quotedMessageId: ctx.id });
          return;
        }
        await setGroupFeature(ctx.chatId, 'antispamMode', mode);
        await adapter.sendMessage(ctx.chatId, `✅ Aksi Anti-Spam berhasil diubah menjadi: *${mode.toUpperCase()}*.`, { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'limit') {
        const limit = parseInt(args[1] || '', 10);
        const dur = parseInt(args[2] || '', 10);
        if (isNaN(limit) || isNaN(dur) || limit < 1 || dur < 1) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/antispam limit 5 10` (Batas 5 pesan dalam 10 detik)', { quotedMessageId: ctx.id });
          return;
        }
        await setGroupFeature(ctx.chatId, 'antispamLimit', limit);
        await setGroupFeature(ctx.chatId, 'antispamDuration', dur);
        await adapter.sendMessage(ctx.chatId, `✅ Batas Anti-Spam berhasil diubah menjadi: *${limit} pesan / ${dur} detik*.`, { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⚠️ Perintah tidak dikenal. Pilihan:\n• `/antispam on|off`\n• `/antispam status`\n• `/antispam mode delete|warn|mute|kick`\n• `/antispam limit <jumlah> <durasi>`', { quotedMessageId: ctx.id });
      return;
    }

    // 2. /antilink
    if (cmd === 'antilink') {
      const sub = args[0]?.toLowerCase();
      if (!sub || sub === 'status') {
        const status = flags.antilink ? '🟢 AKTIF' : '🔴 NONAKTIF';
        const mode = flags.antilinkMode || 'delete';
        await adapter.sendMessage(ctx.chatId, `🛡️ *STATUS ANTI-LINK GRUP*\n\n• Status: ${status}\n• Aksi: *${mode.toUpperCase()}*`, { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'on') {
        await setGroupFeature(ctx.chatId, 'antilink', true);
        await adapter.sendMessage(ctx.chatId, '✅ Fitur Anti-Link berhasil *DIAKTIFKAN*.', { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'off') {
        await setGroupFeature(ctx.chatId, 'antilink', false);
        await adapter.sendMessage(ctx.chatId, '✅ Fitur Anti-Link berhasil *DINONAKTIFKAN*.', { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'mode') {
        const mode = args[1]?.toLowerCase();
        if (!mode || !['delete', 'warn', 'kick'].includes(mode)) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/antilink mode delete` (Pilihan: delete, warn, kick)', { quotedMessageId: ctx.id });
          return;
        }
        await setGroupFeature(ctx.chatId, 'antilinkMode', mode);
        await adapter.sendMessage(ctx.chatId, `✅ Aksi Anti-Link berhasil diubah menjadi: *${mode.toUpperCase()}*.`, { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⚠️ Perintah tidak dikenal. Pilihan:\n• `/antilink on|off`\n• `/antilink status`\n• `/antilink mode delete|warn|kick`', { quotedMessageId: ctx.id });
      return;
    }

    // 3. /whitelistdomain
    if (cmd === 'whitelistdomain') {
      const sub = args[0]?.toLowerCase();
      const domains: string[] = flags.whitelistedDomains || [];

      if (sub === 'add') {
        const domain = args[1]?.trim().toLowerCase();
        if (!domain) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/whitelistdomain add google.com`', { quotedMessageId: ctx.id });
          return;
        }
        if (domains.includes(domain)) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Domain tersebut sudah masuk daftar putih.', { quotedMessageId: ctx.id });
          return;
        }
        domains.push(domain);
        await setGroupFeature(ctx.chatId, 'whitelistedDomains', domains);
        await adapter.sendMessage(ctx.chatId, `✅ Berhasil menambahkan domain *${domain}* ke daftar putih.`, { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'del' || sub === 'remove') {
        const domain = args[1]?.trim().toLowerCase();
        if (!domain) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/whitelistdomain del google.com`', { quotedMessageId: ctx.id });
          return;
        }
        const index = domains.indexOf(domain);
        if (index === -1) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Domain tersebut tidak ada di daftar putih.', { quotedMessageId: ctx.id });
          return;
        }
        domains.splice(index, 1);
        await setGroupFeature(ctx.chatId, 'whitelistedDomains', domains);
        await adapter.sendMessage(ctx.chatId, `✅ Berhasil menghapus domain *${domain}* dari daftar putih.`, { quotedMessageId: ctx.id });
        return;
      }

      if (!sub || sub === 'list') {
        if (domains.length === 0) {
          await adapter.sendMessage(ctx.chatId, 'ℹ️ Tidak ada domain di daftar putih.', { quotedMessageId: ctx.id });
          return;
        }
        await adapter.sendMessage(ctx.chatId, `📋 *DAFTAR PUTIH DOMAIN GRUP*\n\n${domains.map((d, i) => `${i + 1}. ${d}`).join('\n')}`, { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⚠️ Perintah tidak dikenal. Pilihan:\n• `/whitelistdomain add <domain>`\n• `/whitelistdomain del <domain>`\n• `/whitelistdomain list`', { quotedMessageId: ctx.id });
      return;
    }

    // 4. /antivirtex
    if (cmd === 'antivirtex') {
      const sub = args[0]?.toLowerCase();
      if (!sub || sub === 'status') {
        const status = flags.antivirtex ? '🟢 AKTIF' : '🔴 NONAKTIF';
        await adapter.sendMessage(ctx.chatId, `🛡️ *STATUS ANTI-VIRTEX GRUP*\n\n• Status: ${status}`, { quotedMessageId: ctx.id });
        return;
      }
      if (sub === 'on') {
        await setGroupFeature(ctx.chatId, 'antivirtex', true);
        await adapter.sendMessage(ctx.chatId, '✅ Fitur Anti-Virtex berhasil *DIAKTIFKAN*.', { quotedMessageId: ctx.id });
        return;
      }
      if (sub === 'off') {
        await setGroupFeature(ctx.chatId, 'antivirtex', false);
        await adapter.sendMessage(ctx.chatId, '✅ Fitur Anti-Virtex berhasil *DINONAKTIFKAN*.', { quotedMessageId: ctx.id });
        return;
      }
    }

    // 5. /antimention
    if (cmd === 'antimention') {
      const sub = args[0]?.toLowerCase();
      if (!sub || sub === 'status') {
        const status = flags.antimention ? '🟢 AKTIF' : '🔴 NONAKTIF';
        await adapter.sendMessage(ctx.chatId, `🛡️ *STATUS ANTI-MENTION GRUP*\n\n• Status: ${status}`, { quotedMessageId: ctx.id });
        return;
      }
      if (sub === 'on') {
        await setGroupFeature(ctx.chatId, 'antimention', true);
        await adapter.sendMessage(ctx.chatId, '✅ Fitur Anti-Mention berhasil *DIAKTIFKAN*.', { quotedMessageId: ctx.id });
        return;
      }
      if (sub === 'off') {
        await setGroupFeature(ctx.chatId, 'antimention', false);
        await adapter.sendMessage(ctx.chatId, '✅ Fitur Anti-Mention berhasil *DINONAKTIFKAN*.', { quotedMessageId: ctx.id });
        return;
      }
    }

    // 6. /antisticker
    if (cmd === 'antisticker') {
      const sub = args[0]?.toLowerCase();
      if (!sub || sub === 'status') {
        const status = flags.antisticker ? '🟢 AKTIF' : '🔴 NONAKTIF';
        await adapter.sendMessage(ctx.chatId, `🛡️ *STATUS ANTI-STICKER GRUP*\n\n• Status: ${status}`, { quotedMessageId: ctx.id });
        return;
      }
      if (sub === 'on') {
        await setGroupFeature(ctx.chatId, 'antisticker', true);
        await adapter.sendMessage(ctx.chatId, '✅ Fitur Anti-Sticker berhasil *DIAKTIFKAN*.', { quotedMessageId: ctx.id });
        return;
      }
      if (sub === 'off') {
        await setGroupFeature(ctx.chatId, 'antisticker', false);
        await adapter.sendMessage(ctx.chatId, '✅ Fitur Anti-Sticker berhasil *DINONAKTIFKAN*.', { quotedMessageId: ctx.id });
        return;
      }
    }
  }
}

const antispamSuite = new AntiSpamSuiteCommand();
registerCommand(['antispam', 'antilink', 'whitelistdomain', 'antivirtex', 'antimention', 'antisticker'], antispamSuite);
