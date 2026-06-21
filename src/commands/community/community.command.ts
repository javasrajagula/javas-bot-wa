import { normalizeJid } from '../../utils/jid.util.js';
import { Command, registerCommand, checkIfAdmin } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';

export class CommunitySuiteCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // 1. Auto Reply: /addreply, /delreply, /listreply
    if (cmd === 'addreply' || cmd === 'delreply' || cmd === 'listreply') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }
      const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      if (!isAdmin) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Otoritas ditolak. Hanya admin yang dapat mengatur auto-reply.', { quotedMessageId: ctx.id });
        return;
      }

      if (cmd === 'addreply') {
        const text = args.join(' ');
        if (!text.includes('=')) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/addreply halo = halo juga`', { quotedMessageId: ctx.id });
          return;
        }

        const [trigger, response] = text.split('=').map(t => t.trim());
        if (!trigger || !response) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Trigger atau respon tidak boleh kosong.', { quotedMessageId: ctx.id });
          return;
        }

        await prisma.autoReply.create({
          data: { groupId: ctx.chatId, trigger, response, matchType: 'contains', createdBy: ctx.senderId }
        });
        await adapter.sendMessage(ctx.chatId, `✅ Auto reply berhasil ditambahkan.\nTrigger: *"${trigger}"*\nRespon: *"${response}"*`, { quotedMessageId: ctx.id });
      } else if (cmd === 'delreply') {
        const trigger = args.join(' ').trim();
        await prisma.autoReply.deleteMany({
          where: { groupId: ctx.chatId, trigger }
        });
        await adapter.sendMessage(ctx.chatId, `✅ Auto reply dengan trigger *"${trigger}"* berhasil dihapus.`, { quotedMessageId: ctx.id });
      } else {
        const list = await prisma.autoReply.findMany({ where: { groupId: ctx.chatId } });
        if (list.length === 0) {
          await adapter.sendMessage(ctx.chatId, '📭 Daftar auto reply kosong.', { quotedMessageId: ctx.id });
          return;
        }
        const textList = list.map((a, i) => `${i + 1}. *${a.trigger}* -> ${a.response}`).join('\n');
        await adapter.sendMessage(ctx.chatId, `🤖 *AUTO REPLY GRUP* 🤖\n\n${textList}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 2. Polling: /poll, /vote, /pollresult, /closepoll
    if (cmd === 'poll' || cmd === 'vote' || cmd === 'pollresult' || cmd === 'closepoll') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      if (cmd === 'poll') {
        const input = args.join(' ');
        if (!input.includes('|')) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/poll Pertanyaan | opsi1 | opsi2`', { quotedMessageId: ctx.id });
          return;
        }

        const parts = input.split('|').map(p => p.trim());
        const question = parts[0];
        const options = parts.slice(1).filter(Boolean);

        if (!question || options.length < 2) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Pertanyaan dan minimal 2 opsi diperlukan.', { quotedMessageId: ctx.id });
          return;
        }

        // Close any existing active polls
        await prisma.poll.updateMany({
          where: { groupId: ctx.chatId, status: 'active' },
          data: { status: 'closed' }
        });

        const newPoll = await prisma.poll.create({
          data: {
            groupId: ctx.chatId,
            question,
            optionsJson: JSON.stringify(options),
            votesJson: '{}', // { userId: optionIndex }
            status: 'active',
            createdBy: ctx.senderId
          }
        });

        let pollText = `📊 *POLLING BARU GRUP* 📊\n\n*Pertanyaan:* ${question}\n\n`;
        options.forEach((opt, idx) => {
          pollText += `${idx + 1}. ${opt}\n`;
        });
        pollText += `\nKetik \`/vote <angka_opsi>\` untuk memilih!`;

        await adapter.sendMessage(ctx.chatId, pollText, { quotedMessageId: ctx.id });
      }

      else if (cmd === 'vote') {
        const active = await prisma.poll.findFirst({
          where: { groupId: ctx.chatId, status: 'active' }
        });

        if (!active) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada polling aktif saat ini.', { quotedMessageId: ctx.id });
          return;
        }

        const optIdx = parseInt(args[0], 10) - 1;
        const options = JSON.parse(active.optionsJson);

        if (isNaN(optIdx) || optIdx < 0 || optIdx >= options.length) {
          await adapter.sendMessage(ctx.chatId, `⚠️ Opsi tidak valid. Pilih angka 1 sampai ${options.length}.`, { quotedMessageId: ctx.id });
          return;
        }

        const votes = JSON.parse(active.votesJson);
        votes[ctx.senderId] = optIdx;

        await prisma.poll.update({
          where: { id: active.id },
          data: { votesJson: JSON.stringify(votes) }
        });

        await adapter.sendMessage(ctx.chatId, `✅ Pilihan Anda (*${options[optIdx]}*) berhasil dicatat.`, { quotedMessageId: ctx.id });
      }

      else if (cmd === 'pollresult' || cmd === 'closepoll') {
        const active = await prisma.poll.findFirst({
          where: { groupId: ctx.chatId, status: 'active' }
        });

        if (!active) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada polling aktif.', { quotedMessageId: ctx.id });
          return;
        }

        if (cmd === 'closepoll') {
          const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
          if (!isAdmin) {
            await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat menutup polling.', { quotedMessageId: ctx.id });
            return;
          }
          await prisma.poll.update({ where: { id: active.id }, data: { status: 'closed' } });
        }

        const options: string[] = JSON.parse(active.optionsJson);
        const votes: Record<string, number> = JSON.parse(active.votesJson);

        const counts = new Array(options.length).fill(0);
        Object.values(votes).forEach(optIdx => {
          if (counts[optIdx] !== undefined) counts[optIdx]++;
        });

        let resText = `📊 *HASIL POLLING [${cmd === 'closepoll' ? 'CLOSED' : 'ACTIVE'}]* 📊\n\n*Pertanyaan:* ${active.question}\n\n`;
        options.forEach((opt, idx) => {
          resText += `- ${opt}: *${counts[idx]} suara*\n`;
        });

        await adapter.sendMessage(ctx.chatId, resText, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 3. Confess & Menfess: /confess, /menfess
    if (cmd === 'confess' || cmd === 'menfess') {
      const text = args.join(' ').trim();
      if (!text) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Format salah. Contoh: \`/${cmd} pesan rahasia\``, { quotedMessageId: ctx.id });
        return;
      }

      if (cmd === 'confess') {
        // Send anonymously to group
        await adapter.sendMessage(ctx.chatId, `🕵️‍♂️ *CONFESS ANONIM* 🕵️‍♂️\n\nPesan:\n"${text}"`);
        try {
          await adapter.deleteMessage(ctx.chatId, ctx.id, ctx.senderId);
        } catch {}
      } else {
        // Menfess target message
        const rawTarget = args[0];
        const msg = args.slice(1).join(' ').trim();

        if (!rawTarget || !msg) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/menfess @user pesan rahasia`', { quotedMessageId: ctx.id });
          return;
        }

        const targetJid = normalizeJid(rawTarget);
        await adapter.sendMessage(targetJid, `💌 *MENFESS RAHASIA* 💌\n\nSeseorang mengirimkan pesan untukmu:\n"${msg}"`);
        await adapter.sendMessage(ctx.chatId, '✅ Menfess berhasil dikirim secara rahasia ke target.', { quotedMessageId: ctx.id });
      }
      return;
    }


    // 5. Events: /event, /listevent, /delevent
    if (cmd === 'event' || cmd === 'listevent' || cmd === 'delevent') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      // We can reuse the Reminder table or featuresJson to store group events
      const config = await prisma.groupConfig.findUnique({ where: { groupId: ctx.chatId } });
      const features = config ? JSON.parse(config.featuresJson || '{}') : {};
      const events = features.events || [];

      if (cmd === 'event') {
        const desc = args.join(' ').trim();
        if (!desc) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/event Futsal Jumat 19:00`', { quotedMessageId: ctx.id });
          return;
        }

        const newEvent = { id: Math.random().toString(36).substring(2, 6), desc, createdBy: ctx.senderId, date: new Date().toLocaleDateString() };
        events.push(newEvent);
        features.events = events;

        await prisma.groupConfig.update({
          where: { groupId: ctx.chatId },
          data: { featuresJson: JSON.stringify(features) }
        });

        await adapter.sendMessage(ctx.chatId, `✅ Event *"${desc}"* berhasil didaftarkan.\nID Event: *${newEvent.id}*`, { quotedMessageId: ctx.id });
      } else if (cmd === 'delevent') {
        const eid = args[0]?.trim();
        const updated = events.filter((e: any) => e.id !== eid);
        features.events = updated;

        await prisma.groupConfig.update({
          where: { groupId: ctx.chatId },
          data: { featuresJson: JSON.stringify(features) }
        });

        await adapter.sendMessage(ctx.chatId, `✅ Event ID *${eid}* berhasil dihapus.`, { quotedMessageId: ctx.id });
      } else {
        if (events.length === 0) {
          await adapter.sendMessage(ctx.chatId, '📭 Belum ada agenda/event terdaftar di grup ini.', { quotedMessageId: ctx.id });
          return;
        }

        const response = `📅 *AGENDA EVENT GRUP* 📅\n\n` + events.map((e: any) => `- *ID:* ${e.id} | ${e.desc}`).join('\n');
        await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 6. Absensi / Attendance: /absen buka, /absen, /absen list, /absen tutup
    if (cmd === 'absen') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      const action = args[0]?.toLowerCase() || 'hadir';

      if (action === 'buka') {
        const title = args.slice(1).join(' ').trim() || 'Absensi Harian';
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat membuka sesi absensi.', { quotedMessageId: ctx.id });
          return;
        }

        await prisma.attendanceSession.updateMany({
          where: { groupId: ctx.chatId, status: 'open' },
          data: { status: 'closed', closedAt: new Date() }
        });

        await prisma.attendanceSession.create({
          data: { groupId: ctx.chatId, title, status: 'open', createdBy: ctx.senderId }
        });

        await adapter.sendMessage(ctx.chatId, `📢 *ABSENSI DIBUKA: ${title.toUpperCase()}* 📢\n\nKetik \`/absen\` untuk absen hadir!`);
      }

      else if (action === 'list') {
        const session = await prisma.attendanceSession.findFirst({
          where: { groupId: ctx.chatId, status: 'open' }
        });

        if (!session) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada sesi absensi aktif.', { quotedMessageId: ctx.id });
          return;
        }

        const participants: string[] = JSON.parse(session.participantsJson || '[]');
        if (participants.length === 0) {
          await adapter.sendMessage(ctx.chatId, `📭 Belum ada yang absen pada *${session.title}*.`, { quotedMessageId: ctx.id });
          return;
        }

        const textList = participants.map((p, i) => `${i + 1}. @${p.split('@')[0]}`).join('\n');
        await adapter.sendMessage(
          ctx.chatId,
          `📝 *HADIR ABSENSI: ${session.title.toUpperCase()}* 📝\n\n${textList}`,
          { mentions: participants }
        );
      }

      else if (action === 'tutup') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat menutup absensi.', { quotedMessageId: ctx.id });
          return;
        }

        const session = await prisma.attendanceSession.findFirst({
          where: { groupId: ctx.chatId, status: 'open' }
        });

        if (!session) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada sesi absensi aktif.', { quotedMessageId: ctx.id });
          return;
        }

        await prisma.attendanceSession.update({
          where: { id: session.id },
          data: { status: 'closed', closedAt: new Date() }
        });

        await adapter.sendMessage(ctx.chatId, `✅ Sesi absensi *"${session.title}"* berhasil ditutup.`);
      }

      else {
        // Record check-in
        const session = await prisma.attendanceSession.findFirst({
          where: { groupId: ctx.chatId, status: 'open' }
        });

        if (!session) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada sesi absensi aktif saat ini.', { quotedMessageId: ctx.id });
          return;
        }

        const participants: string[] = JSON.parse(session.participantsJson || '[]');
        if (participants.includes(ctx.senderId)) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Anda sudah melakukan absen.', { quotedMessageId: ctx.id });
          return;
        }

        participants.push(ctx.senderId);
        await prisma.attendanceSession.update({
          where: { id: session.id },
          data: { participantsJson: JSON.stringify(participants) }
        });

        await adapter.sendMessage(ctx.chatId, `✅ Berhasil absen hadir untuk @${ctx.senderId.split('@')[0]}.`, { quotedMessageId: ctx.id, mentions: [ctx.senderId] });
      }
      return;
    }
  }
}

const commSuite = new CommunitySuiteCommand();
registerCommand(
  ['addreply', 'delreply', 'listreply', 'poll', 'vote', 'pollresult', 'closepoll', 'confess', 'menfess', 'event', 'listevent', 'delevent', 'absen'],
  commSuite
);
