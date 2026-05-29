# 🤖 WhatsApp Bot Lanjutan (Addendum Features)

Selamat datang di repositori **WhatsApp Bot Lanjutan**! Bot ini dikembangkan menggunakan **Node.js, TypeScript, Baileys SDK, Prisma ORM, dan SQLite** sebagai sistem database lokal yang efisien. Bot ini dirancang agar siap pakai untuk grup WhatsApp dengan fitur gaming, ekonomi virtual, tools stiker premium, pemrosesan file, dan utilitas moderasi cerdas.

---

## 🌟 Prinsip Desain Utama

1. **Silent by Default (Senyap Secara Default)**
   - Saat bot ditambahkan ke grup atau pertama kali dinyalakan, bot **tidak akan** mengirimkan pesan sapaan otomatis, spam menu, atau menyapa admin secara sepihak. Bot hanya membalas ketika command valid dikirimkan.
2. **Modular & Aman**
   - File sementara yang diunduh (gambar/audio/video) akan disimpan di direktori temp lokal dan secara otomatis dibersihkan dalam waktu maksimal 15 menit.
3. **Role-Based Permission Matrix**
   - Membatasi akses perintah secara ketat berdasarkan hierarki peran: **Owner Bot**, **Admin Grup**, **Premium User**, dan **Warga Biasa**.
4. **Dynamic Feature Flags**
   - Seluruh fitur grup (Welcome, Goodbye, Anti-link, Leveling, Economy, dll.) dinonaktifkan secara default dan dapat dikendalikan secara real-time oleh admin grup menggunakan perintah `/feature`.

---

## 🛠️ Langkah-Langkah Instalan & Setup

### 1. Prasyarat (Prerequisites)
Pastikan Anda telah memasang:
- **Node.js** (Rekomendasi v20.x atau lebih baru)
- **npm** (Package manager default)

### 2. Kloning & Pemasangan Dependensi
Pasang semua pustaka yang dibutuhkan menggunakan perintah berikut:
```bash
npm install
```

### 3. Konfigurasi Lingkungan (`.env`)
Salin file `.env.example` ke `.env` di root proyek:
```bash
cp .env.example .env
```
Sesuaikan nilai di dalam `.env` dengan kebutuhan Anda:
```env
# Mode Jalannya Bot: "baileys" (koneksi WhatsApp asli) atau "console" (simulasi terminal)
ADAPTER_MODE="console"

# Database URL untuk SQLite
DATABASE_URL="file:./prisma/dev.db"

# Nama folder sesi penyimpanan WhatsApp Baileys
WA_SESSION_NAME="auth_session"

# Daftar nomor handphone Owner bot (dipisahkan koma, tanpa simbol +)
OWNER_IDS="6289912345678,6285587654321"
```

### 4. Setup Database & Prisma Migrations
Jalankan migrasi Prisma untuk membangun file database SQLite lokal:
```bash
npx prisma db push
```

### 5. Menjalankan Bot
Untuk menjalankan bot dalam mode pengembangan (hot-reload otomatis):
```bash
npm run dev
```

---

## 🏆 Kategori & Daftar Command Bot

