import { Command, registerCommand, checkIfAdmin } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import prisma from '../db/client.js';
import { DEFAULT_FEATURES, parseFeatureFlags, getGroupFeatures } from '../config/feature-flags.js';

const PRESETS: Record<string, Record<string, any>> = {
  sekolah: {
    welcome: true,
    goodbye: true,
    antilink: true,
    antispam: true,
    badword: true,
    reminder: true,
    attendance: true,
    economy: false,
    miniGames: false,
    groupMode: 'sekolah'
  },
  jualan: {
    welcome: false,
    goodbye: false,
    antilink: true,
    antispam: true,
    autoreply: true,
    economy: true,
    groupMode: 'jualbeli'
  },
  gaming: {
    welcome: true,
    goodbye: true,
    antilink: false,
    antispam: true,
    leveling: true,
    economy: true,
    miniGames: true,
    rpg: true,
    poll: true,
    groupMode: 'gaming'
  },
  islami: {
    welcome: true,
    goodbye: true,
    antilink: true,
    antispam: true,
    badword: true,
    language: 'id',
    persona: 'islami',
    groupMode: 'islami'
  },
  komunitas: {
    welcome: true,
    goodbye: true,
    antilink: true,
    antispam: true,
    autoreply: true,
    poll: true,
    leveling: true,
    economy: true,
    miniGames: true,
    groupMode: 'komunitas'
  }
};

export const wizardSessions = new Map<string, {
  step: number;
  config: Record<string, any>;
  senderId: string;
  expiresAt: number;
}>();

