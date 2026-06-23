import { Command, registerCommand, checkIfAdmin } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import { isOwner } from '../../bot/permission.js';
import prisma from '../../db/client.js';

async function logAccess(actorId: string, groupId: string | null, action: string, target: string, metadata: any = {}) {
  await prisma.auditLog.create({
    data: {
      actorId,
      groupId: groupId || 'private',
      action,
      target,
      metadataJson: JSON.stringify(metadata)
    }
  }).catch(err => console.error('Failed to log audit:', err));
}

async function sendPrivacyNotice(chatId: string, feature: string, adapter: WhatsAppAdapter) {
  const { getGroupFeatures } = await import('../../config/feature-flags.js');
  const flags = await getGroupFeatures(chatId).catch(() => ({}) as any);
  if (flags.privacynotice !== false) {
    const notices: Record<string, string> = {
      antiflood: 'Fitur Anti-Flood memantau frekuensi pesan sementara secara real-time untuk mencegah spam. Data frekuensi tidak disimpan permanen di database.',
      antitagall: 'Fitur Anti-Tag-All memantau jumlah mention dalam pesan untuk mencegah penyalahgunaan mention massal. Log detail tidak disimpan.',
      anonanalytics: 'Fitur Anonimisasi Analitik akan menyembunyikan nomor telepon/JID pengguna dalam visualisasi statistik grup demi privasi anggota.',
      sensitivelog: 'Fitur Sensor Log Sensitif menyensor informasi sensitif seperti token, URL, dan nomor telepon dari catatan sistem (logs).',
      privateguard: 'Fitur Private Guard melindungi data sensitif dengan membatasi eksekusi perintah berkategori SENSITIVE hanya di Private Chat.'
    };
    const notice = notices[feature];
    if (notice) {
      await adapter.sendMessage(chatId, `ℹ️ *NOTIFIKASI PRIVASI:*\n${notice}`);
    }
  }
}

