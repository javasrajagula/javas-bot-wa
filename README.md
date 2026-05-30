# 🤖 Javas Bot WA — WhatsApp Bot Lanjutan (TypeScript & Baileys SDK)

Javas Bot WA adalah bot WhatsApp multifungsi berbasis **Node.js, TypeScript, Baileys SDK, Prisma ORM, dan SQLite** sebagai sistem database lokal yang efisien. Bot ini dirancang agar siap pakai untuk grup WhatsApp dengan fitur stiker (termasuk brat sticker), pemrosesan media/audio, utilitas file/dokumen, game interaktif (Werewolf, Tebak Kata, dll.), ekonomi virtual, moderasi grup cerdas, dan kontrol penuh Owner melalui plugin manager dan CLI Admin Dashboard.

---

## 🌟 Prinsip Desain Utama

1. **Silent by Default (Senyap Secara Default)**
   - Saat bot ditambahkan ke grup atau pertama kali dinyalakan, bot **tidak akan** mengirimkan pesan sapaan otomatis, spam menu, atau menyapa admin secara sepihak. Bot hanya membalas ketika command valid dikirimkan oleh pengguna yang berhak.
2. **Modular & Aman**
   - File sementara yang diunduh (gambar/audio/video) akan disimpan di direktori `temp` lokal dan secara otomatis dibersihkan dalam waktu maksimal 15 menit melalui cron internal.
3. **Role-Based Permission Matrix**
   - Membatasi akses perintah secara ketat berdasarkan hierarki peran: **Owner Bot**, **Admin Grup**, **Premium User**, dan **Warga Biasa**.
4. **Dynamic Feature Flags**
   - Seluruh fitur grup (Welcome, Goodbye, Anti-link, Leveling, Economy, dll.) dinonaktifkan secara default dan dapat dikendalikan secara real-time oleh admin grup menggunakan perintah `/feature`.
5. **Global Plugin System**
   - Owner dapat mengaktifkan/menonaktifkan seluruh paket fitur (seperti game, ekonomi, dokumen) secara global menggunakan sistem plugin dinamis.

---

## 🛠️ Langkah-Langkah Instalasi & Setup

### 1. Prasyarat (Prerequisites)
Pastikan Anda telah memasang:
- **Node.js** (Rekomendasi v20.x atau lebih baru)
- **npm** (Package manager default)
- **FFmpeg** (Wajib terpasang di system PATH untuk fitur kompresi video, vstiker, mp3, dan reverse)

### 2. Kloning & Pemasangan Dependensi
Pasang semua pustaka yang dibutuhkan menggunakan perintah berikut:
```bash
npm install
```

### 3. Konfigurasi Lingkungan (`.env`)
Salin file `.env.example` ke `.env` di root proyek dan sesuaikan nilainya:
```env
# Mode Jalannya Bot: "baileys" (koneksi WhatsApp asli) atau "console" (simulasi terminal)
ADAPTER_MODE="baileys"

# Database URL untuk SQLite
DATABASE_URL="file:./dev.db"

# Nama folder sesi penyimpanan WhatsApp Baileys
WA_SESSION_NAME="wa-session"

# Daftar nomor handphone Owner bot (dipisahkan koma, tanpa simbol + dan tanpa extension JID)
OWNER_IDS="6285338123425"
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

### 6. Menjalankan Dashboard Admin CLI
Untuk mengelola grup, fitur, premium user, queue, dan memantau log error langsung dari terminal secara interaktif:
```bash
npm run dashboard
```

### 7. Owner Web Dashboard
Dashboard web tersedia secara opsional dan hanya aktif jika login owner dikonfigurasi:
```env
DASHBOARD_ENABLED="true"
DASHBOARD_PORT="8787"
OWNER_DASHBOARD_PASSWORD="ganti-password-kuat"
```

Jalankan bot seperti biasa, lalu buka `http://localhost:8787`. Dashboard mencakup overview, groups, feature flags, plugins, premium users, subscriptions, queue monitor, usage stats, error logs, group logs, broadcast dengan preview/konfirmasi, backup/restore, dan settings. Credential WhatsApp dan `.env` tidak ditampilkan.

### 8. Backup, Restore, dan Utility Offline
Owner dapat memakai `/backup`, `/backupdb`, `/backupconfig`, `/listbackup`, `/restorebackup <id>`, `/exportconfig`, dan `/importconfig`. Backup disimpan di folder `backups/`, tidak menyertakan `.env` atau session WhatsApp, dan dibersihkan sesuai `BACKUP_RETENTION_DAYS`.