export async function handleWizardInput(ctx: MessageContext, adapter: WhatsAppAdapter): Promise<boolean> {
  if (!ctx.isGroup) return false;

  const session = wizardSessions.get(ctx.chatId);
  if (!session) return false;

  // Check expiration (2 minutes)
  if (Date.now() > session.expiresAt) {
    wizardSessions.delete(ctx.chatId);
    await adapter.sendMessage(ctx.chatId, '⚠️ Sesi Setup Wizard telah kedaluwarsa. Silakan mulai ulang dengan `/setupwizard`.');
    return false;
  }

  // Only the admin who started the wizard can input
  if (session.senderId !== ctx.senderId) {
    return false;
  }

  const input = ctx.body.trim().toLowerCase();
  session.expiresAt = Date.now() + 120_000; // Reset expiration on input

  try {
    switch (session.step) {
      case 1: // Welcome Msg
        if (input === 'y' || input === 'yes') session.config.welcome = true;
        else if (input === 'n' || input === 'no') session.config.welcome = false;
        else {
          await adapter.sendMessage(ctx.chatId, '⚠️ Input tidak valid. Jawab dengan *y* atau *n*.');
          return true;
        }
        session.step = 2;
        await adapter.sendMessage(ctx.chatId, `⚙️ *Langkah 2/10: Goodbye Message*\n\nApakah ingin mengaktifkan pesan perpisahan ketika member keluar?\nJawab: *y* (Ya) atau *n* (Tidak)`);
        break;

      case 2: // Goodbye Msg
        if (input === 'y' || input === 'yes') session.config.goodbye = true;
        else if (input === 'n' || input === 'no') session.config.goodbye = false;
        else {
          await adapter.sendMessage(ctx.chatId, '⚠️ Input tidak valid. Jawab dengan *y* atau *n*.');
          return true;
        }
        session.step = 3;
        await adapter.sendMessage(ctx.chatId, `⚙️ *Langkah 3/10: Anti-Link*\n\nApakah ingin mengaktifkan fitur Anti-Link undangan grup WhatsApp?\nJawab: *y* (Ya) atau *n* (Tidak)`);
        break;

      case 3: // Anti-Link
        if (input === 'y' || input === 'yes') session.config.antilink = true;
        else if (input === 'n' || input === 'no') session.config.antilink = false;
        else {
          await adapter.sendMessage(ctx.chatId, '⚠️ Input tidak valid. Jawab dengan *y* atau *n*.');
          return true;
        }
        session.step = 4;
        await adapter.sendMessage(ctx.chatId, `⚙️ *Langkah 4/10: Anti-Spam*\n\nApakah ingin mengaktifkan proteksi Anti-Spam chat?\nJawab: *y* (Ya) atau *n* (Tidak)`);
        break;

      case 4: // Anti-Spam
        if (input === 'y' || input === 'yes') session.config.antispam = true;
        else if (input === 'n' || input === 'no') session.config.antispam = false;
        else {
          await adapter.sendMessage(ctx.chatId, '⚠️ Input tidak valid. Jawab dengan *y* atau *n*.');
          return true;
        }
        session.step = 5;
        await adapter.sendMessage(ctx.chatId, `⚙️ *Langkah 5/10: Badword Filter*\n\nApakah ingin mengaktifkan filter kata-kata kasar / kotor?\nJawab: *y* (Ya) atau *n* (Tidak)`);
        break;

      case 5: // Badword Filter
        if (input === 'y' || input === 'yes') session.config.badword = true;
        else if (input === 'n' || input === 'no') session.config.badword = false;
        else {
          await adapter.sendMessage(ctx.chatId, '⚠️ Input tidak valid. Jawab dengan *y* atau *n*.');
          return true;
        }
        session.step = 6;
        await adapter.sendMessage(ctx.chatId, `⚙️ *Langkah 6/10: Captcha Verification*\n\nApakah ingin mengaktifkan Captcha verifikasi member baru?\nJawab: *y* (Ya) atau *n* (Tidak)`);
        break;

      case 6: // Captcha
        if (input === 'y' || input === 'yes') session.config.captcha = true;
        else if (input === 'n' || input === 'no') session.config.captcha = false;
        else {
          await adapter.sendMessage(ctx.chatId, '⚠️ Input tidak valid. Jawab dengan *y* atau *n*.');
          return true;
        }
        session.step = 7;
        await adapter.sendMessage(ctx.chatId, `⚙️ *Langkah 7/10: Bot Prefix*\n\nKetik simbol prefix yang ingin digunakan (contoh: *.* atau */* atau *!*)`);
        break;

      case 7: // Bot Prefix
        if (input.length === 1) {
          session.config.prefix = input;
        } else {
          await adapter.sendMessage(ctx.chatId, '⚠️ Prefix harus berupa satu karakter/simbol.');
          return true;
        }
        session.step = 8;
        await adapter.sendMessage(ctx.chatId, `⚙️ *Langkah 8/10: Punishment Mode*\n\nPilih tindakan hukuman jika melanggar aturan:\nKetik: *delete* / *warn* / *mute* / *kick*`);
        break;

      case 8: // Punishment Mode
        if (['delete', 'warn', 'mute', 'kick'].includes(input)) {
          session.config.antilinkMode = input;
          session.config.antispamMode = input;
        } else {
          await adapter.sendMessage(ctx.chatId, '⚠️ Pilihan salah. Ketik salah satu: *delete*, *warn*, *mute*, atau *kick*.');
          return true;
        }
        session.step = 9;
        await adapter.sendMessage(ctx.chatId, `⚙️ *Langkah 9/10: Group Mode*\n\nTentukan tipe mode grup Anda:\nKetik: *sekolah* / *jualbeli* / *gaming* / *islami* / *komunitas* / *private* / *publik* / *event*`);
        break;

      case 9: // Group Mode
        if (['sekolah', 'jualbeli', 'gaming', 'islami', 'komunitas', 'private', 'publik', 'event'].includes(input)) {
          session.config.groupMode = input;
        } else {
          await adapter.sendMessage(ctx.chatId, '⚠️ Pilihan salah. Ketik salah satu opsi yang tersedia.');
          return true;
        }
        session.step = 10;
        const review = [
          `⚙️ *Langkah 10/10: Konfirmasi Pengaturan*`,
          ``,
          `• Welcome Msg: ${session.config.welcome ? '✅ ON' : '❌ OFF'}`,
          `• Goodbye Msg: ${session.config.goodbye ? '✅ ON' : '❌ OFF'}`,
          `• Anti-Link: ${session.config.antilink ? '✅ ON' : '❌ OFF'}`,
          `• Anti-Spam: ${session.config.antispam ? '✅ ON' : '❌ OFF'}`,
          `• Badword Filter: ${session.config.badword ? '✅ ON' : '❌ OFF'}`,
          `• Captcha: ${session.config.captcha ? '✅ ON' : '❌ OFF'}`,
          `• Prefix: *${session.config.prefix}*`,
          `• Hukuman: *${session.config.antilinkMode}*`,
          `• Mode Grup: *${session.config.groupMode}*`,
          ``,
          `Apakah semua data sudah benar?`,
          `Ketik *y* (Terapkan) atau *n* (Batalkan)`
        ].join('\n');
        await adapter.sendMessage(ctx.chatId, review);
        break;

      case 10: // Confirm
        if (input === 'y' || input === 'yes') {
          // Save prefix and active configurations
          const { prefix, groupMode, ...features } = session.config;

          await prisma.groupConfig.upsert({
            where: { groupId: ctx.chatId },
            create: {
              groupId: ctx.chatId,
              prefix,
              botEnabled: true,
              featuresJson: JSON.stringify(features)
            },
            update: {
              prefix,
              featuresJson: JSON.stringify(features)
            }
          });

          // Save custom variable for groupMode if needed
          await prisma.customVariable.upsert({
            where: {
              groupId_userId_key: {
                groupId: ctx.chatId,
                userId: 'system',
                key: 'groupMode'
              }
            },
            create: {
              groupId: ctx.chatId,
              userId: 'system',
              key: 'groupMode',
              value: groupMode
            },
            update: {
              value: groupMode
            }
          });

          await adapter.sendMessage(ctx.chatId, '✅ *Setup Wizard Berhasil!* Semua pengaturan telah diterapkan ke grup ini.');
        } else {
          await adapter.sendMessage(ctx.chatId, '❌ Setup Wizard dibatalkan.');
        }
        wizardSessions.delete(ctx.chatId);
        break;
    }
  } catch (err: any) {
    console.error('[SetupWizard] Error:', err);
    await adapter.sendMessage(ctx.chatId, `❌ Terjadi kesalahan saat memproses wizard: ${err.message}`);
    wizardSessions.delete(ctx.chatId);
  }

  return true;
}

