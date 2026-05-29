import { Command, registerCommand } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import { getGroupFeatures } from '../config/feature-flags.js';

export class SetupCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const flags = await getGroupFeatures(ctx.chatId);
    
    const response = `Setup Bot Grup

Fitur dasar:
- Menu: aktif
- Sticker tools: aktif
- Media tools: aktif
- Game tools: aktif

Fitur grup:
- Welcome: ${flags.welcome ? 'aktif' : 'nonaktif'}
- Goodbye: ${flags.goodbye ? 'aktif' : 'nonaktif'}
- Anti-link: ${flags.antilink ? 'aktif' : 'nonaktif'}
- Anti-spam: ${flags.antispam ? 'aktif' : 'nonaktif'}
- Leveling: ${flags.leveling ? 'aktif' : 'nonaktif'}
- Economy: ${flags.economy ? 'aktif' : 'nonaktif'}
- Confess: ${flags.confess ? 'aktif' : 'nonaktif'}
- Warning: aktif (selalu standby)

Aktifkan dengan:
/feature welcome on
/feature antilink on
/feature leveling on`;

    await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
  }
}

export class StatusFiturCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const flags = await getGroupFeatures(ctx.chatId);
    let response = `📊 *STATUS FITUR GRUP*\n\n`;
    for (const key in flags) {
      response += `- *${key}*: ${flags[key] ? '🟢 AKTIF' : '🔴 NONAKTIF'}\n`;
    }
    await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
  }
}

registerCommand(['setup'], new SetupCommand());
registerCommand(['statusfitur', 'features'], new StatusFiturCommand());
