import { Command, registerCommand, checkIfAdmin } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';
import { stateStore } from '../../services/state/state-store.js';

export class ReputationCommand implements Command {
  private getTrustLevel(rep: number): string {
    if (rep < -5) return 'Restricted 🚫';
    if (rep >= 50) return 'VIP 👑';
    if (rep >= 30) return 'Senior 🎖️';
    if (rep >= 15) return 'Trusted ⭐';
    if (rep >= 5) return 'Active ⚡';
    return 'New 🔰';
  }

  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const cmd = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    // --- 1. /rep @user or /rep (show own) ---
    if (cmd === 'rep') {
      const rawUser = args[0];
      
      // If no args, show own reputation and trust level
      if (!rawUser) {
        const repVar = await prisma.customVariable.findUnique({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId,
              userId: ctx.senderId,
              key: 'reputation'
            }
          }
        });

        const rep = repVar ? parseInt(repVar.value, 10) || 0 : 0;
        const trust = this.getTrustLevel(rep);

        const mention = `@${ctx.senderId.split('@')[0]}`;
        let msg = `🛡️ *REPUTASI WARGA* 🛡️\n\n`;
        msg += `👤 Warga: ${mention}\n`;
        msg += `⭐ Reputasi: *${rep}* poin\n`;
        msg += `🔰 Level Kepercayaan: *${trust}*`;

