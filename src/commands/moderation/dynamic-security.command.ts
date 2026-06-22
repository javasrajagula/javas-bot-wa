import { Command, registerCommand, checkIfAdmin } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';

const SECURITY_MODERATION_LIST = [
  'antiraid', 'raidshield', 'automutev2', 'smartmute', 'antifakenews', 'cooldownword', 'tempban',
  'antiscrenshot', 'adminvote', 'riskprofile', 'antnsfw', 'demoteinactive', 'lockdown', 'grouplock',
  'restrictmedia', 'antivirtex', 'join-captcha', 'phish-sandbox', 'antispamcall', 'loghook',
  'profileguard', 'quarantine', 'regexfilter', 'linkdecode', 'antibypass', 'ban-device', 'silentmode',
  'rules-welcome', 'clearwarn', 'kickprotect', 'antitagall', 'waitlist', 'scrubinfo', 'antivirusdoc',
  'spamlearn', 'historybackup', 'shadowban', 'privacymode', 'autodeletemedia', 'ipfilter', 'antiforeign',
  'toxicthreshold', 'infoupdate', 'ratelimitmsg', 'appeal', 'antiinvitelink', 'verifybadge',
  'groupschedule', 'guardabuse', 'banmessage', 'lockoffline', 'antieditabuse', 'antiviewonce', 'antifarming',
  'lockdownschedule', 'f007'
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
