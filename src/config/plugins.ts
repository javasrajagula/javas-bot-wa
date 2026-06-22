import fs from 'fs';
import path from 'path';
import prisma from '../db/client.js';
import { env } from './env.js';

export interface PluginMetadata {
  name: string;
  commands: string[];
  enabled: boolean;
  permission: 'USER' | 'PREMIUM' | 'GROUP_ADMIN' | 'OWNER';
  category: string;
}

const STATE_FILE = path.join(process.cwd(), 'data', 'plugins_state.json');

const INITIAL_PLUGINS: PluginMetadata[] = [
  {
    name: 'downloader',
    commands: [
      'tt',
      'tiktok',
      'ig',
      'instagram',
      'ytmp3',
      'youtube-audio',
      'ytmp4',
      'youtube-video',
      'fb',
      'facebook',
      'fbdown',
      'twitter',
      'x',
      'twtdl',
      'threads',
      'thread',
      'pinterest',
      'pin',
      'pindl',
      'capcut',
      'cc'
    ],
    enabled: true,
    permission: 'USER',
    category: 'Downloader'
  },
  {
    name: 'sticker',
    commands: ['stiker', 's', 'toimg', 'brat', 'quote', 'removebg', 'rbg', 'stikerbg', 'nobgstick', 'circle', 'bulat', 'outline', 'meme', 'emojimix', 'mix', 'vstiker', 'gifstiker', 'batchstiker', 'pack'],
    enabled: true,
    permission: 'USER',
    category: 'Stickers'
  },
  {
    name: 'media',
    commands: ['hd', 'compress', 'kompres', 'resize', 'crop', 'wm', 'togif', 'thumb', 'cut', 'subtitle', 'mute', 'reverse'],
    enabled: true,
    permission: 'USER',
    category: 'Media'
  },
  {
    name: 'audio',
    commands: ['mp3', 'audio', 'transkrip', 'vntext', 'tts', 'voice', 'cutaudio', 'speed', 'slow'],
    enabled: true,
    permission: 'USER',
    category: 'Audio'
  },
  {
    name: 'text',
    commands: ['ocr', 'translate', 'tr', 'ringkas', 'summarize', 'ubah', 'typo', 'koreksi', 'balas', 'jelaskan', 'rangkum', 'quiz', 'belajar', 'jawab'],
    enabled: true,
    permission: 'USER',
    category: 'Text'
  },
  {
    name: 'document',
    commands: ['img2pdf', 'pdf2img', 'mergepdf', 'compresspdf', 'scan', 'unzip', 'qr', 'readqr', 'ssweb', 'checklink', 'cekpenipuan', 'scamcheck'],
    enabled: true,
    permission: 'USER',
    category: 'Documents'
  },
  {
    name: 'moderation',
    commands: ['warn', 'warnings', 'unwarn', 'clearwarn', 'filter', 'addbadword', 'delbadword', 'listbadword', 'antitoxic', 'antispam', 'automute', 'blacklist', 'unblacklist', 'listblacklist'],
    enabled: true,
    permission: 'GROUP_ADMIN',
    category: 'Moderation'
  },
  {
    name: 'community',
    commands: ['addreply', 'delreply', 'listreply', 'poll', 'vote', 'pollresult', 'closepoll', 'confess', 'menfess', 'remind', 'listremind', 'delremind', 'event', 'listevent', 'delevent', 'absen'],
    enabled: true,
    permission: 'USER',
    category: 'Community'
  },
  {
    name: 'games',
    commands: ['tod', 'truth', 'dare', 'tebakkata', 'tebakgambar', 'suit', 'pilih', 'ttt', 'slot', 'math', 'family100', 'couple', 'jodoh', 'tebaklagu', 'wwrank', 'wwstats', 'ww'],
    enabled: true,
    permission: 'USER',
    category: 'Games'
  },
  {
    name: 'economy',
    commands: ['balance', 'bal', 'claim', 'daily', 'transfer', 'top', 'rank', 'shop', 'buy', 'inventory', 'inv', 'title', 'badge', 'pet', 'dungeon', 'attack', 'heal', 'run', 'quota', 'credit', 'buycredit', 'usage'],
    enabled: true,
    permission: 'USER',
    category: 'Economy'
  },
  {
    name: 'owner',
    commands: ['maintenance', 'premium', 'broadcast', 'stats', 'limit', 'apikey', 'revokeapikey', 'plugin', 'addsewa', 'delsewa', 'listsewa', 'extendsewa', 'setplan', 'backup', 'backupdb', 'backupconfig', 'listbackup', 'restorebackup', 'exportconfig', 'importconfig', 'addreseller', 'reseller'],
    enabled: true,
    permission: 'OWNER',
    category: 'Owner'
  },
  {
    name: 'general',
    commands: [
      'menu',
      'help',
      'start',
      'cmd',
      'cari',
      'ping',
      'status'
    ],
    enabled: true,
    permission: 'USER',
    category: 'General'
  }
];

