import { Command, registerCommand } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import { isGroupAdmin } from '../bot/permission.js';
import prisma from '../db/client.js';

export class SetWelcomeCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const isAdmin = await isGroupAdmin(ctx.chatId, ctx.senderId, adapter);
    if (!isAdmin) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang dapat mengatur pesan welcome.', { quotedMessageId: ctx.id });
      return;
    }

    const welcomeMsg = args.join(' ').trim();
    if (!welcomeMsg) {
      await adapter.sendMessage(
        ctx.chatId,
        '⚠️ Format salah. Gunakan: `/setwelcome <pesan>`\nContoh: `/setwelcome Selamat datang @user di grup @group!`',
        { quotedMessageId: ctx.id }
      );
      return;
    }

    try {
      const config = await prisma.groupConfig.findUnique({
        where: { groupId: ctx.chatId }
      });

      const features = config ? JSON.parse(config.featuresJson || '{}') : {};
      features.welcomeMessage = welcomeMsg;

      await prisma.groupConfig.upsert({
        where: { groupId: ctx.chatId },
        create: {
          groupId: ctx.chatId,
          featuresJson: JSON.stringify(features)
        },
        update: {
          featuresJson: JSON.stringify(features)
        }
      });

      await adapter.sendMessage(
        ctx.chatId,
        `✅ Pesan welcome berhasil diatur menjadi:\n"${welcomeMsg}"`,
        { quotedMessageId: ctx.id }
      );
    } catch (err: any) {
      await adapter.sendMessage(ctx.chatId, `❌ Gagal menyimpan pesan welcome: ${err.message}`, { quotedMessageId: ctx.id });
    }
  }
}

export class SetGoodbyeCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const isAdmin = await isGroupAdmin(ctx.chatId, ctx.senderId, adapter);
    if (!isAdmin) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Hanya admin grup yang dapat mengatur pesan goodbye.', { quotedMessageId: ctx.id });
      return;
    }

    const goodbyeMsg = args.join(' ').trim();
    if (!goodbyeMsg) {
      await adapter.sendMessage(
        ctx.chatId,
        '⚠️ Format salah. Gunakan: `/setgoodbye <pesan>`\nContoh: `/setgoodbye @user telah meninggalkan grup.`',
        { quotedMessageId: ctx.id }
      );
      return;
    }

    try {
      const config = await prisma.groupConfig.findUnique({
        where: { groupId: ctx.chatId }
      });

      const features = config ? JSON.parse(config.featuresJson || '{}') : {};
      features.goodbyeMessage = goodbyeMsg;

      await prisma.groupConfig.upsert({
        where: { groupId: ctx.chatId },
        create: {
          groupId: ctx.chatId,
          featuresJson: JSON.stringify(features)
        },
        update: {
          featuresJson: JSON.stringify(features)
        }
      });

      await adapter.sendMessage(
        ctx.chatId,
        `✅ Pesan goodbye berhasil diatur menjadi:\n"${goodbyeMsg}"`,
        { quotedMessageId: ctx.id }
      );
    } catch (err: any) {
      await adapter.sendMessage(ctx.chatId, `❌ Gagal menyimpan pesan goodbye: ${err.message}`, { quotedMessageId: ctx.id });
    }
  }
}

// Register commands
registerCommand(['setwelcome'], new SetWelcomeCommand());
registerCommand(['setgoodbye'], new SetGoodbyeCommand());
