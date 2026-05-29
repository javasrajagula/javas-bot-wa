import { Command, registerCommand } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import { getUserRole } from '../bot/permission.js';

export class MenuCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const role = await getUserRole(ctx.chatId, ctx.senderId, adapter);

    let menuText = `╭────── *MENU BOT* ──────╮
│
├─ 📝 *STICKER TOOLS*
│  • /stiker - Buat stiker dari gambar
│  • /toimg - Stiker ke gambar
│  • /brat <teks> - Stiker brat
│
├─ 🎮 *GAME TOOLS*
│  • /ww help - Cara bermain Werewolf
│
├─ 💰 *ECONOMY & LEVELING*
│  • /balance - Cek saldo, level, XP
│  • /claim - Hadiah harian harian
│  • /transfer @user <jumlah> - Transfer saldo
│  • /rank - Cek peringkatmu
│  • /top - Papan peringkat warga
│
├─ 📁 *FILE TOOLS*
│  • /ssweb <url> - Screenshot website
│  • /qr <teks> - Buat QR Code
│  • /readqr - Baca QR Code dari gambar
`;

    // Premium features shown to Premium & Owner
    if (role === 'premium' || role === 'owner') {
      menuText += `│
├─ ✨ *PREMIUM AI IMAGE*
│  • /avatar <style> - AI Avatar (anime|kartun|cyberpunk|3d)
│  • /bg <desc> - Ganti background gambar
│  • /hd - HD image enhancement
│  • /tt <url> - Downloader TikTok
│  • /ig <url> - Downloader Instagram
`;
    } else {
      // Show that premium commands exist
      menuText += `│
├─ ✨ *PREMIUM FEATURES*
│  • /tt, /ig, /hd, /avatar, /bg (Khusus Premium)
`;
    }

    // Admin commands shown to Admin & Owner
    if (role === 'admin' || role === 'owner') {
      menuText += `│
├─ 👥 *GROUP ADMIN TOOLS*
│  • /setup - Status fitur grup
│  • /statusfitur - Cek detail feature flags
│  • /feature <nama> <on/off> - Toggle fitur grup
│  • /setwelcome <pesan> - Set greeting welcome
│  • /setgoodbye <pesan> - Set greeting goodbye
│  • /bot off - Matikan respon bot
│  • /setprefix <prefix> - Ubah prefix grup
│  • /setcooldown <fitur> <detik> - Atur cooldown
`;
    }

    // Owner commands shown only to Owner
    if (role === 'owner') {
      menuText += `│
├─ 👑 *OWNER ONLY TOOLS*
│  • /broadcast <pesan> - Kirim pengumuman ke semua grup
│  • /maintenance <on/off> - Mode pemeliharaan bot
│  • /premium <add/remove> @user <days> - Kelola premium
`;
    }

    menuText += `│
╰────────────────────────╯
Ketik */rules* untuk melihat ketentuan penggunaan bot.`;

    await adapter.sendMessage(ctx.chatId, menuText, { quotedMessageId: ctx.id });
  }
}

export class RulesCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const rulesText = `⚠️ *DISCLAIMER & KETENTUAN PENGGUNAAN BOT* ⚠️

1. Gunakan bot secara bijak dan bertanggung jawab.
2. Fitur downloader (/tt, /ig) hanya digunakan untuk mengunduh konten milik sendiri, berizin, atau konten yang memang boleh diunduh secara legal.
3. Bot tidak mendukung download dari akun privat, login pihak ketiga, bypass DRM, atau segala bentuk pelanggaran hak cipta.
4. Data media yang diproses (gambar, stiker, audio) bersifat sementara dan akan dihapus otomatis dari server dalam waktu maksimal 15 menit. Bot tidak menyimpan media pribadi secara permanen.`;

    await adapter.sendMessage(ctx.chatId, rulesText, { quotedMessageId: ctx.id });
  }
}

// Register commands
const menuCmd = new MenuCommand();
registerCommand(['menu', 'help'], menuCmd);

const rulesCmd = new RulesCommand();
registerCommand(['rules'], rulesCmd);
