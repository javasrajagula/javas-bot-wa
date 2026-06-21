import { Command, registerCommand, checkIfAdmin } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';
import { localizerService } from '../../services/system/localizer.service.js';
import { parseFeatureFlags } from '../../config/feature-flags.js';

export async function interpolateTemplate(
  template: string,
  participant: string,
  groupId: string,
  adapter: WhatsAppAdapter
): Promise<string> {
  const socket = (adapter as any).sock;
  let groupName = 'grup';
  let memberCount = '0';
  let rules = 'tidak ada aturan khusus.';

  if (socket) {
    try {
      const metadata = await socket.groupMetadata(groupId);
      groupName = metadata.subject || 'grup';
      memberCount = String(metadata.participants?.length || 0);
      rules = metadata.desc || 'tidak ada aturan khusus.';
    } catch (err) {
      console.error('Failed to fetch group metadata for template:', err);
    }
  }

  const dateObj = new Date();
  const dateStr = dateObj.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' });
  const timeStr = dateObj.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });

  const config = await prisma.groupConfig.findUnique({
    where: { groupId }
  });
  const prefix = config?.prefix || '/';

  const mention = `@${participant.split('@')[0]}`;

  return template
    .replace(/{user}/g, mention)
    .replace(/{group}/g, groupName)
    .replace(/{date}/g, dateStr)
    .replace(/{time}/g, timeStr)
    .replace(/{memberCount}/g, memberCount)
    .replace(/{rules}/g, rules)
    .replace(/{prefix}/g, prefix);
}

// Captcha verification sessions are persisted via stateStore.

export class WelcomeCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
    if (!isAdmin) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang dapat menggunakan command ini.', { quotedMessageId: ctx.id });
      return;
    }

    const commandType = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // Fetch current features config
    const config = await prisma.groupConfig.findUnique({ where: { groupId: ctx.chatId } });
    const features = config ? parseFeatureFlags(config.featuresJson) : {};

    // 1. /welcome [on|off]
    if (commandType === 'welcome') {
      const state = args[0]?.toLowerCase().trim();
      if (state === 'on') {
        features.welcome = true;
        await this.saveFeatures(ctx.chatId, features);
        await adapter.sendMessage(ctx.chatId, '✅ Pesan sambutan otomatis diaktifkan.', { quotedMessageId: ctx.id });
      } else if (state === 'off') {
        features.welcome = false;
        await this.saveFeatures(ctx.chatId, features);
        await adapter.sendMessage(ctx.chatId, '✅ Pesan sambutan otomatis dinonaktifkan.', { quotedMessageId: ctx.id });
      } else {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/welcome [on|off]`', { quotedMessageId: ctx.id });
      }
      return;
    }

    // 2. /goodbye [on|off]
    if (commandType === 'goodbye') {
      const state = args[0]?.toLowerCase().trim();
      if (state === 'on') {
        features.goodbye = true;
        await this.saveFeatures(ctx.chatId, features);
        await adapter.sendMessage(ctx.chatId, '✅ Pesan perpisahan otomatis diaktifkan.', { quotedMessageId: ctx.id });
      } else if (state === 'off') {
        features.goodbye = false;
        await this.saveFeatures(ctx.chatId, features);
        await adapter.sendMessage(ctx.chatId, '✅ Pesan perpisahan otomatis dinonaktifkan.', { quotedMessageId: ctx.id });
      } else {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/goodbye [on|off]`', { quotedMessageId: ctx.id });
      }
      return;
    }

    // 3. /setwelcome <template>
    if (commandType === 'setwelcome') {
      const template = args.join(' ').trim();
      if (!template) {
        await adapter.sendMessage(
          ctx.chatId,
          `⚠️ Format salah. Masukkan template pesan sambutan.\n` +
          `Variabel: {user}, {group}, {date}, {time}, {memberCount}, {rules}, {prefix}\n\n` +
          `Contoh:\n\`/setwelcome Halo {user}, selamat datang di {group}! Silakan baca peraturan: {rules}\``,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      features.welcomeMessage = template;
      await this.saveFeatures(ctx.chatId, features);
      await adapter.sendMessage(ctx.chatId, '✅ Template welcome message berhasil diperbarui.', { quotedMessageId: ctx.id });
      return;
    }

    // 4. /setgoodbye <template>
    if (commandType === 'setgoodbye') {
      const template = args.join(' ').trim();
      if (!template) {
        await adapter.sendMessage(
          ctx.chatId,
          `⚠️ Format salah. Masukkan template pesan perpisahan.\n` +
          `Variabel: {user}, {group}, {date}, {time}, {memberCount}, {prefix}\n\n` +
          `Contoh:\n\`/setgoodbye Dadah {user}, semoga sukses di luar sana!\``,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      features.goodbyeMessage = template;
      await this.saveFeatures(ctx.chatId, features);
      await adapter.sendMessage(ctx.chatId, '✅ Template goodbye message berhasil diperbarui.', { quotedMessageId: ctx.id });
      return;
    }

    // 5. /welcomecard [on|off]
    if (commandType === 'welcomecard') {
      const state = args[0]?.toLowerCase().trim();
      if (state === 'on') {
        features.welcomecard = true;
        await this.saveFeatures(ctx.chatId, features);
        await adapter.sendMessage(ctx.chatId, '✅ Kartu ucapan welcome (gambar) diaktifkan.', { quotedMessageId: ctx.id });
      } else if (state === 'off') {
        features.welcomecard = false;
        await this.saveFeatures(ctx.chatId, features);
        await adapter.sendMessage(ctx.chatId, '✅ Kartu ucapan welcome (gambar) dinonaktifkan.', { quotedMessageId: ctx.id });
      } else {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/welcomecard [on|off]`', { quotedMessageId: ctx.id });
      }
      return;
    }

    // 6. /captcha [on|off]
    if (commandType === 'captcha') {
      const state = args[0]?.toLowerCase().trim();
      if (state === 'on') {
        features.captcha = true;
        await this.saveFeatures(ctx.chatId, features);
        await adapter.sendMessage(ctx.chatId, '✅ Captcha verifikasi member baru diaktifkan.', { quotedMessageId: ctx.id });
      } else if (state === 'off') {
        features.captcha = false;
        await this.saveFeatures(ctx.chatId, features);
        await adapter.sendMessage(ctx.chatId, '✅ Captcha verifikasi member baru dinonaktifkan.', { quotedMessageId: ctx.id });
      } else {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/captcha [on|off]`', { quotedMessageId: ctx.id });
      }
      return;
    }
  }

  private async saveFeatures(groupId: string, features: Record<string, any>) {
    await prisma.groupConfig.upsert({
      where: { groupId },
      create: {
        groupId,
        prefix: '/',
        botEnabled: true,
        featuresJson: JSON.stringify(features)
      },
      update: {
        featuresJson: JSON.stringify(features)
      }
    });
  }
}

// Register commands
const welcomeCmd = new WelcomeCommand();
registerCommand(['welcome', 'goodbye', 'setwelcome', 'setgoodbye', 'welcomecard', 'captcha'], welcomeCmd);
