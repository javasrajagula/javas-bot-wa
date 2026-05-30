import fs from 'fs';
import path from 'path';
import prisma from '../db/client.js';

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
  }
];

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
    return plugin ? plugin.enabled : true;
  }
}

export const pluginManager = new PluginManager();
