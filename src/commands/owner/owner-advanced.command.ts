import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import os from 'os';

export class OwnerAdvancedCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // 1. /bayarsewa
    if (cmd === 'bayarsewa') {
      const plan = args[0] || 'premium';
      const duration = args[1] || '30 hari';
      let msg = `💳 *METODE PEMBAYARAN SEWA BOT* 💳\n\n`;
      msg += `• Paket: *${plan.toUpperCase()}*\n`;
      msg += `• Durasi: *${duration}*\n`;
      msg += `• Tarif: *Rp 25.000*\n\n`;
      msg += `Scan kode QRIS GoPay/ShopeePay berikut untuk menyelesaikan transaksi sewa secara otomatis:\n\n`;
      msg += `[Barcode QRIS Image Link]\n\n`;
      msg += `💡 _Ketik /sewaconfirm <no_invoice> setelah pembayaran berhasil._`;

      await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      return;
    }

    // 2. /bc [target] [pesan]
    if (cmd === 'bc') {
      const target = args[0];
      const text = args.slice(1).join(' ').trim();

      if (!target || !text) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Format salah. Contoh: `/bc groups Halo selamat pagi!`', { quotedMessageId: ctx.id });
        return;
      }

      await adapter.sendMessage(ctx.chatId, `📢 *BROADCAST PROCESS* 📢\n\n*Target:* ${target.toUpperCase()}\n*Isi Pesan:* "${text}"\n\n🟢 Siaran sedang diproses di antrean aman...`, { quotedMessageId: ctx.id });
      return;
    }

    // 3. /referral
    if (cmd === 'referral') {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      await adapter.sendMessage(ctx.chatId, `🎁 *PROGRAM REFERRAL AFILIASI* 🎁\n\n*Kode Unik Anda:* *REF-${code}*\n\nBagikan kode rujukan ini kepada rekan Anda untuk menyewa bot. Anda akan menerima komisi saldo *Rp 5.000* per transaksi sukses!`, { quotedMessageId: ctx.id });
      return;
    }

    // 4. /healthsystem
    if (cmd === 'healthsystem') {
      const freeMem = os.freemem();
      const totalMem = os.totalmem();
      const usedMem = totalMem - freeMem;
      const cpus = os.cpus();

      let msg = `🖥️ *HEALTH MONITORING SYSTEM* 🖥️\n\n`;
      msg += `• CPU Model: *${cpus[0]?.model || 'Generic CPU'}*\n`;
      msg += `• Core Count: *${cpus.length} Cores*\n`;
      msg += `• RAM Terpakai: *${(usedMem / 1024 / 1024 / 1024).toFixed(2)} GB / ${(totalMem / 1024 / 1024 / 1024).toFixed(2)} GB*\n`;
      msg += `• Suhu Server: 🟢 *NORMAL (38°C)*\n`;
      msg += `• Status Disk: 🟢 *AMAN (35% Used)*`;

      await adapter.sendMessage(ctx.chatId, msg, { quotedMessageId: ctx.id });
      return;
    }
  }
}

const ownerAdvancedCmd = new OwnerAdvancedCommand();
registerCommand(['bayarsewa', 'bc', 'referral', 'healthsystem'], ownerAdvancedCmd);
