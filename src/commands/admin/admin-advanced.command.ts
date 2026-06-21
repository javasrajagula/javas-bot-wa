import { Command, registerCommand, checkIfAdmin } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import { isOwner } from '../../bot/permission.js';
import { getGroupFeatures, setGroupFeature } from '../../config/feature-flags.js';
import prisma from '../../db/client.js';
import os from 'os';

const approvalQueue = new Map<string, Set<string>>();

export class AdminAdvancedCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // 1. /ping
    if (cmd === 'ping') {
      const start = Date.now();
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const dbLatency = Date.now() - dbStart;

      const connectionLatency = Date.now() - start;
      const freeMem = os.freemem();
      const totalMem = os.totalmem();
      const usedMem = totalMem - freeMem;
      const memPercent = ((usedMem / totalMem) * 100).toFixed(1);

      let msg = `🏓 *PONG (ADVANCED)* 🏓\n\n`;
      msg += `• Latensi Koneksi: *${connectionLatency}ms*\n`;
      msg += `• Latensi Database: *${dbLatency}ms*\n`;
      msg += `• RAM Terpakai: *${(usedMem / 1024 / 1024 / 1024).toFixed(2)} GB* (${memPercent}%)\n`;
      msg += `• Platform: *${os.platform().toUpperCase()}*\n`;
      msg += `• Uptime OS: *${(os.uptime() / 3600).toFixed(1)} jam*`;

      await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      return;
    }

    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Perintah ini hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
    if (!isAdmin && !isOwner(ctx.senderId)) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang memiliki akses.', { quotedMessageId: ctx.id });
      return;
    }

    // 2. /cloneconfig
    if (cmd === 'cloneconfig') {
      const targetGroup = args[0];
      if (!targetGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan JID grup target. Contoh: `/cloneconfig 123456789@g.us`', { quotedMessageId: ctx.id });
        return;
      }

      try {
        const sourceConfig = await prisma.groupConfig.findUnique({ where: { groupId: ctx.chatId } });
        if (!sourceConfig) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Konfigurasi grup asal tidak ditemukan.', { quotedMessageId: ctx.id });
          return;
        }

        await prisma.groupConfig.upsert({
          where: { groupId: targetGroup },
          create: {
            groupId: targetGroup,
            prefix: sourceConfig.prefix,
            botEnabled: sourceConfig.botEnabled,
            featuresJson: sourceConfig.featuresJson
          },
          update: {
            prefix: sourceConfig.prefix,
            botEnabled: sourceConfig.botEnabled,
            featuresJson: sourceConfig.featuresJson
          }
        });

        await adapter.sendMessage(ctx.chatId, `✅ Konfigurasi berhasil dikloning ke grup *${targetGroup}*!`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal mengkloning konfigurasi: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 3. /approval
    if (cmd === 'approval') {
      const sub = args[0]?.toLowerCase().trim();
      const targetJid = args[1]?.trim();

      let queue = approvalQueue.get(ctx.chatId);
      if (!queue) {
        queue = new Set();
        approvalQueue.set(ctx.chatId, queue);
      }

      if (sub === 'list' || !sub) {
        if (queue.size === 0) {
          await adapter.sendMessage(ctx.chatId, 'ℹ️ Antrean persetujuan anggota baru kosong.', { quotedMessageId: ctx.id });
          return;
        }
        let msg = `⏳ *DAFTAR PERSETUJUAN ANGGOTA BARU* ⏳\n\n`;
        Array.from(queue).forEach((jid, idx) => {
          msg += `${idx + 1}. @${jid.split('@')[0]}\n`;
        });
        msg += `\nGunakan: \`/approval approve <user_jid>\` atau \`/approval reject <user_jid>\``;
        await adapter.sendMessage(ctx.chatId, msg, { mentions: Array.from(queue), quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'approve') {
        if (!targetJid) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan JID user.', { quotedMessageId: ctx.id });
          return;
        }
        queue.delete(targetJid);
        await adapter.sendMessage(ctx.chatId, `✅ Anggota @${targetJid.split('@')[0]} disetujui masuk grup!`, { mentions: [targetJid], quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'reject') {
        if (!targetJid) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan JID user.', { quotedMessageId: ctx.id });
          return;
        }
        queue.delete(targetJid);
        await adapter.sendMessage(ctx.chatId, `❌ Anggota @${targetJid.split('@')[0]} ditolak masuk grup.`, { mentions: [targetJid], quotedMessageId: ctx.id });
        return;
      }
      return;
    }

    // 4. /logmod
    if (cmd === 'logmod') {
      try {
        const infractions = await prisma.infractionLog.findMany({
          where: { groupId: ctx.chatId },
          take: 10,
          orderBy: { createdAt: 'desc' }
        });

        if (infractions.length === 0) {
          await adapter.sendMessage(ctx.chatId, 'ℹ️ Belum ada log moderasi di grup ini.', { quotedMessageId: ctx.id });
          return;
        }

        let msg = `📜 *LOG MODERASI TERBARU (10 TINDAKAN)* 📜\n\n`;
        infractions.forEach((inf, idx) => {
          const target = inf.userId.split('@')[0];
          const actionStr = (inf.action || 'infraction').toUpperCase();
          const reasonStr = inf.reason || '';
          msg += `${idx + 1}. [${inf.createdAt.toLocaleDateString()}] Admin @${inf.createdBy?.split('@')[0]} melakukan *${actionStr}* kepada @${target} (${reasonStr})\n`;
        });

        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal memuat log moderasi: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 5. /batchkick
    if (cmd === 'batchkick') {
      const days = parseInt(args[0]) || 30;
      await adapter.sendMessage(ctx.chatId, `⚠️ Menjalankan Batch Kick untuk anggota tidak aktif >${days} hari...\n\n(Tindakan disimulasikan sukses untuk keamanan)`, { quotedMessageId: ctx.id });
      return;
    }

    // 6. /footer
    if (cmd === 'footer') {
      const text = args.join(' ').trim();
      if (!text) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan teks footer baru. Contoh: `/footer Javas Bot`', { quotedMessageId: ctx.id });
        return;
      }

      await setGroupFeature(ctx.chatId, 'footer_text', text);
      await adapter.sendMessage(ctx.chatId, `✅ Footer bot di grup ini berhasil diubah menjadi: *"${text}"*`, { quotedMessageId: ctx.id });
      return;
    }
  }
}

const adminAdvancedCmd = new AdminAdvancedCommand();
registerCommand(
  ['ping', 'cloneconfig', 'approval', 'logmod', 'batchkick', 'footer'],
  adminAdvancedCmd
);
