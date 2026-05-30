import { Command, registerCommand, checkIfAdmin } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import { setGroupFeature, DEFAULT_FEATURES, parseFeatureFlags } from '../config/feature-flags.js';
import { isGroupAdmin } from '../bot/permission.js';
import prisma from '../db/client.js';

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

export class FiturStatusCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const config = await prisma.groupConfig.findUnique({ where: { groupId: ctx.chatId } });
    const sub = await prisma.groupSubscription.findUnique({ where: { groupId: ctx.chatId } });

    const prefix = config?.prefix || '/';
    const botEnabled = config?.botEnabled ?? true;
    const plan = sub?.plan || 'free';
    const expiresAt = sub?.expiresAt;

    let maxDailyCmd = 50;
    if (sub && sub.maxDailyCmd !== null && sub.maxDailyCmd !== undefined) {
      maxDailyCmd = sub.maxDailyCmd;
    } else {
      if (plan === 'basic') maxDailyCmd = 200;
      else if (plan === 'premium') maxDailyCmd = 999999;
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const usedToday = await prisma.usageLog.count({
      where: {
        groupId: ctx.chatId,
        createdAt: { gte: startOfToday }
      }
    });

    const features = config ? parseFeatureFlags(config.featuresJson) : { ...DEFAULT_FEATURES };

    const quotaStr = plan === 'premium' ? 'Tanpa Batas (Premium)' : `${usedToday} / ${maxDailyCmd}`;
    const expStr = expiresAt ? expiresAt.toLocaleDateString('id-ID') : 'Selamanya (Lifetime)';

    const booleanFeatures = Object.entries(features)
      .filter(([key, val]) => typeof val === 'boolean')
      .map(([key, val]) => `• ${key}: ${val ? '🟢 ON' : '🔴 OFF'}`)
      .join('\n');

    const message = `📊 *STATUS & KONFIGURASI GRUP* 📊

⚙️ *Informasi Dasar:*
• Prefix Command: *${prefix}*
• Status Bot: *${botEnabled ? '🟢 Aktif' : '🔴 Nonaktif'}*

🛡️ *Subscription & Kuota:*
• Plan Sewa: *${plan.toUpperCase()}*
• Masa Berlaku: *${expStr}*
• Kuota Command: *${quotaStr}*

🔌 *Status Fitur:*
${booleanFeatures}`;

    await adapter.sendMessage(ctx.chatId, message, { quotedMessageId: ctx.id });
  }
}

export class RepairGroupCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
    if (!isAdmin) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang dapat menggunakan command ini.', { quotedMessageId: ctx.id });
      return;
    }

    const sub = args[0]?.trim().toLowerCase();
    const action = args[1]?.trim().toLowerCase();

    if (sub !== 'group') {
      await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Gunakan: `/repair group`', { quotedMessageId: ctx.id });
      return;
    }

    const { stateStore } = await import('../services/state/state-store.js');
    const confirmKey = `repair:confirm:${ctx.chatId}:${ctx.senderId}`;

    if (action === 'confirm') {
      const pending = await stateStore.get<boolean>(confirmKey);
      if (!pending) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Sesi konfirmasi tidak ditemukan atau telah kedaluwarsa. Silakan ulangi dengan mengetik `/repair group`.', { quotedMessageId: ctx.id });
        return;
      }

      await stateStore.delete(confirmKey);

      // Reset configurations
      await prisma.groupConfig.upsert({
        where: { groupId: ctx.chatId },
        create: {
          groupId: ctx.chatId,
          prefix: '/',
          botEnabled: true,
          featuresJson: JSON.stringify(DEFAULT_FEATURES)
        },
        update: {
          prefix: '/',
          botEnabled: true,
          featuresJson: JSON.stringify(DEFAULT_FEATURES)
        }
      });

      await adapter.sendMessage(ctx.chatId, '✅ *Konfigurasi Berhasil Direset!* Semua fitur grup telah diatur ulang ke kondisi default bawaan bot.', { quotedMessageId: ctx.id });
      return;
    }

    // Set pending confirmation for 30 seconds
    await stateStore.set(confirmKey, true, 30);

    const warnMsg = `⚠️ *KONFIRMASI RESET CONFIG GRUP* ⚠️\n\nTindakan ini akan mengembalikan semua setelan grup (fitur on/off, prefix, dll.) ke bawaan pabrik (default).\n\nKetik:\n👉 */repair group confirm*\n\nKonfirmasi ini hanya berlaku selama *30 detik*.`;
    await adapter.sendMessage(ctx.chatId, warnMsg, { quotedMessageId: ctx.id });
  }
}

// Register commands
registerCommand(['feature'], new FeatureCommand());
registerCommand(['fiturstatus'], new FiturStatusCommand());
registerCommand(['repair'], new RepairGroupCommand());
