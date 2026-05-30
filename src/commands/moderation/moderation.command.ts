import { Command, registerCommand, checkIfAdmin } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';
import { isOwner } from '../../bot/permission.js';

function parseDuration(str: string): number {
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) return 300; // default 5m
  const val = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's': return val;
    case 'm': return val * 60;
    case 'h': return val * 3600;
    case 'd': return val * 86400;
    default: return val * 60;
  }
}

export class ModerationSuiteCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    // --- GLOBAL BLACKLIST COMMANDS (NO GROUP RESTRICTION) ---
    if (cmd === 'globalblacklist') {
      const action = args[0]?.toLowerCase().trim();
      const rawUser = args[1];
      const reason = args.slice(2).join(' ').trim() || 'Melanggar aturan global';

      if (!action || (action !== 'add' && action !== 'remove' && action !== 'check')) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Pilihan:\n• `/globalblacklist add @user <alasan>`\n• `/globalblacklist remove @user`\n• `/globalblacklist check @user`', { quotedMessageId: ctx.id });
        return;
      }

      const targetJid = rawUser?.includes('@') ? rawUser.replace('@', '').trim() + '@s.whatsapp.net' : rawUser?.trim();
      if (!targetJid) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Silakan tag target user.', { quotedMessageId: ctx.id });
        return;
      }

      if (action === 'add') {
        if (!isOwner(ctx.senderId)) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Owner bot yang dapat menambah blacklist global.', { quotedMessageId: ctx.id });
          return;
        }
        await prisma.blacklist.upsert({
          where: { id: `global-${targetJid}` }, // compound fallback
          create: { id: `global-${targetJid}`, scope: 'global', userId: targetJid, reason, createdBy: ctx.senderId },
          update: { reason, createdBy: ctx.senderId }
        });
        await adapter.sendMessage(ctx.chatId, `✅ @${targetJid.split('@')[0]} dimasukkan ke Blacklist Global.`, { mentions: [targetJid], quotedMessageId: ctx.id });
      } else if (action === 'remove') {
        if (!isOwner(ctx.senderId)) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Owner bot yang dapat menghapus blacklist global.', { quotedMessageId: ctx.id });
          return;
        }
        await prisma.blacklist.deleteMany({
          where: { scope: 'global', userId: targetJid }
        });
        await adapter.sendMessage(ctx.chatId, `✅ @${targetJid.split('@')[0]} dihapus dari Blacklist Global.`, { mentions: [targetJid], quotedMessageId: ctx.id });
      } else {
        const blacklist = await prisma.blacklist.findFirst({
          where: { scope: 'global', userId: targetJid }
        });
        if (blacklist) {
          await adapter.sendMessage(ctx.chatId, `⚠️ @${targetJid.split('@')[0]} terdaftar di Blacklist Global!\nAlasan: *${blacklist.reason}*`, { mentions: [targetJid], quotedMessageId: ctx.id });
        } else {
          await adapter.sendMessage(ctx.chatId, `✅ @${targetJid.split('@')[0]} tidak terdaftar di Blacklist Global.`, { mentions: [targetJid], quotedMessageId: ctx.id });
        }
      }
      return;
    }

    // --- ALL GROUP MODERATION COMMANDS ---
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
    if (!isAdmin) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Otoritas ditolak. Hanya admin grup yang dapat mengakses command moderasi.', { quotedMessageId: ctx.id });
      return;
    }

    const socket = (adapter as any).sock;

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
        const { executePunishment } = await import('../index.js');
        await executePunishment(ctx.chatId, targetJid, 'warn_no_delete', reason, null, adapter, ctx.senderId);
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
      const list = await prisma.badword.findMany({ where: { groupId: ctx.chatId } });
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
          data: { scope, groupId: scope === 'group' ? ctx.chatId : null, userId: targetJid, reason, createdBy: ctx.senderId }
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
        where: { userId: targetJid, scope, groupId: scope === 'group' ? ctx.chatId : null }
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

    // --- EPIC V2 ADMIN TOOLS (KICK, PROMOTE, DEMOTE, SUBJECT, DESC, OPEN, CLOSE, TAGALL) ---

    // tagall & hidetag
    if (cmd === 'tagall' || cmd === 'hidetag') {
      if (!socket) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur ini tidak didukung pada adapter saat ini.', { quotedMessageId: ctx.id });
        return;
      }
      const metadata = await socket.groupMetadata(ctx.chatId);
      const participants = metadata.participants || [];
      const mentions = participants.map((p: any) => p.id);
      const message = args.join(' ').trim();

      if (cmd === 'tagall') {
        let text = `📢 *PENGUMUMAN GRUP* 📢\n\n`;
        if (message) text += `${message}\n\n`;
        text += participants.map((p: any) => `@${p.id.split('@')[0]}`).join(' ');
        await adapter.sendMessage(ctx.chatId, text, { mentions });
      } else {
        await adapter.sendMessage(ctx.chatId, message || '📢', { mentions });
      }
      return;
    }

    // kick, promote, demote
    if (cmd === 'kick' || cmd === 'promote' || cmd === 'demote') {
      const rawUser = args[0];
      if (!rawUser) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Format salah. Contoh: \`/${cmd} @user\``, { quotedMessageId: ctx.id });
        return;
      }
      const targetJid = rawUser.includes('@') ? rawUser.replace('@', '').trim() + '@s.whatsapp.net' : rawUser.trim();

      if (!socket || typeof socket.groupParticipantsUpdate !== 'function') {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur ini tidak didukung pada adapter saat ini.', { quotedMessageId: ctx.id });
        return;
      }

      if (cmd === 'kick') {
        // Admin approval check
        const config = await prisma.groupConfig.findUnique({ where: { groupId: ctx.chatId } });
        const features = config ? JSON.parse(config.featuresJson || '{}') : {};
        if (features.approvalKick) {
          const approvalId = Math.random().toString(36).substring(2, 8).toUpperCase();
          const { stateStore } = await import('../../services/state/state-store.js');
          await stateStore.set(`approval:request:${approvalId}`, {
            id: approvalId,
            groupId: ctx.chatId,
            action: 'kick',
            target: targetJid,
            actorId: ctx.senderId,
            expiresAt: Date.now() + 15 * 60 * 1000
          }, 900);

          await adapter.sendMessage(
            ctx.chatId,
            `⏳ *MEMINTA PERSETUJUAN ADMIN* ⏳\n\n` +
            `Tindakan *KICK* terhadap @${targetJid.split('@')[0]} oleh @${ctx.senderId.split('@')[0]} membutuhkan persetujuan Admin lain.\n\n` +
            `Ketik:\n` +
            `👉 */approve ${approvalId}* (Setujui)\n` +
            `👉 */reject ${approvalId}* (Tolak)`,
            { mentions: [targetJid, ctx.senderId] }
          );
          return;
        }

        await socket.groupParticipantsUpdate(ctx.chatId, [targetJid], 'remove');
        await adapter.sendMessage(ctx.chatId, `🚪 Berhasil mengeluarkan @${targetJid.split('@')[0]} dari grup.`, { mentions: [targetJid] });
      } else if (cmd === 'promote') {
        await socket.groupParticipantsUpdate(ctx.chatId, [targetJid], 'promote');
        await adapter.sendMessage(ctx.chatId, `🎓 @${targetJid.split('@')[0]} sekarang adalah Admin grup.`, { mentions: [targetJid] });
      } else {
        await socket.groupParticipantsUpdate(ctx.chatId, [targetJid], 'demote');
        await adapter.sendMessage(ctx.chatId, `📉 Jabatan Admin @${targetJid.split('@')[0]} telah dicabut.`, { mentions: [targetJid] });
      }
      return;
    }

    // open & close group chat settings
    if (cmd === 'open' || cmd === 'close') {
      if (!socket || typeof socket.groupSettingUpdate !== 'function') {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur ini tidak didukung pada adapter saat ini.', { quotedMessageId: ctx.id });
        return;
      }
      const isAnnounceOnly = cmd === 'close';
      await socket.groupSettingUpdate(ctx.chatId, 'announcement', isAnnounceOnly);
      await adapter.sendMessage(ctx.chatId, `🔒 Grup berhasil di *${isAnnounceOnly ? 'TUTUP (Hanya Admin)' : 'BUKA (Semua Anggota)'}*.`);
      return;
    }

    // setname & setdesc
    if (cmd === 'setname' || cmd === 'setdesc') {
      const val = args.join(' ').trim();
      if (!val) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Format salah. Contoh: \`/${cmd} <nilai baru>\``, { quotedMessageId: ctx.id });
        return;
      }
      if (!socket) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur ini tidak didukung pada adapter saat ini.', { quotedMessageId: ctx.id });
        return;
      }

      if (cmd === 'setname') {
        await socket.groupUpdateSubject(ctx.chatId, val);
        await adapter.sendMessage(ctx.chatId, `✅ Nama grup berhasil diubah menjadi: *${val}*.`, { quotedMessageId: ctx.id });
      } else {
        await socket.groupUpdateDescription(ctx.chatId, val);
        await adapter.sendMessage(ctx.chatId, `✅ Deskripsi grup berhasil diperbarui.`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // setppgc (replied image)
    if (cmd === 'setppgc') {
      const quoted = ctx.quotedMessage;
      if (!quoted || !quoted.media || quoted.media.type !== 'image') {
        await adapter.sendMessage(ctx.chatId, '⚠️ Reply gambar yang ingin dijadikan foto profil grup.', { quotedMessageId: ctx.id });
        return;
      }
      if (!socket || typeof socket.updateProfilePicture !== 'function') {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur ini tidak didukung pada adapter saat ini.', { quotedMessageId: ctx.id });
        return;
      }
      const buffer = await quoted.media.getBuffer();
      await socket.updateProfilePicture(ctx.chatId, buffer);
      await adapter.sendMessage(ctx.chatId, '✅ Foto profil grup berhasil diperbarui.', { quotedMessageId: ctx.id });
      return;
    }

    // linkgc & resetlink
    if (cmd === 'linkgc' || cmd === 'resetlink') {
      if (!socket || typeof socket.groupInviteCode !== 'function') {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur ini tidak didukung pada adapter saat ini.', { quotedMessageId: ctx.id });
        return;
      }

      if (cmd === 'resetlink') {
        await socket.groupRevokeInvite(ctx.chatId);
        await adapter.sendMessage(ctx.chatId, '✅ Tautan undangan grup berhasil di-reset.', { quotedMessageId: ctx.id });
      }

      const code = await socket.groupInviteCode(ctx.chatId);
      await adapter.sendMessage(ctx.chatId, `🔗 *Tautan Undangan Grup:*\nhttps://chat.whatsapp.com/${code}`, { quotedMessageId: ctx.id });
      return;
    }

    // tempmute
    if (cmd === 'tempmute') {
      const rawUser = args[0];
      const durationStr = args[1] || '5m';
      if (!rawUser) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/tempmute @user 10m`', { quotedMessageId: ctx.id });
        return;
      }
      const targetJid = rawUser.includes('@') ? rawUser.replace('@', '').trim() + '@s.whatsapp.net' : rawUser.trim();
      const seconds = parseDuration(durationStr);

      const { stateStore } = await import('../../services/state/state-store.js');
      await stateStore.set(`mute:${ctx.chatId}:${targetJid}`, true, seconds);
      await adapter.sendMessage(ctx.chatId, `✅ @${targetJid.split('@')[0]} berhasil dimute selama ${durationStr}.`, { mentions: [targetJid], quotedMessageId: ctx.id });
      return;
    }

    // tempadmin
    if (cmd === 'tempadmin') {
      const rawUser = args[0];
      const durationStr = args[1] || '1h';
      if (!rawUser) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/tempadmin @user 1h`', { quotedMessageId: ctx.id });
        return;
      }
      const targetJid = rawUser.includes('@') ? rawUser.replace('@', '').trim() + '@s.whatsapp.net' : rawUser.trim();
      const seconds = parseDuration(durationStr);

      if (!socket || typeof socket.groupParticipantsUpdate !== 'function') {
        await adapter.sendMessage(ctx.chatId, '⚠️ Fitur ini tidak didukung pada adapter saat ini.', { quotedMessageId: ctx.id });
        return;
      }

      await socket.groupParticipantsUpdate(ctx.chatId, [targetJid], 'promote');

      const { stateStore } = await import('../../services/state/state-store.js');
      const expiresAt = Date.now() + seconds * 1000;
      await stateStore.set(`tempadmin:${ctx.chatId}:${targetJid}`, expiresAt);

      await adapter.sendMessage(ctx.chatId, `✅ @${targetJid.split('@')[0]} dipromosikan menjadi Admin Sementara selama ${durationStr}.`, { mentions: [targetJid], quotedMessageId: ctx.id });
      return;
    }

    // approval [on|off] [kick|broadcast]
    if (cmd === 'approval') {
      const state = args[0]?.toLowerCase().trim();
      const action = args[1]?.toLowerCase().trim();

      if (!state || !action || (state !== 'on' && state !== 'off') || (action !== 'kick' && action !== 'broadcast')) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/approval on kick` atau `/approval off broadcast`', { quotedMessageId: ctx.id });
        return;
      }

      const config = await prisma.groupConfig.findUnique({ where: { groupId: ctx.chatId } });
      const features = config ? JSON.parse(config.featuresJson || '{}') : {};

      if (action === 'kick') {
        features.approvalKick = state === 'on';
      } else {
        features.approvalBroadcast = state === 'on';
      }

      await prisma.groupConfig.upsert({
        where: { groupId: ctx.chatId },
        create: { groupId: ctx.chatId, prefix: '/', botEnabled: true, featuresJson: JSON.stringify(features) },
        update: { featuresJson: JSON.stringify(features) }
      });

      await adapter.sendMessage(ctx.chatId, `✅ Approval persetujuan untuk *${action.toUpperCase()}* berhasil diatur ke *${state.toUpperCase()}*.`, { quotedMessageId: ctx.id });
      return;
    }

    // approve & reject
    if (cmd === 'approve' || cmd === 'reject') {
      const approvalId = args[0]?.toUpperCase().trim();
      if (!approvalId) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Format salah. Contoh: \`/${cmd} <ID_APPROVAL>\``, { quotedMessageId: ctx.id });
        return;
      }

      const { stateStore } = await import('../../services/state/state-store.js');
      const req = await stateStore.get<any>(`approval:request:${approvalId}`);

      if (!req || req.groupId !== ctx.chatId) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Request approval tidak ditemukan, sudah kedaluwarsa, atau berada di grup lain.', { quotedMessageId: ctx.id });
        return;
      }

      if (req.actorId === ctx.senderId) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Anda tidak dapat menyetujui/menolak permintaan Anda sendiri.', { quotedMessageId: ctx.id });
        return;
      }

      if (cmd === 'approve') {
        if (req.action === 'kick') {
          if (!socket || typeof socket.groupParticipantsUpdate !== 'function') {
            await adapter.sendMessage(ctx.chatId, '⚠️ Fitur ini tidak didukung pada adapter saat ini.', { quotedMessageId: ctx.id });
            return;
          }
          await socket.groupParticipantsUpdate(req.groupId, [req.target], 'remove');
          await adapter.sendMessage(req.groupId, `✅ Permintaan disetujui oleh @${ctx.senderId.split('@')[0]}. Mengeluarkan @${req.target.split('@')[0]} dari grup.`, { mentions: [req.target, ctx.senderId] });
        } else if (req.action === 'broadcast') {
          const text = req.data.text;
          const groups = await prisma.groupConfig.findMany({ where: { botEnabled: true } });
          for (const g of groups) {
            await adapter.sendMessage(g.groupId, text).catch(() => {});
          }
          await adapter.sendMessage(ctx.chatId, `✅ Permintaan disetujui. Broadcast berhasil terkirim ke ${groups.length} grup.`);
        }
      } else {
        await adapter.sendMessage(req.groupId, `❌ Permintaan dengan ID *${approvalId}* ditolak oleh @${ctx.senderId.split('@')[0]}.`, { mentions: [ctx.senderId] });
      }

      await stateStore.delete(`approval:request:${approvalId}`);
      return;
    }

    // kickvote
    if (cmd === 'kickvote') {
      const rawUser = args[0];
      if (!rawUser) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/kickvote @user`', { quotedMessageId: ctx.id });
        return;
      }
      const targetJid = rawUser.includes('@') ? rawUser.replace('@', '').trim() + '@s.whatsapp.net' : rawUser.trim();

      const isTargetAdmin = await checkIfAdmin(ctx.chatId, targetJid, adapter);
      if (isTargetAdmin) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tidak dapat memulai vote kick terhadap Admin grup.', { quotedMessageId: ctx.id });
        return;
      }

      const voteKey = `kickvote:${ctx.chatId}:${targetJid}`;
      const { stateStore } = await import('../../services/state/state-store.js');
      const voters = await stateStore.get<string[]>(voteKey) || [];

      if (voters.includes(ctx.senderId)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Anda sudah memberikan suara untuk kick user ini.', { quotedMessageId: ctx.id });
        return;
      }

      voters.push(ctx.senderId);
      await stateStore.set(voteKey, voters, 3600);

      const votesNeeded = 5;
      const votesLeft = votesNeeded - voters.length;

      if (votesLeft <= 0) {
        await stateStore.delete(voteKey);
        if (socket && typeof socket.groupParticipantsUpdate === 'function') {
          await socket.groupParticipantsUpdate(ctx.chatId, [targetJid], 'remove');
          await adapter.sendMessage(ctx.chatId, `🚪 @${targetJid.split('@')[0]} berhasil dikeluarkan karena hasil vote kick mencapai batas (5/5 suara).`, { mentions: [targetJid] });
        }
      } else {
        await adapter.sendMessage(
          ctx.chatId,
          `🗳️ *VOTE KICK* 🗳️\n\n` +
          `Memulai vote kick untuk @${targetJid.split('@')[0]}.\n` +
          `Suara masuk: *${voters.length}/${votesNeeded}*\n` +
          `Butuh *${votesLeft}* suara lagi untuk mengeluarkan.\n\n` +
          `Ketik ulang \`/kickvote @user\` untuk memberikan suara.`,
          { mentions: [targetJid] }
        );
      }
      return;
    }
  }
}

const modSuite = new ModerationSuiteCommand();
registerCommand(
  [
    'warn', 'warnings', 'unwarn', 'clearwarn',
    'addbadword', 'delbadword', 'listbadword',
    'blacklist', 'unblacklist', 'listblacklist',
    'allowlink', 'dellink', 'listlink',
    'tagall', 'hidetag',
    'kick', 'promote', 'demote',
    'open', 'close',
    'setname', 'setdesc', 'setppgc',
    'linkgc', 'resetlink',
    'tempmute', 'tempadmin',
    'approval', 'approve', 'reject',
    'kickvote', 'globalblacklist'
  ],
  modSuite
);
