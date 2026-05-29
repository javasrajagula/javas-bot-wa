import { Command, registerCommand } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import { getUserRole } from '../bot/permission.js';
import { commandRegistry } from './registry/command-registry.js';
import { pluginManager } from '../config/plugins.js';
import { DEFAULT_FEATURES } from '../config/feature-flags.js';
import prisma from '../db/client.js';

type Role = 'owner' | 'admin' | 'premium' | 'user';

const ROLE_LEVEL: Record<Role, number> = {
  user: 1,
  premium: 2,
  admin: 3,
  owner: 4
};

const CATEGORY_INFO: Record<string, { emoji: string; title: string; desc: string }> = {
  sticker: {
    emoji: '🎨',
    title: 'Sticker',
    desc: 'Buat stiker, brat, meme, emoji mix'
  },
  media: {
    emoji: '🖼️',
    title: 'Media',
    desc: 'Edit gambar/video, HD, crop, watermark'
  },
  audio: {
    emoji: '🎧',
    title: 'Audio',
    desc: 'TTS, MP3, voice effect, potong audio'
  },
  downloader: {
    emoji: '📥',
    title: 'Downloader',
    desc: 'Download TikTok dan Instagram'
  },
  text: {
    emoji: '📝',
    title: 'Text',
    desc: 'OCR, translate, ringkas, typo'
  },
  document: {
    emoji: '📄',
    title: 'Document',
    desc: 'PDF, QR, scan, unzip'
  },
  games: {
    emoji: '🎮',
    title: 'Games',
    desc: 'TOD, tebak kata, suit, slot, werewolf'
  },
  economy: {
    emoji: '💰',
    title: 'Economy',
    desc: 'Saldo, rank, shop, pet, dungeon'
  },
  admin: {
    emoji: '🛡️',
    title: 'Admin',
    desc: 'Moderasi dan pengaturan grup'
  },
  owner: {
    emoji: '👑',
    title: 'Owner',
    desc: 'Tool khusus owner bot'
  },
  general: {
    emoji: 'ℹ️',
    title: 'General',
    desc: 'Info umum bot'
  }
};

const CATEGORY_ORDER = [
  'sticker',
  'media',
  'audio',
  'downloader',
  'text',
  'document',
  'games',
  'economy',
  'admin',
  'owner',
  'general'
];

function line(char = '─', length = 32) {
  return char.repeat(length);
}

function formatCommand(prefix: string, name: string) {
  return `*${prefix}${name}*`;
}

function normalizeCategory(input?: string) {
  if (!input) return '';

  const value = input.toLowerCase().trim();

  const aliases: Record<string, string> = {
    stiker: 'sticker',
    sticker: 'sticker',
    stickers: 'sticker',

    media: 'media',
    foto: 'media',
    video: 'media',

    audio: 'audio',
    voice: 'audio',
    vn: 'audio',

    download: 'downloader',
    downloader: 'downloader',
    dl: 'downloader',

    text: 'text',
    teks: 'text',
    ai: 'text',

    document: 'document',
    dokumen: 'document',
    doc: 'document',
    pdf: 'document',

    game: 'games',
    games: 'games',

    ekonomi: 'economy',
    economy: 'economy',
    eco: 'economy',

    admin: 'admin',
    owner: 'owner',
    all: 'all',
    semua: 'all',
    premium: 'premium'
  };

  return aliases[value] || value;
}

