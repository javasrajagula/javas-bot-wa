import { Command, registerCommand, checkIfAdmin } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';

export class BackupConfigCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Perintah ini hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
    if (!isAdmin) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang memiliki wewenang untuk perintah ini.', { quotedMessageId: ctx.id });
      return;
    }

    const cmd = ctx.command?.commandName || '';

    // 1. /backupconfig
    if (cmd === 'backupconfig') {
      try {
        const [config, autoReplies, badwords, warningRules, commandAliases, blacklists] = await Promise.all([
          prisma.groupConfig.findUnique({ where: { groupId: ctx.chatId } }),
          prisma.autoReply.findMany({ where: { groupId: ctx.chatId } }),
          prisma.badword.findMany({ where: { groupId: ctx.chatId } }),
          prisma.warningRule.findMany({ where: { groupId: ctx.chatId } }),
          prisma.commandAlias.findMany({ where: { groupId: ctx.chatId } }),
          prisma.blacklist.findMany({ where: { groupId: ctx.chatId, scope: 'group' } })
        ]);

        const payload = {
          backupType: 'group-config',
          version: 1,
          groupId: ctx.chatId,
          timestamp: new Date().toISOString(),
          config: {
            prefix: config?.prefix || '/',
            botEnabled: config?.botEnabled ?? true,
            featuresJson: config?.featuresJson || '{}',
            welcomeMessage: config?.welcomeMessage,
            goodbyeMessage: config?.goodbyeMessage,
          },
          autoReplies: autoReplies.map(r => ({ trigger: r.trigger, response: r.response, matchType: r.matchType })),
          badwords: badwords.map(b => ({ word: b.word })),
          warningRules: warningRules.map(w => ({ threshold: w.threshold, action: w.action, duration: w.duration })),
          commandAliases: commandAliases.map(c => ({ alias: c.alias, command: c.command })),
          blacklists: blacklists.map(b => ({ userId: b.userId, reason: b.reason }))
        };

        const buffer = Buffer.from(JSON.stringify(payload, null, 2), 'utf-8');
        const fileName = `config-group-${ctx.chatId.split('@')[0]}.json`;

        await adapter.sendDocument(ctx.chatId, buffer, fileName, 'application/json', {
          quotedMessageId: ctx.id
        });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal membuat cadangan konfigurasi: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 2. /restoreconfig
    if (cmd === 'restoreconfig') {
      const media = ctx.media || ctx.quotedMessage?.media;
      if (!media) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Mohon reply/quote file JSON hasil backup dengan perintah `/restoreconfig` untuk memulihkan konfigurasi.', { quotedMessageId: ctx.id });
        return;
      }

      try {
        const fileBuffer = await media.getBuffer();
        const payload = JSON.parse(fileBuffer.toString('utf-8'));

        if (payload.backupType !== 'group-config') {
          await adapter.sendMessage(ctx.chatId, '❌ File cadangan tidak valid atau bukan merupakan konfigurasi grup.', { quotedMessageId: ctx.id });
          return;
        }

        const data = payload.config;

        await prisma.$transaction(async (tx) => {
          // 1. GroupConfig
          await tx.groupConfig.upsert({
            where: { groupId: ctx.chatId },
            create: {
              groupId: ctx.chatId,
              prefix: data.prefix,
              botEnabled: data.botEnabled,
              featuresJson: data.featuresJson,
              welcomeMessage: data.welcomeMessage,
              goodbyeMessage: data.goodbyeMessage,
            },
            update: {
              prefix: data.prefix,
              botEnabled: data.botEnabled,
              featuresJson: data.featuresJson,
              welcomeMessage: data.welcomeMessage,
              goodbyeMessage: data.goodbyeMessage,
            }
          });

          // 2. AutoReplies
          await tx.autoReply.deleteMany({ where: { groupId: ctx.chatId } });
          if (payload.autoReplies && Array.isArray(payload.autoReplies)) {
            for (const r of payload.autoReplies) {
              await tx.autoReply.create({
                data: {
                  groupId: ctx.chatId,
                  trigger: r.trigger,
                  response: r.response,
                  matchType: r.matchType || 'exact',
                  createdBy: ctx.senderId
                }
              });
            }
          }

          // 3. Badwords
          await tx.badword.deleteMany({ where: { groupId: ctx.chatId } });
          if (payload.badwords && Array.isArray(payload.badwords)) {
            for (const b of payload.badwords) {
              await tx.badword.create({
                data: {
                  groupId: ctx.chatId,
                  word: b.word,
                  createdBy: ctx.senderId
                }
              });
            }
          }

          // 4. WarningRules
          await tx.warningRule.deleteMany({ where: { groupId: ctx.chatId } });
          if (payload.warningRules && Array.isArray(payload.warningRules)) {
            for (const w of payload.warningRules) {
              await tx.warningRule.create({
                data: {
                  groupId: ctx.chatId,
                  threshold: w.threshold,
                  action: w.action,
                  duration: w.duration
                }
              });
            }
          }

          // 5. CommandAliases
          await tx.commandAlias.deleteMany({ where: { groupId: ctx.chatId } });
          if (payload.commandAliases && Array.isArray(payload.commandAliases)) {
            for (const c of payload.commandAliases) {
              await tx.commandAlias.create({
                data: {
                  groupId: ctx.chatId,
                  alias: c.alias,
                  command: c.command,
                  createdBy: ctx.senderId
                }
              });
            }
          }

          // 6. Blacklist
          await tx.blacklist.deleteMany({ where: { groupId: ctx.chatId, scope: 'group' } });
          if (payload.blacklists && Array.isArray(payload.blacklists)) {
            for (const b of payload.blacklists) {
              await tx.blacklist.create({
                data: {
                  scope: 'group',
                  groupId: ctx.chatId,
                  userId: b.userId,
                  reason: b.reason,
                  createdBy: ctx.senderId
                }
              });
            }
          }
        });

        await adapter.sendMessage(ctx.chatId, '✅ Konfigurasi grup (fitur, autoreply, badword, alias, blacklist) berhasil dipulihkan dari cadangan!', { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `❌ Gagal memulihkan konfigurasi: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }
  }
}

const backupConfigCmd = new BackupConfigCommand();
registerCommand(['backupconfig', 'restoreconfig'], backupConfigCmd);
