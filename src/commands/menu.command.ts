import { Command, registerCommand } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import { getUserRole, isOwner } from '../bot/permission.js';
import { commandRegistry } from './registry/command-registry.js';
import { pluginManager } from '../config/plugins.js';
import { DEFAULT_FEATURES } from '../config/feature-flags.js';
import prisma from '../db/client.js';
import { env } from '../config/env.js';
import { getPremiumStatus } from '../services/premium/premium.service.js';

type Role = 'owner' | 'admin' | 'premium' | 'user';

const ROLE_LEVEL: Record<Role, number> = {
  user: 1,
  premium: 2,
  admin: 3,
  owner: 4
};

// ─── Category definitions ────────────────────────────────────────────────────
const CATEGORIES: Record<string, { emoji: string; title: string; desc: string; tag?: string }> = {
  sticker:    { emoji: '🎨', title: 'Stiker',      desc: 'Brat, meme, stiker kreatif, emoji mix'  },
  media:      { emoji: '🖼️', title: 'Media',       desc: 'HD, crop, watermark, GIF, video edit',  tag: '💎' },
  audio:      { emoji: '🎵', title: 'Audio',       desc: 'MP3, TTS, efek suara, potong audio'     },
  downloader: { emoji: '📥', title: 'Downloader',  desc: 'TikTok, Instagram, YouTube',            tag: '💎' },
  text:       { emoji: '📝', title: 'Teks & AI',   desc: 'OCR, terjemah, ringkas, AI chat'        },
  document:   { emoji: '📄', title: 'Dokumen',     desc: 'PDF, QR code, scan, unzip',             tag: '💎' },
  games:      { emoji: '🎮', title: 'Game',        desc: 'TOD, Werewolf, suit, slot, tebak kata'  },
  economy:    { emoji: '💰', title: 'Ekonomi',     desc: 'Saldo, rank, shop, pet, dungeon, RPG'   },
  admin:      { emoji: '🛡️', title: 'Admin',       desc: 'Moderasi, fitur grup, pengaturan',      tag: '🛡️' },
  owner:      { emoji: '👑', title: 'Owner',       desc: 'Tool khusus owner bot',                 tag: '👑' },
  general:    { emoji: 'ℹ️', title: 'Umum',        desc: 'Info dan utilitas umum'                 },
};

const CATEGORY_ORDER = [
  'sticker', 'media', 'audio', 'downloader', 'text',
  'document', 'games', 'economy', 'admin', 'owner', 'general'
];

// ─── Alias normalization ─────────────────────────────────────────────────────
function normalizeCategory(input?: string): string {
  if (!input) return '';
  const v = input.toLowerCase().trim();
  const map: Record<string, string> = {
    stiker: 'sticker', stickers: 'sticker', sticker: 'sticker',
    media: 'media', foto: 'media', video: 'media',
    audio: 'audio', voice: 'audio', vn: 'audio',
    download: 'downloader', downloader: 'downloader', dl: 'downloader',
    text: 'text', teks: 'text', ai: 'text', 'teks&ai': 'text',
    document: 'document', dokumen: 'document', doc: 'document', pdf: 'document',
    game: 'games', games: 'games',
    ekonomi: 'economy', economy: 'economy', eco: 'economy',
    admin: 'admin', owner: 'owner',
    all: 'all', semua: 'all',
    premium: 'premium', saya: 'saya'
  };
  return map[v] || v;
}

// ─── Permission filter ───────────────────────────────────────────────────────
function canDisplay(meta: any, ctx: {
  role: Role; roleValue: number; isGroup: boolean;
  features: Record<string, boolean>; plan: string;
}): boolean {
  const minRole = (meta.minRole || 'user') as Role;
  if (ctx.roleValue < ROLE_LEVEL[minRole]) return false;
  if (meta.premiumOnly && ctx.roleValue < ROLE_LEVEL.premium) return false;
  if (!pluginManager.isPluginEnabled(meta.plugin)) return false;

  if (ctx.isGroup && meta.featureFlag !== 'general') {
    const enabled = ctx.features[meta.featureFlag] ?? DEFAULT_FEATURES[meta.featureFlag] ?? true;
    if (!enabled) return false;
  }
  if (ctx.isGroup) {
    const cat = meta.category;
    if (ctx.plan === 'free' && cat !== 'general' && cat !== 'sticker') return false;
    if (ctx.plan === 'basic' && (cat === 'downloader' || cat === 'media' || cat === 'document')) return false;
  }
  return true;
}

