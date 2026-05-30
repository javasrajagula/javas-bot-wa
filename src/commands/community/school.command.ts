import { Command, registerCommand, checkIfAdmin } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';
import { parseRelativeOrAbsoluteTime } from '../../utils/time-parser.js';

// Custom flexible date parser
function parseCustomDate(str: string): Date | null {
  const clean = str.trim().toLowerCase();
  
  // Try standard relative/absolute time parser first
  const parsed = parseRelativeOrAbsoluteTime(clean);
  if (parsed) return parsed;

  // Try parsing YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) return d;
  }

  // Try parsing DD-MM-YYYY
  const indonesianDateMatch = clean.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (indonesianDateMatch) {
    const day = parseInt(indonesianDateMatch[1], 10);
    const month = parseInt(indonesianDateMatch[2], 10) - 1;
    const year = parseInt(indonesianDateMatch[3], 10);
    const d = new Date(year, month, day, 23, 59, 59);
    if (!isNaN(d.getTime())) return d;
  }

  // Relative day words
  const d = new Date();
  if (clean === 'besok') {
    d.setDate(d.getDate() + 1);
    d.setHours(23, 59, 59, 999);
    return d;
  }
  if (clean === 'lusa') {
    d.setDate(d.getDate() + 2);
    d.setHours(23, 59, 59, 999);
    return d;
  }
  if (clean === 'hariini' || clean === 'hari ini') {
    d.setHours(23, 59, 59, 999);
    return d;
  }

  // General date parse fallback
  const general = new Date(str);
  if (!isNaN(general.getTime())) return general;

  return null;
}

