import { RegisteredCommand, CommandMetadata } from './command-types.js';
import { COMMAND_METADATA_LIST } from './command-metadata.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';

interface RegistryEntry {
  metadata: CommandMetadata;
  execute?: (ctx: MessageContext, args: string[], adapter: WhatsAppAdapter) => Promise<void>;
  isRegistered: boolean;
}

class CommandRegistry {
  private registry = new Map<string, RegistryEntry>();
  private aliasMap = new Map<string, string>();

  constructor() {
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

  public register(names: string[], execute: (ctx: MessageContext, args: string[], adapter: WhatsAppAdapter) => Promise<void>) {
    // Search if any of the aliases match a pre-registered command
    let matchedPrimary: string | undefined;
    for (const name of names) {
      const resolved = this.aliasMap.get(name.toLowerCase());
      if (resolved) {
        matchedPrimary = resolved;
        break;
      }
    }

    if (matchedPrimary) {
      const entry = this.registry.get(matchedPrimary);
      if (entry) {
        entry.execute = execute;
        entry.isRegistered = true;
      }
    } else {
      // Fallback fallback metadata for commands not in pre-defined list
      const primaryName = names[0].toLowerCase();
      const meta: CommandMetadata = {
        name: primaryName,
        aliases: names.slice(1).map(n => n.toLowerCase()),
        category: 'general',
        plugin: 'general',
        featureFlag: 'general',
        description: 'Command otomatis terdaftar.',
        usage: `/${primaryName}`,
        examples: []
      };

      this.registry.set(primaryName, {
        metadata: meta,
        execute,
        isRegistered: true
      });

      this.aliasMap.set(primaryName, primaryName);
      for (const alias of meta.aliases) {
        this.aliasMap.set(alias, primaryName);
      }
    }
  }

  public get(nameOrAlias: string): RegisteredCommand | undefined {
    const primary = this.aliasMap.get(nameOrAlias.toLowerCase());
    if (!primary) return undefined;
    
    const entry = this.registry.get(primary);
    if (entry && entry.isRegistered && entry.execute) {
      return {
        metadata: entry.metadata,
        execute: entry.execute
      };
    }
    return undefined;
  }

  public getAll(): RegisteredCommand[] {
    const list: RegisteredCommand[] = [];
    for (const entry of this.registry.values()) {
      if (entry.isRegistered && entry.execute) {
        list.push({
          metadata: entry.metadata,
          execute: entry.execute
        });
      }
    }
    return list;
  }
}

export const commandRegistry = new CommandRegistry();
export type { CommandRegistry };
