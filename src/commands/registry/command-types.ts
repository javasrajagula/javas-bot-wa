import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import { UserRole } from '../../bot/permission.js';

export interface CommandMetadata {
  name: string;
  aliases: string[];
  category: string;
  plugin: string;
  featureFlag: string;
  minRole?: UserRole;
  premiumOnly?: boolean;
  rateLimitKey?: string;
  description: string;
  usage: string;
  examples: string[];
}

export interface RegisteredCommand {
  metadata: CommandMetadata;
  execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void>;
}
