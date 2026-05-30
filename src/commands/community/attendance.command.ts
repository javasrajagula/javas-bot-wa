import { Command, registerCommand, checkIfAdmin } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';
import { stateStore } from '../../services/state/state-store.js';

interface AttendanceParticipant {
  userId: string;
  name: string;
  status: 'hadir' | 'izin' | 'sakit';
  timestamp: string;
  alasan?: string;
  isLate: boolean;
}

export class AttendanceCommand implements Command {
  private async getActiveSession(groupId: string): Promise<any | null> {
    const session = await prisma.attendanceSession.findFirst({
      where: { groupId, status: 'open' }
    });
    if (!session) return null;

    const metaStr = await stateStore.get(`attendance:meta:${groupId}`);
    if (metaStr) {
      try {
        const meta = JSON.parse(metaStr as string);
        if (meta.autoCloseAt && Date.now() > meta.autoCloseAt) {
          // Close the session automatically
          const closed = await prisma.attendanceSession.update({
            where: { id: session.id },
            data: { status: 'closed', closedAt: new Date() }
          });
          await stateStore.delete(`attendance:meta:${groupId}`);
          return null;
        }
      } catch {}
    }
    return session;
  }

  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const action = args[0]?.toLowerCase().trim();

    // 1. /absen buka <judul> [| batas_terlambat_menit] [| tutup_otomatis_menit]
    if (action === 'buka') {
      const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      if (!isAdmin) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat membuka absensi.', { quotedMessageId: ctx.id });
        return;
      }

      const fullArgs = args.slice(1).join(' ').trim();
      if (!fullArgs) {
        await adapter.sendMessage(
          ctx.chatId,
          '⚠️ Judul absensi harus diisi.\nContoh: `/absen buka Kehadiran Kelas | 15 | 60`',
          { quotedMessageId: ctx.id }
        );
        return;
      }

      const parts = fullArgs.split('|').map(p => p.trim());
      const title = parts[0];
      const lateMinutes = parts[1] ? parseInt(parts[1], 10) : null;
      const autoCloseMinutes = parts[2] ? parseInt(parts[2], 10) : null;

      if (lateMinutes !== null && isNaN(lateMinutes)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Batas terlambat harus berupa angka menit.', { quotedMessageId: ctx.id });
        return;
      }
      if (autoCloseMinutes !== null && isNaN(autoCloseMinutes)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tutup otomatis harus berupa angka menit.', { quotedMessageId: ctx.id });
        return;
      }

      // Close any existing active sessions in this group
      await prisma.attendanceSession.updateMany({
        where: { groupId: ctx.chatId, status: 'open' },
        data: { status: 'closed', closedAt: new Date() }
      });

      const session = await prisma.attendanceSession.create({
        data: {
          groupId: ctx.chatId,
          title,
          status: 'open',
          createdBy: ctx.senderId,
          participantsJson: '[]'
        }
      });

      const meta: any = {};
      if (lateMinutes) {
        meta.lateLimitAt = Date.now() + lateMinutes * 60 * 1000;
      }
      if (autoCloseMinutes) {
        meta.autoCloseAt = Date.now() + autoCloseMinutes * 60 * 1000;
      }

      if (Object.keys(meta).length > 0) {
        await stateStore.set(`attendance:meta:${ctx.chatId}`, JSON.stringify(meta));
      } else {
        await stateStore.delete(`attendance:meta:${ctx.chatId}`);
      }

      let welcomeMsg = `📋 *ABSENSI DIBUKA* 📋\n\n`;
      welcomeMsg += `• Judul: *${title}*\n`;
      if (lateMinutes) {
        welcomeMsg += `• Batas Terlambat: *${lateMinutes} menit* (setelah ini ditandai terlambat)\n`;
      }
      if (autoCloseMinutes) {
        welcomeMsg += `• Tutup Otomatis: *${autoCloseMinutes} menit*\n`;
      }
      welcomeMsg += `\nSilakan ketik:\n👉 \`/absen hadir\`\n👉 \`/absen izin <alasan>\`\n👉 \`/absen sakit <alasan>\``;

