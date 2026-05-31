import { Command, registerCommand, checkIfAdmin } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';
import { isUniqueConstraintError } from '../../utils/prisma-error.util.js';

export async function updateGroupUserStats(groupId: string, userId: string) {
  const now = new Date();
  try {
    // 1. Try to update
    const updated = await prisma.groupUserStats.updateMany({
      where: { groupId, userId },
      data: {
        messageCount: {
          increment: 1
        },
        lastActiveAt: now
      }
    });

    // 2. If not found, try to create
    if (updated.count === 0) {
      try {
        await prisma.groupUserStats.create({
          data: {
            groupId,
            userId,
            messageCount: 1,
            lastActiveAt: now
          }
        });
      } catch (createErr) {
        if (isUniqueConstraintError(createErr)) {
          // 3. Update on conflict
          await prisma.groupUserStats.update({
            where: {
              groupId_userId: {
                groupId,
                userId
              }
            },
            data: {
              messageCount: {
                increment: 1
              },
              lastActiveAt: now
            }
          });
        } else {
          throw createErr;
        }
      }
    }
  } catch (err) {
    console.error('[Stats Update Fail]', err);
  }
}

export async function updateGroupUserCommandStats(groupId: string, userId: string) {
  const now = new Date();
  try {
    // 1. Try to update
    const updated = await prisma.groupUserStats.updateMany({
      where: { groupId, userId },
      data: {
        commandCount: {
          increment: 1
        },
        lastActiveAt: now
      }
    });

    // 2. If not found, try to create
    if (updated.count === 0) {
      try {
        await prisma.groupUserStats.create({
          data: {
            groupId,
            userId,
            commandCount: 1,
            lastActiveAt: now
          }
        });
      } catch (createErr) {
        if (isUniqueConstraintError(createErr)) {
          // 3. Update on conflict
          await prisma.groupUserStats.update({
            where: {
              groupId_userId: {
                groupId,
                userId
              }
            },
            data: {
              commandCount: {
                increment: 1
              },
              lastActiveAt: now
            }
          });
        } else {
          throw createErr;
        }
      }
    }
  } catch (err) {
    console.error('[Command Stats Update Fail]', err);
  }
}

