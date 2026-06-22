import { RegisteredCommand, CommandMetadata } from './command-types.js';
import { COMMAND_METADATA_LIST } from './command-metadata.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';

interface RegistryEntry {
  metadata: CommandMetadata;
  execute?: (ctx: MessageContext, args: string[], adapter: WhatsAppAdapter) => Promise<void>;
  isRegistered: boolean;
}

const COMMAND_MODULES = [
  {
    path: '../menu.command.js',
    commands: ['menu', 'help', 'cmd', 'cari', 'premiumguide', 'start', 'rules']
  },
  {
    path: '../admin.command.js',
    commands: ['admin', 'addadmin', 'deladmin']
  },
  {
    path: '../setup.command.js',
    commands: ['setup', 'setupwizard', 'groupmode', 'pack', 'setupcheck', 'statusfitur', 'features']
  },
  {
    path: '../feature.command.js',
    commands: ['feature', 'fiturstatus', 'repair']
  },
  {
    path: '../downloader.command.js',
    commands: ['tt', 'tiktok', 'ig', 'instagram', 'ytmp3', 'ytmp4', 'fb', 'facebook', 'twitter', 'x', 'threads', 'thread', 'pinterest', 'pin', 'capcut', 'cc']
  },
  {
    path: '../economy.command.js',
    commands: ['balance', 'claim', 'transfer', 'rank', 'top', 'shop', 'buy', 'sell', 'inventory', 'title', 'achievement', 'badge']
  },
  {
    path: '../subscription.command.js',
    commands: ['sewa', 'ceksewa', 'fitursewa', 'invoice', 'sewaconfirm', 'trial']
  },
  {
    path: '../sticker/sticker.command.js',
    commands: ['stiker', 's', 'toimg', 'brat', 'quote', 'removebg', 'stikerbg', 'circle', 'outline', 'meme', 'emojimix', 'vstiker', 'batchstiker']
  },
  {
    path: '../sticker/sticker-creative.command.js',
    commands: ['sfilter', 'smeme', 'togif', 'emojimix']
  },
  {
    path: '../media/media.command.js',
    commands: ['hd', 'compress', 'resize', 'crop', 'wm', 'togif', 'thumb', 'cut', 'mute', 'reverse']
  },
  {
    path: '../media/media-advanced.command.js',
    commands: ['collage', 'watermark', 'gif2webp', 'webp2gif', 'mp42gif', 'compressvideo', 'lowresource', 'resourceguard']
  },
  {
    path: '../audio/audio.command.js',
    commands: ['tts', 'mp3', 'transkrip', 'voice', 'cutaudio', 'speed', 'slow']
  },
  {
    path: '../audio/audio-advanced.command.js',
    commands: ['noisecheck', 'voicetotext', 'texttoaudio', 'subtitles', 'audiosilence']
  },
  {
    path: '../text/text.command.js',
    commands: ['ocr', 'translate', 'ringkas', 'ubah', 'typo', 'balas', 'jelaskan']
  },
  {
    path: '../text/ai.command.js',
    commands: ['ai', 'chatmode', 'provider', 'providerstatus', 'setpersona']
  },
  {
    path: '../text/ai-advanced.command.js',
    commands: ['sentimen', 'cerita', 'rekomendasi', 'addfaq', 'delfaq', 'listfaq']
  },
  {
    path: '../text/ai-multimodal.command.js',
    commands: ['draw', 'vocal', 'faceswap', 'removebg', 'baca', 'jawabsoal']
  },
  {
    path: '../text/dynamic-ai.command.js',
    commands: ['tutor', 'soal', 'rubrik', 'flashcard', 'debat', 'paragraf', 'parafrase', 'koreksi', 'vocab', 'el5', 'aibudget']
  },
  {
    path: '../text/education-advanced.command.js',
    commands: ['tutor', 'matematika', 'kimia', 'fisika', 'sejarah', 'biologi', 'tugas', 'deadline', 'jadwal']
  },
  {
    path: '../text/integration-advanced.command.js',
    commands: ['rss', 'cekweb', 'email', 'webhook', 'shorten', 'short']
  },
  {
    path: '../text/integrations-v2.command.js',
    commands: ['github', 'cekdompet', 'trello', 'steam', 'pantauharga']
  },
  {
    path: '../text/dynamic-integration.command.js',
    commands: ['checkreputation', 'expandlink', 'screenshot', 'bookmark', 'bookmarks', 'queuestatus', 'retryjob', 'sources', 'quota', 'requestdomain', 'linkreminder']
  },
  {
    path: '../games/games.command.js',
    commands: ['tod', 'tebakkata', 'jawab', 'tebakgambar', 'suit', 'ttt', 'slot', 'math', 'family100', 'couple', 'ww']
  },
  {
    path: '../games/games-advanced.command.js',
    commands: ['tictactoe', 'catur', 'connect4', 'battleship', 'uno', 'blackjack', 'monopoly', 'tycoon', 'petbattle', 'guildwar']
  },
  {
    path: '../games/dynamic-games.command.js',
    commands: ['wwchaos', 'wwranked', 'mafiasch', 'detective', 'escape', 'treasure', 'kata', 'emoji', 'suara', 'siluet', 'duel', 'royale', 'ranking', 'familyleague', 'surveySays', 'mathsprint', 'mathboss', 'puzzle24', 'sudoku', 'wordle', 'hangman', 'anagram', 'typing', 'memory', 'minesweeper']
  },
  {
    path: '../games/rpg-advanced.command.js',
    commands: ['dungeon', 'hunt', 'heal', 'inventory', 'shop', 'clan', 'misi', 'quest', 'boss', 'trade']
  },
  {
    path: '../games/werewolf.command.js',
    commands: ['ww', 'wwrank', 'wwstats']
  },
  {
    path: '../games/mission.command.js',
    commands: ['misi', 'mission', 'claimmission']
  },
  {
    path: '../community/community.command.js',
    commands: ['add', 'kick', 'promote', 'demote', 'setname', 'setdesc', 'setppgc', 'linkgc', 'resetlink', 'tagall', 'hidetag']
  },
  {
    path: '../community/schedule.command.js',
    commands: ['jadwal', 'agenda', 'pengingat', 'remind', 'jadwalshalat', 'cuaca']
  },
  {
    path: '../community/alias.command.js',
    commands: ['alias', 'addalias', 'delalias', 'listalias']
  },
  {
    path: '../community/locale.command.js',
    commands: ['locale', 'setlang', 'bahasa']
  },
  {
    path: '../community/welcome.command.js',
    commands: ['welcome', 'goodbye', 'setwelcome', 'setgoodbye', 'welcomecard']
  },
  {
    path: '../community/school.command.js',
    commands: ['schoolmode', 'tugas', 'tugasadd', 'tugasdone', 'absen', 'jadwal']
  },
  {
    path: '../community/attendance.command.js',
    commands: ['absen', 'hadir', 'rekapabsen', 'tutupabsen', 'bukaabsen']
  },
  {
    path: '../community/stats.command.js',
    commands: ['stats', 'stat', 'topchat', 'topcmd', 'topsticker', 'topactive', 'inactive']
  },
  {
    path: '../community/reputation.command.js',
    commands: ['rep', 'thank', 'makasih', 'reputasi', 'badgeworld']
  },
  {
    path: '../community/notes.command.js',
    commands: ['note', 'todo', 'catatan', 'jadwalpribadi', 'targetharian', 'habit', 'mood', 'diary', 'memory']
  },
  {
    path: '../community/business.command.js',
    commands: ['jual', 'beli', 'listproduk', 'hapusproduk', 'customer', 'supplier', 'stok', 'ongkir', 'resi', 'promo']
  },
  {
    path: '../community/finance.command.js',
    commands: ['kas', 'split', 'splitstatus', 'splitdone', 'tagihan', 'arisan', 'iuran', 'invoice', 'order', 'escrow', 'catat']
  },
  {
    path: '../community/automation.command.js',
    commands: ['workflow', 'auto', 'rule', 'var', 'announcements', 'announcement', 'announce']
  },
  {
    path: '../document/document.command.js',
    commands: ['img2pdf', 'pdf2img', 'mergepdf', 'compresspdf', 'scan', 'unzip', 'qr', 'readqr', 'checklink', 'cekpenipuan']
  },
  {
    path: '../document/safety.command.js',
    commands: ['checklink', 'cekpenipuan']
  },
  {
    path: '../document/utility-advanced.command.js',
    commands: ['pdfsplit', 'pdfmerge', 'pdfencrypt', 'pdfdecrypt', 'ocrbatch', 'docsummary', 'renamefile', 'zippreview', 'qrgenerate', 'unitconvert']
  },
  {
    path: '../document/dynamic-utility.command.js',
    commands: ['bmkgweather', 'shorten', 'holiday', 'base64encode', 'base64decode', 'jsonformat', 'wordcount']
  },
  {
    path: '../moderation/moderation.command.js',
    commands: ['kick', 'mute', 'unmute', 'promote', 'demote', 'tempadmin', 'welcome', 'goodbye', 'setwelcome', 'setgoodbye', 'welcomecard', 'captcha', 'blacklist', 'unblacklist', 'listblacklist', 'tagall', 'hidetag', 'grouplog']
  },
  {
    path: '../moderation/antispam.command.js',
    commands: ['antispam', 'antilink', 'whitelistdomain', 'antivirtex', 'antimention', 'antisticker']
  },
  {
    path: '../moderation/warning-rule.command.js',
    commands: ['addwarnrule', 'delwarnrule', 'listwarnrule']
  },
  {
    path: '../moderation/group-log.command.js',
    commands: ['log', 'clearlog']
  },
  {
    path: '../moderation/antiraid.command.js',
    commands: ['antiraid', 'lockdown', 'allowedtypes']
  },
  {
    path: '../moderation/backup-config.command.js',
    commands: ['backupconfig', 'restoreconfig']
  },
  {
    path: '../moderation/dynamic-security.command.js',
    commands: ['antiflood', 'whitelistlink', 'antiforward', 'antijoinbot', 'captcha2', 'muteprogressive', 'lockdownschedule', 'antitagall', 'moderationappeal', 'safetydigest']
  },
  {
    path: '../owner/owner.command.js',
    commands: ['addsewa', 'allowgroup', 'denygroup', 'extendsewa', 'setplan', 'panicmode', 'maintenance', 'shutdownbot', 'restart', 'simulate', 'autobackup', 'backup', 'backupgd', 'backupsend', 'blockcmd', 'enablecmd', 'disablecmd', 'movegroup', 'logoutwa', 'ownerlog', 'updateannounce', 'update']
  },
  {
    path: '../owner/error.command.js',
    commands: ['error', 'errorstats', 'clearerrors']
  },
  {
    path: '../owner/queue.command.js',
    commands: ['queue', 'canceljob', 'job']
  },
  {
    path: '../owner/status.command.js',
    commands: ['ping', 'statusbot', 'status', 'health', 'uptime', 'workers', 'workerstatus', 'diagnose', 'checkdeps', 'securitycheck', 'setupcheck', 'providerstatus', 'dbstatus', 'dbinfo']
  },
  {
    path: '../owner/quota.command.js',
    commands: ['quota', 'credit', 'buycredit', 'usage']
  },
  {
    path: '../owner/coupon.command.js',
    commands: ['coupon', 'referral', 'refclaim']
  },
  {
    path: '../owner/reseller.command.js',
    commands: ['addreseller', 'reseller']
  },
  {
    path: '../owner/privacy.command.js',
    commands: ['privacymode', 'retention', 'mydata', 'deletedata', 'consent', 'setuju', 'generaterules']
  },
  {
    path: '../owner/webhook.command.js',
    commands: ['webhook', 'announce', 'announcements', 'announcement']
  }
];