export class MenuCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const role = await getUserRole(ctx.chatId, ctx.senderId, adapter);
    const roleValue = ROLE_LEVEL[role];

    const { prefix, groupFeatures, groupPlan } = await this.getMenuContext(ctx);
    const rawArg = args[0]?.trim();
    const commandArg = normalizeCategory(rawArg);

    const allCommands = commandRegistry.getAll();
    const visibleCommands = allCommands.filter(cmd =>
      this.canDisplayCommand(cmd.metadata, {
        role,
        roleValue,
        isGroup: ctx.isGroup,
        groupFeatures,
        groupPlan
      })
    );

    if (commandArg && commandArg !== 'all' && commandArg !== 'premium') {
      const knownCategories = [...CATEGORY_ORDER, 'general'];

      if (!knownCategories.includes(commandArg)) {
        const cleanCommandName = rawArg?.startsWith(prefix)
          ? rawArg.slice(prefix.length)
          : rawArg;

        const command = cleanCommandName ? commandRegistry.get(cleanCommandName) : undefined;

        if (command) {
          await this.sendHelp(ctx, adapter, command.metadata, {
            prefix,
            groupFeatures,
            groupPlan
          });
          return;
        }

        await adapter.sendMessage(
          ctx.chatId,
          `⚠️ Menu atau command *${rawArg}* tidak ditemukan.\n\nCoba ketik:\n• *${prefix}menu*\n• *${prefix}menu sticker*\n• *${prefix}help brat*`,
          { quotedMessageId: ctx.id }
        );
        return;
      }
    }

    if (commandArg === 'all') {
      await this.sendAllMenu(ctx, adapter, visibleCommands, prefix, role, groupPlan);
      return;
    }

    if (commandArg === 'premium') {
      await this.sendPremiumMenu(ctx, adapter, visibleCommands, prefix, role, groupPlan);
      return;
    }

    if (commandArg && CATEGORY_ORDER.includes(commandArg)) {
      await this.sendCategoryMenu(ctx, adapter, visibleCommands, prefix, commandArg);
      return;
    }

    await this.sendHomeMenu(ctx, adapter, visibleCommands, prefix, role, groupPlan);
  }

  private async getMenuContext(ctx: MessageContext): Promise<{
    prefix: string;
    groupFeatures: Record<string, boolean>;
    groupPlan: string;
  }> {
    let prefix = '/';
    let groupFeatures: Record<string, boolean> = {};
    let groupPlan = 'private';

    if (!ctx.isGroup) {
      return { prefix, groupFeatures, groupPlan };
    }

    const config = await prisma.groupConfig.findUnique({
      where: { groupId: ctx.chatId }
    });

    if (config) {
      prefix = config.prefix || '/';

      try {
        groupFeatures = {
          ...DEFAULT_FEATURES,
          ...JSON.parse(config.featuresJson || '{}')
        };
      } catch {
        groupFeatures = { ...DEFAULT_FEATURES };
      }
    } else {
      groupFeatures = { ...DEFAULT_FEATURES };
    }

    const subscription = await prisma.groupSubscription.findUnique({
      where: { groupId: ctx.chatId }
    });

    const expired = subscription?.expiresAt && subscription.expiresAt.getTime() < Date.now();
    groupPlan = subscription && !expired ? subscription.plan || 'free' : 'free';

    return { prefix, groupFeatures, groupPlan };
  }

  private canDisplayCommand(
    meta: any,
    context: {
      role: Role;
      roleValue: number;
      isGroup: boolean;
      groupFeatures: Record<string, boolean>;
      groupPlan: string;
    }
  ): boolean {
    const minRole = (meta.minRole || 'user') as Role;

    if (context.roleValue < ROLE_LEVEL[minRole]) return false;
    if (meta.premiumOnly && context.roleValue < ROLE_LEVEL.premium) return false;

    if (!pluginManager.isPluginEnabled(meta.plugin)) return false;

    if (context.isGroup && meta.featureFlag !== 'general') {
      const enabled = context.groupFeatures[meta.featureFlag] !== undefined
        ? context.groupFeatures[meta.featureFlag]
        : DEFAULT_FEATURES[meta.featureFlag] ?? true;

      if (!enabled) return false;
    }

    if (context.isGroup) {
      const category = meta.category;

      if (context.groupPlan === 'free') {
        if (category !== 'general' && category !== 'sticker') return false;
      }

      if (context.groupPlan === 'basic') {
        if (category === 'downloader' || category === 'media' || category === 'document') {
          return false;
        }
      }
    }

    return true;
  }

  private groupByCategory(commands: any[]) {
    const grouped: Record<string, any[]> = {};

    for (const command of commands) {
      const category = command.metadata.category || 'general';

      if (!grouped[category]) {
        grouped[category] = [];
      }

      grouped[category].push(command);
    }

    return grouped;
  }

  private async sendHomeMenu(
    ctx: MessageContext,
    adapter: WhatsAppAdapter,
    commands: any[],
    prefix: string,
    role: Role,
    groupPlan: string
  ) {
    const grouped = this.groupByCategory(commands);

    let text = '';
    text += `╭${line()}╮\n`;
    text += `│ *JAVAS BOT WA*\n`;
    text += `│ Halo, *${ctx.senderName || 'User'}* 👋\n`;
    text += `│ Role: *${role.toUpperCase()}*`;

    if (ctx.isGroup) {
      text += ` | Plan: *${groupPlan.toUpperCase()}*`;
    }

    text += `\n`;
    text += `╰${line()}╯\n\n`;

    text += `*Pilih kategori command:*\n\n`;

    for (const category of CATEGORY_ORDER) {
      const categoryCommands = grouped[category] || [];
      if (categoryCommands.length === 0) continue;

      const info = CATEGORY_INFO[category] || CATEGORY_INFO.general;

      text += `${info.emoji} *${info.title}* — ${categoryCommands.length} command\n`;
      text += `   ${info.desc}\n`;
      text += `   Ketik: *${prefix}menu ${category}*\n\n`;
    }

    text += `╭${line()}╮\n`;
    text += `│ *Shortcut*\n`;
    text += `│ ${prefix}menu all — semua command\n`;
    text += `│ ${prefix}menu premium — fitur premium\n`;
    text += `│ ${prefix}help <command> — detail command\n`;
    text += `│ Contoh: ${prefix}help brat\n`;
    text += `╰${line()}╯`;

    await adapter.sendMessage(ctx.chatId, text, { quotedMessageId: ctx.id });
  }

  private async sendAllMenu(
    ctx: MessageContext,
    adapter: WhatsAppAdapter,
    commands: any[],
    prefix: string,
    role: Role,
    groupPlan: string
  ) {
    const grouped = this.groupByCategory(commands);

    let text = '';
    text += `╭${line()}╮\n`;
    text += `│ *SEMUA COMMAND AKTIF*\n`;
    text += `│ Role: *${role.toUpperCase()}*`;

    if (ctx.isGroup) {
      text += ` | Plan: *${groupPlan.toUpperCase()}*`;
    }

    text += `\n`;
    text += `╰${line()}╯\n\n`;

    for (const category of CATEGORY_ORDER) {
      const categoryCommands = grouped[category] || [];
      if (categoryCommands.length === 0) continue;

      const info = CATEGORY_INFO[category] || CATEGORY_INFO.general;
      const commandNames = categoryCommands
        .map(command => `${prefix}${command.metadata.name}`)
        .join(' • ');

      text += `${info.emoji} *${info.title}*\n`;
      text += `${commandNames}\n\n`;
    }

    text += `Ketik *${prefix}help <command>* untuk detail.\n`;
    text += `Contoh: *${prefix}help brat*`;

    await adapter.sendMessage(ctx.chatId, text, { quotedMessageId: ctx.id });
  }

  private async sendCategoryMenu(
    ctx: MessageContext,
    adapter: WhatsAppAdapter,
    commands: any[],
    prefix: string,
    category: string
  ) {
    const categoryCommands = commands.filter(command => command.metadata.category === category);
    const info = CATEGORY_INFO[category] || CATEGORY_INFO.general;

    if (categoryCommands.length === 0) {
      await adapter.sendMessage(
        ctx.chatId,
        `⚠️ Tidak ada command aktif di kategori *${category}*.\n\nKemungkinan plugin/fitur sedang OFF atau role kamu belum cukup.`,
        { quotedMessageId: ctx.id }
      );
      return;
    }

    let text = '';
    text += `╭${line()}╮\n`;
    text += `│ ${info.emoji} *MENU ${info.title.toUpperCase()}*\n`;
    text += `│ ${info.desc}\n`;
    text += `╰${line()}╯\n\n`;

    categoryCommands.forEach((command, index) => {
      const meta = command.metadata;
      const number = String(index + 1).padStart(2, '0');

      text += `*${number}. ${prefix}${meta.name}*\n`;
      text += `   ${meta.description}\n`;

      if (meta.aliases && meta.aliases.length > 0) {
        text += `   Alias: ${meta.aliases.map((alias: string) => `*${prefix}${alias}*`).join(', ')}\n`;
      }

      text += `\n`;
    });

    text += `Ketik *${prefix}help <command>* untuk contoh penggunaan.\n`;
    text += `Contoh: *${prefix}help ${categoryCommands[0].metadata.name}*`;

    await adapter.sendMessage(ctx.chatId, text, { quotedMessageId: ctx.id });
  }

  private async sendPremiumMenu(
    ctx: MessageContext,
    adapter: WhatsAppAdapter,
    commands: any[],
    prefix: string,
    role: Role,
    groupPlan: string
  ) {
    const premiumCommands = commands.filter(command => {
      const meta = command.metadata;
      return meta.premiumOnly || meta.category === 'downloader' || meta.category === 'media' || meta.category === 'document';
    });

    let text = '';
    text += `╭${line()}╮\n`;
    text += `│ ⭐ *MENU PREMIUM*\n`;
    text += `│ Role: *${role.toUpperCase()}*`;

    if (ctx.isGroup) {
      text += ` | Plan: *${groupPlan.toUpperCase()}*`;
    }

    text += `\n`;
    text += `╰${line()}╯\n\n`;

    if (premiumCommands.length === 0) {
      text += `Belum ada command premium yang aktif untuk konteks ini.\n\n`;
      text += `Cek:\n`;
      text += `• *${prefix}ceksewa*\n`;
      text += `• *${prefix}fitursewa*\n`;
      text += `• *${prefix}menu all*`;
    } else {
      const grouped = this.groupByCategory(premiumCommands);

      for (const category of CATEGORY_ORDER) {
        const categoryCommands = grouped[category] || [];
        if (categoryCommands.length === 0) continue;

        const info = CATEGORY_INFO[category] || CATEGORY_INFO.general;

        text += `${info.emoji} *${info.title}*\n`;
        text += categoryCommands
          .map(command => `• *${prefix}${command.metadata.name}* — ${command.metadata.description}`)
          .join('\n');
        text += `\n\n`;
      }

      text += `Ketik *${prefix}help <command>* untuk detail.`;
    }

    await adapter.sendMessage(ctx.chatId, text, { quotedMessageId: ctx.id });
  }

  private async sendHelp(
    ctx: MessageContext,
    adapter: WhatsAppAdapter,
    meta: any,
    context: {
      prefix: string;
      groupFeatures: Record<string, boolean>;
      groupPlan: string;
    }
  ) {
    const globalEnabled = pluginManager.isPluginEnabled(meta.plugin);

    const groupEnabled = ctx.isGroup && meta.featureFlag !== 'general'
      ? context.groupFeatures[meta.featureFlag] !== undefined
        ? context.groupFeatures[meta.featureFlag]
        : DEFAULT_FEATURES[meta.featureFlag] ?? true
      : true;

    const info = CATEGORY_INFO[meta.category] || CATEGORY_INFO.general;

    let text = '';
    text += `╭${line()}╮\n`;
    text += `│ ${info.emoji} *HELP: ${context.prefix}${meta.name}*\n`;
    text += `╰${line()}╯\n\n`;

    text += `*Deskripsi*\n`;
    text += `${meta.description}\n\n`;

    text += `*Cara pakai*\n`;
    text += `\`${meta.usage.replace(/\//g, context.prefix)}\`\n\n`;

    if (meta.examples && meta.examples.length > 0) {
      text += `*Contoh*\n`;
      text += meta.examples
        .map((example: string) => `• ${example.replace(/\//g, context.prefix)}`)
        .join('\n');
      text += `\n\n`;
    }

    if (meta.aliases && meta.aliases.length > 0) {
      text += `*Alias*\n`;
      text += meta.aliases.map((alias: string) => `• ${context.prefix}${alias}`).join('\n');
      text += `\n\n`;
    }

    text += `*Status*\n`;
    text += `• Kategori: *${info.title}*\n`;
    text += `• Role minimal: *${meta.minRole || 'user'}*\n`;
    text += `• Premium only: *${meta.premiumOnly ? 'Ya' : 'Tidak'}*\n`;
    text += `• Plugin: *${globalEnabled ? 'ON' : 'OFF'}*\n`;

    if (ctx.isGroup) {
      text += `• Fitur grup: *${groupEnabled ? 'ON' : 'OFF'}*\n`;
      text += `• Plan grup: *${context.groupPlan.toUpperCase()}*\n`;
    }

    await adapter.sendMessage(ctx.chatId, text, { quotedMessageId: ctx.id });
  }
}

export class RulesCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const rulesText = `╭────────────────────────╮
│ ⚠️ *ATURAN PENGGUNAAN BOT*
╰────────────────────────╯

1. Gunakan bot secara bijak dan bertanggung jawab.
2. Fitur downloader hanya untuk konten milik sendiri, berizin, atau legal untuk diunduh.
3. Bot tidak mendukung bypass DRM, akun privat, login pihak ketiga, atau pelanggaran hak cipta.
4. Media yang diproses bersifat sementara dan akan dibersihkan otomatis.
5. Admin/owner berhak membatasi fitur jika terjadi spam atau penyalahgunaan.`;

    await adapter.sendMessage(ctx.chatId, rulesText, { quotedMessageId: ctx.id });
  }
}

// Register commands
const menuCmd = new MenuCommand();
registerCommand(['menu', 'help'], menuCmd);

const rulesCmd = new RulesCommand();
registerCommand(['rules'], rulesCmd);