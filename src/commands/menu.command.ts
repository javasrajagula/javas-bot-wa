import { Command, registerCommand } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import { getUserRole, isOwner } from '../bot/permission.js';
import { commandRegistry } from './registry/command-registry.js';
import { pluginManager } from '../config/plugins.js';
import { DEFAULT_FEATURES } from '../config/feature-flags.js';
import prisma from '../db/client.js';
import { env } from '../config/env.js';

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
    
    // Determine command type from trigger
    const commandType = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

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

    // 1. Handle /start
    if (commandType === 'start') {
      const startText = [
        `🤖 *Selamat Datang di Javas Bot WA!* 👋`,
        ``,
        `Halo *${ctx.senderName || 'User'}*, saya adalah bot WhatsApp asisten serbaguna yang siap membantu kebutuhan harian Anda.`,
        ``,
        `💡 *Cara Memulai:*`,
        `• Ketik *${prefix}menu* untuk menampilkan menu utama.`,
        `• Ketik *${prefix}rules* untuk melihat aturan penggunaan bot.`,
        `• Ketik *${prefix}ping* untuk mengecek kecepatan respon bot.`,
        ``,
        `Semoga bermanfaat!`
      ].join('\n');
      await adapter.sendMessage(ctx.chatId, startText, { quotedMessageId: ctx.id });
      return;
    }

    // 2. Handle /premiumguide
    if (commandType === 'premiumguide') {
      const guideText = [
        `⭐ *Panduan Fitur Premium Javas Bot WA* ⭐`,
        ``,
        `Pengguna Premium mendapatkan akses eksklusif ke fitur-fitur kelas atas bot:`,
        ``,
        `🚀 *Keuntungan Premium:*`,
        `1. *Media & Downloader*: Tanpa batasan limit/durasi video.`,
        `2. *HD Upscaling*: Hasil upscaling resolusi gambar lebih tajam (hingga 4x).`,
        `3. *Kecepatan Prioritas*: Pemrosesan antrian media lebih diprioritaskan.`,
        `4. *Command Tanpa Batas*: Bebas cooldown penggunaan command.`,
        ``,
        `💰 *Cara Mendapatkan Premium:*`,
        `Silakan hubungi Owner bot dengan mengetik *${prefix}owner* untuk informasi harga dan aktivasi.`,
        `Anda juga dapat memeriksa status sewa grup dengan command *${prefix}ceksewa*.`
      ].join('\n');
      await adapter.sendMessage(ctx.chatId, guideText, { quotedMessageId: ctx.id });
      return;
    }

    // 3. Handle /cari or /cmd or /menu search <keyword>
    if (commandType === 'cari' || commandType === 'cmd' || (args[0]?.toLowerCase() === 'search' && args.length > 1)) {
      const keyword = (commandType === 'cari' || commandType === 'cmd') 
        ? args.join(' ').trim().toLowerCase()
        : args.slice(1).join(' ').trim().toLowerCase();

      if (!keyword) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Masukkan keyword pencarian.\nContoh: *${prefix}cari stiker* atau *${prefix}cmd brat*`, { quotedMessageId: ctx.id });
        return;
      }

      const matches = visibleCommands.filter(cmd => {
        const name = cmd.metadata.name.toLowerCase();
        const desc = (cmd.metadata.description || '').toLowerCase();
        const aliases = (cmd.metadata.aliases || []).map((a: string) => a.toLowerCase());
        return name.includes(keyword) || desc.includes(keyword) || aliases.some((a: string) => a.includes(keyword));
      });

      if (matches.length === 0) {
        await adapter.sendMessage(ctx.chatId, `🔍 Pencarian untuk *"${keyword}"* tidak ditemukan.`, { quotedMessageId: ctx.id });
        return;
      }

      let searchText = `🔍 *Hasil Pencarian: "${keyword}"*\n\n`;
      matches.forEach((m, index) => {
        searchText += `*${index + 1}. ${prefix}${m.metadata.name}*\n`;
        searchText += `   ${m.metadata.description}\n`;
        if (m.metadata.aliases?.length) {
          searchText += `   Alias: ${m.metadata.aliases.map((a: string) => `*${prefix}${a}*`).join(', ')}\n`;
        }
        searchText += `\n`;
      });
      await adapter.sendMessage(ctx.chatId, searchText, { quotedMessageId: ctx.id });
      return;
    }

    // 4. Handle /menu saya
    if (args[0]?.toLowerCase() === 'saya') {
      let filtered = visibleCommands;
      if (role === 'premium') {
        filtered = visibleCommands.filter(cmd => cmd.metadata.premiumOnly || cmd.metadata.minRole === 'premium' || cmd.metadata.minRole === 'user' || !cmd.metadata.minRole);
      } else if (role === 'user') {
        filtered = visibleCommands.filter(cmd => !cmd.metadata.premiumOnly && (!cmd.metadata.minRole || cmd.metadata.minRole === 'user'));
      }
      // Show custom menu for user
      await this.sendAllMenu(ctx, adapter, filtered, prefix, role, groupPlan);
      return;
    }

    const rawArg = args[0]?.trim();
    const commandArg = normalizeCategory(rawArg);

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
          `⚠️ Menu atau command *${rawArg}* tidak ditemukan.\n\nCoba ketik:\n• *${prefix}menu*\n• *${prefix}menu sticker*\n• *${prefix}help brat*\n• *${prefix}cari stiker*`,
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

    // Calculate quota remaining
    let quotaText = 'Unlimited (Owner/Premium)';
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const isPremiumOrOwner = role === 'owner' || role === 'premium';

    if (!isPremiumOrOwner) {
      if (ctx.isGroup) {
        let maxCmd = 50;
        if (groupPlan === 'basic') maxCmd = 200;
        else if (groupPlan === 'premium') maxCmd = 999999;
        
        const usageCount = await prisma.usageLog.count({
          where: {
            groupId: ctx.chatId,
            createdAt: { gte: startOfDay }
          }
        });
        const left = Math.max(0, maxCmd - usageCount);
        quotaText = `${left} / ${maxCmd} (Grup)`;
      } else {
        const maxCmd = parseInt(env.PRIVATE_DAILY_CMD_LIMIT || '20', 10);
        const usageCount = await prisma.usageLog.count({
          where: {
            userId: ctx.senderId,
            groupId: null,
            createdAt: { gte: startOfDay }
          }
        });
        const left = Math.max(0, maxCmd - usageCount);
        quotaText = `${left} / ${maxCmd} (PC)`;
      }
    } else if (role === 'premium' && !ctx.isGroup) {
      const maxCmd = parseInt(env.PREMIUM_PRIVATE_DAILY_CMD_LIMIT || '200', 10);
      const usageCount = await prisma.usageLog.count({
        where: {
          userId: ctx.senderId,
          groupId: null,
          createdAt: { gte: startOfDay }
        }
      });
      const left = Math.max(0, maxCmd - usageCount);
      quotaText = `${left} / ${maxCmd} (PC Premium)`;
    }

    let text = [
      `╔════════════════════════╗`,
      `║       *JAVAS BOT WA*       ║`,
      `╚════════════════════════╝`,
      `✦ Halo, *${ctx.senderName || 'User'}* 👋`,
      `✦ Role: *${role.toUpperCase()}*` + (ctx.isGroup ? ` | Plan: *${groupPlan.toUpperCase()}*` : ''),
      `✦ Sisa Kuota: *${quotaText}*`,
      `✦ Prefix Bot: *${prefix}*`,
      `─────────────────────────`,
      `*KATEGORI MENU:*`,
      ``
    ].join('\n');

    for (const category of CATEGORY_ORDER) {
      const categoryCommands = grouped[category] || [];
      if (categoryCommands.length === 0) continue;

      const info = CATEGORY_INFO[category] || CATEGORY_INFO.general;

      let statusLabel = '🟢 Free';
      if (category === 'downloader' || category === 'media' || category === 'document') {
        statusLabel = '💎 Premium';
      } else if (category === 'owner') {
        statusLabel = '👑 Owner Only';
      } else if (category === 'admin') {
        statusLabel = '🛡️ Admin Only';
      }

      text += `${info.emoji} *${info.title}* [${statusLabel}]\n`;
      text += `└ _${info.desc}_\n`;
      text += `└ Ketik: \`${prefix}menu ${category}\`\n\n`;
    }

    text += [
      `─────────────────────────`,
      `╔════════════════════════╗`,
      `║       *SHORTCUTS*      ║`,
      `╚════════════════════════╝`,
      `• \`${prefix}menu all\` ─ Semua command`,
      `• \`${prefix}menu premium\` ─ Fitur premium`,
      `• \`${prefix}help <command>\` ─ Detail command`,
      `• Contoh: \`${prefix}help brat\``,
      `─────────────────────────`
    ].join('\n');

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

    let text = [
      `╔════════════════════════╗`,
      `║      *SEMUA COMMAND*     ║`,
      `╚════════════════════════╝`,
      `✦ Role: *${role.toUpperCase()}*` + (ctx.isGroup ? ` | Plan: *${groupPlan.toUpperCase()}*` : ''),
      `─────────────────────────`,
      ``
    ].join('\n');

    for (const category of CATEGORY_ORDER) {
      const categoryCommands = grouped[category] || [];
      if (categoryCommands.length === 0) continue;

      const info = CATEGORY_INFO[category] || CATEGORY_INFO.general;
      const commandNames = categoryCommands
        .map(command => `\`${prefix}${command.metadata.name}\``)
        .join('  ');

      text += `${info.emoji} *${info.title.toUpperCase()}*\n`;
      text += `${commandNames}\n\n`;
    }

    text += [
      `─────────────────────────`,
      `💡 Ketik \`${prefix}help <command>\` untuk detail.`,
      `Contoh: \`${prefix}help brat\``
    ].join('\n');

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

    let text = [
      `╔════════════════════════╗`,
      `  ${info.emoji} *MENU ${info.title.toUpperCase()}*`,
      `╚════════════════════════╝`,
      `✦ _${info.desc}_`,
      `─────────────────────────`,
      ``
    ].join('\n');

    categoryCommands.forEach((command) => {
      const meta = command.metadata;
      const aliasesStr = meta.aliases && meta.aliases.length > 0
        ? ` (${meta.aliases.map((alias: string) => `\`${prefix}${alias}\``).join(', ')})`
        : '';
      const desc = meta.description || 'Tidak ada deskripsi.';
      text += `• \`${prefix}${meta.name}\`${aliasesStr}\n  └ _${desc}_\n\n`;
    });

    text += [
      `─────────────────────────`,
      `💡 Ketik \`${prefix}help <command>\` untuk contoh penggunaan.`,
      `Contoh: \`${prefix}help ${categoryCommands[0].metadata.name}\``
    ].join('\n');

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

    let text = [
      `╔════════════════════════╗`,
      `║      ⭐ *MENU PREMIUM*   ║`,
      `╚════════════════════════╝`,
      `✦ Role: *${role.toUpperCase()}*` + (ctx.isGroup ? ` | Plan: *${groupPlan.toUpperCase()}*` : ''),
      `─────────────────────────`,
      ``
    ].join('\n');

    if (premiumCommands.length === 0) {
      text += `Belum ada command premium yang aktif untuk konteks ini.\n\n`;
      text += `Cek:\n`;
      text += `• \`${prefix}ceksewa\`\n`;
      text += `• \`${prefix}fitursewa\`\n`;
      text += `• \`${prefix}menu all\``;
    } else {
      const grouped = this.groupByCategory(premiumCommands);

      for (const category of CATEGORY_ORDER) {
        const categoryCommands = grouped[category] || [];
        if (categoryCommands.length === 0) continue;

        const info = CATEGORY_INFO[category] || CATEGORY_INFO.general;

        text += `${info.emoji} *${info.title}*\n`;
        text += categoryCommands
          .map(command => `• \`${prefix}${command.metadata.name}\` ─ _${command.metadata.description}_`)
          .join('\n');
        text += `\n\n`;
      }

      text += `─────────────────────────\n`;
      text += `💳 *METODE PEMBAYARAN PREMIUM* 💳\n`;
      text += `• *Provider:* ${env.PREMIUM_PAYMENT_METHOD || 'GoPay'}\n`;
      text += `• *Nomor:* \`${env.PREMIUM_PAYMENT_NUMBER || '085338123425'}\`\n`;
      text += `• Hubungi owner dengan ketik \`${prefix}owner\` untuk aktivasi/konfirmasi.\n`;
      text += `─────────────────────────\n`;
      text += `💡 Ketik \`${prefix}help <command>\` untuk detail.`;
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

    let text = [
      `╔════════════════════════╗`,
      `  ${info.emoji} *HELP: ${context.prefix}${meta.name}*`,
      `╚════════════════════════╝`,
      `─────────────────────────`,
      `📝 *Deskripsi:*`,
      `${meta.description}`,
      ``,
      `💡 *Cara Pakai:*`,
      `\`${meta.usage.replace(/\//g, context.prefix)}\``,
      ``
    ].join('\n');

    if (meta.examples && meta.examples.length > 0) {
      text += `📌 *Contoh:* \n`;
      text += meta.examples
        .map((example: string) => `• \`${example.replace(/\//g, context.prefix)}\``)
        .join('\n');
      text += `\n\n`;
    }

    if (meta.aliases && meta.aliases.length > 0) {
      text += `🔀 *Alias:* \n`;
      text += meta.aliases.map((alias: string) => `• \`${context.prefix}${alias}\``).join('\n');
      text += `\n\n`;
    }

    text += [
      `⚙️ *Status & Ketentuan:*`,
      `• Kategori: *${info.title}*`,
      `• Role Minimal: *${meta.minRole || 'user'}*`,
      `• Premium Only: *${meta.premiumOnly ? 'Ya' : 'Tidak'}*`,
      `• Status Fitur: *${globalEnabled ? 'ON' : 'OFF'}*`
    ].join('\n');

    if (ctx.isGroup) {
      text += `\n• Fitur Grup: *${groupEnabled ? 'ON' : 'OFF'}*`;
      text += `\n• Plan Grup: *${context.groupPlan.toUpperCase()}*`;
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
registerCommand(['menu', 'help', 'cmd', 'cari', 'premiumguide', 'start'], menuCmd);

const rulesCmd = new RulesCommand();
registerCommand(['rules'], rulesCmd);