      await adapter.sendMessage(ctx.chatId, welcomeMsg, { quotedMessageId: ctx.id });

      if (autoCloseMinutes) {
        setTimeout(async () => {
          try {
            const current = await prisma.attendanceSession.findFirst({
              where: { id: session.id }
            });
            if (current && current.status === 'open') {
              await prisma.attendanceSession.update({
                where: { id: current.id },
                data: { status: 'closed', closedAt: new Date() }
              });
              await stateStore.delete(`attendance:meta:${ctx.chatId}`);
              await adapter.sendMessage(ctx.chatId, `🔔 *Sesi Absensi "${title}" telah ditutup otomatis.*`);
            }
          } catch (err) {
            console.error('Auto close setTimeout error:', err);
          }
        }, autoCloseMinutes * 60 * 1000);
      }
      return;
    }

    // 2. /absen hadir
    if (action === 'hadir') {
      const session = await this.getActiveSession(ctx.chatId);
      if (!session) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada sesi absensi aktif saat ini.', { quotedMessageId: ctx.id });
        return;
      }

      const participants: AttendanceParticipant[] = JSON.parse(session.participantsJson || '[]');
      const alreadyAbsen = participants.find(p => p.userId === ctx.senderId);
      if (alreadyAbsen) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Anda sudah terabsen sebagai *${alreadyAbsen.status.toUpperCase()}*.`, { quotedMessageId: ctx.id });
        return;
      }

      let isLate = false;
      const metaStr = await stateStore.get(`attendance:meta:${ctx.chatId}`);
      if (metaStr) {
        try {
          const meta = JSON.parse(metaStr as string);
          if (meta.lateLimitAt && Date.now() > meta.lateLimitAt) {
            isLate = true;
          }
        } catch {}
      }

      const newParticipant: AttendanceParticipant = {
        userId: ctx.senderId,
        name: ctx.senderId.split('@')[0],
        status: 'hadir',
        timestamp: new Date().toISOString(),
        isLate
      };

      participants.push(newParticipant);

      await prisma.attendanceSession.update({
        where: { id: session.id },
        data: { participantsJson: JSON.stringify(participants) }
      });

      const mention = `@${ctx.senderId.split('@')[0]}`;
      const lateStr = isLate ? ' ⏰ (Terlambat)' : ' ⏱️ (Tepat Waktu)';
      await adapter.sendMessage(ctx.chatId, `✅ Berhasil mencatat kehadiran untuk ${mention}${lateStr}.`, {
        quotedMessageId: ctx.id,
        mentions: [ctx.senderId]
      });
      return;
    }

    // 3. /absen izin <alasan>
    // 4. /absen sakit <alasan>
    if (action === 'izin' || action === 'sakit') {
      const session = await this.getActiveSession(ctx.chatId);
      if (!session) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada sesi absensi aktif saat ini.', { quotedMessageId: ctx.id });
        return;
      }

      const alasan = args.slice(1).join(' ').trim();
      if (!alasan) {
        await adapter.sendMessage(
          ctx.chatId,
          `⚠️ Harap sertakan alasan ${action}.\nContoh: \`/absen ${action} Demam tinggi / Keperluan keluarga\``,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      const participants: AttendanceParticipant[] = JSON.parse(session.participantsJson || '[]');
      const alreadyAbsen = participants.find(p => p.userId === ctx.senderId);
      if (alreadyAbsen) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Anda sudah terabsen sebagai *${alreadyAbsen.status.toUpperCase()}*.`, { quotedMessageId: ctx.id });
        return;
      }

      const newParticipant: AttendanceParticipant = {
        userId: ctx.senderId,
        name: ctx.senderId.split('@')[0],
        status: action as 'izin' | 'sakit',
        timestamp: new Date().toISOString(),
        alasan,
        isLate: false
      };

      participants.push(newParticipant);

      await prisma.attendanceSession.update({
        where: { id: session.id },
        data: { participantsJson: JSON.stringify(participants) }
      });

      const mention = `@${ctx.senderId.split('@')[0]}`;
      await adapter.sendMessage(ctx.chatId, `✅ Berhasil mencatat ${action} untuk ${mention} dengan alasan: *${alasan}*.`, {
        quotedMessageId: ctx.id,
        mentions: [ctx.senderId]
      });
      return;
    }

    // 5. /absen list
    if (action === 'list') {
      const session = await this.getActiveSession(ctx.chatId);
      if (!session) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada sesi absensi aktif saat ini.', { quotedMessageId: ctx.id });
        return;
      }

      const participants: AttendanceParticipant[] = JSON.parse(session.participantsJson || '[]');

      const hadirTepat = participants.filter(p => p.status === 'hadir' && !p.isLate);
      const hadirLambat = participants.filter(p => p.status === 'hadir' && p.isLate);
      const izin = participants.filter(p => p.status === 'izin');
      const sakit = participants.filter(p => p.status === 'sakit');

      let listMsg = `📋 *DAFTAR ABSENSI AKTIF* 📋\n`;
      listMsg += `• Judul: *${session.title}*\n\n`;

      listMsg += `⏱️ *Hadir (Tepat Waktu) [${hadirTepat.length}]:*\n`;
      if (hadirTepat.length === 0) listMsg += `- Nihil\n`;
      else hadirTepat.forEach(p => {
        const time = new Date(p.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
        listMsg += `- @${p.userId.split('@')[0]} (${time})\n`;
      });

      listMsg += `\n⏰ *Hadir (Terlambat) [${hadirLambat.length}]:*\n`;
      if (hadirLambat.length === 0) listMsg += `- Nihil\n`;
      else hadirLambat.forEach(p => {
        const time = new Date(p.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
        listMsg += `- @${p.userId.split('@')[0]} (${time})\n`;
      });

      listMsg += `\n✉️ *Izin [${izin.length}]:*\n`;
      if (izin.length === 0) listMsg += `- Nihil\n`;
      else izin.forEach(p => {
        listMsg += `- @${p.userId.split('@')[0]} (Alasan: ${p.alasan})\n`;
      });

      listMsg += `\n🤒 *Sakit [${sakit.length}]:*\n`;
      if (sakit.length === 0) listMsg += `- Nihil\n`;
      else sakit.forEach(p => {
        listMsg += `- @${p.userId.split('@')[0]} (Alasan: ${p.alasan})\n`;
      });

      const allMentions = participants.map(p => p.userId);

      await adapter.sendMessage(ctx.chatId, listMsg, {
        quotedMessageId: ctx.id,
        mentions: allMentions
      });
      return;
    }

    // 6. /absen tutup
    if (action === 'tutup') {
      const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      if (!isAdmin) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat menutup sesi absensi.', { quotedMessageId: ctx.id });
        return;
      }

      const session = await prisma.attendanceSession.findFirst({
        where: { groupId: ctx.chatId, status: 'open' }
      });

      if (!session) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada sesi absensi aktif yang dapat ditutup.', { quotedMessageId: ctx.id });
        return;
      }

      await prisma.attendanceSession.update({
        where: { id: session.id },
        data: { status: 'closed', closedAt: new Date() }
      });
      await stateStore.delete(`attendance:meta:${ctx.chatId}`);

      await adapter.sendMessage(ctx.chatId, `✅ Sesi absensi *"${session.title}"* berhasil ditutup.`, { quotedMessageId: ctx.id });
      return;
    }

    // 7. /absen rekap
    if (action === 'rekap') {
      let session = await this.getActiveSession(ctx.chatId);
      let isActive = true;
      if (!session) {
        session = await prisma.attendanceSession.findFirst({
          where: { groupId: ctx.chatId },
          orderBy: { createdAt: 'desc' }
        });
        isActive = false;
      }

      if (!session) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Belum ada data absensi di grup ini.', { quotedMessageId: ctx.id });
        return;
      }

      const participants: AttendanceParticipant[] = JSON.parse(session.participantsJson || '[]');

      const hadirTepat = participants.filter(p => p.status === 'hadir' && !p.isLate);
      const hadirLambat = participants.filter(p => p.status === 'hadir' && p.isLate);
      const izin = participants.filter(p => p.status === 'izin');
      const sakit = participants.filter(p => p.status === 'sakit');

      let listMsg = `📊 *REKAP ABSENSI KELAS* 📊\n\n`;
      listMsg += `• Judul: *${session.title}*\n`;
      listMsg += `• Status: *${isActive ? 'AKTIF (BUKA)' : 'TUTUP'}*\n`;
      listMsg += `• Dibuat pada: *${new Date(session.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}*\n\n`;

      listMsg += `⏱️ Hadir (Tepat): *${hadirTepat.length}*\n`;
      listMsg += `⏰ Hadir (Lambat): *${hadirLambat.length}*\n`;
      listMsg += `✉️ Izin: *${izin.length}*\n`;
      listMsg += `🤒 Sakit: *${sakit.length}*\n`;
      listMsg += `👥 *Total Berpartisipasi: ${participants.length}*\n\n`;

      listMsg += `Ketik \`/absen list\` untuk melihat daftar nama detail yang aktif, atau \`/absen export\` untuk mengunduh file rekap.`;

      await adapter.sendMessage(ctx.chatId, listMsg, { quotedMessageId: ctx.id });
      return;
    }

    // 8. /absen export
    if (action === 'export') {
      const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      if (!isAdmin) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat mengekspor data absensi.', { quotedMessageId: ctx.id });
        return;
      }

      const session = await prisma.attendanceSession.findFirst({
        where: { groupId: ctx.chatId },
        orderBy: { createdAt: 'desc' }
      });

      if (!session) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Belum ada data absensi untuk diekspor.', { quotedMessageId: ctx.id });
        return;
      }

      const participants: AttendanceParticipant[] = JSON.parse(session.participantsJson || '[]');

      if (participants.length === 0) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Sesi absensi ini tidak memiliki partisipan.', { quotedMessageId: ctx.id });
        return;
      }

      let csv = 'No,User ID (Phone),Nama,Status,Terlambat,Waktu Absen,Alasan\n';
      participants.forEach((p, idx) => {
        const time = new Date(p.timestamp).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        const line = `${idx + 1},${p.userId.split('@')[0]},${p.name},${p.status},${p.isLate ? 'Ya' : 'Tidak'},"${time}","${p.alasan || ''}"`;
        csv += line + '\n';
      });

      const fileName = `rekap-absen-${session.title.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
      const buffer = Buffer.from(csv);

      await adapter.sendDocument(ctx.chatId, buffer, fileName, 'text/csv', { quotedMessageId: ctx.id });
      return;
    }

    // Default help menu
    let helpMsg = `📋 *PANDUAN ABSENSI V2* 📋\n\n`;
    helpMsg += `• \`/absen buka <judul> [| batas_terlambat_menit] [| tutup_otomatis_menit]\` - Membuka sesi absensi baru (Admin)\n`;
    helpMsg += `• \`/absen hadir\` - Mengisi absensi hadir\n`;
    helpMsg += `• \`/absen izin <alasan>\` - Mengisi absensi izin\n`;
    helpMsg += `• \`/absen sakit <alasan>\` - Mengisi absensi sakit\n`;
    helpMsg += `• \`/absen list\` - Melihat daftar absensi aktif\n`;
    helpMsg += `• \`/absen tutup\` - Menutup sesi absensi secara manual (Admin)\n`;
    helpMsg += `• \`/absen rekap\` - Melihat rekapitulasi sesi terakhir\n`;
    helpMsg += `• \`/absen export\` - Mengunduh rekapitulasi dalam format CSV (Admin)\n`;

    await adapter.sendMessage(ctx.chatId, helpMsg, { quotedMessageId: ctx.id });
  }
}

const attendanceCmd = new AttendanceCommand();
registerCommand(['absen'], attendanceCmd);
