import { Command, registerCommand, checkIfAdmin } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import { werewolfEngine, Player } from '../services/werewolf/werewolf.engine.js';

export class WerewolfCommand implements Command {
  private locks: Map<string, Promise<any>> = new Map();

  private async acquireLock(groupId: string, fn: () => Promise<void>): Promise<void> {
    const currentLock = this.locks.get(groupId) || Promise.resolve();
    const nextLock = currentLock.then(async () => {
      try {
        await fn();
      } catch (err) {
        console.error('[Werewolf Lock Error]', err);
      }
    });
    this.locks.set(groupId, nextLock);
    return nextLock;
  }

  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const subCommand = args[0]?.toLowerCase();
    let lockGroupId = ctx.chatId;

    if (!ctx.isGroup && (subCommand === 'kill' || subCommand === 'protect' || subCommand === 'check')) {
      const game = await werewolfEngine.findActiveGameForPlayer(ctx.senderId);
      if (game) {
        lockGroupId = game.groupId;
      }
    }

    await this.acquireLock(lockGroupId, () => this.executeInternal(ctx, args, adapter));
  }

  private async executeInternal(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const subCommand = args[0]?.toLowerCase();
    
    if (!subCommand || subCommand === 'help') {
      const helpMsg = `📖 *PANDUAN GAME WEREWOLF*
      
Command Grup:
- \`/ww create\` : Membuat lobby game baru (5-10 pemain)
- \`/ww join\` : Bergabung ke dalam lobby
- \`/ww leave\` : Keluar dari lobby
- \`/ww start\` : Memulai permainan (Hanya Host)
- \`/ww status\` : Melihat status pemain & fase game
- \`/ww stop\` : Menghentikan game (Host/Admin)
- \`/ww vote @user\` : Memilih pemain untuk dieksekusi (Fase Vote Siang)

Command Chat Pribadi (Malam Hari):
- \`/ww kill @user\` : Menghabisi warga (Werewolf)
- \`/ww protect @user\` : Melindungi warga (Doctor)
- \`/ww check @user\` : Menerawang peran warga (Seer)

*Hunter Skill (Siang Hari):*
- Jika Hunter mati, gunakan \`/ww kill @user\` di grup dalam 30 detik untuk menembak balik.`;
      
      await adapter.sendMessage(ctx.chatId, helpMsg, { quotedMessageId: ctx.id });
      return;
    }

    // Handle Private/DM Night actions: kill, protect, check
    if (subCommand === 'kill' || subCommand === 'protect' || subCommand === 'check') {
      const target = args[1];
      if (!target) {
        await adapter.sendMessage(ctx.chatId, `⚠️ Format salah. Gunakan: \`/ww ${subCommand} @username\``, { quotedMessageId: ctx.id });
        return;
      }

      if (!ctx.isGroup) {
        // DM context
        const game = await werewolfEngine.findActiveGameForPlayer(ctx.senderId);
        if (!game) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Anda tidak sedang berada dalam game Werewolf aktif.', { quotedMessageId: ctx.id });
          return;
        }

        try {
          const result = await werewolfEngine.setNightAction(game.groupId, subCommand as any, ctx.senderId, target);
          await adapter.sendMessage(ctx.chatId, `✅ ${result}`, { quotedMessageId: ctx.id });
        } catch (err: any) {
          await adapter.sendMessage(ctx.chatId, `❌ Gagal melakukan aksi malam: ${err.message}`, { quotedMessageId: ctx.id });
        }
      } else {
        // Group Context
        // Special case: Hunter retaliatory kill in day discussion!
        if (subCommand === 'kill') {
          try {
            await werewolfEngine.hunterKill(ctx.chatId, ctx.senderId, target);
          } catch (err: any) {
            await adapter.sendMessage(ctx.chatId, `❌ Aksi ditolak: ${err.message}`, { quotedMessageId: ctx.id });
          }
        } else {
          await adapter.sendMessage(ctx.chatId, `⚠️ Aksi malam ini hanya boleh dikirim secara privat ke chat bot demi kerahasiaan peran.`, { quotedMessageId: ctx.id });
        }
      }
      return;
    }

    // All other commands must be in a group chat
    if (!ctx.isGroup) {
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di dalam grup chat.', { quotedMessageId: ctx.id });
      return;
    }

    const groupId = ctx.chatId;

    try {
      switch (subCommand) {
        case 'create': {
          const response = await werewolfEngine.createLobby(groupId, ctx.senderId, ctx.senderName);
          await adapter.sendMessage(groupId, response, { quotedMessageId: ctx.id });
          break;
        }
        case 'join': {
          const response = await werewolfEngine.joinGame(groupId, ctx.senderId, ctx.senderName);
          await adapter.sendMessage(groupId, response, { quotedMessageId: ctx.id });
          break;
        }
        case 'leave': {
          const response = await werewolfEngine.leaveGame(groupId, ctx.senderId);
          await adapter.sendMessage(groupId, response, { quotedMessageId: ctx.id });
          break;
        }
        case 'start': {
          await werewolfEngine.startGame(groupId, ctx.senderId);
          break;
        }
        case 'stop': {
          const isAdmin = await checkIfAdmin(groupId, ctx.senderId, adapter);
          const response = await werewolfEngine.stopGame(groupId, ctx.senderId, isAdmin);
          await adapter.sendMessage(groupId, response, { quotedMessageId: ctx.id });
          break;
        }
        case 'vote': {
          const target = args[1];
          if (!target) {
            await adapter.sendMessage(groupId, '⚠️ Format salah. Gunakan: \`/ww vote @username\`', { quotedMessageId: ctx.id });
            return;
          }
          const response = await werewolfEngine.castVote(groupId, ctx.senderId, target);
          await adapter.sendMessage(groupId, response, { quotedMessageId: ctx.id });
          break;
        }
        case 'status': {
          const game = await werewolfEngine.getGame(groupId);
          if (!game) {
            await adapter.sendMessage(groupId, '⚠️ Tidak ada game Werewolf yang berjalan di grup ini.', { quotedMessageId: ctx.id });
            return;
          }

          const players: Player[] = JSON.parse(game.playersJson);
          let statusMsg = `📊 *STATUS GAME WEREWOLF*\n`;
          statusMsg += `• Status: *${game.status.toUpperCase()}*\n`;
          statusMsg += `• Fase: *${game.phase.toUpperCase()}*\n`;
          statusMsg += `• Host: @${game.hostUserId.split('@')[0]}\n\n`;

          statusMsg += `👥 *Daftar Pemain (${players.length}):*\n`;
          players.forEach((p, index) => {
            statusMsg += `${index + 1}. @${p.id.split('@')[0]} : ${p.isAlive ? '🟢 Hidup' : '🔴 Mati (Peran: ' + p.role + ')'}\n`;
          });

          if (game.expiresAt) {
            const timeRemaining = Math.max(0, Math.ceil((new Date(game.expiresAt).getTime() - Date.now()) / 1000));
            statusMsg += `\n⏰ Sisa waktu fase: *${timeRemaining} detik*`;
          }

          await adapter.sendMessage(groupId, statusMsg, { quotedMessageId: ctx.id });
          break;
        }
        default:
          await adapter.sendMessage(groupId, '⚠️ Subcommand tidak dikenal. Gunakan `/ww help` untuk panduan.', { quotedMessageId: ctx.id });
      }
    } catch (err: any) {
      await adapter.sendMessage(groupId, `❌ Error: ${err.message || err}`, { quotedMessageId: ctx.id });
    }
  }
}

// Register command
const wwCmd = new WerewolfCommand();
registerCommand(['ww', 'werewolf'], wwCmd);