export class SetupCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
    if (!isAdmin) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang dapat menggunakan command setup.', { quotedMessageId: ctx.id });
      return;
    }

    const commandType = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // /setupwizard
    if (commandType === 'setupwizard') {
      const currentFeatures = await getGroupFeatures(ctx.chatId);
      const config = await prisma.groupConfig.findUnique({ where: { groupId: ctx.chatId } });

      wizardSessions.set(ctx.chatId, {
        step: 1,
        config: {
          welcome: currentFeatures.welcome ?? false,
          goodbye: currentFeatures.goodbye ?? false,
          antilink: currentFeatures.antilink ?? false,
          antispam: currentFeatures.antispam ?? false,
          badword: currentFeatures.badword ?? false,
          captcha: currentFeatures.captcha ?? false,
          prefix: config?.prefix ?? '/',
          antilinkMode: currentFeatures.antilinkMode ?? 'warn',
          groupMode: 'komunitas'
        },
        senderId: ctx.senderId,
        expiresAt: Date.now() + 120_000
      });

      const startMsg = [
        `⚙️ *Javas Bot WA — Setup Wizard* ⚙️`,
        `Selamat datang di asisten setup grup interaktif.`,
        ``,
        `*Langkah 1/10: Welcome Message*`,
        `Apakah ingin mengaktifkan pesan sambutan otomatis saat member baru masuk?`,
        `Jawab: *y* (Ya) atau *n* (Tidak)`
      ].join('\n');

      await adapter.sendMessage(ctx.chatId, startMsg, { quotedMessageId: ctx.id });
      return;
    }

    // /groupmode [sekolah|jualbeli|gaming|islami|komunitas|private|publik|event]
    if (commandType === 'groupmode') {
      const mode = args[0]?.toLowerCase().trim();
      const validModes = ['sekolah', 'jualbeli', 'gaming', 'islami', 'komunitas', 'private', 'publik', 'event'];

      if (!mode || !validModes.includes(mode)) {
        await adapter.sendMessage(
          ctx.chatId,
          `⚠️ Format salah.\nGunakan: \`/groupmode [sekolah|jualbeli|gaming|islami|komunitas|private|publik|event]\``,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      await prisma.customVariable.upsert({
        where: {
          groupId_userId_key: {
            groupId: ctx.chatId,
            userId: 'system',
            key: 'groupMode'
          }
        },
        create: {
          groupId: ctx.chatId,
          userId: 'system',
          key: 'groupMode',
          value: mode
        },
        update: {
          value: mode
        }
      });

      await adapter.sendMessage(ctx.chatId, `✅ Mode grup berhasil diubah menjadi *${mode.toUpperCase()}*.`, { quotedMessageId: ctx.id });
      return;
    }

    // /pack [sekolah|jualan|gaming|islami|komunitas]
    if (commandType === 'pack') {
      const packName = args[0]?.toLowerCase().trim();
      const preset = PRESETS[packName || ''];

      if (!preset) {
        await adapter.sendMessage(
          ctx.chatId,
          `⚠️ Pack tidak ditemukan. Pilihan:\n• \`/pack sekolah\`\n• \`/pack jualan\`\n• \`/pack gaming\`\n• \`/pack islami\`\n• \`/pack komunitas\``,
          { quotedMessageId: ctx.id }
        );
        return;
      }

      const current = await getGroupFeatures(ctx.chatId);
      const next = { ...current, ...preset };

      // Apply changes to database
      const { groupMode, ...features } = next;
      await prisma.groupConfig.upsert({
        where: { groupId: ctx.chatId },
        create: {
          groupId: ctx.chatId,
          prefix: '/',
          botEnabled: true,
          featuresJson: JSON.stringify(features)
        },
        update: {
          featuresJson: JSON.stringify(features)
        }
      });

      if (groupMode) {
        await prisma.customVariable.upsert({
          where: {
            groupId_userId_key: {
              groupId: ctx.chatId,
              userId: 'system',
              key: 'groupMode'
            }
          },
          create: {
            groupId: ctx.chatId,
            userId: 'system',
            key: 'groupMode',
            value: groupMode
          },
          update: {
            value: groupMode
          }
        });
      }

      const diff = Object.keys(preset)
        .map(key => `├ ${key}: *${preset[key]}*`)
        .join('\n');

      await adapter.sendMessage(
        ctx.chatId,
        `✅ *Pack ${packName!.toUpperCase()} Berhasil Diterapkan!*\n\n*Pengaturan Baru:*\n${diff}`,
        { quotedMessageId: ctx.id }
      );
      return;
    }

    // /setupcheck
    if (commandType === 'setupcheck') {
      const config = await prisma.groupConfig.findUnique({ where: { groupId: ctx.chatId } });
      const currentFeatures = parseFeatureFlags(config?.featuresJson || '{}');
      const gModeVar = await prisma.customVariable.findUnique({
        where: {
          groupId_userId_key: {
            groupId: ctx.chatId,
            userId: 'system',
            key: 'groupMode'
          }
        }
      });

      const mode = gModeVar?.value || 'komunitas';

      const lines = [
        `📋 *Status Setup Grup*`,
        ``,
        `• Prefix bot: *${config?.prefix ?? '/'}*`,
        `• Mode grup: *${mode.toUpperCase()}*`,
        `• Bot aktif: ${config?.botEnabled ?? true ? '✅' : '❌'}`,
        ``,
        `⚙️ *Fitur Moderasi*`,
        `├ Welcome Msg: ${currentFeatures.welcome ? '✅ ON' : '❌ OFF'}`,
        `├ Goodbye Msg: ${currentFeatures.goodbye ? '✅ ON' : '❌ OFF'}`,
        `├ Anti-Link: ${currentFeatures.antilink ? '✅ ON' : '❌ OFF'}`,
        `├ Anti-Spam: ${currentFeatures.antispam ? '✅ ON' : '❌ OFF'}`,
        `├ Badword Filter: ${currentFeatures.badword ? '✅ ON' : '❌ OFF'}`,
        `└ Captcha: ${currentFeatures.captcha ? '✅ ON' : '❌ OFF'}`,
        ``,
        `Ketik \`/setupwizard\` untuk mengubah pengaturan.`
      ];

      await adapter.sendMessage(ctx.chatId, lines.join('\n'), { quotedMessageId: ctx.id });
      return;
    }
  }
}

export class StatusFiturCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const config = await prisma.groupConfig.findUnique({ where: { groupId: ctx.chatId } });
    const flags = parseFeatureFlags(config?.featuresJson || '{}');
    const enabled = Object.entries(flags).filter(([, value]) => value === true).map(([key]) => key);
    const disabled = Object.entries(flags).filter(([, value]) => value === false).map(([key]) => key);

    const response = `📊 *STATUS FITUR GRUP*\n\n*Aktif (${enabled.length}):*\n${enabled.map(key => `- ${key}`).join('\n') || '-'}\n\n*Nonaktif (${disabled.length}):*\n${disabled.map(key => `- ${key}`).join('\n') || '-'}`;
    await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
  }
}

// Register commands
const setupCmd = new SetupCommand();
registerCommand(['setup', 'setupwizard', 'groupmode', 'pack', 'setupcheck'], setupCmd);
registerCommand(['statusfitur', 'features'], new StatusFiturCommand());