export class PrivacyDataCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName?.toLowerCase() || '';

    // F011: retentionmode
    if (cmd === 'retentionmode') {
      const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      if (!isAdmin) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat mengatur retensi data.', { quotedMessageId: ctx.id });
        return;
      }

      const sub = args[0]?.toLowerCase();
      if (sub === 'set') {
        const feature = args[1]?.toLowerCase();
        const days = parseInt(args[2], 10);
        if (!feature || isNaN(days) || days < 0) {
          await adapter.sendMessage(ctx.chatId!, '⚠️ Format salah. Gunakan: `/retentionmode set <feature> <days>` (days >= 0)', { quotedMessageId: ctx.id });
          return;
        }

        await prisma.customVariable.upsert({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId!,
              userId: 'group',
              key: `retention:${feature}`
            }
          },
          create: {
            groupId: ctx.chatId!,
            userId: 'group',
            key: `retention:${feature}`,
            value: days.toString()
          },
          update: {
            value: days.toString()
          }
        });

        await adapter.sendMessage(ctx.chatId!, `✅ Kebijakan retensi data untuk fitur *${feature}* berhasil diset ke *${days}* hari.`, { quotedMessageId: ctx.id });
        return;
      }

      // Default: show policies
      const policies = await prisma.customVariable.findMany({
        where: {
          groupId: ctx.chatId!,
          key: { startsWith: 'retention:' }
        }
      });

      let text = `📂 *KEBIJAKAN RETENSI DATA* 📂\n\n`;
      if (policies.length === 0) {
        text += `Belum ada kebijakan retensi khusus yang dikonfigurasi.\n\nCara pakai:\n• \`/retentionmode set <feature> <days>\``;
      } else {
        policies.forEach(p => {
          const featureName = p.key.replace('retention:', '');
          text += `• *${featureName.toUpperCase()}*: ${p.value} Hari\n`;
        });
      }
      await adapter.sendMessage(ctx.chatId!, text, { quotedMessageId: ctx.id });
      return;
    }

    // F012: exportdata
    if (cmd === 'exportdata') {
      const userId = ctx.senderId;
      await logAccess(userId, ctx.chatId, 'export_data', userId);

      try {
        const profile = await prisma.userProfile.findUnique({ where: { userId } });
        const economy = await prisma.userEconomy.findUnique({ where: { userId } });
        const warnings = await prisma.warning.findMany({ where: { userId } });
        const usageLogs = await prisma.usageLog.count({ where: { userId } });

        let text = `📦 *EKSPOR DATA PENGGUNA* 📦\n\n`;
        text += `• User ID: \`${userId}\`\n`;
        text += `• Premium: ${profile?.isPremium ? 'Ya' : 'Tidak'}\n`;
        text += `• Bahasa: ${profile?.language || 'id'}\n`;
        text += `• Saldo Dompet: Rp ${economy?.balance?.toLocaleString('id-ID') || 0}\n`;
        text += `• Saldo Bank: Rp ${economy?.bank?.toLocaleString('id-ID') || 0}\n`;
        text += `• Level: ${economy?.level || 1} (XP: ${economy?.xp || 0})\n`;
        text += `• Total Peringatan: ${warnings.length}\n`;
        text += `• Total Penggunaan Perintah: ${usageLogs}\n\n`;
        text += `_Data ini adalah seluruh informasi personal Anda yang disimpan oleh sistem bot._`;

        await adapter.sendMessage(ctx.chatId, text, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal memproses ekspor data: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // F013: deletedata
    if (cmd === 'deletedata') {
      const userId = ctx.senderId;
      const sub = args[0]?.toLowerCase();

      if (sub !== 'confirm') {
        await adapter.sendMessage(
          ctx.chatId,
          `⚠️ *HAPUS DATA BOT* ⚠️\n\n` +
          `Tindakan ini akan menghapus:\n` +
          `• Profil pengguna\n` +
          `• Data ekonomi (saldo, bank, XP)\n` +
          `• Log penggunaan\n\n` +
          `🔴 *Tindakan ini bersifat permanen dan tidak dapat dibatalkan.*\n\n` +
          `Ketik \`/deletedata confirm\` untuk menyetujui penghapusan data Anda.`,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      await logAccess(userId, ctx.chatId, 'delete_data', userId);

      try {
        await prisma.userProfile.deleteMany({ where: { userId } });
        await prisma.userEconomy.deleteMany({ where: { userId } });
        await prisma.usageLog.deleteMany({ where: { userId } });
        await prisma.customVariable.deleteMany({ where: { userId } });

        await adapter.sendMessage(ctx.chatId, '✅ Seluruh data personal Anda berhasil dihapus dari sistem bot.', { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal menghapus data: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // F014: anonanalytics
    if (cmd === 'anonanalytics') {
      const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      if (!isAdmin) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat mengatur anonimisasi analitik.', { quotedMessageId: ctx.id });
        return;
      }

      const sub = args[0]?.toLowerCase();
      if (sub === 'on') {
        const { setGroupFeature } = await import('../../config/feature-flags.js');
        await setGroupFeature(ctx.chatId!, 'anonanalytics', true);
        await adapter.sendMessage(ctx.chatId!, '✅ Fitur *Anonimisasi Analitik* berhasil diaktifkan.', { quotedMessageId: ctx.id });
        await sendPrivacyNotice(ctx.chatId!, 'anonanalytics', adapter);
        return;
      }

      if (sub === 'off') {
        const { setGroupFeature } = await import('../../config/feature-flags.js');
        await setGroupFeature(ctx.chatId!, 'anonanalytics', false);
        await adapter.sendMessage(ctx.chatId!, '✅ Fitur *Anonimisasi Analitik* berhasil dinonaktifkan.', { quotedMessageId: ctx.id });
        return;
      }

      const { getGroupFeatures } = await import('../../config/feature-flags.js');
      const flags = await getGroupFeatures(ctx.chatId!);
      const status = flags.anonanalytics ? '🟢 AKTIF' : '🔴 NONAKTIF';
      await adapter.sendMessage(ctx.chatId!, `🛡️ *ANONIMISASI DATA ANALITIK* 🛡️\n\n• Status: ${status}\n\nPerintah:\n• \`/anonanalytics on|off\``, { quotedMessageId: ctx.id });
      return;
    }

    // F015: sensitivelog
    if (cmd === 'sensitivelog') {
      if (!isOwner(ctx.senderId)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya owner bot yang dapat mengatur sensor log.', { quotedMessageId: ctx.id });
        return;
      }

      const sub = args[0]?.toLowerCase();
      if (sub === 'on') {
        const { setGroupFeature } = await import('../../config/feature-flags.js');
        await setGroupFeature(ctx.chatId!, 'sensitivelog', true);
        await adapter.sendMessage(ctx.chatId!, '✅ Sensor log sensitif berhasil diaktifkan.', { quotedMessageId: ctx.id });
        await sendPrivacyNotice(ctx.chatId!, 'sensitivelog', adapter);
        return;
      }

      if (sub === 'off') {
        const { setGroupFeature } = await import('../../config/feature-flags.js');
        await setGroupFeature(ctx.chatId!, 'sensitivelog', false);
        await adapter.sendMessage(ctx.chatId!, '✅ Sensor log sensitif berhasil dinonaktifkan.', { quotedMessageId: ctx.id });
        return;
      }

      const { getGroupFeatures } = await import('../../config/feature-flags.js');
      const flags = await getGroupFeatures(ctx.chatId!);
      const status = flags.sensitivelog ? '🟢 AKTIF' : '🔴 NONAKTIF';
      await adapter.sendMessage(ctx.chatId!, `🛡️ *SENSOR LOG SENSITIF* 🛡️\n\n• Status: ${status}\n\nPerintah:\n• \`/sensitivelog on|off\``, { quotedMessageId: ctx.id });
      return;
    }

    // F016: consentai
    if (cmd === 'consentai') {
      const sub = args[0]?.toLowerCase();
      const userId = ctx.senderId;

      if (sub === 'yes' || sub === 'ya') {
        await prisma.customVariable.upsert({
          where: {
            groupId_userId_key: {
              groupId: 'global',
              userId,
              key: 'consent:ai'
            }
          },
          create: {
            groupId: 'global',
            userId,
            key: 'consent:ai',
            value: 'yes'
          },
          update: {
            value: 'yes'
          }
        });
        await adapter.sendMessage(ctx.chatId!, '✅ Anda telah memberikan persetujuan (consent) untuk penggunaan fitur AI.', { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'no' || sub === 'tidak') {
        await prisma.customVariable.upsert({
          where: {
            groupId_userId_key: {
              groupId: 'global',
              userId,
              key: 'consent:ai'
            }
          },
          create: {
            groupId: 'global',
            userId,
            key: 'consent:ai',
            value: 'no'
          },
          update: {
            value: 'no'
          }
        });
        await adapter.sendMessage(ctx.chatId!, '✅ Anda telah menolak persetujuan (consent) untuk penggunaan fitur AI.', { quotedMessageId: ctx.id });
        return;
      }

      const consent = await prisma.customVariable.findUnique({
        where: {
          groupId_userId_key: {
            groupId: 'global',
            userId,
            key: 'consent:ai'
          }
        }
      });

      const status = consent?.value === 'yes' ? '🟢 DISETUJUI' : '🔴 DITOLAK / BELUM DISETUJUI';
      await adapter.sendMessage(
        ctx.chatId!,
        `🛡️ *PERSETUJUAN (CONSENT) FITUR AI* 🛡️\n\n` +
        `• Status Anda: ${status}\n\n` +
        `Gunakan:\n` +
        `• \`/consentai yes\` — Setujui penggunaan AI\n` +
        `• \`/consentai no\` — Tolak penggunaan AI`,
        { quotedMessageId: ctx.id }
      );
      return;
    }

    // F017: dataclassification
    if (cmd === 'dataclassification') {
      const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      if (!isAdmin) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat mengelola klasifikasi data.', { quotedMessageId: ctx.id });
        return;
      }

      const sub = args[0]?.toLowerCase();
      if (sub === 'set') {
        const targetCmd = args[1]?.toLowerCase();
        const label = args[2]?.toLowerCase();
        if (!targetCmd || !label || !['public', 'personal', 'sensitive', 'media'].includes(label)) {
          await adapter.sendMessage(ctx.chatId!, '⚠️ Format salah. Gunakan: `/dataclassification set <command> <public|personal|sensitive|media>`', { quotedMessageId: ctx.id });
          return;
        }

        await prisma.customVariable.upsert({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId!,
              userId: 'group',
              key: `classification:${targetCmd}`
            }
          },
          create: {
            groupId: ctx.chatId!,
            userId: 'group',
            key: `classification:${targetCmd}`,
            value: label
          },
          update: {
            value: label
          }
        });

        await adapter.sendMessage(ctx.chatId!, `✅ Klasifikasi data untuk perintah *${targetCmd}* diset ke *${label.toUpperCase()}*.`, { quotedMessageId: ctx.id });
        return;
      }

      // Default: show list
      const configs = await prisma.customVariable.findMany({
        where: {
          groupId: ctx.chatId!,
          key: { startsWith: 'classification:' }
        }
      });

      let text = `🛡️ *KLASIFIKASI DATA PERINTAH* 🛡️\n\n`;
      if (configs.length === 0) {
        text += `Belum ada perintah khusus yang diklasifikasikan.\n\nCara pakai:\n• \`/dataclassification set <command> <label>\``;
      } else {
        configs.forEach(c => {
          const cName = c.key.replace('classification:', '');
          text += `• */${cName}*: *${c.value.toUpperCase()}*\n`;
        });
      }
      await adapter.sendMessage(ctx.chatId!, text, { quotedMessageId: ctx.id });
      return;
    }

    // F018: privateguard
    if (cmd === 'privateguard') {
      const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      if (!isAdmin) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat mengatur Private Guard.', { quotedMessageId: ctx.id });
        return;
      }

      const sub = args[0]?.toLowerCase();
      if (sub === 'on') {
        const { setGroupFeature } = await import('../../config/feature-flags.js');
        await setGroupFeature(ctx.chatId!, 'privateguard', true);
        await adapter.sendMessage(ctx.chatId!, '✅ Fitur *Private Guard* berhasil diaktifkan. Perintah berkategori SENSITIVE hanya akan diizinkan di obrolan pribadi.', { quotedMessageId: ctx.id });
        await sendPrivacyNotice(ctx.chatId!, 'privateguard', adapter);
        return;
      }

      if (sub === 'off') {
        const { setGroupFeature } = await import('../../config/feature-flags.js');
        await setGroupFeature(ctx.chatId!, 'privateguard', false);
        await adapter.sendMessage(ctx.chatId!, '✅ Fitur *Private Guard* berhasil dinonaktifkan.', { quotedMessageId: ctx.id });
        return;
      }

      const { getGroupFeatures } = await import('../../config/feature-flags.js');
      const flags = await getGroupFeatures(ctx.chatId!);
      const status = flags.privateguard ? '🟢 AKTIF' : '🔴 NONAKTIF';
      await adapter.sendMessage(
        ctx.chatId!,
        `🛡️ *PRIVATE GUARD SYSTEM* 🛡️\n\n` +
        `• Status: ${status}\n\n` +
        `Perintah:\n` +
        `• \`/privateguard on|off\``,
        { quotedMessageId: ctx.id }
      );
      return;
    }

    // F019: privacynotice
    if (cmd === 'privacynotice') {
      const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      if (!isAdmin) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat mengatur notifikasi privasi.', { quotedMessageId: ctx.id });
        return;
      }

      const sub = args[0]?.toLowerCase();
      if (sub === 'on') {
        const { setGroupFeature } = await import('../../config/feature-flags.js');
        await setGroupFeature(ctx.chatId!, 'privacynotice', true);
        await adapter.sendMessage(ctx.chatId!, '✅ Fitur *Notifikasi Privasi* berhasil diaktifkan.', { quotedMessageId: ctx.id });
        return;
      }

      if (sub === 'off') {
        const { setGroupFeature } = await import('../../config/feature-flags.js');
        await setGroupFeature(ctx.chatId!, 'privacynotice', false);
        await adapter.sendMessage(ctx.chatId!, '✅ Fitur *Notifikasi Privasi* berhasil dinonaktifkan.', { quotedMessageId: ctx.id });
        return;
      }

      const { getGroupFeatures } = await import('../../config/feature-flags.js');
      const flags = await getGroupFeatures(ctx.chatId!);
      const status = flags.privacynotice ? '🟢 AKTIF' : '🔴 NONAKTIF';
      await adapter.sendMessage(
        ctx.chatId!,
        `🛡️ *NOTIFIKASI PRIVASI OTOMATIS* 🛡️\n\n` +
        `• Status: ${status}\n\n` +
        `Perintah:\n` +
        `• \`/privacynotice on|off\``,
        { quotedMessageId: ctx.id }
      );
      return;
    }

    // F020: auditaccess
    if (cmd === 'auditaccess') {
      if (!isOwner(ctx.senderId)) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Hanya owner bot yang dapat melihat log audit akses.', { quotedMessageId: ctx.id });
        return;
      }

      const sub = args[0]?.toLowerCase();
      if (sub === 'clear') {
        await prisma.auditLog.deleteMany({});
        await adapter.sendMessage(ctx.chatId!, '✅ Log audit akses data sensitif berhasil dikosongkan.', { quotedMessageId: ctx.id });
        return;
      }

      // Default: show audit logs
      try {
        const logs = await prisma.auditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10
        });

        if (logs.length === 0) {
          await adapter.sendMessage(ctx.chatId!, 'ℹ️ Belum ada log akses data sensitif yang tercatat.', { quotedMessageId: ctx.id });
          return;
        }

        let text = `🔒 *LOG AUDIT AKSES DATA SENSITIF* 🔒\n\n`;
        logs.forEach((log, index) => {
          const dateStr = new Date(log.createdAt).toLocaleString('id-ID');
          const actorStr = log.actorId || '';
          text += `${index + 1}. [${dateStr}]\n` +
                  `   • Aktor: @${actorStr.split('@')[0]}\n` +
                  `   • Aksi: ${log.action}\n` +
                  `   • Target: ${log.target}\n\n`;
        });

        const mentions = logs.map(l => l.actorId).filter((id): id is string => id !== null);
        await adapter.sendMessage(ctx.chatId!, text, { quotedMessageId: ctx.id, mentions });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId!, `❌ Gagal mengambil log audit: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }
  }
}

const privacyDataCmd = new PrivacyDataCommand();
registerCommand([
  'retentionmode',
  'exportdata',
  'deletedata',
  'anonanalytics',
  'sensitivelog',
  'consentai',
  'dataclassification',
  'privateguard',
  'privacynotice',
  'auditaccess'
], privacyDataCmd);
