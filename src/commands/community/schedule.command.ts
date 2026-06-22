import { normalizeJid } from '../../utils/jid.util.js';
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
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

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
    if (cmd === 'ultah' || cmd === 'birthday' || cmd === 'f039') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      const sub = args[0]?.toLowerCase();

      if (sub === 'card') {
        const mention = args[1];
        if (!mention) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/birthday card @user`', { quotedMessageId: ctx.id });
          return;
        }

        const targetJid = normalizeJid(mention);
        const cardText = `🎂🎉 *SELAMAT ULANG TAHUN* 🎉🎂\n\n` +
          `Kepada Yth. @${targetJid.split('@')[0]}!\n` +
          `Semoga panjang umur, sehat selalu, murah rezeki, dan segala cita-citanya tercapai. Amin! 🎈✨\n\n` +
          `🎈 *Best wishes from the group!* 🎈`;

        await adapter.sendMessage(ctx.chatId, cardText, {
          quotedMessageId: ctx.id,
          mentions: [targetJid]
        });
        return;
      }

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

        const targetJid = normalizeJid(mention);
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

        const targetJid = normalizeJid(mention);
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

    // ==========================================
    // RECURRING REMINDERS: /reminderulang (F041)
    // ==========================================
    if (cmd === 'reminderulang' || cmd === 'f041') {
      const sub = args[0]?.toLowerCase();
      if (sub === 'set') {
        const targetDay = args[1]?.toLowerCase();
        const timeVal = args[2];
        const msg = args.slice(3).join(' ').trim();

        if (!targetDay || !timeVal || !msg) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh:\n👉 `/reminderulang set senin 07:00 Rapat` atau `/reminderulang set daily 07:00 Minum obat`', { quotedMessageId: ctx.id });
          return;
        }

        const timeRegex = /^\d{2}[:.]\d{2}$/;
        if (!timeRegex.test(timeVal)) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format jam salah. Gunakan HH:MM (contoh: 07:00).', { quotedMessageId: ctx.id });
          return;
        }

        let interval = '';
        if (targetDay === 'daily') {
          interval = 'daily';
        } else if (DAYS_MAP[targetDay] !== undefined) {
          interval = `rrule:weekly:${DAYS_MAP[targetDay]}`;
        } else {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hari tidak valid. Gunakan `daily` atau nama hari (senin, selasa, dst).', { quotedMessageId: ctx.id });
          return;
        }

        const now = new Date();
        const [hour, min] = timeVal.split(':').map(Number);
        const runAt = new Date(now);
        runAt.setHours(hour, min, 0, 0);

        if (interval === 'daily') {
          if (runAt.getTime() <= now.getTime()) {
            runAt.setDate(runAt.getDate() + 1);
          }
        } else {
          const targetDayNum = DAYS_MAP[targetDay];
          const currentDayNum = now.getDay();
          let diff = targetDayNum - currentDayNum;
          if (diff < 0 || (diff === 0 && runAt.getTime() <= now.getTime())) {
            diff += 7;
          }
          runAt.setDate(runAt.getDate() + diff);
        }

        const messagePayload = JSON.stringify({
          recurring: true,
          interval,
          originalMessage: msg
        });

        const reminder = await prisma.reminder.create({
          data: {
            scope: ctx.isGroup ? 'group' : 'private',
            groupId: ctx.isGroup ? ctx.chatId : null,
            userId: ctx.senderId,
            message: messagePayload,
            runAt,
            status: 'pending'
          }
        });

        await adapter.sendMessage(
          ctx.chatId,
          `⏰ *Pengingat Berulang Berhasil Dibuat* ⏰\n\n` +
          `• Tipe: ${interval === 'daily' ? 'Setiap Hari' : 'Setiap ' + targetDay.toUpperCase()}\n` +
          `• Waktu Pertama: *${runAt.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}*\n` +
          `• Pesan: "${msg}"\n` +
          `• ID: \`${reminder.id.slice(0, 8)}\``,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      if (sub === 'list') {
        const whereClause: any = {
          status: 'pending',
          message: { startsWith: '{"recurring":true' }
        };
        if (ctx.isGroup) {
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
          await adapter.sendMessage(ctx.chatId, '📭 Tidak ada pengingat berulang aktif.', { quotedMessageId: ctx.id });
          return;
        }

        let resp = `⏰ *DAFTAR PENGINGAT BERULANG* ⏰\n\n`;
        list.forEach((r) => {
          try {
            const payload = JSON.parse(r.message);
            const type = r.scope === 'group' ? '👥 Grup' : '👤 Pribadi';
            const recurrenceText = payload.interval === 'daily' ? 'Setiap Hari' : `Setiap ${DAYS_REVERSE[parseInt(payload.interval.split(':')[2], 10)]}`;
            resp += `• *ID:* \`${r.id.slice(0, 8)}\` (${type})\n`;
            resp += `  Jadwal: ${recurrenceText}\n`;
            resp += `  Waktu Terdekat: ${r.runAt.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}\n`;
            resp += `  Pesan: "${payload.originalMessage}"\n\n`;
          } catch {}
        });

        await adapter.sendMessage(ctx.chatId, resp.trim(), { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'del' || sub === 'delete') {
        const rid = args[1]?.trim();
        if (!rid) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/reminderulang del <id>`', { quotedMessageId: ctx.id });
          return;
        }

        const reminders = await prisma.reminder.findMany({
          where: { id: { startsWith: rid } }
        });

        if (reminders.length === 0) {
          await adapter.sendMessage(ctx.chatId, '❌ Pengingat tidak ditemukan.', { quotedMessageId: ctx.id });
          return;
        }

        const reminder = reminders[0];
        await prisma.reminder.delete({ where: { id: reminder.id } });
        await adapter.sendMessage(ctx.chatId, `✅ Pengingat berulang ID \`${reminder.id.slice(0, 8)}\` berhasil dihapus.`, { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, '⚠️ Sub-command tidak dikenal. Gunakan: `/reminderulang set`, `/reminderulang list`, `/reminderulang del`.', { quotedMessageId: ctx.id });
      return;
    }

    // ==========================================
    // NATURAL LANGUAGE REMINDERS: /remindernlp (F042)
    // ==========================================
    if (cmd === 'remindernlp' || cmd === 'f042') {
      const text = args.join(' ').trim();
      if (!text) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tulis pesan pengingat dalam bahasa alami. Contoh:\n👉 `/remindernlp ingatkan saya 10 menit lagi makan siang`', { quotedMessageId: ctx.id });
        return;
      }

      let timeVal: Date | null = null;
      let message = text;

      const cleanText = text.replace(/^(ingatkan saya|ingatkan|remind me|remind)\s+/i, '').trim();

      const relativeMinMatch = cleanText.match(/(\d+)\s*(menit|m)\s*(lagi)?/i);
      if (relativeMinMatch) {
        const minutes = parseInt(relativeMinMatch[1], 10);
        timeVal = new Date(Date.now() + minutes * 60 * 1000);
        message = cleanText.replace(relativeMinMatch[0], '').trim();
      }

      const relativeHourMatch = cleanText.match(/(\d+)\s*(jam|h)\s*(lagi)?/i);
      if (!timeVal && relativeHourMatch) {
        const hours = parseInt(relativeHourMatch[1], 10);
        timeVal = new Date(Date.now() + hours * 60 * 60 * 1000);
        message = cleanText.replace(relativeHourMatch[0], '').trim();
      }

      const relativeDayMatch = cleanText.match(/(\d+)\s*(hari|d)\s*(lagi)?/i);
      if (!timeVal && relativeDayMatch) {
        const days = parseInt(relativeDayMatch[1], 10);
        timeVal = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        message = cleanText.replace(relativeDayMatch[0], '').trim();
      }

      const tomorrowMatch = cleanText.match(/besok\s*(pagi|siang|sore|malam)?\s*(jam|pukul)?\s*(\d{1,2})[:.](\d{2})/i);
      if (!timeVal && tomorrowMatch) {
        const dayWord = tomorrowMatch[1]?.toLowerCase();
        let hours = parseInt(tomorrowMatch[3], 10);
        const mins = parseInt(tomorrowMatch[4], 10);

        const target = new Date();
        target.setDate(target.getDate() + 1);

        if (dayWord === 'malam' && hours < 12) hours += 12;
        if (dayWord === 'sore' && hours < 12) hours += 12;

        target.setHours(hours, mins, 0, 0);
        timeVal = target;
        message = cleanText.replace(tomorrowMatch[0], '').trim();
      }

      const laterMatch = cleanText.match(/nanti\s*(pagi|siang|sore|malam)?\s*(jam|pukul)?\s*(\d{1,2})[:.](\d{2})/i);
      if (!timeVal && laterMatch) {
        const dayWord = laterMatch[1]?.toLowerCase();
        let hours = parseInt(laterMatch[3], 10);
        const mins = parseInt(laterMatch[4], 10);

        const target = new Date();
        if (dayWord === 'malam' && hours < 12) hours += 12;
        if (dayWord === 'sore' && hours < 12) hours += 12;

        target.setHours(hours, mins, 0, 0);
        if (target.getTime() <= Date.now()) {
          target.setDate(target.getDate() + 1);
        }
        timeVal = target;
        message = cleanText.replace(laterMatch[0], '').trim();
      }

      message = message.replace(/^(untuk|bahwa|untuk melakukan|kalau|buat|yaitu)\s+/i, '').trim();

      if (!timeVal || !message) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Gagal memahami waktu atau pesan pengingat Anda. Coba gunakan kata-kata yang lebih sederhana, contoh: `/remindernlp ingatkan saya 15 menit lagi beli pulsa`', { quotedMessageId: ctx.id });
        return;
      }

      const reminder = await prisma.reminder.create({
        data: {
          scope: ctx.isGroup ? 'group' : 'private',
          groupId: ctx.isGroup ? ctx.chatId : null,
          userId: ctx.senderId,
          message,
          runAt: timeVal,
          status: 'pending'
        }
      });

      await adapter.sendMessage(
        ctx.chatId,
        `⏰ *Pengingat Bahasa Alami Dibuat* ⏰\n\n` +
        `• Waktu: *${timeVal.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}*\n` +
        `• Pesan: "${message}"\n` +
        `• ID: \`${reminder.id.slice(0, 8)}\``,
        { quotedMessageId: ctx.id }
      );
      return;
    }

    // ==========================================
    // DAILY AGENDA: /agendaharian (F045)
    // ==========================================
    if (cmd === 'agendaharian' || cmd === 'f045' || cmd === 'agenda') {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const schedules = ctx.isGroup
        ? await prisma.schedule.findMany({
            where: { groupId: ctx.chatId!, dayOfWeek: now.getDay() },
            orderBy: { time: 'asc' }
          })
        : [];

      const remindersWhere: any = {
        status: 'pending',
        runAt: { gte: startOfDay, lte: endOfDay }
      };
      if (ctx.isGroup) {
        remindersWhere.OR = [
          { userId: ctx.senderId, scope: 'private' },
          { groupId: ctx.chatId, scope: 'group' }
        ];
      } else {
        remindersWhere.userId = ctx.senderId;
        remindersWhere.scope = 'private';
      }
      const reminders = await prisma.reminder.findMany({
        where: remindersWhere,
        orderBy: { runAt: 'asc' }
      });

      const tasks = ctx.isGroup
        ? await prisma.task.findMany({
            where: {
              groupId: ctx.chatId!,
              status: 'pending',
              deadline: { gte: startOfDay, lte: endOfDay }
            },
            orderBy: { deadline: 'asc' }
          })
        : [];

      let agendaMsg = `📅 *AGENDA HARI INI* 📅\n`;
      agendaMsg += `⎔ Tanggal: *${now.toLocaleDateString('id-ID', { dateStyle: 'full' })}*\n\n`;

      if (schedules.length > 0) {
        agendaMsg += `📚 *JADWAL PELAJARAN / RUTINITAS GRUP:*\n`;
        schedules.forEach(s => {
          agendaMsg += `• [${s.time}] ${s.subject}\n`;
        });
        agendaMsg += `\n`;
      }

      if (tasks.length > 0) {
        agendaMsg += `📝 *TUGAS / DEADLINE HARI INI:*\n`;
        tasks.forEach(t => {
          let desc = t.description;
          try {
            const parsed = JSON.parse(t.description);
            desc = `[${parsed.subject}] ${parsed.details}`;
          } catch {}
          const timeStr = t.deadline ? t.deadline.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
          agendaMsg += `• [Jam ${timeStr}] ${desc}\n`;
        });
        agendaMsg += `\n`;
      }

      if (reminders.length > 0) {
        agendaMsg += `⏰ *PENGINGAT TERJADWAL HARI INI:*\n`;
        reminders.forEach(r => {
          let text = r.message;
          try {
            const parsed = JSON.parse(r.message);
            if (parsed.recurring) text = parsed.originalMessage;
          } catch {}
          const timeStr = r.runAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
          agendaMsg += `• [${timeStr}] ${text}\n`;
        });
        agendaMsg += `\n`;
      }

      if (schedules.length === 0 && tasks.length === 0 && reminders.length === 0) {
        agendaMsg += `🏖️ Hari ini santai! Tidak ada agenda, jadwal pelajaran, tugas, atau pengingat terdaftar untuk hari ini.`;
      } else {
        agendaMsg += `✨ *Semoga harimu menyenangkan dan produktif!*`;
      }

      await adapter.sendMessage(ctx.chatId, agendaMsg.trim(), { quotedMessageId: ctx.id });
      return;
    }

    // ==========================================
    // LINK REMINDER: /linkreminder (F100)
    // ==========================================
    if (cmd === 'linkreminder' || cmd === 'f100') {
      const url = args[0]?.trim();
      const timeStr = args[1]?.trim();

      if (!url || !timeStr || !url.startsWith('http')) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/linkreminder https://example.com 2h`', { quotedMessageId: ctx.id });
        return;
      }

      const runAt = parseRelativeOrAbsoluteTime(timeStr);
      if (!runAt) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format waktu tidak valid. Gunakan: `10m`, `2h`, `1d`, `20:00`, dll.', { quotedMessageId: ctx.id });
        return;
      }

      const reminder = await prisma.reminder.create({
        data: {
          scope: 'private',
          groupId: ctx.isGroup ? ctx.chatId : null,
          userId: ctx.senderId,
          message: `Baca link: ${url}`,
          runAt,
          status: 'pending'
        }
      });

      await adapter.sendMessage(
        ctx.chatId,
        `✅ *Link Reminder Berhasil Dibuat* ⏰\n\n` +
        `• Link: ${url}\n` +
        `• Waktu Pengingat: *${runAt.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}*\n` +
        `• ID: \`${reminder.id.slice(0, 8)}\``,
        { quotedMessageId: ctx.id }
      );
      return;
    }
  }
}

const schedSuite = new ScheduleSuiteCommand();
registerCommand(
  ['remind', 'remindgroup', 'listremind', 'delremind', 'jadwal', 'tugas', 'ultah', 'reminderulang', 'f041', 'remindernlp', 'f042', 'agendaharian', 'f045', 'linkreminder', 'f100', 'birthday', 'f039'],
  schedSuite
);
