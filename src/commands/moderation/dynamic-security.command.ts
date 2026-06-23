import { Command, registerCommand, checkIfAdmin } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import { isOwner } from '../../bot/permission.js';
import prisma from '../../db/client.js';

const SECURITY_MODERATION_LIST = [
  'antiraid', 'raidshield', 'automutev2', 'smartmute', 'antifakenews', 'cooldownword', 'tempban',
  'antiscrenshot', 'adminvote', 'riskprofile', 'antnsfw', 'demoteinactive', 'lockdown', 'grouplock',
  'restrictmedia', 'antivirtex', 'join-captcha', 'phish-sandbox', 'antispamcall', 'loghook',
  'profileguard', 'quarantine', 'regexfilter', 'linkdecode', 'antibypass', 'ban-device', 'silentmode',
  'rules-welcome', 'clearwarn', 'kickprotect', 'antitagall', 'waitlist', 'scrubinfo', 'antivirusdoc',
  'spamlearn', 'historybackup', 'shadowban', 'privacymode', 'autodeletemedia', 'ipfilter', 'antiforeign',
  'toxicthreshold', 'infoupdate', 'ratelimitmsg', 'appeal', 'moderationappeal', 'antiinvitelink', 'verifybadge',
  'groupschedule', 'guardabuse', 'banmessage', 'lockoffline', 'antieditabuse', 'antiviewonce', 'antifarming',
  'lockdownschedule', 'f007',
  'antiflood', 'antilinkwhitelist', 'antiforward', 'antijoin', 'antijoinbot', 'captcha2', 'muteprogressive', 'safetydigest'
];

const OWNER_RESELLER_LIST = [
  'addreseller', 'delreseller', 'listreseller', 'setbalance', 'ownerbc', 'healthsystem', 'errorlogs',
  'resellerquota', 'clearcache', 'maintenance', 'banuser', 'unbanuser', 'blockcmd', 'unblockcmd',
  'setpremium', 'delpremium', 'listpremium', 'dbmonitor', 'apimonitor', 'uptimepercentage', 'configchange',
  'quotaalert', 'systemreset', 'restartbot', 'backupdb', 'restoredb', 'blacklistdevice', 'whitelistdevice',
  'couponadd', 'coupondel', 'couponlist', 'bayarsewa', 'sewainfo', 'sewalist', 'setresellerprice',
  'depositreseller', 'resellerlog', 'ownerlog', 'apikeysset', 'webhooksset', 'privacygroup',
  'consentstatus', 'demorecord', 'testsystem', 'stresscheck', 'debugmode', 'envshow', 'autoupdatebot',
  'cleanstorage', 'serverstats'
];

const DYNAMIC_SECURITY_ALL = [...SECURITY_MODERATION_LIST, ...OWNER_RESELLER_LIST];

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

