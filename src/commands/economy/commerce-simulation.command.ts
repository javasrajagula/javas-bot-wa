import { Command, registerCommand } from '../index.js';
import { MessageContext } from '../../bot/message.types.js';
import { WhatsAppAdapter } from '../../bot/whatsapp.adapter.js';
import prisma from '../../db/client.js';

// In-memory bank deposits
const bankDeposits = new Map<string, number>();

export class CommerceSimulationCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const cmd = ctx.command?.commandName || ctx.body.trim().split(/\s+/)[0].replace(/^[^\w\s]+/, '').toLowerCase();

    // 1. /pasar
    if (cmd === 'pasar') {
      await adapter.sendMessage(ctx.chatId, '🛒 *PASAR PERDAGANGAN VIRTUAL* 🛒\n\n• Toko Potion: 15 koin\n• Toko Pedang Kayu: 80 koin\n• Toko Perisai: 120 koin\n\n💡 _Cara beli: `/pasar beli potion`_', { quotedMessageId: ctx.id });
      return;
    }

    // 2. /deposito [jumlah]
    if (cmd === 'deposito') {
      const amount = parseInt(args[0]);
      if (isNaN(amount) || amount <= 0) {
        const balance = bankDeposits.get(ctx.senderId) || 0;
        await adapter.sendMessage(ctx.chatId, `🏦 *BANK DEPOSITO VIRTUAL* 🏦\n\n*Saldo Simpanan Anda:* *${balance} koin*\n*Bunga Harian:* *5%*\n\nGunakan perintah \`/deposito [jumlah]\` untuk menabung koin.`, { quotedMessageId: ctx.id });
        return;
      }

      const econ = await prisma.userEconomy.findUnique({ where: { userId: ctx.senderId } });
      const userBalance = econ?.balance || 0;
      if (userBalance < amount) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Saldo koin di tangan Anda tidak cukup untuk dimasukkan ke deposito.', { quotedMessageId: ctx.id });
        return;
      }

      await prisma.userEconomy.update({ where: { userId: ctx.senderId }, data: { balance: { decrement: amount } } });
      const current = bankDeposits.get(ctx.senderId) || 0;
      bankDeposits.set(ctx.senderId, current + amount);

      await adapter.sendMessage(ctx.chatId, `✅ Berhasil mendepositokan *${amount} koin* ke bank virtual! Saldo tersimpan aman dengan bunga 5% per hari.`, { quotedMessageId: ctx.id });
      return;
    }

    // 3. /tambangcrypto
    if (cmd === 'tambangcrypto') {
      const btcEarned = (Math.random() * 0.005).toFixed(5);
      await adapter.sendMessage(ctx.chatId, `🪙 *CRYPTO MINING Virtual* 🪙\n\nMesin pertambangan GPU Anda menyala!\nAnda menambang sebesar *${btcEarned} BTC* hari ini!`, { quotedMessageId: ctx.id });
      return;
    }

    // 4. /begal [@user]
    if (cmd === 'begal') {
      const mention = ctx.body.match(/@\d+/g)?.[0];
      if (!mention) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Tag target begal Anda. Contoh: `/begal @user`', { quotedMessageId: ctx.id });
        return;
      }

      const targetId = mention.replace('@', '') + '@s.whatsapp.net';
      const isSuccess = Math.random() > 0.5;

      const targetEcon = await prisma.userEconomy.findUnique({ where: { userId: targetId } });
      const targetBalance = targetEcon?.balance || 0;

      if (targetBalance < 50) {
        await adapter.sendMessage(ctx.chatId, '⚠️ Target begal Anda terlalu miskin (<50 koin). Cari target lain!', { quotedMessageId: ctx.id });
        return;
      }

      if (isSuccess) {
        const stolen = Math.floor(targetBalance * 0.2) + 10;
        await prisma.userEconomy.update({ where: { userId: targetId }, data: { balance: { decrement: stolen } } });
        await prisma.userEconomy.upsert({
          where: { userId: ctx.senderId },
          create: { userId: ctx.senderId, balance: stolen },
          update: { balance: { increment: stolen } }
        });
        await adapter.sendMessage(ctx.chatId, `🚨 *BEGAL BERHASIL!* 🚨\n\n@${ctx.senderId.split('@')[0]} merampok @${targetId.split('@')[0]} sebesar *${stolen} koin*!`, { mentions: [ctx.senderId, targetId], quotedMessageId: ctx.id });
      } else {
        const penalty = 30;
        await prisma.userEconomy.upsert({
          where: { userId: ctx.senderId },
          create: { userId: ctx.senderId, balance: 0 },
          update: { balance: { decrement: Math.min(penalty, targetBalance) } }
        });
        await adapter.sendMessage(ctx.chatId, `🚨 *BEGAL GAGAL!* 🚨\n\n@${ctx.senderId.split('@')[0]} tertangkap warga saat ingin merampok @${targetId.split('@')[0]} dan denda *30 koin*!`, { mentions: [ctx.senderId, targetId], quotedMessageId: ctx.id });
      }
      return;
    }

    // 5. /asuransi
    if (cmd === 'asuransi') {
      await adapter.sendMessage(ctx.chatId, `🛡️ *ASURANSI KOIN RPG* 🛡️\n\nBeli premi asuransi seharga *50 koin* untuk mengamankan 90% saldo koin Anda dari begal selama 24 jam.\nKetik \`/asuransi beli\` untuk menyetujui.`, { quotedMessageId: ctx.id });
      return;
    }

    // 6. /lotre
    if (cmd === 'lotre') {
      await adapter.sendMessage(ctx.chatId, `🎫 *JACKPOT LOTTERY GRUP* 🎫\n\nHarga Tiket: *10 koin*\nTotal Hadiah: *1500 koin*\n\nGunakan perintah \`/lotre beli\` untuk membeli tiket lotre nomor keberuntungan.`, { quotedMessageId: ctx.id });
      return;
    }
  }
}

const commerceSimCmd = new CommerceSimulationCommand();
registerCommand(['pasar', 'deposito', 'tambangcrypto', 'begal', 'asuransi', 'lotre'], commerceSimCmd);
