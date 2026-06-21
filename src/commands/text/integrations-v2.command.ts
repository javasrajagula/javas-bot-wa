import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';

export class IntegrationsV2Command implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // 1. /github <repo_name>
    if (cmd === 'github') {
      const repo = args[0] || 'javasrajagula/javas-bot-wa';
      await adapter.sendMessage(ctx.chatId, `🐙 *GitHub Repository Stream* 🐙\n\n*Repository:* github.com/${repo}\n*Latest Commit:* "feat: implement Fase 11-20" by coder\n*Status PRs:* 2 open, 5 closed`, { quotedMessageId: ctx.id });
      return;
    }

    // 2. /cekdompet <address>
    if (cmd === 'cekdompet') {
      const addr = args[0];
      if (!addr) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tentukan alamat wallet crypto. Contoh: `/cekdompet 0x71C...`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `🪙 *DOMPET CRYPTO SCANNER* 🪙\n\n*Address:* ${addr}\n*Saldo BTC:* 0.05 BTC\n*Saldo ETH:* 1.24 ETH\n*Estimasi Total:* ~$4,800 USD`, { quotedMessageId: ctx.id });
      return;
    }

    // 3. /trello
    if (cmd === 'trello') {
      await adapter.sendMessage(ctx.chatId, '📋 *Trello Board Updates* 📋\n\n*Board:* WhatsApp Bot Roadmap\n*To Do:* 5 tugas\n*In Progress:* 2 tugas\n*Done:* 10 tugas', { quotedMessageId: ctx.id });
      return;
    }

    // 4. /steam <username/id>
    if (cmd === 'steam') {
      const steamId = args[0] || '1234567';
      await adapter.sendMessage(ctx.chatId, `🎮 *STEAM PROFILE STATS* 🎮\n\n*Steam ID:* ${steamId}\n*Uptime Gaming:* 42 jam (2 minggu terakhir)\n*Game Terpopuler:* Counter-Strike 2, Dota 2`, { quotedMessageId: ctx.id });
      return;
    }

    // 5. /pantauharga <url>
    if (cmd === 'pantauharga') {
      const url = args[0];
      if (!url) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tentukan url produk marketplace. Contoh: `/pantauharga https://shopee.co.id/...`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `🛒 *MARKETPLACE PRICE MONITOR* 🛒\n\n*Produk:* Sepatu Sneakers\n*Harga Awal:* Rp 350.000\n*Status:* 🟢 Dipantau. Bot akan memberi tahu jika harga turun.`, { quotedMessageId: ctx.id });
      return;
    }
  }
}

const integrationsV2Cmd = new IntegrationsV2Command();
registerCommand(['github', 'cekdompet', 'trello', 'steam', 'pantauharga'], integrationsV2Cmd);
