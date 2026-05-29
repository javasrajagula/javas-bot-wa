import { Command, registerCommand, checkIfAdmin } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';
import { isOwner } from '../../bot/permission.js';

export class ModerationSuiteCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
    if (!isAdmin) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Otoritas ditolak. Hanya admin grup yang dapat mengakses command moderasi.', { quotedMessageId: ctx.id });
      return;
    }

    const cmd = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    // 1. Warnings system: /warn, /warnings, /unwarn, /clearwarn
    if (cmd === 'warn') {
      const rawUser = args[0];
      const reason = args.slice(1).join(' ').trim() || 'Melanggar peraturan grup';
      if (!rawUser) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/warn @user <alasan>`', { quotedMessageId: ctx.id });
        return;
      }

      const targetJid = rawUser.includes('@') ? rawUser.replace('@', '').trim() + '@s.whatsapp.net' : rawUser.trim();
      
      try {
        await prisma.warning.create({
          data: {
            groupId: ctx.chatId,
            userId: targetJid,
            reason,
            warnedBy: ctx.senderId
          }
        });

        const userWarnings = await prisma.warning.count({
          where: { groupId: ctx.chatId, userId: targetJid }
        });

        const mentionTarget = `@${targetJid.split('@')[0]}`;
        const mentionWarnedBy = `@${ctx.senderId.split('@')[0]}`;

        let message = `⚠️ *PERINGATAN* ⚠️\n\nAdmin ${mentionWarnedBy} memberikan peringatan kepada ${mentionTarget}.\nAlasan: *${reason}*\nJumlah Peringatan: *${userWarnings}/3*`;

        if (userWarnings >= 3) {
          message += `\n\n🚫 ${mentionTarget} telah melebihi batas 3 peringatan! Melakukan tindakan blokir/keluarkan.`;
          // Clear warnings after kick
          await prisma.warning.deleteMany({
            where: { groupId: ctx.chatId, userId: targetJid }
          });
        }

        await adapter.sendMessage(ctx.chatId, message, { mentions: [ctx.senderId, targetJid] });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal memproses warning: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    if (cmd === 'warnings') {
      const rawUser = args[0] || ctx.senderId;
      const targetJid = rawUser.includes('@') ? rawUser.replace('@', '').trim() + '@s.whatsapp.net' : rawUser.trim();
      
      const count = await prisma.warning.count({
        where: { groupId: ctx.chatId, userId: targetJid }
      });

      const mention = `@${targetJid.split('@')[0]}`;
      await adapter.sendMessage(ctx.chatId, `📝 ${mention} memiliki *${count}* peringatan aktif di grup ini.`, { mentions: [targetJid] });
      return;
    }

    if (cmd === 'unwarn') {
      const rawUser = args[0];
      if (!rawUser) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/unwarn @user`', { quotedMessageId: ctx.id });
        return;
      }
      const targetJid = rawUser.includes('@') ? rawUser.replace('@', '').trim() + '@s.whatsapp.net' : rawUser.trim();

      const lastWarning = await prisma.warning.findFirst({
        where: { groupId: ctx.chatId, userId: targetJid },
        orderBy: { createdAt: 'desc' }
      });

      if (lastWarning) {
        await prisma.warning.delete({ where: { id: lastWarning.id } });
        const count = await prisma.warning.count({ where: { groupId: ctx.chatId, userId: targetJid } });
        await adapter.sendMessage(ctx.chatId, `✅ Berhasil mengurangi peringatan untuk @${targetJid.split('@')[0]}. Sisa: *${count}/3*`, { mentions: [targetJid] });
      } else {
        await adapter.sendMessage(ctx.chatId, `⚠️ @${targetJid.split('@')[0]} tidak memiliki peringatan.`, { mentions: [targetJid] });
      }
      return;
    }

    if (cmd === 'clearwarn') {
      const rawUser = args[0];
      if (!rawUser) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/clearwarn @user`', { quotedMessageId: ctx.id });
        return;
      }
      const targetJid = rawUser.includes('@') ? rawUser.replace('@', '').trim() + '@s.whatsapp.net' : rawUser.trim();

      await prisma.warning.deleteMany({
        where: { groupId: ctx.chatId, userId: targetJid }
      });
      await adapter.sendMessage(ctx.chatId, `✅ Semua peringatan untuk @${targetJid.split('@')[0]} berhasil dihapus.`, { mentions: [targetJid] });
      return;
    }

    // 2. Badword filter: /addbadword, /delbadword, /listbadword
    if (cmd === 'addbadword') {
      const word = args.join(' ').trim().toLowerCase();
      if (!word) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/addbadword anjay`', { quotedMessageId: ctx.id });
        return;
      }

      try {
        await prisma.badword.create({
          data: { groupId: ctx.chatId, word, createdBy: ctx.senderId }
        });
        await adapter.sendMessage(ctx.chatId, `✅ Kata kasar *"${word}"* berhasil ditambahkan ke filter badword.`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal menambahkan badword: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    if (cmd === 'delbadword') {
      const word = args.join(' ').trim().toLowerCase();
      if (!word) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/delbadword anjay`', { quotedMessageId: ctx.id });
        return;
      }

      await prisma.badword.deleteMany({
        where: { groupId: ctx.chatId, word }
      });
      await adapter.sendMessage(ctx.chatId, `✅ Kata kasar *"${word}"* dihapus dari filter badword.`, { quotedMessageId: ctx.id });
      return;
    }

    if (cmd === 'listbadword') {
      const list = await prisma.badword.findMany({
        where: { groupId: ctx.chatId }
      });

      if (list.length === 0) {
        await adapter.sendMessage(ctx.chatId, '📭 Daftar badword grup kosong.', { quotedMessageId: ctx.id });
        return;
      }

      const response = `🚫 *DAFTAR BADWORD GRUP* 🚫\n\n` + list.map((b, i) => `${i + 1}. ${b.word}`).join('\n');
      await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
      return;
    }

    // 3. Blacklist: /blacklist, /unblacklist, /listblacklist
    if (cmd === 'blacklist') {
      const rawUser = args[0];
      const reason = args.slice(1).join(' ').trim() || 'Melanggar aturan';
      if (!rawUser) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/blacklist @user <alasan>`', { quotedMessageId: ctx.id });
        return;
      }

      const targetJid = rawUser.includes('@') ? rawUser.replace('@', '').trim() + '@s.whatsapp.net' : rawUser.trim();
      const scope = isOwner(ctx.senderId) ? 'global' : 'group';

      try {
        await prisma.blacklist.create({
          data: {
            scope,
            groupId: scope === 'group' ? ctx.chatId : null,
            userId: targetJid,
            reason,
            createdBy: ctx.senderId
          }
        });
        await adapter.sendMessage(ctx.chatId, `✅ Berhasil menambahkan @${targetJid.split('@')[0]} ke Blacklist (${scope.toUpperCase()}).\nAlasan: *${reason}*`, { mentions: [targetJid] });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal menambahkan ke blacklist: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    if (cmd === 'unblacklist') {
      const rawUser = args[0];
      if (!rawUser) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/unblacklist @user`', { quotedMessageId: ctx.id });
        return;
      }
      const targetJid = rawUser.includes('@') ? rawUser.replace('@', '').trim() + '@s.whatsapp.net' : rawUser.trim();

      const scope = isOwner(ctx.senderId) ? 'global' : 'group';
      await prisma.blacklist.deleteMany({
        where: {
          userId: targetJid,
          scope,
          groupId: scope === 'group' ? ctx.chatId : null
        }
      });
      await adapter.sendMessage(ctx.chatId, `✅ @${targetJid.split('@')[0]} dihapus dari Blacklist (${scope.toUpperCase()}).`, { mentions: [targetJid] });
      return;
    }

    if (cmd === 'listblacklist') {
      const list = await prisma.blacklist.findMany({
        where: {
          OR: [
            { scope: 'global' },
            { scope: 'group', groupId: ctx.chatId }
          ]
        }
      });

      if (list.length === 0) {
        await adapter.sendMessage(ctx.chatId, '📭 Daftar blacklist kosong.', { quotedMessageId: ctx.id });
        return;
      }

      const response = `🚫 *DAFTAR BLACKLIST* 🚫\n\n` + list.map((b, i) => `${i + 1}. @${b.userId.split('@')[0]} - Scope: ${b.scope.toUpperCase()} | Alasan: ${b.reason}`).join('\n');
      await adapter.sendMessage(ctx.chatId, response, { mentions: list.map(b => b.userId) });
      return;
    }

    // 4. Whitelist Link: /allowlink, /dellink, /listlink
    if (cmd === 'allowlink' || cmd === 'dellink' || cmd === 'listlink') {
      const domain = args[0]?.trim().toLowerCase();
      
      const config = await prisma.groupConfig.findUnique({ where: { groupId: ctx.chatId } });
      const features = config ? JSON.parse(config.featuresJson || '{}') : {};
      const whitelisted = features.whitelistedDomains || [];

      if (cmd === 'allowlink') {
        if (!domain) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/allowlink google.com`', { quotedMessageId: ctx.id });
          return;
        }
        if (!whitelisted.includes(domain)) {
          whitelisted.push(domain);
          features.whitelistedDomains = whitelisted;
          await prisma.groupConfig.upsert({
            where: { groupId: ctx.chatId },
            create: { groupId: ctx.chatId, featuresJson: JSON.stringify(features) },
            update: { featuresJson: JSON.stringify(features) }
          });
        }
        await adapter.sendMessage(ctx.chatId, `✅ Domain *${domain}* diperbolehkan di grup ini.`, { quotedMessageId: ctx.id });
      } else if (cmd === 'dellink') {
        if (!domain) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/dellink google.com`', { quotedMessageId: ctx.id });
          return;
        }
        const index = whitelisted.indexOf(domain);
        if (index > -1) {
          whitelisted.splice(index, 1);
          features.whitelistedDomains = whitelisted;
          await prisma.groupConfig.update({
            where: { groupId: ctx.chatId },
            data: { featuresJson: JSON.stringify(features) }
          });
        }
        await adapter.sendMessage(ctx.chatId, `✅ Domain *${domain}* dihapus dari whitelist.`, { quotedMessageId: ctx.id });
      } else {
        if (whitelisted.length === 0) {
          await adapter.sendMessage(ctx.chatId, '📭 Whitelist domain kosong.', { quotedMessageId: ctx.id });
          return;
        }
        await adapter.sendMessage(ctx.chatId, `🔗 *DOMAIN WHITELIST GRUP* 🔗\n\n` + whitelisted.map((d: string, i: number) => `${i + 1}. ${d}`).join('\n'), { quotedMessageId: ctx.id });
      }
      return;
    }
  }
}

const modSuite = new ModerationSuiteCommand();
registerCommand(
  ['warn', 'warnings', 'unwarn', 'clearwarn', 'addbadword', 'delbadword', 'listbadword', 'blacklist', 'unblacklist', 'listblacklist', 'allowlink', 'dellink', 'listlink'],
  modSuite
);