export class GroupStatsCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const cmd = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    // --- 1. /topchat ---
    if (cmd === 'topchat' || cmd === 'topactive') {
      const [records, groupStats] = await Promise.all([
        prisma.customVariable.findMany({
          where: { groupId: ctx.chatId, key: 'message_count' }
        }),
        prisma.groupUserStats.findMany({
          where: { groupId: ctx.chatId }
        })
      ]);

      const userCounts = new Map<string, number>();
      records.forEach(r => {
        if (r.userId) {
          userCounts.set(r.userId, parseInt(r.value, 10) || 0);
        }
      });
      groupStats.forEach(s => {
        const existing = userCounts.get(s.userId) || 0;
        userCounts.set(s.userId, existing + s.messageCount);
      });

      const sorted = Array.from(userCounts.entries())
        .map(([userId, count]) => ({ userId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

      if (sorted.length === 0) {
        await adapter.sendMessage(ctx.chatId, '📭 Belum ada data keaktifan chat di grup ini.', { quotedMessageId: ctx.id });
        return;
      }

      let msg = `🏆 *DAFTAR TOP CHATTER GRUP* 🏆\n\n`;
      const mentions: string[] = [];

      sorted.forEach((item, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
        const mention = `@${item.userId.split('@')[0]}`;
        mentions.push(item.userId);
        msg += `${medal} *#${index + 1}* ${mention} — *${item.count}* pesan\n`;
      });

      await adapter.sendMessage(ctx.chatId, msg, {
        quotedMessageId: ctx.id,
        mentions
      });
      return;
    }

    // --- 2. /topcmd ---
    if (cmd === 'topcmd') {
      const logs = await prisma.usageLog.findMany({
        where: { groupId: ctx.chatId }
      });

      const cmdCounts: Record<string, number> = {};
      logs.forEach(log => {
        const feat = log.feature || 'general';
        cmdCounts[feat] = (cmdCounts[feat] || 0) + 1;
      });

      const sortedCmds = Object.entries(cmdCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      if (sortedCmds.length === 0) {
        await adapter.sendMessage(ctx.chatId, '📭 Belum ada data penggunaan command di grup ini.', { quotedMessageId: ctx.id });
        return;
      }

      let msg = `📊 *TOP FITUR/COMMAND DI GRUP* 📊\n\n`;
      sortedCmds.forEach(([feat, count], index) => {
        const num = index + 1;
        msg += `${num}. *${feat.toUpperCase()}* — digunakan *${count}* kali\n`;
      });

      await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      return;
    }

    // --- 3. /inactive ---
    if (cmd === 'inactive') {
      const socket = (adapter as any).sock;
      if (!socket) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Socket WhatsApp tidak tersedia.', { quotedMessageId: ctx.id });
        return;
      }

      const limitArg = args[0]?.toLowerCase().trim();
      const limitDays = limitArg?.includes('30') ? 30 : 7;
      const cutoff = Date.now() - limitDays * 24 * 60 * 60 * 1000;

      let metadata;
      try {
        metadata = await socket.groupMetadata(ctx.chatId);
      } catch (err) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Gagal mengambil metadata grup.', { quotedMessageId: ctx.id });
        return;
      }

      const participants = metadata.participants.map((p: any) => p.id);

      const [lastMessageTimes, groupStats] = await Promise.all([
        prisma.customVariable.findMany({
          where: {
            groupId: ctx.chatId,
            key: 'last_message_time'
          }
        }),
        prisma.groupUserStats.findMany({
          where: { groupId: ctx.chatId }
        })
      ]);

      const timeMap = new Map<string, number>();
      lastMessageTimes.forEach(record => {
        timeMap.set(record.userId!, parseInt(record.value, 10) || 0);
      });
      groupStats.forEach(s => {
        const existingTime = timeMap.get(s.userId) || 0;
        const statsTime = s.lastActiveAt.getTime();
        timeMap.set(s.userId, Math.max(existingTime, statsTime));
      });

      const inactiveUsers: string[] = [];
      participants.forEach((userId: string) => {
        if (userId === socket.user?.id) return; // skip bot

        const lastTime = timeMap.get(userId);
        if (!lastTime || lastTime < cutoff) {
          inactiveUsers.push(userId);
        }
      });

      if (inactiveUsers.length === 0) {
        await adapter.sendMessage(ctx.chatId, `🎉 Semua anggota aktif dalam ${limitDays} hari terakhir!`, { quotedMessageId: ctx.id });
        return;
      }

      let msg = `💤 *ANGGOTA INAKTIF (≥ ${limitDays} HARI)* 💤\n`;
      msg += `Total: *${inactiveUsers.length}* dari *${participants.length}* anggota.\n\n`;

      const displayList = inactiveUsers.slice(0, 50);
      displayList.forEach((userId, i) => {
        msg += `${i + 1}. @${userId.split('@')[0]}\n`;
      });

      if (inactiveUsers.length > 50) {
        msg += `\n_...dan ${inactiveUsers.length - 50} anggota lainnya._`;
      }

      await adapter.sendMessage(ctx.chatId, msg, {
        quotedMessageId: ctx.id,
        mentions: displayList
      });
      return;
    }

    // --- 4. /grouphealth ---
    if (cmd === 'grouphealth') {
      const socket = (adapter as any).sock;
      let totalMembers = 0;
      if (socket) {
        try {
          const meta = await socket.groupMetadata(ctx.chatId);
          totalMembers = meta.participants.length;
        } catch {}
      }

      const [warningsCount, infractionCount, totalMsgsCount, groupStats] = await Promise.all([
        prisma.warning.count({ where: { groupId: ctx.chatId } }),
        prisma.infractionLog.count({ where: { groupId: ctx.chatId } }),
        prisma.customVariable.findMany({ where: { groupId: ctx.chatId, key: 'message_count' } }),
        prisma.groupUserStats.findMany({ where: { groupId: ctx.chatId } })
      ]);

      const userCounts = new Map<string, number>();
      totalMsgsCount.forEach(r => {
        if (r.userId) {
          userCounts.set(r.userId, parseInt(r.value, 10) || 0);
        }
      });
      groupStats.forEach(s => {
        const existing = userCounts.get(s.userId) || 0;
        userCounts.set(s.userId, existing + s.messageCount);
      });

      const sumMsgs = Array.from(userCounts.values()).reduce((acc, count) => acc + count, 0);
      const activeMembers = userCounts.size;

      // Math logic for health
      let score = 100;
      score -= warningsCount * 4;
      score -= infractionCount * 8;
      
      const engagementRatio = totalMembers > 0 ? (activeMembers / totalMembers) * 100 : 0;
      
      if (engagementRatio > 50) score += 10;
      else if (engagementRatio < 10) score -= 15;

      score = Math.max(0, Math.min(100, score));

      let healthStatus = '🟢 SEHAT';
      if (score < 50) healthStatus = '🔴 SANGAT KURANG SEHAT / BISING';
      else if (score < 75) healthStatus = '🟡 CUKUP SEHAT';

      let msg = `🏥 *KESEHATAN GRUP (GROUP HEALTH)* 🏥\n\n`;
      msg += `• Status Kesehatan: *${healthStatus}*\n`;
      msg += `• Skor Kesehatan: *${score}/100*\n\n`;
      msg += `📊 *Detail Parameter:*\n`;
      msg += `• Total Pesan Terdata: *${sumMsgs}* pesan\n`;
      msg += `• Anggota Aktif Chat: *${activeMembers}* anggota\n`;
      msg += `• Rasio Keaktifan: *${engagementRatio.toFixed(1)}%*\n`;
      msg += `• Peringatan Aktif: *${warningsCount}* peringatan\n`;
      msg += `• Total Tindakan Moderasi: *${infractionCount}* kali\n`;

      await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      return;
    }

    // --- 5. /weeklyreport ---
    if (cmd === 'weeklyreport') {
      const [records, groupStats] = await Promise.all([
        prisma.customVariable.findMany({
          where: { groupId: ctx.chatId, key: 'message_count' }
        }),
        prisma.groupUserStats.findMany({
          where: { groupId: ctx.chatId }
        })
      ]);

      const userCounts = new Map<string, number>();
      records.forEach(r => {
        if (r.userId) {
          userCounts.set(r.userId, parseInt(r.value, 10) || 0);
        }
      });
      groupStats.forEach(s => {
        const existing = userCounts.get(s.userId) || 0;
        userCounts.set(s.userId, existing + s.messageCount);
      });

      const sorted = Array.from(userCounts.entries())
        .map(([userId, count]) => ({ userId, count }))
        .sort((a, b) => b.count - a.count);

      const topChatter = sorted[0];
      const sumMsgs = sorted.reduce((acc, r) => acc + r.count, 0);

      const warningsCount = await prisma.warning.count({
        where: {
          groupId: ctx.chatId,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
      });

      let reportMsg = `📅 *LAPORAN MINGGUAN KELAS / GRUP* 📅\n\n`;
      reportMsg += `• Total Pesan (Minggu Ini): *${sumMsgs}* pesan\n`;
      reportMsg += `• Anggota Berkontribusi: *${sorted.length}* warga\n`;
      if (topChatter) {
        reportMsg += `• Top Chatter: @${topChatter.userId.split('@')[0]} (*${topChatter.count}* pesan)\n`;
      }
      reportMsg += `• Peringatan Dikeluarkan: *${warningsCount}* kali\n\n`;
      reportMsg += `Semoga grup tetap kondusif, produktif, dan menyenangkan!`;

      await adapter.sendMessage(ctx.chatId, reportMsg, {
        quotedMessageId: ctx.id,
        mentions: topChatter ? [topChatter.userId] : []
      });
      return;
    }

    // --- 6. /groupstats ---
    if (cmd === 'groupstats') {
      const [aliases, schedules, tasks, messageRecords, groupStats] = await Promise.all([
        prisma.commandAlias.count({ where: { groupId: ctx.chatId } }),
        prisma.schedule.count({ where: { groupId: ctx.chatId } }),
        prisma.task.count({ where: { groupId: ctx.chatId, status: 'pending' } }),
        prisma.customVariable.findMany({ where: { groupId: ctx.chatId, key: 'message_count' } }),
        prisma.groupUserStats.findMany({ where: { groupId: ctx.chatId } })
      ]);

      const userCounts = new Map<string, number>();
      messageRecords.forEach(r => {
        if (r.userId) {
          userCounts.set(r.userId, parseInt(r.value, 10) || 0);
        }
      });
      groupStats.forEach(s => {
        const existing = userCounts.get(s.userId) || 0;
        userCounts.set(s.userId, existing + s.messageCount);
      });

      const sumMsgs = Array.from(userCounts.values()).reduce((acc, count) => acc + count, 0);
      const activeUsersCount = userCounts.size;

      let msg = `📊 *STATISTIK PENGGUNAAN GRUP* 📊\n\n`;
      msg += `• Total Pesan Terdeteksi: *${sumMsgs}* pesan\n`;
      msg += `• Total Chatter Aktif: *${activeUsersCount}* warga\n`;
      msg += `• Custom Alias Aktif: *${aliases}* alias\n`;
      msg += `• Pelajaran Terjadwal: *${schedules}* pelajaran\n`;
      msg += `• Tugas Kelas Pending: *${tasks}* tugas\n\n`;
      msg += `Gunakan \`/topchat\` untuk melihat papan keaktifan chatter, atau \`/topcmd\` untuk statistik command.`;

      await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      return;
    }
  }
}

const groupStatsCmd = new GroupStatsCommand();
registerCommand(['groupstats', 'topchat', 'topactive', 'topcmd', 'inactive', 'grouphealth', 'weeklyreport'], groupStatsCmd);

