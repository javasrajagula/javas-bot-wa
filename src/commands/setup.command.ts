import { Command, registerCommand, checkIfAdmin } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import prisma from '../db/client.js';
import { DEFAULT_FEATURES, getGroupFeatures, parseFeatureFlags } from '../config/feature-flags.js';

const PRESETS: Record<string, Record<string, any>> = {
  basic: {
    welcome: false,
    goodbye: false,
    antilink: false,
    antispam: true,
    badword: false,
    leveling: false,
    economy: false
  },
  sekolah: {
    welcome: true,
    goodbye: true,
    antilink: true,
    antispam: true,
    badword: true,
    reminder: true,
    attendance: true,
    economy: false,
    miniGames: false
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
    miniGames: true
  },
  strict: {
    welcome: true,
    goodbye: true,
    antilink: true,
    antispam: true,
    badword: true,
    modsmart: true,
    warning: true,
    automute: true,
    economy: false
  },
  game: {
    leveling: true,
    economy: true,
    miniGames: true,
    rpg: true,
    poll: true
  }
};

const pendingSetup = new Map<string, { preset: string; changes: Record<string, any>; expiresAt: number }>();

export class SetupCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
    if (!isAdmin) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang dapat menjalankan setup.', { quotedMessageId: ctx.id });
      return;
    }

    const action = args[0]?.toLowerCase();
    if (!action || action === 'wizard') {
      await this.showWizard(ctx, adapter);
      return;
    }

    if (action === 'confirm') {
      await this.confirmSetup(ctx, adapter);
      return;
    }

    if (action === 'reset') {
      pendingSetup.set(ctx.chatId, {
        preset: 'reset',
        changes: { ...DEFAULT_FEATURES },
        expiresAt: Date.now() + 60_000
      });
      await adapter.sendMessage(ctx.chatId, `*KONFIRMASI SETUP RESET*\n\nSemua fitur grup akan dikembalikan ke default.\n\nKetik */setup confirm* dalam 60 detik untuk menerapkan.`, { quotedMessageId: ctx.id });
      return;
    }

    const preset = PRESETS[action];
    if (!preset) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Preset tidak dikenal. Pilihan: basic, sekolah, komunitas, strict, game, reset.', { quotedMessageId: ctx.id });
      return;
    }

    const current = await getGroupFeatures(ctx.chatId);
    const next = { ...current, ...preset };
    const diff = Object.keys(preset)
      .map(key => `- ${key}: ${current[key] ? 'ON' : 'OFF'} -> ${next[key] ? 'ON' : 'OFF'}`)
      .join('\n');

    pendingSetup.set(ctx.chatId, {
      preset: action,
      changes: next,
      expiresAt: Date.now() + 60_000
    });

    await adapter.sendMessage(
      ctx.chatId,
      `*KONFIRMASI SETUP ${action.toUpperCase()}*\n\n${diff}\n\nKetik */setup confirm* dalam 60 detik untuk menerapkan.`,
      { quotedMessageId: ctx.id }
    );
  }

  private async showWizard(ctx: MessageContext, adapter: WhatsAppAdapter) {
    const text = `*SETUP WIZARD GRUP*\n\nPreset tersedia:\n- /setup basic\n- /setup sekolah\n- /setup komunitas\n- /setup strict\n- /setup game\n- /setup reset\n\nSetiap preset butuh konfirmasi dengan /setup confirm.`;
    await adapter.sendMessage(ctx.chatId, text, { quotedMessageId: ctx.id });
  }

  private async confirmSetup(ctx: MessageContext, adapter: WhatsAppAdapter) {
    const pending = pendingSetup.get(ctx.chatId);
    if (!pending || pending.expiresAt < Date.now()) {
      pendingSetup.delete(ctx.chatId);
      await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada setup yang menunggu konfirmasi atau sudah kedaluwarsa.', { quotedMessageId: ctx.id });
      return;
    }

    await prisma.groupConfig.upsert({
      where: { groupId: ctx.chatId },
      create: {
        groupId: ctx.chatId,
        prefix: '/',
        botEnabled: true,
        featuresJson: JSON.stringify(pending.changes)
      },
      update: {
        featuresJson: JSON.stringify(pending.changes)
      }
    });

    pendingSetup.delete(ctx.chatId);
    await adapter.sendMessage(ctx.chatId, `✅ Setup preset *${pending.preset}* berhasil diterapkan.`, { quotedMessageId: ctx.id });
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

const setup = new SetupCommand();
registerCommand(['setup', 'setupwizard'], setup);
registerCommand(['statusfitur', 'features'], new StatusFiturCommand());
