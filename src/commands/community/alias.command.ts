import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import { checkIfAdmin } from '../index.js';
import { commandRegistry } from '../registry/command-registry.js';
import prisma from '../../db/client.js';

export class AliasCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
      return;
    }

    const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
    if (!isAdmin) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Hanya Admin grup yang dapat mengelola custom alias.', { quotedMessageId: ctx.id });
      return;
    }

    const commandType = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // Unified helper or standalone commands
    const action = args[0]?.toLowerCase().trim();

    // 1. /addcmd or /addalias or /alias add
    if (commandType === 'addcmd' || commandType === 'addalias' || (commandType === 'alias' && action === 'add')) {
      const aliasArgs = (commandType === 'alias') ? args.slice(1) : args;
      const fullText = aliasArgs.join(' ');
      const parts = fullText.split('=');

      if (parts.length !== 2) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah.\nGunakan: `/addcmd <alias> = <realcommand>` atau `/alias add <alias> = <realcommand>`\nContoh: `/addcmd st = stiker`', { quotedMessageId: ctx.id });
        return;
      }

      let alias = parts[0].trim().toLowerCase();
      let realCommand = parts[1].trim().toLowerCase();

      // Strip leading prefixes if any
      if (alias.startsWith('/')) alias = alias.slice(1);
      if (realCommand.startsWith('/')) realCommand = realCommand.slice(1);

      if (!alias || !realCommand) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Alias atau real command tidak valid.', { quotedMessageId: ctx.id });
        return;
      }

      // Check if the alias is already an existing command in registry
      if (await commandRegistry.get(alias)) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Tidak bisa menggunakan *${alias}* sebagai alias karena merupakan command bawaan bot.`, { quotedMessageId: ctx.id });
        return;
      }

      // Check if real command exists in registry
      const targetCmd = await commandRegistry.get(realCommand);
      if (!targetCmd) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Command asli *${realCommand}* tidak ditemukan atau tidak aktif.`, { quotedMessageId: ctx.id });
        return;
      }

      // Prevent aliasing owner commands
      if (targetCmd.metadata.minRole === 'owner') {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tidak diperbolehkan membuat alias untuk command Owner.', { quotedMessageId: ctx.id });
        return;
      }

      try {
        await prisma.commandAlias.upsert({
          where: {
            groupId_alias: {
              groupId: ctx.chatId,
              alias
            }
          },
          create: {
            groupId: ctx.chatId,
            alias,
            command: realCommand,
            createdBy: ctx.senderId
          },
          update: {
            command: realCommand,
            createdBy: ctx.senderId
          }
        });

        await adapter.sendMessage(ctx.chatId, `✅ Berhasil menambahkan alias: */${alias}* ➔ */${realCommand}*`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        console.error('[Alias] Failed to add command alias:', err);
        await adapter.sendMessage(ctx.chatId, `❌ Gagal menyimpan alias: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 2. /delcmd or /delalias or /alias del/remove
    if (commandType === 'delcmd' || commandType === 'delalias' || (commandType === 'alias' && (action === 'del' || action === 'delete' || action === 'remove'))) {
      const aliasArgs = (commandType === 'alias') ? args.slice(1) : args;
      let alias = aliasArgs[0]?.trim().toLowerCase();
      if (!alias) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah.\nGunakan: `/delcmd <alias>` atau `/alias del <alias>`\nContoh: `/delcmd st`', { quotedMessageId: ctx.id });
        return;
      }

      if (alias.startsWith('/')) alias = alias.slice(1);

      try {
        const deleted = await prisma.commandAlias.deleteMany({
          where: {
            groupId: ctx.chatId,
            alias
          }
        });

        if (deleted.count > 0) {
          await adapter.sendMessage(ctx.chatId, `✅ Alias */${alias}* berhasil dihapus.`, { quotedMessageId: ctx.id });
        } else {
          await adapter.sendMessage(ctx.chatId, `⚠️ Alias */${alias}* tidak ditemukan di grup ini.`, { quotedMessageId: ctx.id });
        }
      } catch (err: any) {
        console.error('[Alias] Failed to delete command alias:', err);
        await adapter.sendMessage(ctx.chatId, `❌ Gagal menghapus alias: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    // 3. /listcmd or /cmdalias or /listalias or /alias or /alias list
    if (
      commandType === 'listcmd' ||
      commandType === 'cmdalias' ||
      commandType === 'listalias' ||
      (commandType === 'alias' && (!action || action === 'list'))
    ) {
      try {
        const aliases = await prisma.commandAlias.findMany({
          where: { groupId: ctx.chatId }
        });

        if (aliases.length === 0) {
          await adapter.sendMessage(ctx.chatId, 'ℹ️ Tidak ada custom alias yang terdaftar di grup ini.', { quotedMessageId: ctx.id });
          return;
        }

        let responseText = `📋 *Daftar Custom Alias Grup*\n\n`;
        aliases.forEach((alias, index) => {
          responseText += `${index + 1}. */${alias.alias}* ➔ */${alias.command}*\n`;
        });

        await adapter.sendMessage(ctx.chatId, responseText, { quotedMessageId: ctx.id });
      } catch (err: any) {
        console.error('[Alias] Failed to list command aliases:', err);
        await adapter.sendMessage(ctx.chatId, `❌ Gagal memuat daftar alias: ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }
  }
}

// Register commands
const aliasCmd = new AliasCommand();
registerCommand([
  'addcmd', 'delcmd', 'listcmd', 'cmdalias',
  'alias', 'addalias', 'delalias', 'listalias'
], aliasCmd);