function getCountdownStr(deadline: Date): string {
  const now = Date.now();
  const diff = deadline.getTime() - now;

  if (diff < 0) {
    return '⚠️ TERLAMBAT!';
  }

  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} hari lagi`;
  if (hours > 0) return `${hours} jam lagi`;
  return `${mins} menit lagi`;
}

const HARI_MAP: Record<string, number> = {
  minggu: 0, sunday: 0,
  senin: 1, monday: 1,
  selasa: 2, tuesday: 2,
  rabu: 3, wednesday: 3,
  kamis: 4, thursday: 4,
  jumat: 5, friday: 5,
  sabtu: 6, saturday: 6
};

const HARI_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export class SchoolCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    // Verify group is in school mode
    const modeVar = await prisma.customVariable.findUnique({
      where: {
        groupId_userId_key: {
          groupId: ctx.chatId,
          userId: 'system',
          key: 'groupMode'
        }
      }
    });

    const isSchoolMode = modeVar?.value === 'sekolah';
    const cmd = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    // Warn if group mode is not school, except for the groupmode config itself
    if (!isSchoolMode && cmd !== 'groupmode') {
      await adapter.sendMessage(
        ctx.chatId,
        '⚠️ Grup ini tidak berada dalam mode SEKOLAH.\nAktifkan terlebih dahulu dengan mengetik: `/groupmode sekolah` atau `/pack sekolah`',
        { quotedMessageId: ctx.id }
      );
      return;
    }

    // --- 1. /tugas commands ---
    if (cmd === 'tugas') {
      const action = args[0]?.toLowerCase().trim();

      // /tugas add <mapel> | <deadline> | <deskripsi>
      if (action === 'add') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang dapat menambahkan tugas kelas.', { quotedMessageId: ctx.id });
          return;
        }

        const fullArgs = args.slice(1).join(' ');
        const parts = fullArgs.split('|');
        if (parts.length < 3) {
          await adapter.sendMessage(
            ctx.chatId,
            '⚠️ Format salah.\nGunakan: `/tugas add <mapel> | <deadline> | <deskripsi>`\nContoh: `/tugas add Matematika | besok | Mengerjakan LKS hal 12`',
            { quotedMessageId: ctx.id }
          );
          return;
        }

        const mapel = parts[0].trim();
        const deadlineStr = parts[1].trim();
        const deskripsi = parts[2].trim();

        const deadline = parseCustomDate(deadlineStr);
        if (!deadline) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tanggal/waktu deadline tidak valid. Contoh format: *2026-06-05*, *05-06-2026*, *besok*, *lusa*.', { quotedMessageId: ctx.id });
          return;
        }

        const taskJson = JSON.stringify({ type: 'tugas', subject: mapel, details: deskripsi });
        const task = await prisma.task.create({
          data: {
            groupId: ctx.chatId,
            userId: ctx.senderId,
            description: taskJson,
            deadline,
            status: 'pending'
          }
        });

        await adapter.sendMessage(
          ctx.chatId,
          `📝 *TUGAS BARU BERHASIL DITAMBAHKAN*\n\n` +
          `• ID Tugas: *${task.id.slice(0, 6).toUpperCase()}*\n` +
          `• Mapel: *${mapel}*\n` +
          `• Deskripsi: ${deskripsi}\n` +
          `• Deadline: ${deadline.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} (${getCountdownStr(deadline)})`,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      // /tugas selesai <id>
      if (action === 'selesai' || action === 'done') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang dapat menyelesaikan tugas kelas.', { quotedMessageId: ctx.id });
          return;
        }

        const taskId = args[1]?.trim().toLowerCase();
        if (!taskId) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan ID Tugas. Contoh: `/tugas selesai 5D2F8A`', { quotedMessageId: ctx.id });
          return;
        }

        // Search for task with matching prefix (since we display 6-char prefix)
        const tasks = await prisma.task.findMany({
          where: { groupId: ctx.chatId, status: 'pending' }
        });

        const matched = tasks.find(t => t.id.toLowerCase().startsWith(taskId));
        if (!matched) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Tugas dengan ID *"${taskId.toUpperCase()}"* tidak ditemukan atau sudah selesai.`, { quotedMessageId: ctx.id });
          return;
        }

        await prisma.task.update({
          where: { id: matched.id },
          data: { status: 'done' }
        });

        let subjectName = 'Tugas';
        try {
          const parsed = JSON.parse(matched.description);
          subjectName = parsed.subject || 'Tugas';
        } catch {}

        await adapter.sendMessage(ctx.chatId, `✅ *Tugas "${subjectName}"* (ID: *${matched.id.slice(0, 6).toUpperCase()}*) berhasil ditandai selesai.`, { quotedMessageId: ctx.id });
        return;
      }

      // /tugas list
      if (!action || action === 'list') {
        const tasks = await prisma.task.findMany({
          where: { groupId: ctx.chatId, status: 'pending' },
          orderBy: { deadline: 'asc' }
        });

        const tugasList = tasks.filter(t => {
          try {
            const parsed = JSON.parse(t.description);
            return parsed.type === 'tugas';
          } catch {
            return true; // fallback
          }
        });

        if (tugasList.length === 0) {
          await adapter.sendMessage(ctx.chatId, '🎉 *Hore!* Tidak ada tugas kelas pending saat ini. Semua sudah selesai!', { quotedMessageId: ctx.id });
          return;
        }

        let msg = `📚 *DAFTAR TUGAS KELAS PENDING* 📚\n\n`;
        tugasList.forEach((t, i) => {
          let mapel = 'Tugas';
          let desc = t.description;
          try {
            const parsed = JSON.parse(t.description);
            mapel = parsed.subject || 'Tugas';
            desc = parsed.details || '';
          } catch {}

          const dline = t.deadline ? new Date(t.deadline) : null;
          const countdown = dline ? ` (${getCountdownStr(dline)})` : '';
          msg += `*${i + 1}. [${mapel}]* (ID: *${t.id.slice(0, 6).toUpperCase()}*)\n`;
          msg += `   📝 Tugas: ${desc}\n`;
          if (dline) {
            msg += `   ⏱️ Deadline: ${dline.toLocaleDateString('id-ID')} ${countdown}\n`;
          }
          msg += `\n`;
        });

        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        return;
      }
    }

    // --- 2. /deadline ---
    if (cmd === 'deadline') {
      const now = new Date();
      const threeDaysLater = new Date();
      threeDaysLater.setDate(threeDaysLater.getDate() + 3);

      const tasks = await prisma.task.findMany({
        where: {
          groupId: ctx.chatId,
          status: 'pending',
          deadline: { lte: threeDaysLater }
        },
        orderBy: { deadline: 'asc' }
      });

      if (tasks.length === 0) {
        await adapter.sendMessage(ctx.chatId, '✅ Aman! Tidak ada tugas kelas dengan deadline mendesak (dalam 3 hari ke depan).', { quotedMessageId: ctx.id });
        return;
      }

      let msg = `🚨 *DEADLINE TUGAS MENDESAK (≤ 3 HARI)* 🚨\n\n`;
      tasks.forEach((t, i) => {
        let mapel = 'Tugas';
        let desc = t.description;
        try {
          const parsed = JSON.parse(t.description);
          mapel = parsed.subject || 'Tugas';
          desc = parsed.details || '';
        } catch {}

        const dline = t.deadline ? new Date(t.deadline) : new Date();
        msg += `*${i + 1}. [${mapel}]* - *${getCountdownStr(dline)}*\n`;
        msg += `   📝 Tugas: ${desc}\n`;
        msg += `   ⏱️ Batas: ${dline.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n\n`;
      });

      await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      return;
    }

    // --- 3. /rekaptugas ---
    if (cmd === 'rekaptugas') {
      const [pending, completed] = await Promise.all([
        prisma.task.findMany({ where: { groupId: ctx.chatId, status: 'pending' }, orderBy: { deadline: 'asc' } }),
        prisma.task.findMany({ where: { groupId: ctx.chatId, status: 'done' }, orderBy: { createdAt: 'desc' }, take: 10 })
      ]);

      let recap = `📊 *REKAP TUGAS KELAS* 📊\n\n`;
      recap += `🛑 *PENDING (${pending.length}):*\n`;
      if (pending.length === 0) {
        recap += `- Tidak ada tugas pending.\n`;
      } else {
        pending.forEach((t, i) => {
          let mapel = 'Tugas';
          try {
            const parsed = JSON.parse(t.description);
            mapel = parsed.subject || 'Tugas';
          } catch {}
          recap += `${i + 1}. [${mapel}] - Exp: ${t.deadline ? new Date(t.deadline).toLocaleDateString('id-ID') : '-'}\n`;
        });
      }

      recap += `\n✅ *SELESAI (10 Terakhir):*\n`;
      if (completed.length === 0) {
        recap += `- Belum ada tugas selesai.\n`;
      } else {
        completed.forEach((t, i) => {
          let mapel = 'Tugas';
          try {
            const parsed = JSON.parse(t.description);
            mapel = parsed.subject || 'Tugas';
          } catch {}
          recap += `${i + 1}. [${mapel}] - Selesai\n`;
        });
      }

      await adapter.sendMessage(ctx.chatId, recap, { quotedMessageId: ctx.id });
      return;
    }

    // --- 4. /jadwal & /jadwalpelajaran ---
    if (cmd === 'jadwal' || cmd === 'jadwalpelajaran') {
      const sub = args[0]?.toLowerCase().trim();

      // /jadwal add <hari> | <jam> | <mapel>
      if (sub === 'add') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang dapat menambahkan jadwal pelajaran.', { quotedMessageId: ctx.id });
          return;
        }

        const fullArgs = args.slice(1).join(' ');
        const parts = fullArgs.split('|');
        if (parts.length < 3) {
          await adapter.sendMessage(
            ctx.chatId,
            '⚠️ Format salah.\nGunakan: `/jadwal add <hari> | <jam> | <mapel>`\nContoh: `/jadwal add senin | 07:30 | Matematika`',
            { quotedMessageId: ctx.id }
          );
          return;
        }

        const hariInput = parts[0].trim().toLowerCase();
        const jam = parts[1].trim();
        const mapel = parts[2].trim();

        const dayOfWeek = HARI_MAP[hariInput];
        if (dayOfWeek === undefined) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hari tidak dikenal. Gunakan: Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu.', { quotedMessageId: ctx.id });
          return;
        }

        const schedule = await prisma.schedule.create({
          data: {
            groupId: ctx.chatId,
            dayOfWeek,
            time: jam,
            subject: mapel
          }
        });

        await adapter.sendMessage(
          ctx.chatId,
          `✅ Jadwal berhasil ditambahkan!\n• Hari: *${HARI_NAMES[dayOfWeek]}*\n• Jam: *${jam}*\n• Mapel: *${mapel}*\n• ID Jadwal: *${schedule.id.slice(0, 6).toUpperCase()}*`,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      // /jadwal del <id>
      if (sub === 'del' || sub === 'remove') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang dapat menghapus jadwal pelajaran.', { quotedMessageId: ctx.id });
          return;
        }

        const sid = args[1]?.trim().toLowerCase();
        if (!sid) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Masukkan ID Jadwal. Contoh: `/jadwal del 3A5D9F`', { quotedMessageId: ctx.id });
          return;
        }

        const schedules = await prisma.schedule.findMany({ where: { groupId: ctx.chatId } });
        const matched = schedules.find(s => s.id.toLowerCase().startsWith(sid));
        if (!matched) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Jadwal dengan ID *"${sid.toUpperCase()}"* tidak ditemukan.`, { quotedMessageId: ctx.id });
          return;
        }

        await prisma.schedule.delete({ where: { id: matched.id } });
        await adapter.sendMessage(ctx.chatId, `✅ Jadwal pelajaran *${matched.subject}* berhasil dihapus.`, { quotedMessageId: ctx.id });
        return;
      }

      // /jadwal hariini & /jadwal besok
      if (sub === 'hariini' || sub === 'hari ini' || sub === 'besok' || !sub) {
        let dayTarget = new Date().getDay();
        let targetName = 'Hari Ini';

        if (sub === 'besok') {
          dayTarget = (dayTarget + 1) % 7;
          targetName = 'Besok';
        }

        const list = await prisma.schedule.findMany({
          where: { groupId: ctx.chatId, dayOfWeek: dayTarget },
          orderBy: { time: 'asc' }
        });

        if (list.length === 0) {
          await adapter.sendMessage(ctx.chatId, `🏖️ Tidak ada jadwal pelajaran untuk *${targetName}* (${HARI_NAMES[dayTarget]}).`, { quotedMessageId: ctx.id });
          return;
        }

        let msg = `📅 *JADWAL PELAJARAN ${targetName.toUpperCase()} (${HARI_NAMES[dayTarget].toUpperCase()})* 📅\n\n`;
        list.forEach((s) => {
          msg += `• [${s.time}] *${s.subject}*\n`;
        });

        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        return;
      }

      // Display complete list
      if (sub === 'list') {
        const list = await prisma.schedule.findMany({
          where: { groupId: ctx.chatId },
          orderBy: [{ dayOfWeek: 'asc' }, { time: 'asc' }]
        });

        if (list.length === 0) {
          await adapter.sendMessage(ctx.chatId, 'ℹ️ Belum ada jadwal pelajaran yang didaftarkan di grup ini.', { quotedMessageId: ctx.id });
          return;
        }

        let msg = `📅 *JADWAL PELAJARAN KELAS* 📅\n\n`;
        let currentDay = -1;

        list.forEach((s) => {
          if (s.dayOfWeek !== currentDay) {
            currentDay = s.dayOfWeek;
            msg += `\n*=== ${HARI_NAMES[currentDay].toUpperCase()} ===*\n`;
          }
          msg += `├ [${s.time}] *${s.subject}* (ID: *${s.id.slice(0, 6).toUpperCase()}*)\n`;
        });

        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        return;
      }
    }

    // --- 5. /ujian commands ---
    if (cmd === 'ujian') {
      const action = args[0]?.toLowerCase().trim();

      if (action === 'add') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang dapat menambahkan jadwal ujian.', { quotedMessageId: ctx.id });
          return;
        }

        const fullArgs = args.slice(1).join(' ');
        const parts = fullArgs.split('|');
        if (parts.length < 2) {
          await adapter.sendMessage(
            ctx.chatId,
            '⚠️ Format salah.\nGunakan: `/ujian add <mapel> | <tanggal>`\nContoh: `/ujian add Kimia | 05-06-2026`',
            { quotedMessageId: ctx.id }
          );
          return;
        }

        const mapel = parts[0].trim();
        const dateStr = parts[1].trim();

        const dateObj = parseCustomDate(dateStr);
        if (!dateObj) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tanggal tidak valid. Contoh format: *2026-06-05*, *05-06-2026*, *besok*.', { quotedMessageId: ctx.id });
          return;
        }

        const taskJson = JSON.stringify({ type: 'ujian', subject: mapel });
        const task = await prisma.task.create({
          data: {
            groupId: ctx.chatId,
            userId: ctx.senderId,
            description: taskJson,
            deadline: dateObj,
            status: 'pending'
          }
        });

        await adapter.sendMessage(
          ctx.chatId,
          `✍️ *JADWAL UJIAN BERHASIL DITAMBAHKAN*\n\n` +
          `• Mapel: *${mapel}*\n` +
          `• Tanggal: *${dateObj.toLocaleDateString('id-ID')}*\n` +
          `• ID Ujian: *${task.id.slice(0, 6).toUpperCase()}*`,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      if (!action || action === 'list') {
        const tasks = await prisma.task.findMany({
          where: { groupId: ctx.chatId, status: 'pending' },
          orderBy: { deadline: 'asc' }
        });

        const exams = tasks.filter(t => {
          try {
            const parsed = JSON.parse(t.description);
            return parsed.type === 'ujian';
          } catch {
            return false;
          }
        });

        if (exams.length === 0) {
          await adapter.sendMessage(ctx.chatId, '🎉 *Aman!* Belum ada jadwal ujian terdaftar.', { quotedMessageId: ctx.id });
          return;
        }

        let msg = `✍️ *JADWAL UJIAN KELAS AKTIF* ✍️\n\n`;
        exams.forEach((t, i) => {
          let mapel = 'Ujian';
          try {
            const parsed = JSON.parse(t.description);
            mapel = parsed.subject || 'Ujian';
          } catch {}

          const dline = t.deadline ? new Date(t.deadline) : new Date();
          msg += `${i + 1}. *[${mapel}]* - *${dline.toLocaleDateString('id-ID')}* (${getCountdownStr(dline)})\n   ID Ujian: *${t.id.slice(0, 6).toUpperCase()}*\n\n`;
        });

        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        return;
      }
    }

    // --- 6. /calendar commands ---
    if (cmd === 'calendar' || cmd === 'kalender') {
      const action = args[0]?.toLowerCase().trim();

      if (action === 'add') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang dapat menambahkan event kalender.', { quotedMessageId: ctx.id });
          return;
        }

        const fullArgs = args.slice(1).join(' ');
        const parts = fullArgs.split('|');
        if (parts.length < 2) {
          await adapter.sendMessage(
            ctx.chatId,
            '⚠️ Format salah.\nGunakan: `/calendar add <event> | <tanggal>`\nContoh: `/calendar add Study Tour Bali | 15-06-2026`',
            { quotedMessageId: ctx.id }
          );
          return;
        }

        const eventName = parts[0].trim();
        const dateStr = parts[1].trim();

        const dateObj = parseCustomDate(dateStr);
        if (!dateObj) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tanggal tidak valid. Contoh format: *2026-06-15*, *15-06-2026*.', { quotedMessageId: ctx.id });
          return;
        }

        const taskJson = JSON.stringify({ type: 'calendar', subject: eventName });
        const task = await prisma.task.create({
          data: {
            groupId: ctx.chatId,
            userId: ctx.senderId,
            description: taskJson,
            deadline: dateObj,
            status: 'pending'
          }
        });

        await adapter.sendMessage(
          ctx.chatId,
          `📅 *AGENDA BARU BERHASIL DITAMBAHKAN*\n\n` +
          `• Event: *${eventName}*\n` +
          `• Tanggal: *${dateObj.toLocaleDateString('id-ID')}*\n` +
          `• ID Event: *${task.id.slice(0, 6).toUpperCase()}*`,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      if (!action || action === 'list') {
        const tasks = await prisma.task.findMany({
          where: { groupId: ctx.chatId, status: 'pending' },
          orderBy: { deadline: 'asc' }
        });

        const events = tasks.filter(t => {
          try {
            const parsed = JSON.parse(t.description);
            return parsed.type === 'calendar' || parsed.type === 'ujian'; // display both as calendar events
          } catch {
            return false;
          }
        });

        if (events.length === 0) {
          await adapter.sendMessage(ctx.chatId, 'ℹ️ Belum ada agenda kalender terdaftar.', { quotedMessageId: ctx.id });
          return;
        }

        let msg = `📅 *AGENDA KALENDER KELAS* 📅\n\n`;
        events.forEach((t, i) => {
          let label = 'Agenda';
          let typeLabel = 'Event';
          try {
            const parsed = JSON.parse(t.description);
            label = parsed.subject || 'Agenda';
            typeLabel = parsed.type === 'ujian' ? '✍️ Ujian' : '📅 Event';
          } catch {}

          const dline = t.deadline ? new Date(t.deadline) : new Date();
          msg += `*${i + 1}. [${typeLabel}]* *${label}*\n   ├ Tanggal: ${dline.toLocaleDateString('id-ID')} (${getCountdownStr(dline)})\n   └ ID: *${t.id.slice(0, 6).toUpperCase()}*\n\n`;
        });

        await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
        return;
      }
    }
  }
}

// Register commands
const schoolCmd = new SchoolCommand();
registerCommand(['tugas', 'deadline', 'rekaptugas', 'jadwal', 'jadwalpelajaran', 'ujian', 'calendar', 'kalender'], schoolCmd);
