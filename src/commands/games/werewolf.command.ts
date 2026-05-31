import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import { werewolfEngine } from '../../services/werewolf/werewolf.engine.js';
import { isOwner } from '../../bot/permission.js';
import prisma from '../../db/client.js';

export class WerewolfCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const sub = args[0]?.toLowerCase();

    if (!sub || sub === 'help') {
      const helpMsg = `🐺 *WEREWOLF GAME HELP* 🐺\n\n` +
        `Gunakan perintah berikut di Grup:\n` +
        `├ \`/ww start\` - Membuat lobby baru\n` +
        `├ \`/ww join\` - Bergabung ke lobby\n` +
        `├ \`/ww leave\` - Keluar dari lobby\n` +
        `├ \`/ww begin\` - Memulai permainan (oleh Host)\n` +
        `├ \`/ww status\` - Melihat status game aktif\n` +
        `├ \`/ww vote @user\` - Memilih pemain (fase siang)\n` +
        `└ \`/ww stop\` - Menghentikan paksa game\n\n` +
        `Perintah di Chat Pribadi (Malam Hari):\n` +
        `├ \`/ww kill @user\` - (Werewolf/Black Wolf) Bunuh warga\n` +
        `├ \`/ww infect @user\` - (Black Wolf) Menginfeksi warga\n` +
        `├ \`/ww protect @user\` - (Doctor) Lindungi warga\n` +
        `├ \`/ww check @user\` - (Seer) Terawang peran\n` +
        `├ \`/ww poison @user\` - (Witch) Meracuni warga\n` +
        `├ \`/ww heal\` - (Witch) Menyembuhkan korban\n` +
        `└ \`/ww pass\` - (Witch) Lewati giliran`;
      await adapter.sendMessage(ctx.chatId, helpMsg, { quotedMessageId: ctx.id });
      return;
    }

    // Handle Private commands (kill, protect, check, poison, heal, infect, pass)
    if (!ctx.isGroup) {
      const isNightAction = ['kill', 'protect', 'check', 'poison', 'heal', 'infect', 'pass'].includes(sub);
      if (isNightAction) {
        const targetUsername = args.slice(1).join(' ').trim();
        if (!targetUsername && sub !== 'heal' && sub !== 'pass') {
          await adapter.sendMessage(ctx.chatId, `⚠️ Format salah. Contoh: \`/ww ${sub} @username\``);
          return;
        }

        // Find which group game the player is in
        const game = await werewolfEngine.findActiveGameForPlayer(ctx.senderId);
        if (!game) {
          await adapter.sendMessage(ctx.chatId, '⚠️ Anda tidak sedang berada dalam game Werewolf aktif.');
          return;
        }

        try {
          const res = await werewolfEngine.setNightAction(game.groupId, sub as any, ctx.senderId, targetUsername);
          await adapter.sendMessage(ctx.chatId, `✅ ${res}`);
        } catch (err: any) {
          await adapter.sendMessage(ctx.chatId, `❌ ${err.message}`);
        }
        return;
      }
      
      await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya bisa digunakan di grup atau untuk aksi malam hari.');
      return;
    }

    // Group commands: start, join, leave, begin, status, vote, stop
    if (sub === 'start') {
      try {
        const res = await werewolfEngine.createLobby(ctx.chatId, ctx.senderId, ctx.senderName);
        await adapter.sendMessage(ctx.chatId, `✅ ${res}`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `⚠️ ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    if (sub === 'join') {
      try {
        const res = await werewolfEngine.joinGame(ctx.chatId, ctx.senderId, ctx.senderName);
        await adapter.sendMessage(ctx.chatId, `✅ ${res}`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `⚠️ ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    if (sub === 'leave') {
      try {
        const res = await werewolfEngine.leaveGame(ctx.chatId, ctx.senderId);
        await adapter.sendMessage(ctx.chatId, `✅ ${res}`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `⚠️ ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    if (sub === 'begin') {
      try {
        await werewolfEngine.startGame(ctx.chatId, ctx.senderId);
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `⚠️ ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    if (sub === 'status') {
      const game = await werewolfEngine.getGame(ctx.chatId);
      if (!game) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tidak ada game Werewolf aktif di grup ini.', { quotedMessageId: ctx.id });
        return;
      }

      const players = JSON.parse(game.playersJson);
      const alivePlayers = players.filter((p: any) => p.isAlive);
      const deadPlayers = players.filter((p: any) => !p.isAlive);

      let statusMsg = `🐺 *STATUS WEREWOLF GAME* 🐺\n\n` +
        `📌 Fase: *${game.phase.toUpperCase()}*\n` +
        `👥 Pemain Hidup (${alivePlayers.length}):\n` +
        alivePlayers.map((p: any) => `- @${p.id.split('@')[0]}`).join('\n') + '\n\n';

      if (deadPlayers.length > 0) {
        statusMsg += `💀 Pemain Mati (${deadPlayers.length}):\n` +
          deadPlayers.map((p: any) => `- @${p.id.split('@')[0]} (${p.role})`).join('\n') + '\n\n';
      }

      if (game.status === 'lobby') {
        statusMsg += `💡 Ketik \`/ww join\` untuk bergabung. Host: @${game.hostUserId.split('@')[0]}`;
      } else {
        statusMsg += `⌛ Batas waktu fase ini selesai pada: ${game.expiresAt ? game.expiresAt.toLocaleTimeString('id-ID') : '-'}`;
      }

      const mentions = players.map((p: any) => p.id);
      await adapter.sendMessage(ctx.chatId, statusMsg, { mentions, quotedMessageId: ctx.id });
      return;
    }

    if (sub === 'vote') {
      const targetUsername = args.slice(1).join(' ').trim();
      if (!targetUsername) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tentukan pemain yang ingin Anda vote. Contoh: `/ww vote @username`', { quotedMessageId: ctx.id });
        return;
      }

      try {
        const res = await werewolfEngine.castVote(ctx.chatId, ctx.senderId, targetUsername);
        await adapter.sendMessage(ctx.chatId, `✅ ${res}`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `⚠️ ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    if (sub === 'kill') {
      const targetUsername = args.slice(1).join(' ').trim();
      if (!targetUsername) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tentukan target tembakan. Contoh: `/ww kill @username`', { quotedMessageId: ctx.id });
        return;
      }

      try {
        const res = await werewolfEngine.hunterKill(ctx.chatId, ctx.senderId, targetUsername);
        await adapter.sendMessage(ctx.chatId, `✅ ${res}`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `⚠️ ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    if (sub === 'stop') {
      const { checkIfAdmin } = await import('../index.js');
      const isAdmin = await checkIfAdmin(ctx.chatId, ctx.senderId, adapter);
      const isSenderOwner = isOwner(ctx.senderId);

      try {
        const res = await werewolfEngine.stopGame(ctx.chatId, ctx.senderId, isAdmin || isSenderOwner);
        await adapter.sendMessage(ctx.chatId, `✅ ${res}`, { quotedMessageId: ctx.id });
      } catch (err: any) {
        await adapter.sendMessage(ctx.chatId, `⚠️ ${err.message}`, { quotedMessageId: ctx.id });
      }
      return;
    }

    await adapter.sendMessage(ctx.chatId, '⚠️ Sub-command tidak dikenal. Ketik `/ww help` untuk bantuan.', { quotedMessageId: ctx.id });
  }
}

const werewolfCmd = new WerewolfCommand();
registerCommand(['ww', 'werewolf'], werewolfCmd);
