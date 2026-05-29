import { Command, registerCommand } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import { setGroupFeature, DEFAULT_FEATURES } from '../config/feature-flags.js';
import { isGroupAdmin } from '../bot/permission.js';

export class FeatureCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const isAdmin = await isGroupAdmin(ctx.chatId, ctx.senderId, adapter);
    if (!isAdmin) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang dapat mengubah pengaturan fitur.', { quotedMessageId: ctx.id });
      return;
    }

    const feature = args[0]?.trim().toLowerCase();
    const action = args[1]?.trim().toLowerCase();

    const featureList = Object.keys(DEFAULT_FEATURES).join(', ');

    if (!feature || (action !== 'on' && action !== 'off')) {
      await adapter.sendMessage(
        ctx.chatId,
        `⚠️ Format salah.\nGunakan: \`/feature <nama_fitur> <on|off>\`\n\nFitur tersedia:\n${featureList}`,
        { quotedMessageId: ctx.id }
      );
      return;
    }

    const value = action === 'on';

    try {
      await setGroupFeature(ctx.chatId, feature, value);
      await adapter.sendMessage(
        ctx.chatId,
        `✅ Fitur grup *${feature}* berhasil diubah menjadi: *${action.toUpperCase()}*.`,
        { quotedMessageId: ctx.id }
      );
    } catch (err: any) {
      await adapter.sendMessage(
        ctx.chatId,
        `❌ Gagal mengubah fitur: ${err.message}`,
        { quotedMessageId: ctx.id }
      );
    }
  }
}

// Register feature command
registerCommand(['feature'], new FeatureCommand());