// Dynamically register the new PRD commands and plugins
import { PRD_CATALOG } from '../commands/prd/prd-feature-catalog.js';

const newPlugins: Record<string, string[]> = {
  privacy: [],
  school: [],
  productivity: [],
  business: [],
  automation: [],
  analytics: [],
  developer: [],
  premium: [],
  ai: [],
  admin: []
};

for (const entry of PRD_CATALOG) {
  const pName = entry.plugin.toLowerCase();
  const cmds = [entry.name, ...entry.aliases];

  if (pName in newPlugins) {
    newPlugins[pName].push(...cmds);
  } else {
    const existing = INITIAL_PLUGINS.find(p => p.name.toLowerCase() === pName);
    if (existing) {
      existing.commands.push(...cmds);
    }
  }
}

for (const [name, commands] of Object.entries(newPlugins)) {
  const categoryName = name.charAt(0).toUpperCase() + name.slice(1);
  INITIAL_PLUGINS.push({
    name,
    commands,
    enabled: true,
    permission: name === 'developer' || name === 'premium' ? 'OWNER' : 'USER',
    category: categoryName
  });
}

class PluginManager {
  private plugins: PluginMetadata[] = [];

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const fileContent = fs.readFileSync(STATE_FILE, 'utf-8');
        const savedState = JSON.parse(fileContent);
        this.plugins = INITIAL_PLUGINS.map(p => {
          const saved = savedState.find((s: any) => s.name === p.name);
          return {
            ...p,
            enabled: saved ? saved.enabled : p.enabled
          };
        });
      } else {
        this.plugins = [...INITIAL_PLUGINS];
        this.saveStateToFile();
      }
    } catch (err) {
      console.error('Failed to load plugin state:', err);
      this.plugins = [...INITIAL_PLUGINS];
    }
  }

  private saveStateToFile() {
    try {
      fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
      const stateToSave = this.plugins.map(p => ({ name: p.name, enabled: p.enabled }));
      fs.writeFileSync(STATE_FILE, JSON.stringify(stateToSave, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save plugin state to file:', err);
    }
  }

  public async syncWithDatabase(): Promise<void> {
    try {
      const dbStates = await prisma.pluginState.findMany();

      if (dbStates.length > 0) {
        console.log('[Plugins] Loaded states from database.');
        this.plugins = INITIAL_PLUGINS.map(p => {
          const dbState = dbStates.find((s: { name: string; enabled: boolean }) => s.name === p.name);
          return {
            ...p,
            enabled: dbState ? dbState.enabled : p.enabled
          };
        });
        this.saveStateToFile();
      } else {
        console.log('[Plugins] Migrating local plugin states to database...');
        for (const p of this.plugins) {
          await prisma.pluginState.upsert({
            where: { name: p.name },
            create: { name: p.name, enabled: p.enabled },
            update: { enabled: p.enabled }
          });
        }
        console.log('[Plugins] Migration to database completed.');
      }
    } catch (err) {
      console.warn('[Plugins] Failed to sync with database, falling back to local file state:', err);
    }
  }

  public listPlugins(): PluginMetadata[] {
    return this.plugins;
  }

  public setPluginStatus(name: string, enabled: boolean): boolean {
    const plugin = this.plugins.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (plugin) {
      plugin.enabled = enabled;
      this.saveStateToFile();
      prisma.pluginState.upsert({
        where: { name: plugin.name },
        create: { name: plugin.name, enabled },
        update: { enabled }
      }).catch((err: unknown) => console.error('[Plugins] Failed to save state to database:', err));
      return true;
    }
    return false;
  }

  public isCommandEnabled(commandName: string): boolean {
    const name = commandName.toLowerCase();
    const plugin = this.plugins.find(p => p.commands.includes(name));
    if (plugin) {
      return plugin.enabled;
    }
    return true; // Default enabled if not mapped to a plugin
  }

  public getPluginForCommand(commandName: string): PluginMetadata | undefined {
    const name = commandName.toLowerCase();
    return this.plugins.find(p => p.commands.includes(name));
  }

  public isPluginEnabled(pluginName: string): boolean {
    const plugin = this.plugins.find(p => p.name.toLowerCase() === pluginName.toLowerCase());

    if (!plugin) {
      console.warn(`[Plugins] Unknown plugin requested: ${pluginName}`);
      return env.NODE_ENV === 'production' ? false : true;
    }

    return plugin.enabled;
  }

  public validatePluginsOnStartup(registeredPlugins: Set<string>): void {
    const knownPluginNames = new Set(INITIAL_PLUGINS.map(p => p.name.toLowerCase()));
    for (const pluginName of registeredPlugins) {
      if (!knownPluginNames.has(pluginName.toLowerCase())) {
        const msg = `[Plugins] STARTUP VALIDATION: Command metadata references unknown plugin: "${pluginName}"`;
        if (env.NODE_ENV === 'production') {
          throw new Error(msg);
        } else {
          console.warn(msg);
        }
      }
    }
  }
}

export const pluginManager = new PluginManager();
