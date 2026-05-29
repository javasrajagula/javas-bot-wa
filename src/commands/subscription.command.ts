import { Command, registerCommand } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import prisma from '../db/client.js';

export class SubscriptionCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.body.trim().split(/\s+/)[0].slice(1).toLowerCase();

    // 1. /sewa
    if (cmd === 'sewa') {
      const response = `ℹ️ *INFORMASI SEWA JAVAS BOT WA*

Ingin menggunakan Javas Bot WA di grup Anda secara penuh?
Kami menyediakan paket sewa bulanan dengan harga terjangkau:

• *Basic Plan* - Rp 10.000 / bulan
  - Moderasi dasar (Anti-link, Anti-spam)
  - Fitur stiker & game ringan
  
• *Premium Plan* - Rp 25.000 / bulan
  - Seluruh fitur Basic Plan
  - Downloader (TikTok, Instagram)
  - Pengolah media lanjutan & HD rendering
  - Werewolf & Economy RPG Penuh

Silakan hubungi *Owner* untuk melakukan sewa dan aktivasi.
Ketik \`/fitursewa\` untuk membandingkan fitur lengkap.`;
      await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
      return;
    }

    // 2. /ceksewa
    if (cmd === 'ceksewa') {
      if (!ctx.isGroup) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Command ini hanya dapat digunakan di dalam grup.', { quotedMessageId: ctx.id });
        return;
      }

      const sub = await prisma.groupSubscription.findUnique({
        where: { groupId: ctx.chatId }
      });

      const plan = sub?.plan || 'free';
      const expiresAt = sub?.expiresAt;
      const isExpired = expiresAt && expiresAt.getTime() < Date.now();

      let response = `📊 *INFORMASI SEWA GRUP INI*\n\n`;
      response += `• *Grup ID:* ${ctx.chatId}\n`;
      response += `• *Paket:* ${plan.toUpperCase()}\n`;
      response += `• *Masa Aktif:* ${expiresAt ? expiresAt.toLocaleDateString() : 'Lifetime (Tidak Terbatas)'}\n`;
      if (isExpired) {
        response += `⚠️ *Status:* Kedaluwarsa (Kembali ke paket FREE)`;
      } else {
        response += `🟢 *Status:* Aktif`;
      }

      await adapter.sendMessage(ctx.chatId, response, { quotedMessageId: ctx.id });
      return;
    }

    // 3. /fitursewa
    if (cmd === 'fitursewa') {
      const table = `📋 *PERBANDINGAN FITUR SEWA GRUP*

| Fitur | FREE | BASIC | PREMIUM |
| :--- | :---: | :---: | :---: |
| Fitur Stiker | ✅ | ✅ | ✅ |
| Moderasi Grup | ❌ | ✅ | ✅ |
| Game Werewolf | ❌ | ❌ | ✅ |
| Downloader | ❌ | ❌ | ✅ |
| HD & Media | ❌ | ❌ | ✅ |
| Custom Prefix | ❌ | ✅ | ✅ |

Ketik \`/sewa\` untuk panduan berlangganan.`;
      await adapter.sendMessage(ctx.chatId, table, { quotedMessageId: ctx.id });
      return;
    }
  }
}

const subCommand = new SubscriptionCommand();
registerCommand(['sewa', 'ceksewa', 'fitursewa'], subCommand);
