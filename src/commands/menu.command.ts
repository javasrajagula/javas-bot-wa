import { Command, registerCommand } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import { getUserRole } from '../bot/permission.js';
import { commandRegistry } from './registry/command-registry.js';
import { pluginManager } from '../config/plugins.js';
import prisma from '../db/client.js';

export class MenuCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const role = await getUserRole(ctx.chatId, ctx.senderId, adapter);

    // Resolve prefix and group feature flags
    let prefix = '/';
    let groupFeatures: Record<string, boolean> = {};
    if (ctx.isGroup) {
      const config = await prisma.groupConfig.findUnique({ where: { groupId: ctx.chatId } });
      if (config) {
        prefix = config.prefix;
        try {
          groupFeatures = JSON.parse(config.featuresJson || '{}');
        } catch {}
      }
    }

    const commandArg = args[0]?.trim().toLowerCase();

    // 1. If it's a help request for a specific command:
    const isCategory = ['sticker', 'media', 'audio', 'downloader', 'text', 'document', 'games', 'economy', 'admin', 'owner', 'all'].includes(commandArg);
    if (commandArg && !isCategory) {
      const cleanCmdName = commandArg.startsWith(prefix) ? commandArg.slice(prefix.length) : commandArg;
      const cmd = commandRegistry.get(cleanCmdName);
      if (cmd) {
        const meta = cmd.metadata;
        const globalEnabled = pluginManager.isPluginEnabled(meta.plugin);
        const groupEnabled = ctx.isGroup
          ? (groupFeatures[meta.featureFlag] !== undefined ? groupFeatures[meta.featureFlag] : true)
          : true;

        let helpMsg = `╭─── *HELP: ${prefix}${meta.name.toUpperCase()}* ───╮\n`;
        helpMsg += `│\n`;
        helpMsg += `├─ 📝 *Deskripsi:* ${meta.description}\n`;
        helpMsg += `├─ ⚙️ *Penggunaan:* ${meta.usage.replace(/\//g, prefix)}\n`;
        if (meta.aliases && meta.aliases.length > 0) {
          helpMsg += `├─ 🔀 *Alias:* ${meta.aliases.map(a => prefix + a).join(', ')}\n`;
        }
        if (meta.examples && meta.examples.length > 0) {
          helpMsg += `├─ 💡 *Contoh:* ${meta.examples.map(ex => ex.replace(/\//g, prefix)).join(', ')}\n`;
        }
        helpMsg += `├─ 👥 *Minimal Role:* ${meta.minRole || 'user'}\n`;
        if (meta.premiumOnly) {
          helpMsg += `├─ ⭐ *Premium:* Ya\n`;
        }
        helpMsg += `├─ 📁 *Kategori:* ${meta.category}\n`;
        helpMsg += `├─ 🔌 *Status Global:* ${globalEnabled ? '🟢 Aktif' : '🔴 Nonaktif'}\n`;
        if (ctx.isGroup) {
          helpMsg += `├─ 👥 *Status Grup:* ${groupEnabled ? '🟢 Aktif' : '🔴 Nonaktif'}\n`;
        }
        helpMsg += `│\n`;
        helpMsg += `╰────────────────────────╯`;
        await adapter.sendMessage(ctx.chatId, helpMsg, { quotedMessageId: ctx.id });
        return;
      }
    }

    // Role hierarchies
    const roleHierarchy: Record<string, number> = { owner: 4, admin: 3, premium: 2, user: 1 };
    const userRoleVal = roleHierarchy[role];

    const shouldDisplayCommand = (meta: any) => {
      // 1. Min role check
      const cmdMinRole = meta.minRole || 'user';
      if (userRoleVal < roleHierarchy[cmdMinRole]) return false;
      if (meta.premiumOnly && userRoleVal < 2) return false;

      // 2. Global plugin enabled check
      if (!pluginManager.isPluginEnabled(meta.plugin)) return false;

      // 3. Group feature flag check
      if (ctx.isGroup && meta.featureFlag !== 'general') {
        const isFlagOn = groupFeatures[meta.featureFlag] !== undefined ? groupFeatures[meta.featureFlag] : true;
        if (!isFlagOn) return false;
      }

      return true;
    };

    const allCommands = commandRegistry.getAll();

    // 2. If user requests /menu all:
    if (commandArg === 'all') {
      let menuText = `╭────── *ALL JAVAS BOT COMMANDS* ──────╮\n│\n`;
      const categories = ['sticker', 'media', 'audio', 'downloader', 'text', 'document', 'games', 'economy', 'admin', 'owner'];
      for (const cat of categories) {
        if (cat === 'admin' && userRoleVal < 3) continue;
        if (cat === 'owner' && userRoleVal < 4) continue;

        const catCmds = allCommands.filter(c => c.metadata.category === cat && shouldDisplayCommand(c.metadata));
        if (catCmds.length === 0) continue;

        menuText += `├─ 📁 *${cat.toUpperCase()}*\n`;
        catCmds.forEach(c => {
          menuText += `│  • ${prefix}${c.metadata.name} - ${c.metadata.description}\n`;
        });
        menuText += `│\n`;
      }
      menuText += `╰────────────────────────╯\n`;
      menuText += `Ketik *${prefix}help <command>* untuk bantuan detail.`;
      await adapter.sendMessage(ctx.chatId, menuText, { quotedMessageId: ctx.id });
      return;
    }

    // 3. If user requests a specific category:
    if (commandArg && isCategory) {
      if (commandArg === 'admin' && userRoleVal < 3) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Kategori admin khusus untuk Admin grup.', { quotedMessageId: ctx.id });
        return;
      }
      if (commandArg === 'owner' && userRoleVal < 4) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Kategori owner khusus untuk Owner bot.', { quotedMessageId: ctx.id });
        return;
      }

      const catCmds = allCommands.filter(c => c.metadata.category === commandArg && shouldDisplayCommand(c.metadata));
      if (catCmds.length === 0) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Tidak ada command aktif di kategori "${commandArg}".`, { quotedMessageId: ctx.id });
        return;
      }

      let menuText = `╭────── *CATEGORY: ${commandArg.toUpperCase()}* ──────╮\n│\n`;
      catCmds.forEach(c => {
        menuText += `│  • *${prefix}${c.metadata.name}* - ${c.metadata.description}\n`;
        if (c.metadata.aliases && c.metadata.aliases.length > 0) {
          menuText += `│    _Alias: ${c.metadata.aliases.map(a => prefix + a).join(', ')}_\n`;
        }
      });
      menuText += `│\n╰────────────────────────╯\n`;
      menuText += `Ketik *${prefix}help <command>* untuk bantuan detail.`;
      await adapter.sendMessage(ctx.chatId, menuText, { quotedMessageId: ctx.id });
      return;
    }

    // 4. Default: Show categories overview
    let menuText = `╭────── *JAVAS BOT WA MENU* ──────╮\n`;
    menuText += `│\n`;
    menuText += `│ Halo *${ctx.senderName}*!\n`;
    menuText += `│ Ketik *${prefix}menu <kategori>* untuk melihat daftar command.\n`;
    menuText += `│ Contoh: *${prefix}menu sticker*\n`;
    menuText += `│\n`;
    menuText += `├─ 📝 *sticker* - Stiker WhatsApp\n`;
    menuText += `├─ 🎥 *media* - Pengolah Media Foto/Video\n`;
    menuText += `├─ 🎵 *audio* - Pengolah Audio & VN\n`;
    menuText += `├─ 📥 *downloader* - Pengunduh Video & Foto\n`;
    menuText += `├─ 📖 *text* - Utilitas Teks & Belajar\n`;
    menuText += `├─ 📁 *document* - Utilitas File/PDF/Document\n`;
    menuText += `├─ 🎮 *games* - Game Interaktif & Werewolf\n`;
    menuText += `├─ 💰 *economy* - Sistem Level & Ekonomi RPG\n`;

    if (userRoleVal >= 3) {
      menuText += `├─ 👥 *admin* - Moderasi & Pengaturan Grup\n`;
    }
    if (userRoleVal >= 4) {
      menuText += `├─ 👑 *owner* - System Tools & Developer Commands\n`;
    }

    menuText += `│\n`;
    menuText += `├─ ℹ️ Ketik *${prefix}menu all* untuk melihat semua.\n`;
    menuText += `├─ ℹ️ Ketik *${prefix}rules* untuk disclaimer & aturan.\n`;
    menuText += `╰────────────────────────╯`;

    await adapter.sendMessage(ctx.chatId, menuText, { quotedMessageId: ctx.id });
  }
}

export class RulesCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const rulesText = `⚠️ *DISCLAIMER & KETENTUAN PENGGUNAAN BOT* ⚠️

1. Gunakan bot secara bijak dan bertanggung jawab.
2. Fitur downloader (/tt, /ig) hanya digunakan untuk mengunduh konten milik sendiri, berizin, atau konten yang memang boleh diunduh secara legal.
3. Bot tidak mendukung download dari akun privat, login pihak ketiga, bypass DRM, atau segala bentuk pelanggaran hak cipta.
4. Data media yang diproses (gambar, stiker, audio) bersifat sementara dan akan dihapus otomatis dari server dalam waktu maksimal 15 menit. Bot tidak menyimpan media pribadi secara permanen.`;

    await adapter.sendMessage(ctx.chatId, rulesText, { quotedMessageId: ctx.id });
  }
}

// Register commands
const menuCmd = new MenuCommand();
registerCommand(['menu', 'help'], menuCmd);

const rulesCmd = new RulesCommand();
registerCommand(['rules'], rulesCmd);