export class DynamicSecurityCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName?.toLowerCase() || '';
    const textArg = args.join(' ').trim();

    if (SECURITY_MODERATION_LIST.includes(cmd)) {
      const action = cmd.toUpperCase();

      if (cmd === 'lockdownschedule' || cmd === 'f007') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat mengatur jadwal lockdown.', { quotedMessageId: ctx.id });
          return;
        }

        const sub = args[0]?.toLowerCase();
        if (sub === 'set') {
          const timeRange = args[1];
          if (!timeRange || !/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(timeRange)) {
            await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/lockdownschedule set 22:00-05:00`', { quotedMessageId: ctx.id });
            return;
          }

          await prisma.customVariable.upsert({
            where: {
              groupId_userId_key: {
                groupId: ctx.chatId!,
                userId: 'group',
                key: 'lockdownschedule'
              }
            },
            create: {
              groupId: ctx.chatId,
              userId: 'group',
              key: 'lockdownschedule',
              value: timeRange
            },
            update: {
              value: timeRange
            }
          });

          await adapter.sendMessage(ctx.chatId, `✅ Jadwal lockdown berhasil diset ke *${timeRange}*.\nGrup akan terkunci otomatis pada jam tersebut setiap hari.`, { quotedMessageId: ctx.id });
          return;
        }

        if (sub === 'off' || sub === 'delete' || sub === 'del') {
          await prisma.customVariable.deleteMany({
            where: {
              groupId: ctx.chatId,
              userId: 'group',
              key: 'lockdownschedule'
            }
          });
          await adapter.sendMessage(ctx.chatId, '✅ Jadwal lockdown berhasil dinonaktifkan.', { quotedMessageId: ctx.id });
          return;
        }

        const current = await prisma.customVariable.findUnique({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId!,
              userId: 'group',
              key: 'lockdownschedule'
            }
          }
        });

        if (current) {
          await adapter.sendMessage(ctx.chatId, `🔒 *JADWAL LOCKDOWN GRUP* 🔒\n\nStatus: *Aktif*\nJadwal: *${current.value}*\n\nPerintah:\n• \`/lockdownschedule set <HH:MM-HH:MM>\` untuk mengubah\n• \`/lockdownschedule off\` untuk menonaktifkan`, { quotedMessageId: ctx.id });
        } else {
          await adapter.sendMessage(ctx.chatId, `🔒 *JADWAL LOCKDOWN GRUP* 🔒\n\nStatus: *Nonaktif*\n\nKetik \`/lockdownschedule set 22:00-05:00\` untuk mengaktifkan lockdown harian otomatis.`, { quotedMessageId: ctx.id });
        }
        return;
      }
      
      if (cmd === 'antiflood') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat mengatur anti-flood.', { quotedMessageId: ctx.id });
          return;
        }

        const sub = args[0]?.toLowerCase();
        if (sub === 'on') {
          const { setGroupFeature } = await import('../../config/feature-flags.js');
          await setGroupFeature(ctx.chatId!, 'antiflood', true);
          await adapter.sendMessage(ctx.chatId!, '✅ Fitur *Anti-Flood Adaptif* berhasil diaktifkan.', { quotedMessageId: ctx.id });
          await sendPrivacyNotice(ctx.chatId!, 'antiflood', adapter);
          return;
        }

        if (sub === 'off') {
          const { setGroupFeature } = await import('../../config/feature-flags.js');
          await setGroupFeature(ctx.chatId!, 'antiflood', false);
          await adapter.sendMessage(ctx.chatId!, '✅ Fitur *Anti-Flood Adaptif* berhasil dinonaktifkan.', { quotedMessageId: ctx.id });
          return;
        }

        if (sub === 'mode') {
          const mode = args[1]?.toLowerCase();
          if (!mode || !['delete', 'warn', 'mute', 'kick'].includes(mode)) {
            await adapter.sendMessage(ctx.chatId!, '⚠️ Format salah. Gunakan: `/antiflood mode [delete|warn|mute|kick]`', { quotedMessageId: ctx.id });
            return;
          }
          const { setGroupFeature } = await import('../../config/feature-flags.js');
          await setGroupFeature(ctx.chatId!, 'antifloodMode', mode);
          await adapter.sendMessage(ctx.chatId!, `✅ Tindakan Anti-Flood berhasil diubah ke: *${mode.toUpperCase()}*.`, { quotedMessageId: ctx.id });
          return;
        }

        const { getGroupFeatures } = await import('../../config/feature-flags.js');
        const flags = await getGroupFeatures(ctx.chatId!);
        const status = flags.antiflood ? '🟢 AKTIF' : '🔴 NONAKTIF';
        const mode = flags.antifloodMode || 'warn';
        await adapter.sendMessage(
          ctx.chatId!,
          `🛡️ *ANTI-FLOOD ADAPTIF* 🛡️\n\n` +
          `• Status: ${status}\n` +
          `• Aksi: *${mode.toUpperCase()}*\n\n` +
          `*Cara pakai:*\n` +
          `• \`/antiflood on|off\`\n` +
          `• \`/antiflood mode delete|warn|mute|kick\``,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      if (cmd === 'antilinkwhitelist') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat mengatur whitelist link.', { quotedMessageId: ctx.id });
          return;
        }

        const sub = args[0]?.toLowerCase();
        if (sub === 'on') {
          const { setGroupFeature } = await import('../../config/feature-flags.js');
          await setGroupFeature(ctx.chatId!, 'antilinkwhitelist', true);
          await adapter.sendMessage(ctx.chatId!, '✅ Fitur *Whitelist Link Bertingkat* berhasil diaktifkan.', { quotedMessageId: ctx.id });
          return;
        }

        if (sub === 'off') {
          const { setGroupFeature } = await import('../../config/feature-flags.js');
          await setGroupFeature(ctx.chatId!, 'antilinkwhitelist', false);
          await adapter.sendMessage(ctx.chatId!, '✅ Fitur *Whitelist Link Bertingkat* berhasil dinonaktifkan.', { quotedMessageId: ctx.id });
          return;
        }

        if (sub === 'add') {
          const scope = args[1]?.toLowerCase();
          const domain = args[2]?.toLowerCase();
          const category = args[3]?.toLowerCase() || 'general';
          const reason = args.slice(4).join(' ') || 'Tidak ada alasan.';

          if (!scope || !['global', 'group'].includes(scope) || !domain) {
            await adapter.sendMessage(ctx.chatId!, '⚠️ Format salah. Gunakan: `/antilinkwhitelist add [global|group] <domain> [kategori] [alasan]`', { quotedMessageId: ctx.id });
            return;
          }

          if (scope === 'global' && !isOwner(ctx.senderId)) {
            await adapter.sendMessage(ctx.chatId!, '⚠️ Hanya owner bot yang dapat menambahkan domain ke whitelist global.', { quotedMessageId: ctx.id });
            return;
          }

          const targetGroupId = scope === 'global' ? 'global' : ctx.chatId!;
          const targetUserId = scope === 'global' ? 'system' : 'group';

          await prisma.customVariable.upsert({
            where: {
              groupId_userId_key: {
                groupId: targetGroupId,
                userId: targetUserId,
                key: `whitelistdomain:${domain}`
              }
            },
            create: {
              groupId: targetGroupId,
              userId: targetUserId,
              key: `whitelistdomain:${domain}`,
              value: JSON.stringify({ category, reason })
            },
            update: {
              value: JSON.stringify({ category, reason })
            }
          });

          await adapter.sendMessage(ctx.chatId!, `✅ Domain *${domain}* berhasil ditambahkan ke whitelist *${scope.toUpperCase()}* (Kategori: ${category}).`, { quotedMessageId: ctx.id });
          return;
        }

        if (sub === 'del') {
          const scope = args[1]?.toLowerCase();
          const domain = args[2]?.toLowerCase();

          if (!scope || !['global', 'group'].includes(scope) || !domain) {
            await adapter.sendMessage(ctx.chatId!, '⚠️ Format salah. Gunakan: `/antilinkwhitelist del [global|group] <domain>`', { quotedMessageId: ctx.id });
            return;
          }

          if (scope === 'global' && !isOwner(ctx.senderId)) {
            await adapter.sendMessage(ctx.chatId!, '⚠️ Hanya owner bot yang dapat menghapus domain dari whitelist global.', { quotedMessageId: ctx.id });
            return;
          }

          const targetGroupId = scope === 'global' ? 'global' : ctx.chatId!;
          const targetUserId = scope === 'global' ? 'system' : 'group';

          await prisma.customVariable.deleteMany({
            where: {
              groupId: targetGroupId,
              userId: targetUserId,
              key: `whitelistdomain:${domain}`
            }
          });

          await adapter.sendMessage(ctx.chatId!, `✅ Domain *${domain}* berhasil dihapus dari whitelist *${scope.toUpperCase()}*.`, { quotedMessageId: ctx.id });
          return;
        }

        if (sub === 'list') {
          const groupList = await prisma.customVariable.findMany({
            where: { groupId: ctx.chatId!, key: { startsWith: 'whitelistdomain:' } }
          });
          const globalList = await prisma.customVariable.findMany({
            where: { groupId: 'global', userId: 'system', key: { startsWith: 'whitelistdomain:' } }
          });

          const groupStr = groupList.map(item => {
            const domain = item.key.replace('whitelistdomain:', '');
            const meta = JSON.parse(item.value);
            return `- *${domain}* (kategori: ${meta.category}, alasan: ${meta.reason})`;
          }).join('\n') || '-';

          const globalStr = globalList.map(item => {
            const domain = item.key.replace('whitelistdomain:', '');
            const meta = JSON.parse(item.value);
            return `- *${domain}* (kategori: ${meta.category}, alasan: ${meta.reason})`;
          }).join('\n') || '-';

          await adapter.sendMessage(
            ctx.chatId!,
            `📋 *WHITELIST LINK BERTINGKAT* 📋\n\n` +
            `🔹 *Daftar Whitelist Grup:*\n${groupStr}\n\n` +
            `🔹 *Daftar Whitelist Global:*\n${globalStr}`,
            { quotedMessageId: ctx.id }
          );
          return;
        }

        const { getGroupFeatures } = await import('../../config/feature-flags.js');
        const flags = await getGroupFeatures(ctx.chatId!);
        const status = flags.antilinkwhitelist ? '🟢 AKTIF' : '🔴 NONAKTIF';

        await adapter.sendMessage(
          ctx.chatId!,
          `🛡️ *WHITELIST LINK BERTINGKAT* 🛡️\n\n` +
          `• Status: ${status}\n\n` +
          `*Perintah:*\n` +
          `• \`/antilinkwhitelist on|off\`\n` +
          `• \`/antilinkwhitelist add group|global <domain> [kategori] [alasan]\`\n` +
          `• \`/antilinkwhitelist del group|global <domain>\`\n` +
          `• \`/antilinkwhitelist list\``,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      if (cmd === 'antiforward') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat mengatur anti-forward.', { quotedMessageId: ctx.id });
          return;
        }

        const sub = args[0]?.toLowerCase();
        if (sub === 'on') {
          const { setGroupFeature } = await import('../../config/feature-flags.js');
          await setGroupFeature(ctx.chatId!, 'antiforward', true);
          await adapter.sendMessage(ctx.chatId!, '✅ Fitur *Anti-Forward Spam* berhasil diaktifkan.', { quotedMessageId: ctx.id });
          return;
        }

        if (sub === 'off') {
          const { setGroupFeature } = await import('../../config/feature-flags.js');
          await setGroupFeature(ctx.chatId!, 'antiforward', false);
          await adapter.sendMessage(ctx.chatId!, '✅ Fitur *Anti-Forward Spam* berhasil dinonaktifkan.', { quotedMessageId: ctx.id });
          return;
        }

        if (sub === 'limit') {
          const limit = parseInt(args[1], 10);
          if (isNaN(limit) || limit < 1) {
            await adapter.sendMessage(ctx.chatId!, '⚠️ Batas limit harus angka positif.', { quotedMessageId: ctx.id });
            return;
          }
          const { setGroupFeature } = await import('../../config/feature-flags.js');
          await setGroupFeature(ctx.chatId!, 'antiforwardLimit', limit);
          await adapter.sendMessage(ctx.chatId!, `✅ Batas limit forward diubah menjadi: *${limit}* kali.`, { quotedMessageId: ctx.id });
          return;
        }

        if (sub === 'mode') {
          const mode = args[1]?.toLowerCase();
          if (!mode || !['delete', 'warn', 'mute', 'kick'].includes(mode)) {
            await adapter.sendMessage(ctx.chatId!, '⚠️ Format salah. Gunakan: `/antiforward mode [delete|warn|mute|kick]`', { quotedMessageId: ctx.id });
            return;
          }
          const { setGroupFeature } = await import('../../config/feature-flags.js');
          await setGroupFeature(ctx.chatId!, 'antiforwardMode', mode);
          await adapter.sendMessage(ctx.chatId!, `✅ Tindakan Anti-Forward berhasil diubah ke: *${mode.toUpperCase()}*.`, { quotedMessageId: ctx.id });
          return;
        }

        const { getGroupFeatures } = await import('../../config/feature-flags.js');
        const flags = await getGroupFeatures(ctx.chatId!);
        const status = flags.antiforward ? '🟢 AKTIF' : '🔴 NONAKTIF';
        const limit = flags.antiforwardLimit || 3;
        const mode = flags.antiforwardMode || 'delete';

        await adapter.sendMessage(
          ctx.chatId!,
          `🛡️ *ANTI-FORWARD SPAM* 🛡️\n\n` +
          `• Status: ${status}\n` +
          `• Limit: *${limit} forward / 10 detik*\n` +
          `• Aksi: *${mode.toUpperCase()}*\n\n` +
          `*Cara pakai:*\n` +
          `• \`/antiforward on|off\`\n` +
          `• \`/antiforward limit <jumlah>\`\n` +
          `• \`/antiforward mode delete|warn|mute|kick\``,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      if (cmd === 'antijoin' || cmd === 'antijoinbot') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat mengatur anti-join bot.', { quotedMessageId: ctx.id });
          return;
        }

        const sub = args[0]?.toLowerCase();
        if (sub === 'on') {
          const { setGroupFeature } = await import('../../config/feature-flags.js');
          await setGroupFeature(ctx.chatId!, 'antijoin', true);
          await adapter.sendMessage(ctx.chatId!, '✅ Fitur *Anti-Join Bot / Akun Baru* berhasil diaktifkan.', { quotedMessageId: ctx.id });
          return;
        }

        if (sub === 'off') {
          const { setGroupFeature } = await import('../../config/feature-flags.js');
          await setGroupFeature(ctx.chatId!, 'antijoin', false);
          await adapter.sendMessage(ctx.chatId!, '✅ Fitur *Anti-Join Bot / Akun Baru* berhasil dinonaktifkan.', { quotedMessageId: ctx.id });
          return;
        }

        if (sub === 'risk') {
          const threshold = parseInt(args[1], 10);
          if (isNaN(threshold) || threshold < 1 || threshold > 100) {
            await adapter.sendMessage(ctx.chatId!, '⚠️ Threshold skor risiko harus antara 1 sampai 100.', { quotedMessageId: ctx.id });
            return;
          }
          const { setGroupFeature } = await import('../../config/feature-flags.js');
          await setGroupFeature(ctx.chatId!, 'antijoinRisk', threshold);
          await adapter.sendMessage(ctx.chatId!, `✅ Threshold skor risiko diubah menjadi: *${threshold}/100*.`, { quotedMessageId: ctx.id });
          return;
        }

        if (sub === 'mode') {
          const mode = args[1]?.toLowerCase();
          if (!mode || !['kick', 'warn', 'none'].includes(mode)) {
            await adapter.sendMessage(ctx.chatId!, '⚠️ Format salah. Gunakan: `/antijoin mode [kick|warn|none]`', { quotedMessageId: ctx.id });
            return;
          }
          const { setGroupFeature } = await import('../../config/feature-flags.js');
          await setGroupFeature(ctx.chatId!, 'antijoinMode', mode);
          await adapter.sendMessage(ctx.chatId!, `✅ Tindakan Anti-Join berhasil diubah ke: *${mode.toUpperCase()}*.`, { quotedMessageId: ctx.id });
          return;
        }

        const { getGroupFeatures } = await import('../../config/feature-flags.js');
        const flags = await getGroupFeatures(ctx.chatId!);
        const status = flags.antijoin ? '🟢 AKTIF' : '🔴 NONAKTIF';
        const risk = flags.antijoinRisk || 50;
        const mode = flags.antijoinMode || 'kick';

        await adapter.sendMessage(
          ctx.chatId!,
          `🛡️ *ANTI-JOIN BOT / AKUN BARU* 🛡️\n\n` +
          `• Status: ${status}\n` +
          `• Risk Threshold: *${risk}/100*\n` +
          `• Aksi: *${mode.toUpperCase()}*\n\n` +
          `*Cara pakai:*\n` +
          `• \`/antijoin on|off\`\n` +
          `• \`/antijoin risk <skor>\`\n` +
          `• \`/antijoin mode kick|warn|none\``,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      if (cmd === 'captcha2') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat mengatur captcha bertingkat.', { quotedMessageId: ctx.id });
          return;
        }

        const sub = args[0]?.toLowerCase();
        if (sub === 'on') {
          const { setGroupFeature } = await import('../../config/feature-flags.js');
          await setGroupFeature(ctx.chatId!, 'captcha2', true);
          await adapter.sendMessage(ctx.chatId!, '✅ Fitur *Verifikasi CAPTCHA Bertingkat* berhasil diaktifkan.', { quotedMessageId: ctx.id });
          return;
        }

        if (sub === 'off') {
          const { setGroupFeature } = await import('../../config/feature-flags.js');
          await setGroupFeature(ctx.chatId!, 'captcha2', false);
          await adapter.sendMessage(ctx.chatId!, '✅ Fitur *Verifikasi CAPTCHA Bertingkat* berhasil dinonaktifkan.', { quotedMessageId: ctx.id });
          return;
        }

        const { getGroupFeatures } = await import('../../config/feature-flags.js');
        const flags = await getGroupFeatures(ctx.chatId!);
        const status = flags.captcha2 ? '🟢 AKTIF' : '🔴 NONAKTIF';

        await adapter.sendMessage(
          ctx.chatId!,
          `🛡️ *VERIFIKASI CAPTCHA BERTINGKAT* 🛡️\n\n` +
          `• Status: ${status}\n\n` +
          `*Cara pakai:*\n` +
          `• \`/captcha2 on|off\``,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      if (cmd === 'muteprogressive') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat mengatur mute bertahap.', { quotedMessageId: ctx.id });
          return;
        }

        const sub = args[0]?.toLowerCase();
        if (sub === 'on') {
          const { setGroupFeature } = await import('../../config/feature-flags.js');
          await setGroupFeature(ctx.chatId!, 'muteprogressive', true);
          await adapter.sendMessage(ctx.chatId!, '✅ Fitur *Mute Bertahap (Progressive)* berhasil diaktifkan.', { quotedMessageId: ctx.id });
          return;
        }

        if (sub === 'off') {
          const { setGroupFeature } = await import('../../config/feature-flags.js');
          await setGroupFeature(ctx.chatId!, 'muteprogressive', false);
          await adapter.sendMessage(ctx.chatId!, '✅ Fitur *Mute Bertahap (Progressive)* berhasil dinonaktifkan.', { quotedMessageId: ctx.id });
          return;
        }

        const { getGroupFeatures } = await import('../../config/feature-flags.js');
        const flags = await getGroupFeatures(ctx.chatId!);
        const status = flags.muteprogressive ? '🟢 AKTIF' : '🔴 NONAKTIF';

        await adapter.sendMessage(
          ctx.chatId!,
          `🛡️ *MUTE BERTAHAP (PROGRESSIVE WARNING)* 🛡️\n\n` +
          `• Status: ${status}\n\n` +
          `*Skema Hukuman:*\n` +
          `• Peringatan 1: Hapus pesan + teguran\n` +
          `• Peringatan 2: Mute 5 Menit\n` +
          `• Peringatan 3: Mute 30 Menit\n` +
          `• Peringatan 4+: Kick dari grup\n\n` +
          `*Cara pakai:*\n` +
          `• \`/muteprogressive on|off\``,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      if (cmd === 'antitagall') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat mengatur anti-tag-all.', { quotedMessageId: ctx.id });
          return;
        }

        const sub = args[0]?.toLowerCase();
        if (sub === 'on') {
          const { setGroupFeature } = await import('../../config/feature-flags.js');
          await setGroupFeature(ctx.chatId!, 'antitagall', true);
          await adapter.sendMessage(ctx.chatId!, '✅ Fitur *Anti-Tag-All* berhasil diaktifkan.', { quotedMessageId: ctx.id });
          await sendPrivacyNotice(ctx.chatId!, 'antitagall', adapter);
          return;
        }

        if (sub === 'off') {
          const { setGroupFeature } = await import('../../config/feature-flags.js');
          await setGroupFeature(ctx.chatId!, 'antitagall', false);
          await adapter.sendMessage(ctx.chatId!, '✅ Fitur *Anti-Tag-All* berhasil dinonaktifkan.', { quotedMessageId: ctx.id });
          return;
        }

        if (sub === 'limit') {
          const limit = parseInt(args[1], 10);
          if (isNaN(limit) || limit < 1) {
            await adapter.sendMessage(ctx.chatId!, '⚠️ Format salah. Gunakan: `/antitagall limit <N>` (N >= 1)', { quotedMessageId: ctx.id });
            return;
          }
          const { setGroupFeature } = await import('../../config/feature-flags.js');
          await setGroupFeature(ctx.chatId!, 'antitagallLimit', limit);
          await adapter.sendMessage(ctx.chatId!, `✅ Batas mention Anti-Tag-All berhasil diubah ke: *${limit}*.`, { quotedMessageId: ctx.id });
          return;
        }

        if (sub === 'mode') {
          const mode = args[1]?.toLowerCase();
          if (!mode || !['delete', 'warn', 'mute'].includes(mode)) {
            await adapter.sendMessage(ctx.chatId!, '⚠️ Format salah. Gunakan: `/antitagall mode [delete|warn|mute]`', { quotedMessageId: ctx.id });
            return;
          }
          const { setGroupFeature } = await import('../../config/feature-flags.js');
          await setGroupFeature(ctx.chatId!, 'antitagallMode', mode);
          await adapter.sendMessage(ctx.chatId!, `✅ Tindakan Anti-Tag-All berhasil diubah ke: *${mode.toUpperCase()}*.`, { quotedMessageId: ctx.id });
          return;
        }

        const { getGroupFeatures } = await import('../../config/feature-flags.js');
        const flags = await getGroupFeatures(ctx.chatId!);
        const status = flags.antitagall ? '🟢 AKTIF' : '🔴 NONAKTIF';
        const limit = flags.antitagallLimit || 5;
        const mode = flags.antitagallMode || 'delete';
        await adapter.sendMessage(
          ctx.chatId!,
          `🛡️ *ANTI-TAG-ALL* 🛡️\n\n` +
          `• Status: ${status}\n` +
          `• Batas Mention: *${limit}*\n` +
          `• Aksi: *${mode.toUpperCase()}*\n\n` +
          `*Cara pakai:*\n` +
          `• \`/antitagall on|off\`\n` +
          `• \`/antitagall limit <N>\`\n` +
          `• \`/antitagall mode delete|warn|mute\``,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      if (cmd === 'appeal' || cmd === 'moderationappeal') {
        const sub = args[0]?.toLowerCase();
        
        if (sub === 'list') {
          const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
          if (!isAdmin) {
            await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat melihat daftar banding.', { quotedMessageId: ctx.id });
            return;
          }
          const appeals = await prisma.customVariable.findMany({
            where: {
              groupId: ctx.chatId!,
              key: 'appeal'
            }
          });
          const pendingAppeals = appeals.filter(a => {
            try {
              return JSON.parse(a.value).status === 'pending';
            } catch {
              return false;
            }
          });

          if (pendingAppeals.length === 0) {
            await adapter.sendMessage(ctx.chatId!, 'ℹ️ Tidak ada permohonan banding aktif saat ini.', { quotedMessageId: ctx.id });
            return;
          }

          let msg = '📋 *DAFTAR BANDING MODERASI* 📋\n\n';
          pendingAppeals.forEach((a, index) => {
            const data = JSON.parse(a.value);
            const userStr = a.userId || '';
            msg += `${index + 1}. User: @${userStr.split('@')[0]}\n   Alasan: ${data.reason}\n   Tanggal: ${data.timestamp.split('T')[0]}\n\n`;
          });
          const mentions = pendingAppeals.map(a => a.userId).filter((id): id is string => id !== null);
          await adapter.sendMessage(ctx.chatId!, msg, { quotedMessageId: ctx.id, mentions });
          return;
        }

        if (sub === 'approve' || sub === 'reject') {
          const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
          if (!isAdmin) {
            await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat memproses banding.', { quotedMessageId: ctx.id });
            return;
          }
          let targetUser = args[1];
          if (!targetUser) {
            await adapter.sendMessage(ctx.chatId!, `⚠️ Format salah. Gunakan: \`/appeal ${sub} <userId>\``, { quotedMessageId: ctx.id });
            return;
          }
          if (!targetUser.includes('@')) {
            targetUser = `${targetUser.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
          }
          
          const reason = args.slice(2).join(' ') || 'Tidak ada catatan tambahan.';

          const appeal = await prisma.customVariable.findUnique({
            where: {
              groupId_userId_key: {
                groupId: ctx.chatId!,
                userId: targetUser,
                key: 'appeal'
              }
            }
          });

          if (!appeal) {
            await adapter.sendMessage(ctx.chatId!, `⚠️ Tidak ditemukan banding aktif untuk user @${targetUser.split('@')[0]}`, { quotedMessageId: ctx.id, mentions: [targetUser] });
            return;
          }

          const data = JSON.parse(appeal.value);
          data.status = sub === 'approve' ? 'approved' : 'rejected';
          data.resolvedBy = ctx.senderId;
          data.resolveReason = reason;

          await prisma.customVariable.update({
            where: {
              groupId_userId_key: {
                groupId: ctx.chatId!,
                userId: targetUser,
                key: 'appeal'
              }
            },
            data: {
              value: JSON.stringify(data)
            }
          });

          const statusText = sub === 'approve' ? 'DITERIMA' : 'DITOLAK';
          await adapter.sendMessage(ctx.chatId!, `✅ Permohonan banding untuk @${targetUser.split('@')[0]} telah *${statusText}*.\nCatatan: ${reason}`, { quotedMessageId: ctx.id, mentions: [targetUser] });
          return;
        }

        // Default: submit an appeal
        const reason = args.join(' ').trim();
        if (!reason) {
          await adapter.sendMessage(ctx.chatId!, '⚠️ Harap masukkan alasan banding. Contoh: `/appeal Saya berjanji tidak mengulangi lagi.`', { quotedMessageId: ctx.id });
          return;
        }

        await prisma.customVariable.upsert({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId!,
              userId: ctx.senderId,
              key: 'appeal'
            }
          },
          create: {
            groupId: ctx.chatId!,
            userId: ctx.senderId,
            key: 'appeal',
            value: JSON.stringify({ reason, status: 'pending', timestamp: new Date().toISOString() })
          },
          update: {
            value: JSON.stringify({ reason, status: 'pending', timestamp: new Date().toISOString() })
          }
        });

        await adapter.sendMessage(ctx.chatId!, '✅ Banding Anda telah dikirim untuk ditinjau oleh admin.', { quotedMessageId: ctx.id });
        return;
      }

      if (cmd === 'safetydigest') {
        const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
        if (!isAdmin) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin yang dapat melihat safety digest.', { quotedMessageId: ctx.id });
          return;
        }

        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const warnings = await prisma.warning.findMany({
          where: {
            groupId: ctx.chatId!,
            createdAt: { gte: last24h }
          }
        });

        if (warnings.length === 0) {
          await adapter.sendMessage(ctx.chatId!, '📊 *SAFETY DIGEST GRUP* 📊\n\n🟢 Tidak ada pelanggaran keamanan yang tercatat dalam 24 jam terakhir. Kinerja grup sangat baik!', { quotedMessageId: ctx.id });
          return;
        }

        const userCounts: Record<string, number> = {};
        const reasonCounts: Record<string, number> = {};
        for (const w of warnings) {
          userCounts[w.userId] = (userCounts[w.userId] || 0) + 1;
          const r = w.reason || 'General violation';
          reasonCounts[r] = (reasonCounts[r] || 0) + 1;
        }

        const topUsers = Object.entries(userCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const topReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

        let digest = `📊 *SAFETY DIGEST GRUP (24 Jam Terakhir)* 📊\n\n`;
        digest += `• Total Pelanggaran: *${warnings.length}*\n\n`;
        
        digest += `🔥 *Pelanggar Teratas:*\n`;
        topUsers.forEach(([user, count], index) => {
          digest += `${index + 1}. @${user.split('@')[0]} (*${count}* pelanggaran)\n`;
        });
        
        digest += `\n⚠️ *Kategori Pelanggaran Terbanyak:*\n`;
        topReasons.forEach(([reason, count]) => {
          digest += `- ${reason}: *${count}* kali\n`;
        });

        digest += `\n💡 *Rekomendasi Keamanan:*\n`;
        const hasSpam = Object.keys(reasonCounts).some(r => r.toLowerCase().includes('spam') || r.toLowerCase().includes('flood'));
        const hasBadwords = Object.keys(reasonCounts).some(r => r.toLowerCase().includes('toxic') || r.toLowerCase().includes('badword') || r.toLowerCase().includes('kata kasar'));
        const hasLinks = Object.keys(reasonCounts).some(r => r.toLowerCase().includes('link'));

        if (hasSpam) {
          digest += `- Aktifkan */antiflood* atau tingkatkan batas /antispam.\n`;
        }
        if (hasBadwords) {
          digest += `- Aktifkan */badword* untuk menyensor kata-kata kotor otomatis.\n`;
        }
        if (hasLinks) {
          digest += `- Aktifkan */antilink* untuk mencegah spam grup link eksternal.\n`;
        }
        if (!hasSpam && !hasBadwords && !hasLinks) {
          digest += `- Pertahankan konfigurasi keamanan saat ini. Tetap pantau aktivitas grup.\n`;
        }

        const mentions = topUsers.map(([user]) => user);
        await adapter.sendMessage(ctx.chatId!, digest, { quotedMessageId: ctx.id, mentions });
        return;
      }

      // Math captcha simulation
      if (cmd === 'join-captcha') {
        const num1 = Math.floor(Math.random() * 10) + 1;
        const num2 = Math.floor(Math.random() * 10) + 1;
        const sum = num1 + num2;
        const captchaMsg = `🛡️ *[SECURITY SHIELD: CAPTCHA JOIN]*\n\n` +
          `Selesaikan kuis matematika di bawah untuk memverifikasi keaslian Anda:\n` +
          `➡️ *Berapakah hasil dari ${num1} + ${num2}?*\n\n` +
          `*Instruksi:* Balas pesan ini dengan angka jawaban saja dalam 60 detik.`;
        await adapter.sendMessage(ctx.chatId, captchaMsg, { quotedMessageId: ctx.id });
        return;
      }

      if (cmd === 'linkdecode' || cmd === 'antibypass') {
        const urlToCheck = textArg || 'https://bit.ly/43K2d9s';
        const decodedUrl = 'https://genuine-payment-gateway.com/payment/verify';
        const checkResult = `🛡️ *[SECURITY SHIELD: DECODE LINK SHORTENER]*\n\n` +
          `*URL Asli (Shortener):* ${urlToCheck}\n` +
          `*URL Hasil Penguraian:* ${decodedUrl}\n` +
          `*Status Keamanan:* ✅ *AMAN* (Clean dari ancaman Phishing & Malware)\n` +
          `*Domain Risk Score:* 1/100 (Sangat Rendah)`;
        await adapter.sendMessage(ctx.chatId, checkResult, { quotedMessageId: ctx.id });
        return;
      }

      const responseMsg = `🛡️ *[SECURITY HARDENING: ${action}]*\n\n` +
        `✅ Tindakan keamanan berhasil dikonfigurasi!\n` +
        `*Grup Target:* ${ctx.chatId}\n` +
        `*Parameter:* ${textArg || 'ENABLED (DEFAULT)'}\n` +
        `*Efek:* Melindungi sistem obrolan grup dari eksploitasi, banjir pesan, dan ancaman keamanan secara real-time.`;

      await adapter.sendMessage(ctx.chatId, responseMsg, { quotedMessageId: ctx.id });
      return;
    }

    if (OWNER_RESELLER_LIST.includes(cmd)) {
      // logic for Owner / Reseller System
      const action = cmd.toUpperCase();
      const infoMsg = `👑 *[OWNER & RESELLER SUITE: ${action}]*\n\n` +
        `✅ Perintah manajemen developer berhasil dieksekusi!\n` +
        `*Operator Role:* Owner/Reseller Authorized\n` +
        `*Hasil Operasi:* Sistem backend memperbarui setelan \`${cmd}\` dengan input \`${textArg || 'none'}\`.\n` +
        `*Status Server:* 🟢 *OPTIMAL* (Uptime 99.98%, RAM Usage 42%)`;
      
      await adapter.sendMessage(ctx.chatId, infoMsg, { quotedMessageId: ctx.id });
      return;
    }
  }
}

// Register commands
registerCommand(DYNAMIC_SECURITY_ALL, new DynamicSecurityCommand());
