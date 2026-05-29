import { Command, registerCommand, checkIfAdmin } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';
import { parseRelativeOrAbsoluteTime } from '../../utils/time-parser.js';

const DAYS_MAP: Record<string, number> = {
  'minggu': 0,
  'senin': 1,
  'selasa': 2,
  'rabu': 3,
  'kamis': 4,
  'jumat': 5,
  'sabtu': 6
};

const DAYS_REVERSE = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export class ScheduleSuiteCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    // ==========================================
    // REMINDERS: /remind, /remindgroup, /listremind, /delremind
    // ==========================================
    if (cmd === 'remind' || cmd === 'remindgroup' || cmd === 'listremind' || cmd === 'delremind') {
      if (cmd === 'remindgroup' && !ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command `/remindgroup` hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      if (cmd === 'remindgroup') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Otoritas ditolak. Hanya admin grup yang dapat membuat pengingat grup.', { quotedMessageId: ctx.id });
          return;
        }
      }

      if (cmd === 'remind' || cmd === 'remindgroup') {
        let timeStr = '';
        let message = '';

        // If the format starts with "besok" or "lusa", they take two tokens for time (e.g. "besok 07:00")
        const firstArg = args[0]?.toLowerCase();
        if (firstArg === 'besok' || firstArg === 'lusa') {
          timeStr = `${args[0]} ${args[1] || ''}`.trim();
          message = args.slice(2).join(' ').trim();
        } else {
          timeStr = args[0] || '';
          message = args.slice(1).join(' ').trim();
        }

        if (!timeStr || !message) {
          const eg = cmd === 'remind' ? '/remind 10m minum' : '/remindgroup besok 07:00 rapat';
          await adapter.sendMessage(ctx.chatId, `⚠️ Format salah. Contoh:\n👉 \`${eg}\``, { quotedMessageId: ctx.id });
          return;
        }

        const runAt = parseRelativeOrAbsoluteTime(timeStr);
        if (!runAt) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format waktu tidak valid. Gunakan format seperti: `10m`, `2h`, `1d`, `20:00`, `besok 07:00`, atau `lusa 14:30`.', { quotedMessageId: ctx.id });
          return;
        }

        const isGroupScope = cmd === 'remindgroup';
        const reminder = await prisma.reminder.create({
          data: {
            scope: isGroupScope ? 'group' : 'private',
            groupId: isGroupScope ? ctx.chatId : null,
            userId: ctx.senderId,
            message,
            runAt,
            status: 'pending'
          }
        });

        await adapter.sendMessage(
          ctx.chatId,
          `⏰ *Pengingat Berhasil Dibuat* ⏰\n\n` +
          `• Target: ${isGroupScope ? 'Grup ini' : 'Pribadi'}\n` +
          `• Waktu: *${runAt.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}*\n` +
          `• Pesan: "${message}"\n` +
          `• ID: \`${reminder.id.slice(0, 8)}\``,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      if (cmd === 'listremind') {
        const whereClause: any = { status: 'pending' };
        if (ctx.isGroup) {
          // In a group, show group reminders for this group AND user's private reminders
          whereClause.OR = [
            { userId: ctx.senderId, scope: 'private' },
            { groupId: ctx.chatId, scope: 'group' }
          ];
        } else {
          whereClause.userId = ctx.senderId;
          whereClause.scope = 'private';
        }

        const list = await prisma.reminder.findMany({
          where: whereClause,
          orderBy: { runAt: 'asc' }
        });

        if (list.length === 0) {
          await adapter.sendMessage(ctx.chatId, '📭 Tidak ada pengingat aktif/pending untuk Anda.', { quotedMessageId: ctx.id });
          return;
        }

        let resp = `⏰ *DAFTAR PENGINGAT AKTIF* ⏰\n\n`;
        list.forEach((r) => {
          const type = r.scope === 'group' ? '👥 Grup' : '👤 Pribadi';
          resp += `• *ID:* \`${r.id.slice(0, 8)}\` (${type})\n`;
          resp += `  Waktu: ${r.runAt.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}\n`;
          resp += `  Pesan: "${r.message}"\n\n`;
        });

        await adapter.sendMessage(ctx.chatId, resp.trim(), { quotedMessageId: ctx.id });
        return;
      }

      if (cmd === 'delremind') {
        const rid = args[0]?.trim();
        if (!rid) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/delremind <id>`', { quotedMessageId: ctx.id });
          return;
        }

        // Find reminder
        const reminders = await prisma.reminder.findMany({
          where: {
            id: { startsWith: rid }
          }
        });

        if (reminders.length === 0) {
          await adapter.sendMessage(ctx.chatId, '❌ Pengingat tidak ditemukan.', { quotedMessageId: ctx.id });
          return;
        }

        const reminder = reminders[0];
        const isOwnerOrCreator = reminder.userId === ctx.senderId;
        let canDelete = isOwnerOrCreator;

        if (!canDelete && reminder.scope === 'group' && reminder.groupId === ctx.chatId) {
          // If group reminder, group admin can delete it
          const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
          if (isAdmin) canDelete = true;
        }

        if (!canDelete) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Otoritas ditolak. Anda hanya bisa menghapus pengingat buatan sendiri.', { quotedMessageId: ctx.id });
          return;
        }

        await prisma.reminder.delete({
          where: { id: reminder.id }
        });

        await adapter.sendMessage(ctx.chatId, `✅ Pengingat dengan ID \`${reminder.id.slice(0, 8)}\` berhasil dihapus.`, { quotedMessageId: ctx.id });
        return;
      }
    }

    // ==========================================
    // SCHEDULE / JADWAL: /jadwal
    // ==========================================
    if (cmd === 'jadwal') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      const sub = args[0]?.toLowerCase();

      if (sub === 'add') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Otoritas ditolak. Hanya admin grup yang dapat menambah jadwal.', { quotedMessageId: ctx.id });
          return;
        }

        const dayName = args[1]?.toLowerCase();
        const timeVal = args[2];
        const subject = args.slice(3).join(' ').trim();

        if (!dayName || !timeVal || !subject || DAYS_MAP[dayName] === undefined) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh:\n👉 `/jadwal add senin 07:00 Matematika`', { quotedMessageId: ctx.id });
          return;
        }

        const timeRegex = /^\d{2}[:.]\d{2}$/;
        if (!timeRegex.test(timeVal)) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format jam salah. Gunakan format HH:MM (contoh: 07:00).', { quotedMessageId: ctx.id });
          return;
        }

        const schedule = await prisma.schedule.create({
          data: {
            groupId: ctx.chatId,
            dayOfWeek: DAYS_MAP[dayName],
            time: timeVal.replace('.', ':'),
            subject
          }
        });

        await adapter.sendMessage(ctx.chatId, `✅ Jadwal berhasil ditambahkan!\nHari: *${DAYS_REVERSE[schedule.dayOfWeek]}*\nJam: *${schedule.time}*\nMata Pelajaran/Agenda: *${schedule.subject}*\nID: \`${schedule.id.slice(0, 8)}\``, { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'del') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Otoritas ditolak. Hanya admin grup yang dapat menghapus jadwal.', { quotedMessageId: ctx.id });
          return;
        }

        const sid = args[1]?.trim();
        if (!sid) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/jadwal del <id>`', { quotedMessageId: ctx.id });
          return;
        }

        const schedules = await prisma.schedule.findMany({
          where: { groupId: ctx.chatId, id: { startsWith: sid } }
        });

        if (schedules.length === 0) {
          await adapter.sendMessage(ctx.chatId, '❌ Jadwal tidak ditemukan.', { quotedMessageId: ctx.id });
          return;
        }

        await prisma.schedule.delete({
          where: { id: schedules[0].id }
        });

        await adapter.sendMessage(ctx.chatId, `✅ Jadwal dengan ID \`${schedules[0].id.slice(0, 8)}\` berhasil dihapus.`, { quotedMessageId: ctx.id });
        return;
      }

      // Display schedules
      let targetDay: number | null = null;
      let title = '📅 *JADWAL GRUP* 📅';

      if (sub === 'hariini' || sub === 'today') {
        targetDay = new Date().getDay();
        title = `📅 *JADWAL HARI INI (${DAYS_REVERSE[targetDay]})* 📅`;
      } else if (sub === 'besok' || sub === 'tomorrow') {
        targetDay = (new Date().getDay() + 1) % 7;
        title = `📅 *JADWAL BESOK (${DAYS_REVERSE[targetDay]})* 📅`;
      } else if (sub && DAYS_MAP[sub] !== undefined) {
        targetDay = DAYS_MAP[sub];
        title = `📅 *JADWAL HARI ${DAYS_REVERSE[targetDay].toUpperCase()}* 📅`;
      }

      const query: any = { groupId: ctx.chatId };
      if (targetDay !== null) {
        query.dayOfWeek = targetDay;
      }

      const list = await prisma.schedule.findMany({
        where: query,
        orderBy: [
          { dayOfWeek: 'asc' },
          { time: 'asc' }
        ]
      });

      if (list.length === 0) {
        await adapter.sendMessage(ctx.chatId, `📭 Tidak ada jadwal terdaftar untuk ${targetDay !== null ? 'hari ini/besok' : 'grup ini'}.`, { quotedMessageId: ctx.id });
        return;
      }

      let resp = `${title}\n\n`;
      if (targetDay !== null) {
        list.forEach(s => {
          resp += `• [${s.time}] *${s.subject}* (ID: \`${s.id.slice(0, 8)}\`)\n`;
        });
      } else {
        // Group by day of week
        const grouped: Record<number, typeof list> = {};
        list.forEach(s => {
          if (!grouped[s.dayOfWeek]) grouped[s.dayOfWeek] = [];
          grouped[s.dayOfWeek].push(s);
        });

        for (let i = 0; i < 7; i++) {
          if (grouped[i]) {
            resp += `*=== ${DAYS_REVERSE[i]} ===*\n`;
            grouped[i].forEach(s => {
              resp += `• [${s.time}] *${s.subject}* (ID: \`${s.id.slice(0, 8)}\`)\n`;
            });
            resp += `\n`;
          }
        }
      }

      await adapter.sendMessage(ctx.chatId, resp.trim(), { quotedMessageId: ctx.id });
      return;
    }

    // ==========================================
    // TASKS / TUGAS: /tugas
    // ==========================================
    if (cmd === 'tugas') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      const sub = args[0]?.toLowerCase();

      if (sub === 'add') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Otoritas ditolak. Hanya admin grup yang dapat menambah tugas.', { quotedMessageId: ctx.id });
          return;
        }

        // We need: /tugas add <deadline> <deskripsi>
        // Example: /tugas add "besok 23:59" Kerjakan PR
        // Let's parse arguments. If they use double quotes for deadline, we can parse it nicely.
        let deadlineStr = '';
        let description = '';

        const fullText = args.join(' ');
        const quoteMatch = fullText.match(/^"([^"]+)"\s+(.+)$/);
        if (quoteMatch) {
          deadlineStr = quoteMatch[1];
          description = quoteMatch[2].trim();
        } else {
          // Fallback if no quotes: first arg is deadline (single word like "10m" or "1d"), rest is desc
          deadlineStr = args[0];
          description = args.slice(1).join(' ').trim();
        }

        if (!deadlineStr || !description) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh:\n👉 `/tugas add "besok 23:59" Buku Cetak IPA` atau `/tugas add 3d Laporan Praktikum`', { quotedMessageId: ctx.id });
          return;
        }

        const deadline = parseRelativeOrAbsoluteTime(deadlineStr);
        if (!deadline) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format deadline tidak valid. Gunakan format seperti: `10m`, `1d`, `20:00`, `"besok 23:59"`.', { quotedMessageId: ctx.id });
          return;
        }

        const task = await prisma.task.create({
          data: {
            groupId: ctx.chatId,
            userId: ctx.senderId,
            description,
            deadline,
            status: 'pending'
          }
        });

        await adapter.sendMessage(
          ctx.chatId,
          `📝 *Tugas Berhasil Ditambahkan* 📝\n\n` +
          `• Deskripsi: *${description}*\n` +
          `• Tenggat: *${deadline.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}*\n` +
          `• ID: \`${task.id.slice(0, 8)}\``,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      if (sub === 'done') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Otoritas ditolak. Hanya admin grup yang dapat menandai tugas selesai.', { quotedMessageId: ctx.id });
          return;
        }

        const tid = args[1]?.trim();
        if (!tid) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/tugas done <id>`', { quotedMessageId: ctx.id });
          return;
        }

        const tasks = await prisma.task.findMany({
          where: { groupId: ctx.chatId, id: { startsWith: tid } }
        });

        if (tasks.length === 0) {
          await adapter.sendMessage(ctx.chatId, '❌ Tugas tidak ditemukan.', { quotedMessageId: ctx.id });
          return;
        }

        await prisma.task.update({
          where: { id: tasks[0].id },
          data: { status: 'done' }
        });

        await adapter.sendMessage(ctx.chatId, `✅ Tugas *"${tasks[0].description}"* ditandai selesai! 🎉`, { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'del') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Otoritas ditolak. Hanya admin grup yang dapat menghapus tugas.', { quotedMessageId: ctx.id });
          return;
        }

        const tid = args[1]?.trim();
        if (!tid) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/tugas del <id>`', { quotedMessageId: ctx.id });
          return;
        }

        const tasks = await prisma.task.findMany({
          where: { groupId: ctx.chatId, id: { startsWith: tid } }
        });

        if (tasks.length === 0) {
          await adapter.sendMessage(ctx.chatId, '❌ Tugas tidak ditemukan.', { quotedMessageId: ctx.id });
          return;
        }

        await prisma.task.delete({
          where: { id: tasks[0].id }
        });

        await adapter.sendMessage(ctx.chatId, `✅ Tugas *"${tasks[0].description}"* berhasil dihapus.`, { quotedMessageId: ctx.id });
        return;
      }

      // Display pending tasks
      const list = await prisma.task.findMany({
        where: { groupId: ctx.chatId, status: 'pending' },
        orderBy: { deadline: 'asc' }
      });

      if (list.length === 0) {
        await adapter.sendMessage(ctx.chatId, '🎉 Tidak ada tugas/deadline pending di grup ini. Santai dulu!', { quotedMessageId: ctx.id });
        return;
      }

      let resp = `📝 *DAFTAR TUGAS & DEADLINE GRUP* 📝\n\n`;
      list.forEach((t, i) => {
        const dlStr = t.deadline
          ? t.deadline.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
          : 'Tanpa tenggat';
        resp += `${i + 1}. *${t.description}*\n`;
        resp += `   • Tenggat: ${dlStr}\n`;
        resp += `   • ID: \`${t.id.slice(0, 8)}\`\n\n`;
      });

      await adapter.sendMessage(ctx.chatId, resp.trim(), { quotedMessageId: ctx.id });
      return;
    }

    // ==========================================
    // BIRTHDAYS / ULTAH: /ultah
    // ==========================================
    if (cmd === 'ultah') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      const sub = args[0]?.toLowerCase();

      if (sub === 'add') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Otoritas ditolak. Hanya admin grup yang dapat menambah info ulang tahun.', { quotedMessageId: ctx.id });
          return;
        }

        const mention = args[1];
        const dateStr = args[2]; // e.g. 12-08

        if (!mention || !dateStr) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/ultah add @user 12-08`', { quotedMessageId: ctx.id });
          return;
        }

        const targetJid = mention.includes('@') ? mention.replace('@', '').trim() + '@s.whatsapp.net' : mention.trim();
        const dateRegex = /^\d{2}-\d{2}$/;
        if (!dateRegex.test(dateStr)) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format tanggal lahir salah. Gunakan format DD-MM (contoh: 12-08 untuk 12 Agustus).', { quotedMessageId: ctx.id });
          return;
        }

        // Upsert birthday (one birthday per user per group)
        const existing = await prisma.birthday.findFirst({
          where: { groupId: ctx.chatId, userId: targetJid }
        });

        if (existing) {
          await prisma.birthday.update({
            where: { id: existing.id },
            data: { date: dateStr }
          });
        } else {
          await prisma.birthday.create({
            data: { groupId: ctx.chatId, userId: targetJid, date: dateStr }
          });
        }

        await adapter.sendMessage(ctx.chatId, `✅ Berhasil mencatat ulang tahun untuk @${targetJid.split('@')[0]} pada tanggal *${dateStr}*!`, { quotedMessageId: ctx.id, mentions: [targetJid] });
        return;
      }

      if (sub === 'del') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Otoritas ditolak. Hanya admin grup yang dapat menghapus info ulang tahun.', { quotedMessageId: ctx.id });
          return;
        }

        const mention = args[1];
        if (!mention) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/ultah del @user`', { quotedMessageId: ctx.id });
          return;
        }

        const targetJid = mention.includes('@') ? mention.replace('@', '').trim() + '@s.whatsapp.net' : mention.trim();
        const deleted = await prisma.birthday.deleteMany({
          where: { groupId: ctx.chatId, userId: targetJid }
        });

        if (deleted.count === 0) {
          await adapter.sendMessage(ctx.chatId, '❌ Data ulang tahun target tidak ditemukan.', { quotedMessageId: ctx.id });
          return;
        }

        await adapter.sendMessage(ctx.chatId, `✅ Berhasil menghapus info ulang tahun untuk @${targetJid.split('@')[0]}.`, { quotedMessageId: ctx.id, mentions: [targetJid] });
        return;
      }

      // List birthdays
      const list = await prisma.birthday.findMany({
        where: { groupId: ctx.chatId }
      });

      if (list.length === 0) {
        await adapter.sendMessage(ctx.chatId, '📭 Tidak ada data ulang tahun terdaftar di grup ini.', { quotedMessageId: ctx.id });
        return;
      }

      // Sort by MM-DD
      const sorted = list.sort((a, b) => {
        const [aDay, aMonth] = a.date.split('-').map(Number);
        const [bDay, bMonth] = b.date.split('-').map(Number);
        if (aMonth !== bMonth) return aMonth - bMonth;
        return aDay - bDay;
      });

      const months = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

      let resp = `🎂 *DAFTAR ULANG TAHUN ANGGOTA* 🎂\n\n`;
      const mentionsList: string[] = [];

      sorted.forEach(u => {
        const [day, month] = u.date.split('-').map(Number);
        const monthName = months[month] || 'Bulan';
        resp += `• @${u.userId.split('@')[0]} - *${day} ${monthName}*\n`;
        mentionsList.push(u.userId);
      });

      await adapter.sendMessage(ctx.chatId, resp.trim(), { mentions: mentionsList });
      return;
    }
  }
}

const schedSuite = new ScheduleSuiteCommand();
registerCommand(
  ['remind', 'remindgroup', 'listremind', 'delremind', 'jadwal', 'tugas', 'ultah'],
  schedSuite
);