class CommandRegistry {
  private registry = new Map<string, RegistryEntry>();
  private aliasMap = new Map<string, string>();
  private fileMap = new Map<string, string>();

  constructor() {
    // Populate file lookup map
    for (const mod of COMMAND_MODULES) {
      for (const cmd of mod.commands) {
        this.fileMap.set(cmd.toLowerCase(), mod.path);
      }
    }

    // Populate registry with all pre-defined command metadata
    for (const meta of COMMAND_METADATA_LIST) {
      const primary = meta.name.toLowerCase();

      this.registry.set(primary, {
        metadata: meta,
        isRegistered: false
      });

      this.aliasMap.set(primary, primary);

      for (const alias of meta.aliases) {
        this.aliasMap.set(alias.toLowerCase(), primary);
      }
    }
  }

  public register(
    names: string[],
    execute: (ctx: MessageContext, args: string[], adapter: WhatsAppAdapter) => Promise<void>
  ) {
    const normalizedNames = names.map(name => name.toLowerCase());

    for (const name of normalizedNames) {
      const resolvedPrimary = this.aliasMap.get(name);

      if (resolvedPrimary) {
        const entry = this.registry.get(resolvedPrimary);

        if (entry) {
          entry.execute = execute;
          entry.isRegistered = true;
        }

        continue;
      }

      const meta: CommandMetadata = {
        name,
        aliases: [],
        category: 'general',
        plugin: 'general',
        featureFlag: 'general',
        description: 'Command otomatis terdaftar.',
        usage: `/${name}`,
        examples: []
      };

      this.registry.set(name, {
        metadata: meta,
        execute,
        isRegistered: true
      });

      this.aliasMap.set(name, name);
    }
  }

