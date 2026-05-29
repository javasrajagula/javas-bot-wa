import { Command, registerCommand } from './index.js';
import { MessageContext } from '../bot/message.types.js';
import { WhatsAppAdapter } from '../bot/whatsapp.adapter.js';
import { getUserRole } from '../bot/permission.js';

export class MenuCommand implements Command {
  public async execute(ctx: MessageContext, args: string[], adapter: WhatsAppAdapter): Promise<void> {
    const role = await getUserRole(ctx.chatId, ctx.senderId, adapter);

    let menuText = `╭────── *JAVAS BOT WA* ──────╮
│
├─ 📝 *STICKER SUITE*
│  • /stiker - Foto/video ke stiker WebP
│  • /toimg - Stiker ke gambar PNG
│  • /brat <teks> - Brat sticker (classic/grid)
│  • /quote <teks> - Kutipan gradient stiker
│  • /removebg - Hapus background gambar
│  • /stikerbg - Stiker no-background
│  • /circle - Crop gambar lingkaran
│  • /outline [color] - Outline stiker
│  • /meme <atas> | <bawah> - Meme generator
│  • /emojimix 😂 + 😭 - Gabung emoji
│  • /vstiker - Video ke stiker bergerak
│  • /batchstiker - Batch conversion
│
├─ 🎥 *MEDIA TOOLS*
│  • /hd - HD image (Lanczos3 upscaler)
│  • /compress [low|medium|high] - Kompres
│  • /resize [preset|dim] - Ubah resolusi
│  • /crop [story|pp|square] - Potong rasio
│  • /wm <teks> - Tambahkan watermark
│  • /togif - Video ke animasi GIF
│  • /thumb [time] - Ambil thumbnail video
│  • /cut [start-end] - Potong durasi video
│  • /mute - Hapus audio dari video
│  • /reverse - Putar balik video
│
├─ 🎵 *AUDIO TOOLS*
│  • /mp3 - Ekstrak video ke MP3
│  • /transkrip - Simulasi Voice Note ke teks
│  • /tts <teks> - Text-to-Speech (Google)
│  • /voice [robot|chipmunk|deep] - Efek suara
│  • /cutaudio [start-end] - Potong durasi audio
│  • /speed [rate] / /slow [rate] - Tempo audio
│
├─ 📖 *TEXT & STUDY TOOLS*
│  • /ocr - Ekstrak tulisan dari gambar
│  • /translate [lang] - Terjemahan teks
│  • /ringkas - Ringkas tulisan panjang
│  • /ubah [gaya] - Rewrite gaya bahasa
│  • /typo - Koreksi kesalahan penulisan
│  • /balas [gaya] - AI reply generator
│  • /jelaskan <topik> - Penjelasan belajar
│  • /quiz [sekolah|umum|anime] - Kuis kognitif
│
├─ 📁 *FILE & DOKUMEN*
│  • /img2pdf - Gambar ke dokumen PDF
│  • /pdf2img - Halaman PDF ke gambar JPG
│  • /mergepdf - Gabung file PDF
│  • /compresspdf - Perkecil ukuran PDF
│  • /scan - Scan dokumen (Contrast & Perspective)
│  • /unzip - Ekstrak ZIP/RAR secara aman
│  • /qr <teks|url> - Buat QR Code
│  • /readqr - Baca isi gambar QR Code
│
├─ 🎮 *INTERACTIVE GAMES*
│  • /tod - Sesi permainan Truth or Dare
│  • /tebakkata - Game tebak kata
│  • /tebakgambar - Kuis tebak gambar
│  • /suit @user - Suit PvP interaktif
│  • /ttt @user - Tic Tac Toe multipemain
│  • /slot - Taruhan mesin slot virtual
│  • /math - Kuis perhitungan matematika
│  • /family100 - Kuis survei Family 100
│  • /couple / /jodoh - Ramalan cinta
│  • /ww [create|join|start|stop] - Werewolf
│  • /wwrank / /wwstats - Peringkat Werewolf
│
├─ 💰 *ECONOMY & RPG SYSTEM*
│  • /balance - Cek saldo, level, dan XP
│  • /claim - Klaim uang & XP harian
│  • /transfer @user <jumlah> - Kirim saldo
│  • /rank - Kartu profil & level XP
│  • /top - Papan peringkat miliarder
│  • /shop - Toko item virtual
│  • /buy <item> - Beli barang toko
│  • /inventory - Tas barang belanjaan
│  • /title set <nama> - Kustom gelar profil
│  • /pet [adopt|feed|status|battle] - Pet system
│  • /dungeon - Mulai turn-based RPG dungeon
`;

    // Premium features shown to Premium & Owner
    if (role === 'premium' || role === 'owner') {
      menuText += `│
├─ ⭐ *PREMIUM FEATURES*
│  • /hd 4x - HD enhancement kualitas super
│  • /subtitle - Auto overlay subtitle video
│  • /removebg (max 15MB) - Premium removal
│  • /vstiker (max 10s) - Durasi video sticker
`;
    } else {
      menuText += `│
├─ ⭐ *PREMIUM FEATURES*
│  • /hd 4x, /subtitle, /removebg 15MB, /vstiker 10s
│    (Tersedia khusus untuk Premium User)
`;
    }

    // Admin commands shown to Admin & Owner
    if (role === 'admin' || role === 'owner') {
      menuText += `│
├─ 👥 *GROUP MODERATION & COMM*
│  • /setup - Status & petunjuk setup grup
│  • /statusfitur - Detail feature flags
│  • /feature <nama> <on/off> - Toggle fitur grup
│  • /bot [on/off] - Aktifkan/matikan respon bot
│  • /setprefix <prefix> - Ubah prefix panggilan
│  • /setcooldown <fitur> <detik> - Limit cooldown
│  • /warn @user <alasan> - Beri poin warning
│  • /warnings @user - Cek warning member
│  • /unwarn / /clearwarn - Kelola warning
│  • /addbadword / /delbadword - Sensor kata
│  • /listbadword - List kata diblokir
│  • /blacklist @user - Blokir member
│  • /unblacklist @user - Hapus blokir member
│  • /listblacklist - Daftar hitam grup/global
│  • /addreply <trigger> = <resp> - Auto reply
│  • /delreply / /listreply - Kelola auto reply
│  • /poll <tanya> | <opsi> - Buat polling
│  • /pollresult / /closepoll - Kelola polling
│  • /remind [waktu] [pesan] - Atur pengingat
│  • /event <nama> <waktu> - Jadwal kegiatan
│  • /absen [buka|list|tutup] - Absensi
`;
    }

    // Owner commands shown only to Owner
    if (role === 'owner') {
      menuText += `│
├─ 👑 *OWNER SYSTEM TOOLS*
│  • /maintenance [on/off] - Mode pemeliharaan
│  • /premium [add|remove] @user - Kelola premium
│  • /broadcast <pesan> - Broadcast massal (konfirmasi)
│  • /stats - Status server, queue & error logs
│  • /limit - Tampilkan limit rate-limit bot
│  • /apikey / /revokeapikey - Token API system
│  • /plugin [list|on|off] - Plugin manager global
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