function groupByCategory(commands: any[]): Record<string, any[]> {
  const result: Record<string, any[]> = {};
  for (const c of commands) {
    const cat = c.metadata.category || 'general';
    if (!result[cat]) result[cat] = [];
    result[cat].push(c);
  }
  return result;
}

// ─── Context loader ──────────────────────────────────────────────────────────
async function loadContext(ctx: MessageContext) {
  let prefix = '/';
  let features: Record<string, boolean> = { ...DEFAULT_FEATURES };
  let plan = 'free';

  if (ctx.isGroup) {
    const cfg = await prisma.groupConfig.findUnique({ where: { groupId: ctx.chatId } });
    if (cfg) {
      prefix = cfg.prefix || '/';
      try { features = { ...DEFAULT_FEATURES, ...JSON.parse(cfg.featuresJson || '{}') }; } catch { /**/ }
    }
    const sub = await prisma.groupSubscription.findUnique({ where: { groupId: ctx.chatId } });
    const expired = sub?.expiresAt && sub.expiresAt.getTime() < Date.now();
    plan = (sub && !expired) ? (sub.plan || 'free') : 'free';
  }
  return { prefix, features, plan };
}

// ─── Quota helper ────────────────────────────────────────────────────────────
async function getQuotaText(ctx: MessageContext, role: Role, plan: string): Promise<string> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (role === 'owner') return '♾️ Unlimited';
  if (role === 'premium') {
    if (!ctx.isGroup) {
      const max = parseInt(env.PREMIUM_PRIVATE_DAILY_CMD_LIMIT || '200', 10);
      const used = await prisma.usageLog.count({ where: { userId: ctx.senderId, groupId: null, createdAt: { gte: today } } });
      return `${Math.max(0, max - used)}/${max} (PM Premium)`;
    }
    return '♾️ Unlimited (Premium)';
  }
  const max = ctx.isGroup
    ? (plan === 'basic' ? 200 : 50)
    : parseInt(env.PRIVATE_DAILY_CMD_LIMIT || '20', 10);
  const where = ctx.isGroup
    ? { groupId: ctx.chatId, createdAt: { gte: today } }
    : { userId: ctx.senderId, groupId: null as any, createdAt: { gte: today } };
  const used = await prisma.usageLog.count({ where });
  return `${Math.max(0, max - used)}/${max}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MenuCommand
// ═══════════════════════════════════════════════════════════════════════════════
export class MenuCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const role = await getUserRole(ctx.chatId, ctx.senderId, adapter);
    const roleValue = ROLE_LEVEL[role];
    const { prefix, features, plan } = await loadContext(ctx);

    const cmdType = ctx.command?.commandName
      || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    const allCmds = commandRegistry.getAll();
    const visible = allCmds.filter(c => canDisplay(c.metadata, {
      role, roleValue, isGroup: ctx.isGroup, features, plan
    }));

    // ── /start ──────────────────────────────────────────────────────────────
    if (cmdType === 'start') {
      await adapter.sendMessage(ctx.chatId, [
        `🤖 *Selamat Datang di Javas Bot WA!* 👋`,
        ``,
        `Halo *${ctx.senderName || 'User'}* — saya bot WhatsApp multifungsi siap membantu.`,
        ``,
        `📌 *Mulai dari sini:*`,
        `• \`${prefix}menu\` → Menu utama`,
        `• \`${prefix}help <command>\` → Cara pakai command`,
        `• \`${prefix}cari <kata>\` → Cari command`,
        `• \`${prefix}ping\` → Cek respon bot`,
      ].join('\n'), { quotedMessageId: ctx.id });
      return;
    }

    // ── /premiumguide ────────────────────────────────────────────────────────
    if (cmdType === 'premiumguide') {
      await adapter.sendMessage(ctx.chatId, [
        `⭐ *Panduan Premium Javas Bot WA*`,
        ``,
        `🚀 *Keuntungan Premium:*`,
        `• Media & Downloader tanpa limit`,
        `• HD Upscaling hingga 4x`,
        `• Antrian prioritas`,
        `• Cooldown dihapus`,
        ``,
        `💳 *Cara mendapatkan Premium:*`,
        `Ketik \`${prefix}owner\` untuk info harga & aktivasi.`,
        `Ketik \`${prefix}ceksewa\` untuk status sewa grup.`,
      ].join('\n'), { quotedMessageId: ctx.id });
      return;
    }

    // ── /cari & /cmd ─────────────────────────────────────────────────────────
    if (cmdType === 'cari' || cmdType === 'cmd') {
      const kw = args.join(' ').trim().toLowerCase();
      if (!kw) {
        await adapter.sendMessage(ctx.chatId,
          `🔍 Masukkan kata kunci.\nContoh: \`${prefix}cari stiker\``,
          { quotedMessageId: ctx.id });
        return;
      }
      const hits = visible.filter(c => {
        const m = c.metadata;
        return m.name.includes(kw)
          || (m.description || '').toLowerCase().includes(kw)
          || (m.aliases || []).some((a: string) => a.includes(kw));
      });
      if (!hits.length) {
        await adapter.sendMessage(ctx.chatId, `🔍 Tidak ada command untuk *"${kw}"*.`, { quotedMessageId: ctx.id });
        return;
      }
      const lines = hits.slice(0, 20).map((c, i) =>
        `${i + 1}. \`${prefix}${c.metadata.name}\` — _${c.metadata.description}_`
      );
      if (hits.length > 20) lines.push(`_... dan ${hits.length - 20} lainnya_`);
      await adapter.sendMessage(ctx.chatId,
        `🔍 *Hasil "${kw}":*\n\n${lines.join('\n')}\n\n💡 \`${prefix}help <command>\` untuk detail.`,
        { quotedMessageId: ctx.id });
      return;
    }

    const rawArg = args[0]?.trim();
    const catArg = normalizeCategory(rawArg);

    // ── /menu <category> ─────────────────────────────────────────────────────
    if (catArg && CATEGORY_ORDER.includes(catArg)) {
      if (!ctx.isGroup && catArg === 'admin') {
        await adapter.sendMessage(ctx.chatId, `⚠️ Kategori Admin Grup tidak tersedia di chat pribadi.`, { quotedMessageId: ctx.id });
        return;
      }
      await this.sendCategory(ctx, adapter, visible, prefix, catArg);
      return;
    }

    // ── /menu all ────────────────────────────────────────────────────────────
    if (catArg === 'all') {
      await this.sendAll(ctx, adapter, visible, prefix, role, plan);
      return;
    }

    // ── /menu premium ────────────────────────────────────────────────────────
    if (catArg === 'premium') {
      await this.sendPremium(ctx, adapter, visible, prefix, role, plan);
      return;
    }

    // ── /menu saya ───────────────────────────────────────────────────────────
    if (catArg === 'saya') {
      await this.sendHome(ctx, adapter, visible.filter(c => {
        if (role === 'user') return !c.metadata.premiumOnly && (!c.metadata.minRole || c.metadata.minRole === 'user');
        return true;
      }), prefix, role, plan);
      return;
    }

    // ── /help <command> ──────────────────────────────────────────────────────
    if (rawArg) {
      const cmdName = rawArg.startsWith(prefix) ? rawArg.slice(prefix.length) : rawArg;
      const found = commandRegistry.get(cmdName);
      if (found) {
        await this.sendHelp(ctx, adapter, found.metadata, { prefix, features, plan });
        return;
      }
      await adapter.sendMessage(ctx.chatId,
        `⚠️ Command atau kategori *${rawArg}* tidak dikenali.\n\n` +
        `Coba:\n• \`${prefix}menu\`\n• \`${prefix}menu sticker\`\n• \`${prefix}cari <kata>\``,
        { quotedMessageId: ctx.id });
      return;
    }

    // ── Default: home menu ───────────────────────────────────────────────────
    await this.sendHome(ctx, adapter, visible, prefix, role, plan);
  }

  // ── HOME MENU (compact, navigasi saja) ──────────────────────────────────────
  private async sendHome(
    ctx: MessageContext, adapter: WhatsAppAdapter,
    commands: any[], prefix: string, role: Role, plan: string
  ) {
    const grouped = groupByCategory(commands);
    const quota = await getQuotaText(ctx, role, plan);

    const premStatus = await getPremiumStatus(ctx.senderId);
    let premLine = '';
    if (premStatus.isPremium && premStatus.expiresAt) {
      premLine = `\n⏳ Expired Premium: *${premStatus.expiresAt.toLocaleDateString('id-ID')}* (${premStatus.daysLeft} hari lagi)`;
    } else if (premStatus.isPremium) {
      premLine = `\n⭐ Expired Premium: *Selamanya*`;
    }

    const header = [
      `🤖 *JAVAS BOT WA*`,
      `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
      `👤 *${ctx.senderName || 'User'}* · ${role.toUpperCase()}${ctx.isGroup ? ` · ${plan.toUpperCase()}` : ''}${premLine}`,
      `📊 Kuota hari ini: *${quota}*`,
      `⌨️ Prefix: *${prefix}*`,
      `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
      `📂 *PILIH KATEGORI:*`,
      ``
    ].join('\n');

    const cats: string[] = [];
    for (const cat of CATEGORY_ORDER) {
      if (!ctx.isGroup && cat === 'admin') continue;
      if (cat === 'owner' && role !== 'owner') continue;
      const cmds = grouped[cat] || [];
      if (!cmds.length) continue;

      const info = CATEGORIES[cat];
      const tag = info.tag ? ` ${info.tag}` : '';
      cats.push(`${info.emoji} *${info.title}*${tag} _(${cmds.length} cmd)_`);
      cats.push(`   └ \`${prefix}menu ${cat}\``);
    }

    const footer = [
      ``,
      `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
      `🔍 \`${prefix}cari <kata>\` — cari command`,
      `❓ \`${prefix}help <cmd>\` — cara pakai`,
      `📋 \`${prefix}menu all\` — semua command`,
      `⭐ \`${prefix}menu premium\` — fitur premium`,
    ].join('\n');

    await adapter.sendMessage(ctx.chatId, header + cats.join('\n') + footer, { quotedMessageId: ctx.id });
  }

  // ── CATEGORY MENU (detail 1 kategori) ────────────────────────────────────────
  private async sendCategory(
    ctx: MessageContext, adapter: WhatsAppAdapter,
    commands: any[], prefix: string, category: string
  ) {
    const info = CATEGORIES[category] || CATEGORIES.general;
    const cmds = commands.filter(c => c.metadata.category === category);

    if (!cmds.length) {
      await adapter.sendMessage(ctx.chatId,
        `⚠️ Tidak ada command aktif di *${info.title}*.\nFitur mungkin OFF atau role belum cukup.`,
        { quotedMessageId: ctx.id });
      return;
    }

    const header = [
      `${info.emoji} *MENU ${info.title.toUpperCase()}*`,
      `_${info.desc}_`,
      `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
      ``
    ].join('\n');

    // Max 25 commands ditampilkan, sisanya "...dan N lainnya"
    const shown = cmds.slice(0, 25);
    const lines = shown.map(c => {
      const m = c.metadata;
      const alias = m.aliases?.length
        ? ` _(${m.aliases.slice(0, 2).map((a: string) => `${prefix}${a}`).join(', ')})_`
        : '';
      return `• \`${prefix}${m.name}\`${alias}\n  _${m.description || '–'}_`;
    });
    if (cmds.length > 25) {
      lines.push(`_…dan ${cmds.length - 25} command lainnya_`);
    }

    const footer = [
      ``,
      `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
      `💡 \`${prefix}help ${shown[0].metadata.name}\` untuk contoh penggunaan.`,
      `🔙 \`${prefix}menu\` kembali ke menu utama.`
    ].join('\n');

    await adapter.sendMessage(ctx.chatId, header + lines.join('\n\n') + footer, { quotedMessageId: ctx.id });
  }

  // ── ALL MENU (ringkas, semua kategori tanpa deskripsi panjang) ────────────────
  private async sendAll(
    ctx: MessageContext, adapter: WhatsAppAdapter,
    commands: any[], prefix: string, role: Role, plan: string
  ) {
    const grouped = groupByCategory(commands);
    const total = commands.length;

    let text = [
      `📋 *SEMUA COMMAND* _(${total} total)_`,
      `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
      ``
    ].join('\n');

    for (const cat of CATEGORY_ORDER) {
      if (!ctx.isGroup && cat === 'admin') continue;
      if (cat === 'owner' && role !== 'owner') continue;
      const cmds = grouped[cat] || [];
      if (!cmds.length) continue;

      const info = CATEGORIES[cat];
      // Tampilkan nama command dalam baris singkat, max 10 per kategori
      const names = cmds.slice(0, 10).map(c => `\`${prefix}${c.metadata.name}\``).join(' ');
      const more = cmds.length > 10 ? ` _+${cmds.length - 10}_` : '';
      text += `${info.emoji} *${info.title}* _(${cmds.length})_\n${names}${more}\n\n`;
    }

    text += [
      `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
      `💡 \`${prefix}menu <kategori>\` untuk detail per kategori.`,
      `❓ \`${prefix}help <cmd>\` untuk cara pakai.`
    ].join('\n');

    await adapter.sendMessage(ctx.chatId, text, { quotedMessageId: ctx.id });
  }

  // ── PREMIUM MENU ──────────────────────────────────────────────────────────────
  private async sendPremium(
    ctx: MessageContext, adapter: WhatsAppAdapter,
    commands: any[], prefix: string, role: Role, plan: string
  ) {
    const premCmds = commands.filter(c => {
      const m = c.metadata;
      return m.premiumOnly || m.category === 'downloader' || m.category === 'media' || m.category === 'document';
    });

    let text = [
      `⭐ *MENU PREMIUM*`,
      `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
      ``
    ].join('\n');

    if (!premCmds.length) {
      text += `Belum ada command premium aktif untuk role/plan Anda.\n\n`;
      text += `Cek: \`${prefix}ceksewa\` · \`${prefix}menu all\``;
    } else {
      const grouped = groupByCategory(premCmds);
      for (const cat of CATEGORY_ORDER) {
        const cmds = grouped[cat] || [];
        if (!cmds.length) continue;
        const info = CATEGORIES[cat];
        const names = cmds.map(c => `\`${prefix}${c.metadata.name}\``).join(' ');
        text += `${info.emoji} *${info.title}*\n${names}\n\n`;
      }
      text += [
        `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
        `💳 *Aktivasi Premium:*`,
        `• Metode: *${env.PREMIUM_PAYMENT_METHOD || 'GoPay/Transfer'}*`,
        `• Nomor: \`${env.PREMIUM_PAYMENT_NUMBER || '085338123425'}\``,
        `• Ketik \`${prefix}owner\` untuk konfirmasi ke owner.`
      ].join('\n');
    }

    await adapter.sendMessage(ctx.chatId, text, { quotedMessageId: ctx.id });
  }

  // ── HELP (detail satu command) ────────────────────────────────────────────────
  private async sendHelp(
    ctx: MessageContext, adapter: WhatsAppAdapter,
    meta: any, context: { prefix: string; features: Record<string, boolean>; plan: string }
  ) {
    const info = CATEGORIES[meta.category] || CATEGORIES.general;
    const p = context.prefix;
    const globalOn = pluginManager.isPluginEnabled(meta.plugin);
    const groupOn = ctx.isGroup && meta.featureFlag !== 'general'
      ? (context.features[meta.featureFlag] ?? DEFAULT_FEATURES[meta.featureFlag] ?? true)
      : true;

    let text = [
      `${info.emoji} *HELP: ${p}${meta.name}*`,
      `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
      `📝 ${meta.description || '–'}`,
      ``,
      `💡 *Cara pakai:*`,
      `\`${(meta.usage || `/${meta.name}`).replace(/\//g, p)}\``,
    ].join('\n');

    if (meta.examples?.length) {
      text += `\n\n📌 *Contoh:*\n`;
      text += meta.examples.slice(0, 3).map((e: string) => `• \`${e.replace(/\//g, p)}\``).join('\n');
    }

    if (meta.aliases?.length) {
      text += `\n\n🔀 *Alias:* ${meta.aliases.map((a: string) => `\`${p}${a}\``).join(' · ')}`;
    }

    text += `\n\n⚙️ *Status:*`;
    text += `\n• Kategori: *${info.title}*`;
    text += `\n• Role min: *${meta.minRole || 'user'}*`;
    text += `\n• Premium: *${meta.premiumOnly ? 'Ya ⭐' : 'Tidak'}*`;
    text += `\n• Plugin: *${globalOn ? '🟢 ON' : '🔴 OFF'}*`;
    if (ctx.isGroup) {
      text += `\n• Fitur grup: *${groupOn ? '🟢 ON' : '🔴 OFF'}*`;
      text += `\n• Plan grup: *${context.plan.toUpperCase()}*`;
    }

    await adapter.sendMessage(ctx.chatId, text, { quotedMessageId: ctx.id });
  }
}

// ─── Rules command ───────────────────────────────────────────────────────────
export class RulesCommand implements Command {
  public async execute(ctx: MessageContext, _args: string[], adapter: WhatsAppAdapter): Promise<void> {
    await adapter.sendMessage(ctx.chatId, [
      `⚠️ *ATURAN PENGGUNAAN BOT*`,
      `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
      `1. Gunakan bot secara bijak dan bertanggung jawab.`,
      `2. Fitur downloader hanya untuk konten legal/milik sendiri.`,
      `3. Bot tidak mendukung bypass DRM, akun privat, atau pelanggaran hak cipta.`,
      `4. Media yang diproses bersifat sementara dan dibersihkan otomatis.`,
      `5. Admin/owner berhak membatasi fitur jika terjadi penyalahgunaan.`,
    ].join('\n'), { quotedMessageId: ctx.id });
  }
}

// ─── Register ────────────────────────────────────────────────────────────────
registerCommand(['menu', 'help', 'cmd', 'cari', 'premiumguide', 'start'], new MenuCommand());
registerCommand(['rules'], new RulesCommand());