  public ensureMetadata(metadata: CommandMetadata): void {
    const primary = metadata.name.toLowerCase();
    const existing = this.registry.get(primary);

    if (existing) {
      existing.metadata = {
        ...metadata,
        aliases: [...new Set([...(existing.metadata.aliases || []), ...(metadata.aliases || [])])]
      };
    } else {
      this.registry.set(primary, {
        metadata,
        isRegistered: false
      });
    }

    this.aliasMap.set(primary, primary);
    for (const alias of metadata.aliases) {
      this.aliasMap.set(alias.toLowerCase(), primary);
    }
  }

  public isPrdCoverageCommand(name: string): boolean {
    const primary = this.aliasMap.get(name.toLowerCase());
    if (!primary) return true;
    return !this.fileMap.has(primary);
  }

  public async get(nameOrAlias: string): Promise<RegisteredCommand | undefined> {
    const primary = this.aliasMap.get(nameOrAlias.toLowerCase());

    if (!primary) return undefined;

    const entry = this.registry.get(primary);

    if (entry) {
      if (!entry.isRegistered || !entry.execute) {
        const modulePath = this.fileMap.get(primary);
        if (modulePath) {
          try {
            await import(modulePath);
          } catch (err) {
            console.error(`[Registry] Failed to lazy load module ${modulePath} for command ${primary}:`, err);
          }
        }
      }

      if (entry.isRegistered && entry.execute) {
        return {
          metadata: entry.metadata,
          execute: entry.execute
        };
      }
    }

    return undefined;
  }

  public getAll(): RegisteredCommand[] {
    const list: RegisteredCommand[] = [];

    for (const [primary, entry] of this.registry.entries()) {
      list.push({
        metadata: entry.metadata,
        execute: async (ctx, args, adapter) => {
          const resolved = await this.get(primary);
          if (resolved) {
            await resolved.execute(ctx, args, adapter);
          } else {
            throw new Error(`Command ${primary} could not be resolved`);
          }
        }
      });
    }

    return list;
  }
}

export const commandRegistry = new CommandRegistry();
export type { CommandRegistry };