| Kategori | Command | Deskripsi | Peran Minimal |
| :--- | :--- | :--- | :--- |
| **Umum** | `/menu` / `/help` | Menampilkan daftar perintah yang tersedia | User biasa |
| | `/rules` | Ketentuan penggunaan bot dan disclaimer hukum | User biasa |
| **Stiker** | `/stiker` / `/s` | Mengubah gambar menjadi stiker WebP | User biasa |
| | `/toimg` | Mengubah stiker WebP kembali menjadi gambar PNG | User biasa |
| | `/brat <teks>` | Membuat stiker brat estetik berlatar putih | User biasa |
| **Game** | `/ww help` | Panduan bermain game Werewolf multipemain | User biasa |
| | `/ww join` | Bergabung ke lobby Werewolf | User biasa |
| | `/ww start` | Memulai permainan Werewolf | User biasa |
| **Ekonomi** | `/balance` / `/bal` | Memeriksa saldo virtual, Level, dan XP | User biasa (jika aktif) |
| | `/claim` / `/daily` | Mengklaim hadiah harian uang virtual + XP | User biasa (jika aktif) |
| | `/transfer @user <qty>`| Mentransfer uang virtual ke pengguna lain | User biasa (jika aktif) |
| | `/rank` / `/level` | Memeriksa peringkat XP global Anda | User biasa (jika aktif) |
| | `/top` / `/leaderboard`| Menampilkan papan peringkat 10 besar | User biasa (jika aktif) |
| **File & Tools** | `/ssweb <url>` | Mengambil screenshot dari halaman web | User biasa |
| | `/qr <teks>` | Membuat QR Code berupa gambar dari teks | User biasa |
| | `/readqr` | Membaca isi pesan dari file QR Code (reply) | User biasa |
| **Premium AI** | `/avatar <style>` | AI Avatar filter (`anime`, `kartun`, `cyberpunk`, `3d`) | Premium User / Owner |
| | `/bg <deskripsi>` | Mengubah latar belakang gambar dengan solid-color | Premium User / Owner |
| | `/hd` | Peningkatan kualitas gambar dengan Sharp/Lanczos3 | Premium User / Owner |
| | `/tt <url>` | Pengunduh video TikTok tanpa tanda air | Premium User / Owner |
| | `/ig <url>` | Pengunduh reel / kiriman foto Instagram | Premium User / Owner |
| **Admin Grup** | `/setup` | Memeriksa status fitur grup & petunjuk aktifasi | Admin Grup / Owner |
| | `/statusfitur` | Memeriksa detail flags yang aktif/nonaktif | Admin Grup / Owner |
| | `/feature <nama> <on/off>`| Mengaktifkan/menonaktifkan fitur tertentu | Admin Grup / Owner |
| | `/setwelcome <pesan>`| Mengatur template sapaan selamat datang (@user, @group) | Admin Grup / Owner |
| | `/setgoodbye <pesan>`| Mengatur template salam perpisahan (@user) | Admin Grup / Owner |
| | `/bot off` | Menonaktifkan respon bot di grup bersangkutan | Admin Grup / Owner |
| | `/setprefix <prefix>` | Mengubah prefiks pemanggilan perintah (misal: `!`) | Admin Grup / Owner |
| | `/setcooldown <fitur> <dtk>`| Mengatur batasan jeda penggunaan fitur | Admin Grup / Owner |
| **Owner Bot** | `/broadcast <pesan>` | Mengirimkan pengumuman penting ke seluruh grup | Owner Bot |
| | `/maintenance <on/off>`| Mengaktifkan mode pemeliharaan (bot hanya respon owner)| Owner Bot |
| | `/premium add/remove @user [hari]`| Mengelola lisensi keanggotaan Premium | Owner Bot |

---

## ⚙️ Detail Fitur & Pengaturan Flag Grup

Gunakan perintah `/feature <nama_flag> on/off` untuk menyalakan atau mematikan fitur berikut:
- **`welcome`**: Mengirim pesan selamat datang saat anggota baru masuk.
- **`goodbye`**: Mengirim pesan perpisahan saat anggota keluar.
- **`antilink`**: Mendeteksi link masuk. Jika pengirim bukan admin, link akan dihapus otomatis dan dikirim peringatan.
- **`leveling`**: Mengaktifkan sistem XP per aktivitas chat (bertambah 5-15 XP setiap 30 detik chat).
- **`economy`**: Mengaktifkan saldo virtual per aktivitas chat (bertambah Rp. 2-5 per chat) dan daily claim.
- **`cleancmd`**: Menghapus pesan perintah pengguna secara otomatis setelah dibalas (membuat chat room tetap bersih).

---

## 🧪 Pengujian Sistem (Testing)

Proyek ini dilengkapi dengan suite pengujian otomatis menggunakan **Vitest**.
Untuk menjalankan pengujian:
```bash
npm run test
```

Pengujian ini mencakup validasi:
1. Skema pembagian Peran (Role-Based Permissions).
2. Sistem antrian / rate limiter.
3. Fungsi matematika penambahan level-up dan claim ekonomi.
4. Logika validasi regex tautan downloader.
5. Pembaruan config dynamic flags di dalam SQLite database.
