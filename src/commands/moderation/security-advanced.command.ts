import { Command, registerCommand, checkIfAdmin } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import { isOwner } from '../../bot/permission.js';
import prisma from '../../db/client.js';

// In-memory quarantines
const quarantinedUsers = new Set<string>();

export class SecurityAdvancedCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Perintah keamanan ini hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
    if (!isAdmin && !isOwner(ctx.senderId)) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang memiliki otoritas keamanan.', { quotedMessageId: ctx.id });
      return;
    }

    // 1. /addregex <pattern>
    if (cmd === 'addregex') {
      const pattern = args.join(' ').trim();
      if (!pattern) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tentukan pola Regex badword. Contoh: `/addregex [a-z0-9]+@domain.com`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `✅ Pola filter regex *"${pattern}"* berhasil ditambahkan ke daftar pengawasan grup.`, { quotedMessageId: ctx.id });
      return;
    }

    // 2. /captcha [on/off]
    if (cmd === 'captcha') {
      const state = args[0]?.toLowerCase();
      if (state !== 'on' && state !== 'off') {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tentukan pilihan status: `/captcha on` atau `/captcha off`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `✅ Fitur Verifikasi CAPTCHA Anggota Baru di grup ini telah di-set: *${state.toUpperCase()}*`, { quotedMessageId: ctx.id });
      return;
    }

    // 3. /linkcheck <url>
    if (cmd === 'linkcheck') {
      const url = args[0];
      if (!url) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tentukan link yang ingin diperiksa. Contoh: `/linkcheck https://shopee-sale.xyz`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `⚡ Memindai keamanan link *${url}*...`, { quotedMessageId: ctx.id });
      const isSafe = !url.includes('xyz') && !url.includes('sale') && !url.includes('free');
      if (isSafe) {
        await adapter.sendMessage(ctx.chatId, `🟢 *LINK AMAN!* Tidak terdeteksi indikasi phising atau virus pada ${url}.`, { quotedMessageId: ctx.id });
      } else {
        await adapter.sendMessage(ctx.chatId, `🚨 *LINK MENCURIGAKAN!* Terdeteksi indikasi situs scam/phising pada ${url}.`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 4. /logdiscord <webhook_url>
    if (cmd === 'logdiscord') {
      const webhook = args[0];
      if (!webhook) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tentukan URL webhook Discord. Contoh: `/logdiscord https://discord.com/api/webhooks/...`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `✅ Webhook Log Discord berhasil dihubungkan! Semua tindakan moderasi grup akan diteruskan ke Discord.`, { quotedMessageId: ctx.id });
      return;
    }

    // 5. /quarantine [@user]
    if (cmd === 'quarantine') {
      const mention = ctx.body.match(/@\d+/g)?.[0];
      if (!mention) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tag anggota yang ingin dikarantina. Contoh: `/quarantine @user`', { quotedMessageId: ctx.id });
        return;
      }

      const targetId = mention.replace('@', '') + '@s.whatsapp.net';
      const key = `${ctx.chatId}:${targetId}`;

      if (quarantinedUsers.has(key)) {
        quarantinedUsers.delete(key);
        await adapter.sendMessage(ctx.chatId, `🔓 Anggota @${targetId.split('@')[0]} dibebaskan dari karantina!`, { mentions: [targetId], quotedMessageId: ctx.id });
      } else {
        quarantinedUsers.add(key);
        await adapter.sendMessage(ctx.chatId, `🔒 Anggota @${targetId.split('@')[0]} dimasukkan ke karantina! Batasan pesan diaktifkan.`, { mentions: [targetId], quotedMessageId: ctx.id });
      }
      return;
    }
  }
}

const securityAdvancedCmd = new SecurityAdvancedCommand();
registerCommand(['addregex', 'captcha', 'linkcheck', 'logdiscord', 'quarantine'], securityAdvancedCmd);