        await adapter.sendMessage(ctx.chatId, msg, {
          quotedMessageId: ctx.id,
          mentions: [ctx.senderId]
        });
        return;
      }

      // If repping someone
      const targetUserId = rawUser.includes('@')
        ? rawUser.replace(/[@\s]/g, '').trim() + '@s.whatsapp.net'
        : rawUser.trim() + '@s.whatsapp.net';

      if (targetUserId === ctx.senderId) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Kamu tidak bisa memberikan reputasi ke dirimu sendiri.', { quotedMessageId: ctx.id });
        return;
      }

      // Check cooldown (1 hour per target)
      const cooldownKey = `rep:cooldown:${ctx.chatId}:${ctx.senderId}:${targetUserId}`;
      const isCooldown = await stateStore.get(cooldownKey);
      if (isCooldown) {
        await adapter.sendMessage(
          ctx.chatId,
          '⏳ Kamu baru saja berinteraksi dengan reputasi pengguna ini. Silakan tunggu 1 jam sebelum memberikan reputasi lagi.',
          { quotedMessageId: ctx.id }
        );
        return;
      }

      // Get target rep
      const repVar = await prisma.customVariable.findUnique({
        where: {
          groupId_userId_key: {
            groupId: ctx.chatId,
            userId: targetUserId,
            key: 'reputation'
          }
        }
      });

      const currentRep = repVar ? parseInt(repVar.value, 10) || 0 : 0;
      const newRep = currentRep + 1;

      await prisma.customVariable.upsert({
        where: {
          groupId_userId_key: {
            groupId: ctx.chatId,
            userId: targetUserId,
            key: 'reputation'
          }
        },
        create: {
          groupId: ctx.chatId,
          userId: targetUserId,
          key: 'reputation',
          value: String(newRep)
        },
        update: {
          value: String(newRep)
        }
      });

      // Set cooldown
      await stateStore.set(cooldownKey, true, 3600);

      const mentionSender = `@${ctx.senderId.split('@')[0]}`;
      const mentionTarget = `@${targetUserId.split('@')[0]}`;
      const trust = this.getTrustLevel(newRep);

      await adapter.sendMessage(
        ctx.chatId,
        `✅ ${mentionSender} memberikan *+1 reputasi* ke ${mentionTarget}.\n⭐ Reputasi Sekarang: *${newRep}* poin\n🔰 Level Kepercayaan: *${trust}*`,
        {
          quotedMessageId: ctx.id,
          mentions: [ctx.senderId, targetUserId]
        }
      );
      return;
    }

    // --- 2. /-rep @user ---
    if (cmd === '-rep') {
      const rawUser = args[0];
      if (!rawUser) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan pengguna yang ingin dikurangi reputasinya. Contoh: `/-rep @user`', { quotedMessageId: ctx.id });
        return;
      }

      const targetUserId = rawUser.includes('@')
        ? rawUser.replace(/[@\s]/g, '').trim() + '@s.whatsapp.net'
        : rawUser.trim() + '@s.whatsapp.net';

      if (targetUserId === ctx.senderId) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Kamu tidak bisa mengurangi reputasi dirimu sendiri.', { quotedMessageId: ctx.id });
        return;
      }

      // Check cooldown (1 hour per target)
      const cooldownKey = `rep:cooldown:${ctx.chatId}:${ctx.senderId}:${targetUserId}`;
      const isCooldown = await stateStore.get(cooldownKey);
      if (isCooldown) {
        await adapter.sendMessage(
          ctx.chatId,
          '⏳ Kamu baru saja berinteraksi dengan reputasi pengguna ini. Silakan tunggu 1 jam sebelum memberikan/mengurangi reputasi lagi.',
          { quotedMessageId: ctx.id }
        );
        return;
      }

      // Get target rep
      const repVar = await prisma.customVariable.findUnique({
        where: {
          groupId_userId_key: {
            groupId: ctx.chatId,
            userId: targetUserId,
            key: 'reputation'
          }
        }
      });

      const currentRep = repVar ? parseInt(repVar.value, 10) || 0 : 0;
      const newRep = currentRep - 1;

      await prisma.customVariable.upsert({
        where: {
          groupId_userId_key: {
            groupId: ctx.chatId,
            userId: targetUserId,
            key: 'reputation'
          }
        },
        create: {
          groupId: ctx.chatId,
          userId: targetUserId,
          key: 'reputation',
          value: String(newRep)
        },
        update: {
          value: String(newRep)
        }
      });

      // Set cooldown
      await stateStore.set(cooldownKey, true, 3600);

      const mentionSender = `@${ctx.senderId.split('@')[0]}`;
      const mentionTarget = `@${targetUserId.split('@')[0]}`;
      const trust = this.getTrustLevel(newRep);

      await adapter.sendMessage(
        ctx.chatId,
        `⚠️ ${mentionSender} memberikan *-1 reputasi* ke ${mentionTarget}.\n⭐ Reputasi Sekarang: *${newRep}* poin\n🔰 Level Kepercayaan: *${trust}*`,
        {
          quotedMessageId: ctx.id,
          mentions: [ctx.senderId, targetUserId]
        }
      );
      return;
    }

    // --- 3. /toprep ---
    if (cmd === 'toprep') {
      const records = await prisma.customVariable.findMany({
        where: { groupId: ctx.chatId, key: 'reputation' }
      });

      const sorted = records
        .map(r => ({ userId: r.userId!, rep: parseInt(r.value, 10) || 0 }))
        .sort((a, b) => b.rep - a.rep)
        .slice(0, 10);

      if (sorted.length === 0) {
        await adapter.sendMessage(ctx.chatId, '📭 Belum ada data papan reputasi di grup ini.', { quotedMessageId: ctx.id });
        return;
      }

      let msg = `🏆 *PAPAN PERINGKAT REPUTASI WARGA* 🏆\n\n`;
      const mentions: string[] = [];

      sorted.forEach((item, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
        const mention = `@${item.userId.split('@')[0]}`;
        mentions.push(item.userId);
        const trust = this.getTrustLevel(item.rep);
        msg += `${medal} *#${index + 1}* ${mention}\n   └ Reputasi: *${item.rep}* poin | *${trust}*\n`;
      });

      await adapter.sendMessage(ctx.chatId, msg, {
        quotedMessageId: ctx.id,
        mentions
      });
      return;
    }

    // --- 4. /trustlevel ---
    if (cmd === 'trustlevel') {
      let trustHelp = `🔰 *SISTEM LEVEL KEPERCAYAAN (TRUST LEVEL)* 🔰\n\n`;
      trustHelp += `Setiap warga memiliki Level Kepercayaan berdasarkan total poin reputasi yang didapatkan dari warga lain:\n\n`;
      trustHelp += `• 👑 *VIP*: ≥ 50 poin\n`;
      trustHelp += `• 🎖️ *Senior*: ≥ 30 poin\n`;
      trustHelp += `• ⭐ *Trusted*: ≥ 15 poin\n`;
      trustHelp += `• ⚡ *Active*: ≥ 5 poin\n`;
      trustHelp += `• 🔰 *New*: ≥ 0 poin\n`;
      trustHelp += `• 🚫 *Restricted*: < -5 poin (di bawah batas minimum)\n\n`;
      trustHelp += `💡 Cara meningkatkan reputasi: Mintalah warga lain untuk mengetik \`/rep @kamu\` jika kamu membantu mereka di grup!`;

      await adapter.sendMessage(ctx.chatId, trustHelp, { quotedMessageId: ctx.id });
      return;
    }

    // --- 5. /audit @user ---
    if (cmd === 'audit') {
      const rawUser = args[0];
      if (!rawUser) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan pengguna yang ingin diaudit. Contoh: `/audit @user`', { quotedMessageId: ctx.id });
        return;
      }

      const targetUserId = rawUser.includes('@')
        ? rawUser.replace(/[@\s]/g, '').trim() + '@s.whatsapp.net'
        : rawUser.trim() + '@s.whatsapp.net';

      const [warnings, infractionLogs, repVar, economy] = await Promise.all([
        prisma.warning.count({ where: { groupId: ctx.chatId, userId: targetUserId } }),
        prisma.infractionLog.findMany({ where: { groupId: ctx.chatId, userId: targetUserId }, take: 5, orderBy: { createdAt: 'desc' } }),
        prisma.customVariable.findUnique({ where: { groupId_userId_key: { groupId: ctx.chatId, userId: targetUserId, key: 'reputation' } } }),
        prisma.userEconomy.findUnique({ where: { userId: targetUserId } })
      ]);

      const rep = repVar ? parseInt(repVar.value, 10) || 0 : 0;
      const trust = this.getTrustLevel(rep);

      const mentionTarget = `@${targetUserId.split('@')[0]}`;
      let msg = `🔍 *AUDIT WARGA: ${mentionTarget}* 🔍\n\n`;
      msg += `⭐ Reputasi: *${rep}* poin (${trust})\n`;
      msg += `📊 Level Ekonomi: *${economy?.level ?? 1}* (XP: ${economy?.xp ?? 0})\n`;
      msg += `💵 Saldo: *Rp ${economy?.balance?.toLocaleString('id-ID') ?? 0}*\n`;
      msg += `⚠️ Jumlah Peringatan: *${warnings}* peringatan\n\n`;
      
      msg += `🛑 *5 Riwayat Tindakan Moderasi Terakhir:*\n`;
      if (infractionLogs.length === 0) {
        msg += `- Bersih / Tidak ada riwayat pelanggaran.\n`;
      } else {
        infractionLogs.forEach((log, idx) => {
          msg += `${idx + 1}. *[${log.type.toUpperCase()}]* ${log.reason} (oleh ${log.createdBy || 'system'})\n`;
        });
      }

      await adapter.sendMessage(ctx.chatId, msg, {
        quotedMessageId: ctx.id,
        mentions: [targetUserId]
      });
      return;
    }
  }
}

const reputationCmd = new ReputationCommand();
registerCommand(['rep', '-rep', 'toprep', 'trustlevel', 'audit'], reputationCmd);