Utility non-paid AI:
- OCR memakai Tesseract lokal melalui `OCR_COMMAND`.
- Transkripsi VN/audio memakai wrapper lokal Whisper/Vosk melalui `STT_COMMAND`; jika belum dikonfigurasi bot memberi instruksi setup.
- Translate dapat memakai self-hosted LibreTranslate melalui `LIBRETRANSLATE_URL`, dengan fallback dictionary sederhana.
- PDF/ZIP diproses lokal dengan limit ukuran dan proteksi path traversal/executable.

---

## 🏆 Kategori & Daftar Command Bot

| Kategori | Command | Deskripsi | Peran Minimal |
| :--- | :--- | :--- | :--- |
| **Umum** | `/menu` / `/help` | Menampilkan daftar perintah yang tersedia | User biasa |
| | `/rules` | Ketentuan penggunaan bot dan disclaimer hukum | User biasa |
| **Stiker** | `/stiker` / `/s` [pack:A author:B] | Mengubah gambar menjadi stiker WebP (dukung custom metadata) | User biasa |
| | `/toimg` | Mengubah stiker WebP kembali menjadi gambar PNG | User biasa |
| | `/brat <teks>` / `/brat classic <teks>` | Membuat stiker brat estetik grid/classic berlatar putih dengan blur | User biasa |
| | `/quote <teks>` | Membuat stiker kutipan estetik bergaya gradient | User biasa |
| | `/removebg` / `/rbg` | Menghapus background gambar (mengirim dalam bentuk PNG) | User biasa |
| | `/stikerbg` / `/nobgstick` | Mengubah gambar menjadi stiker tanpa background | User biasa |
| | `/circle` / `/bulat` | Mengubah gambar menjadi stiker berbentuk lingkaran | User biasa |
| | `/outline` [white/black] | Mengubah gambar menjadi stiker ber-outline warna putih/hitam | User biasa |
| | `/meme <teks atas> \| <teks bawah>` | Meng-overlay teks meme (Impact font) ke gambar | User biasa |
| | `/emojimix` / `/mix` 😂 + 😭 | Menggabungkan dua emoji menjadi satu stiker WebP | User biasa |
| | `/vstiker` / `/gifstiker` | Mengubah video/GIF menjadi stiker bergerak (Free: 5s, Premium: 10s) | User biasa |
| | `/batchstiker` / `/pack` | Memproses banyak gambar sekaligus menjadi stiker | User biasa |
| **Media Tools** | `/hd` / `/hd 2x` / `/hd 4x` | Upscale & sharpen gambar (HD 4x membutuhkan status Premium) | User biasa / Premium |
| | `/compress` [low/medium/high] | Mengompres ukuran file gambar / video | User biasa |
| | `/resize` [story/feed/profile/...] | Mengubah resolusi gambar sesuai preset atau dimensi manual (Wxh) | User biasa |
| | `/crop` [story/pp/square] | Memotong gambar dengan rasio preset | User biasa |
| | `/wm <teks>` | Menyisipkan watermark teks buatan sendiri ke gambar/video | User biasa |
| | `/togif` | Mengonversi video menjadi format animasi GIF | User biasa |
| | `/thumb` [time] | Mengambil gambar snapshot/thumbnail video pada menit tertentu | User biasa |
| | `/cut` [start-end] | Memotong durasi video (contoh: `/cut 00:05-00:15`) | User biasa |
| | `/subtitle` | Menambahkan subtitle otomatis (Overlay teks) ke video | Premium User |
| | `/mute` | Menghapus trek audio dari file video | User biasa |
| | `/reverse` | Memutar balik jalannya video beserta audio (Reverse) | User biasa |
| **Audio Tools** | `/mp3` / `/audio` | Mengekstrak audio dari video menjadi file MP3 | User biasa |
| | `/transkrip` / `/vntext` | Mengonversi file voice note menjadi teks (simulasi transkrip) | User biasa |
| | `/tts <teks>` | Mengubah teks tertulis menjadi file audio (Voice Google TTS) | User biasa |
| | `/voice` [robot/chipmunk/deep] | Memberikan efek modulasi suara pada audio | User biasa |
| | `/cutaudio` [start-end] | Memotong durasi audio | User biasa |
| | `/speed` [rate] / `/slow` [rate] | Mengubah kecepatan pemutaran audio | User biasa |
| **Text & AI** | `/ocr` | Mengekstrak teks dari gambar (Optical Character Recognition) | User biasa |
| | `/translate` [lang] / `/tr` [lang] | Menerjemahkan teks atau reply pesan ke bahasa tujuan | User biasa |
| | `/ringkas` / `/summarize` | Meringkas teks panjang menjadi poin-poin ringkas | User biasa |
| | `/ubah` [formal/santai/lucu/...] | Menulis ulang gaya bahasa teks | User biasa |
| | `/typo` / `/koreksi` | Mengoreksi kesalahan penulisan teks secara otomatis | User biasa |
| | `/balas` [santai/formal/lucu] | Menghasilkan balasan otomatis berbasis AI | User biasa |
| | `/jelaskan` <topik> | Memberikan penjelasan informatif mengenai topik pelajaran | User biasa |
| | `/quiz` [sekolah/umum/anime] | Memulai sesi kuis interaktif untuk belajar mandiri | User biasa |
| **Dokumen & PDF** | `/img2pdf` | Menggabungkan beberapa gambar menjadi satu file PDF | User biasa |
| | `/pdf2img` | Mengekstrak halaman-halaman PDF menjadi gambar JPG | User biasa |
| | `/mergepdf` | Menggabungkan beberapa file PDF menjadi satu file | User biasa |
| | `/compresspdf` | Memperkecil ukuran file dokumen PDF | User biasa |
| | `/scan` | Simulasi scan dokumen (Auto-contrast & Perspective correction) | User biasa |
| | `/unzip` | Mengekstrak arsip ZIP/RAR secara aman (memblokir file executable) | User biasa |
| | `/qr <teks/url>` | Membuat QR Code berupa gambar dari teks / link | User biasa |
| | `/readqr` | Membaca isi pesan tersembunyi dari file gambar QR Code | User biasa |
| **Grup & Moderasi**| `/setup` | Memeriksa status fitur grup & petunjuk aktifasi | Admin Grup / Owner |
| | `/statusfitur` | Memeriksa detail status flags grup yang aktif/nonaktif | Admin Grup / Owner |
| | `/feature <nama> <on/off>`| Mengaktifkan/menonaktifkan fitur tertentu | Admin Grup / Owner |
| | `/bot` [on/off] | Mengaktifkan atau menonaktifkan respon bot di grup bersangkutan | Admin Grup / Owner |
| | `/setprefix <prefix>` | Mengubah prefiks pemanggilan perintah (misal: `!`) | Admin Grup / Owner |
| | `/setcooldown <fitur> <dtk>`| Mengatur batasan jeda penggunaan fitur | Admin Grup / Owner |
| | `/warn @user <alasan>` | Memberikan poin peringatan kepada member (Auto kick pada 3 warn) | Admin Grup / Owner |
| | `/warnings @user` | Memeriksa jumlah pelanggaran/warning member | Admin Grup / Owner |
| | `/unwarn` / `/clearwarn` | Mengurangi atau membersihkan total poin warning member | Admin Grup / Owner |
| | `/addbadword <kata>` | Menambahkan kata toxic baru ke filter badword grup | Admin Grup / Owner |
| | `/delbadword <kata>` | Menghapus kata dari daftar sensor grup | Admin Grup / Owner |
| | `/listbadword` | Menampilkan seluruh kata yang diblokir di grup ini | Admin Grup / Owner |
| | `/blacklist @user` | Memasukkan user ke daftar cekal (Ditolak berinteraksi dengan bot) | Admin Grup / Owner |
| | `/unblacklist @user` | Menghapus user dari daftar cekal | Admin Grup / Owner |
| | `/listblacklist` | Menampilkan daftar hitam grup/global | Admin Grup / Owner |
| **Komunitas** | `/addreply <trigger> = <resp>`| Mendaftarkan auto-reply otomatis untuk pesan tertentu | Admin Grup / Owner |
| | `/delreply <trigger>` | Menghapus pendaftaran auto-reply | Admin Grup / Owner |
| | `/listreply` | Menampilkan semua auto-reply terdaftar di grup ini | Admin Grup / Owner |
| | `/poll <Q> \| <opsi1> \| ...` | Membuat sesi voting/polling aktif di grup | Admin Grup / Owner |
| | `/pollresult` / `/closepoll` | Melihat hasil perolehan suara / Menutup polling | Admin Grup / Owner |
| | `/confess <pesan>` | Mengirimkan pesan pengakuan anonim | User biasa |
| | `/menfess @user <pesan>` | Mengirimkan pesan DM rahasia kepada sesama member | User biasa |
| | `/remind` [waktu] [pesan] | Menjadwalkan pengingat pribadi / grup (contoh: `/remind 10m minum`) | User biasa |
| | `/event <nama> <waktu>` | Merencanakan agenda acara/kegiatan grup bersama | Admin Grup / Owner |
| | `/absen` [buka/list/tutup] | Mengelola absensi kehadiran interaktif | Admin Grup / Owner |
| **Games** | `/tod` / `/truth` / `/dare` | Memulai permainan Truth or Dare | User biasa |
| | `/tebakkata` | Memulai sesi tebak kata berhadiah XP | User biasa |
| | `/tebakgambar` | Memulai sesi tebak gambar (clue teks) | User biasa |
| | `/suit @user` | Mengajak member lain bermain Suit PvP (Batu Gunting Kertas) | User biasa |
| | `/ttt @user` | Bermain Tic-Tac-Toe multipemain | User biasa |
| | `/slot` | Bermain judi slot virtual menggunakan saldo virtual | User biasa |
| | `/math` | Game perhitungan matematika cepat | User biasa |
| | `/quiz` | Game kuis Trivia pengetahuan umum | User biasa |
| | `/family100` | Memulai sesi kuis survey Family 100 | User biasa |
| | `/couple` / `/jodoh` | Memeriksa kecocokan hubungan cinta antar member | User biasa |
| | `/ww` [create/join/start/stop]| Mengelola sesi permainan Werewolf | User biasa |
| | `/wwrank` / `/wwstats` | Menampilkan statistik kemenangan werewolf di grup | User biasa |
| **Ekonomi & RPG** | `/balance` / `/bal` | Memeriksa saldo virtual, level, dan XP | User biasa (jika aktif) |
| | `/claim` / `/daily` | Klaim bonus harian saldo dan XP | User biasa (jika aktif) |
| | `/transfer @user <jumlah>` | Mentransfer saldo virtual ke pengguna lain | User biasa (jika aktif) |
| | `/rank` | Menampilkan Level Card & persentase XP | User biasa (jika aktif) |
| | `/top` / `/leaderboard` | Menampilkan 10 besar miliarder di database | User biasa (jika aktif) |
| | `/shop` / `/buy <item>` | Toko item virtual (seperti title, badge, pet food) | User biasa (jika aktif) |
| | `/inventory` / `/inv` | Menampilkan isi tas item yang sudah dibeli | User biasa (jika aktif) |
| | `/title set <nama>` | Mengatur gelar profil kustom di level card | User biasa (jika aktif) |
| | `/pet` [adopt/feed/status/battle]| Mengadopsi hewan peliharaan, memberi makan, & duel pet | User biasa (jika aktif) |
| | `/dungeon` | Memulai petualangan turn-based RPG di dungeon | User biasa (jika aktif) |
| **Owner Tools** | `/maintenance` [on/off] | Mengaktifkan/menonaktifkan mode pemeliharaan global | Owner Bot |
| | `/premium` [add/remove] @user | Menambah / menghapus hak Premium user | Owner Bot |
| | `/broadcast <pesan>` | Menyiarkan pesan massal ke seluruh grup (wajib konfirmasi) | Owner Bot |
| | `/stats` | Menampilkan statistik server, active queue, dan error log terbaru | Owner Bot |
| | `/limit` | Menampilkan limit request rate-limit per kategori fitur | Owner Bot |
| | `/apikey` | Menghasilkan API key terenkripsi unik | Owner Bot |
| | `/revokeapikey` | Menarik/menghapus akses seluruh API key miliknya | Owner Bot |
| | `/plugin` [list/on/off] | Manajemen plugin: mematikan/menyalakan fitur secara global | Owner Bot |

---

## ⚙️ Detail Fitur & Pengaturan Flag Grup

Gunakan perintah `/feature <nama_flag> on/off` untuk menyalakan atau mematikan fitur berikut di tingkat grup:
- **`welcome`**: Mengirim pesan selamat datang saat anggota baru masuk.
- **`goodbye`**: Mengirim pesan perpisahan saat anggota keluar.
- **`antilink`**: Mengontrol pembagian tautan luar (kecuali whitelist domain).
- **`leveling`**: Mengaktifkan perolehan XP dan naik level dari chat grup.
- **`economy`**: Mengaktifkan sistem uang virtual grup.
- **`cleancmd`**: Menghapus pesan command pengguna secara otomatis setelah dibalas untuk merapikan room chat.

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
6. Toggle status plugin dan otentikasi hashing API key.
