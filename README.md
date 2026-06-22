# 🤖 Javas Bot WA — WhatsApp Bot Lanjutan (TypeScript & Baileys SDK)

Javas Bot WA adalah bot WhatsApp multifungsi berbasis **Node.js, TypeScript, Baileys SDK, Prisma ORM, dan SQLite** sebagai sistem database lokal yang efisien. Bot ini dirancang agar siap pakai untuk grup WhatsApp dengan fitur lengkap: stiker, media/audio, dokumen, game interaktif, ekonomi virtual, komunitas sekolah, bisnis & keuangan, otomasi, privasi data, webhook, dan moderasi cerdas dengan kontrol penuh Owner melalui plugin manager dan CLI Admin Dashboard.

---

## 🌟 Prinsip Desain Utama

1. **Silent by Default (Senyap Secara Default)**
   - Saat bot ditambahkan ke grup, bot **tidak** mengirimkan sapaan otomatis. Bot hanya merespons command valid dari pengguna yang berhak.
2. **Modular & Aman**
   - File sementara yang diunduh disimpan di direktori `temp` dan dibersihkan otomatis dalam ≤15 menit.
3. **Role-Based Permission Matrix**
   - Akses perintah dibatasi ketat berdasarkan hierarki peran: **Owner Bot → Admin Grup → Premium User → Warga Biasa**.
4. **Dynamic Feature Flags**
   - Seluruh fitur grup dinonaktifkan secara default dan dikendalikan real-time oleh admin dengan `/feature`.
5. **Global Plugin System**
   - Owner mengaktifkan/menonaktifkan paket fitur global (game, ekonomi, AI, dll.) lewat sistem plugin dinamis.
6. **Privacy by Design**
   - Mendukung Privacy Mode (strict/balanced/off), kebijakan retensi data, consent per-fitur, dan hak penghapusan data (GDPR-style).
7. **Asynchronous Lazy-Loading Registry (Phase 0 Optimization)**
   - Semua modul perintah bot di-load secara dinamis (lazy loading) menggunakan dynamic ESM `import()` saat pertama kali dieksekusi oleh pengguna. Eager static imports pada `app.ts` dibersihkan, menghemat runtime memory secara signifikan dan mempercepat startup bot menjadi instan.

---

## 🛠️ Langkah-Langkah Instalasi & Setup

### 1. Prasyarat (Prerequisites)
Pastikan telah terpasang:
- **Node.js** (Rekomendasi v20.x atau lebih baru)
- **npm** (Package manager default)
- **FFmpeg** (Wajib di system PATH untuk video, stiker bergerak, audio, reverse)

### 2. Kloning & Pemasangan Dependensi
```bash
npm install
```

### 3. Konfigurasi Lingkungan (`.env`)
Salin `.env.example` ke `.env` dan sesuaikan:
```env
# Mode bot: "baileys" (koneksi WA asli) atau "console" (simulasi terminal)
ADAPTER_MODE="baileys"

# Database URL untuk SQLite
DATABASE_URL="file:./dev.db"

# Nama folder sesi penyimpanan Baileys
WA_SESSION_NAME="wa-session"

# Nomor Owner bot (pisahkan koma, tanpa + dan tanpa JID suffix)
OWNER_IDS="6285338123425"
```

### 4. Setup Database & Prisma Migrations
```bash
npx prisma db push
```

### 5. Menjalankan Bot
```bash
npm run dev
```

### 6. CLI Admin Dashboard
```bash
npm run dashboard
```

### 7. Owner Web Dashboard (Opsional)
```env
DASHBOARD_ENABLED="true"
DASHBOARD_PORT="8787"
OWNER_DASHBOARD_PASSWORD="ganti-password-kuat"
```
Buka `http://localhost:8787`. Mencakup overview, groups, feature flags, plugins, premium users, subscriptions, queue monitor, usage stats, error logs, broadcast, backup/restore, dan settings.

### 8. Backup, Restore, Utility Offline & Diagnostik
```
/backup  /backupdb  /backupconfig  /listbackup  /restorebackup <id>
/exportconfig  /importconfig
/dbinfo  /checkdeps
```
Backup disimpan di `backups/`, tidak menyertakan `.env` atau session WA.

Diagnostik & Utility Dependencies:
- `/checkdeps`: Mengecek status instalasi semua dependensi sistem (FFmpeg, Poppler, Tesseract, OCR, STT, dll).
- `/dbinfo`: Menampilkan lokasi file database SQLite dan disk usage saat ini.

Utility non-paid AI & Offline System Dependencies:
- **FFmpeg & FFprobe**: Wajib untuk stiker video, GIF, reverse, watermark, dan konversi audio/video.
  - *Windows*: Unduh dari gyan.dev, ekstrak, dan tambahkan folder `bin` ke Path System Environment Variables.
  - *Linux*: `sudo apt install ffmpeg`
- **OCR (Tesseract)**: Wajib untuk pembacaan teks dari gambar (`/ocr`).
  - *Windows*: Unduh installer tesseract dari UB Mannheim, install, lalu set `TESSERACT_CMD` ke path instalasi (e.g. `C:\Program Files\Tesseract-OCR\tesseract.exe`) atau tambahkan ke PATH.
  - *Linux*: `sudo apt install tesseract-ocr`
- **Document (Poppler)**: Wajib untuk konversi PDF ke gambar (`/pdf2img`) dan ekstraksi teks PDF (`/pdftext`).
  - *Windows*: Unduh binary Poppler untuk Windows, ekstrak, dan tambahkan folder `bin` ke PATH.
  - *Linux*: `sudo apt install poppler-utils`
- **STT (Whisper/Vosk)**: Konversi voice note ke teks (`/transkrip`).
  - Konfigurasi `STT_COMMAND` ke wrapper script Python/executable Whisper atau Vosk Anda (e.g. `python scripts/whisper_stt.py`).
- **Translate**: Diterjemahkan secara bertingkat: LibreTranslate (`LIBRETRANSLATE_URL`), OpenAI/Compatible AI API (`AI_PROVIDER`), atau Kamus Lokal.


---

## 🏆 Daftar Lengkap Command Bot

### 🎨 Stiker

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/stiker` / `/s` | Ubah gambar/video menjadi stiker WebP | User |
| `/toimg` | Ubah stiker menjadi gambar PNG | User |
| `/brat <teks>` | Stiker brat estetik berlatar putih | User |
| `/brat classic <teks>` | Stiker brat gaya classic | User |
| `/quote <teks>` | Stiker kutipan bergaya gradient | User |
| `/removebg` / `/rbg` | Hapus background gambar | User |
| `/stikerbg` | Gambar tanpa background → stiker | User |
| `/circle` / `/bulat` | Gambar lingkaran → stiker | User |
| `/outline [white/black]` | Tambah outline pada stiker | User |
| `/meme <atas> \| <bawah>` | Overlay teks meme ke gambar | User |
| `/emojimix` / `/mix` 😂+😭 | Gabungkan dua emoji menjadi stiker | User |
| `/vstiker` / `/gifstiker` | Video/GIF → stiker bergerak | User |
| `/batchstiker` | Proses banyak gambar sekaligus | User |

### 📸 Media Tools

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/hd` / `/hd 2x` / `/hd 4x` | Upscale & sharpen gambar | User / Premium |
| `/compress [low/medium/high]` | Kompres gambar/video | User |
| `/resize [preset/WxH]` | Ubah resolusi gambar | User |
| `/crop [story/pp/square]` | Potong gambar dengan rasio preset | User |
| `/wm <teks>` | Sisipkan watermark teks ke gambar/video | User |
| `/togif` | Konversi video ke GIF | User |
| `/thumb [time]` | Ambil thumbnail video | User |
| `/cut [start-end]` | Potong durasi video | User |
| `/subtitle` | Tambah subtitle otomatis ke video | Premium |
| `/mute` | Hapus audio dari video | User |
| `/reverse` | Putar balik video beserta audio | User |

### 🎵 Audio Tools

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/mp3` / `/audio` | Ekstrak audio dari video → MP3 | User |
| `/transkrip` / `/vntext` | Konversi voice note ke teks | User |
| `/tts <teks>` | Teks → file audio (Google TTS) | User |
| `/voice [robot/chipmunk/deep]` | Efek modulasi suara | User |
| `/cutaudio [start-end]` | Potong durasi audio | User |
| `/speed [rate]` / `/slow [rate]` | Ubah kecepatan audio | User |

### 💬 Text & AI

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/ocr` | Ekstrak teks dari gambar (OCR) | User |
| `/translate [lang]` / `/tr` | Terjemahkan teks ke bahasa tujuan | User |
| `/ringkas` / `/summarize` | Ringkas teks panjang | User |
| `/ubah [formal/santai/lucu/...]` | Tulis ulang gaya bahasa | User |
| `/typo` / `/koreksi` | Koreksi kesalahan penulisan | User |
| `/balas [santai/formal/lucu]` | Balasan otomatis berbasis AI | User |
| `/jelaskan <topik>` | Penjelasan topik pelajaran | User |
| `/quiz [sekolah/umum/anime]` | Kuis interaktif belajar mandiri | User |
| `/ai <pertanyaan>` | Chat langsung dengan AI provider | User |
| `/setai <provider>` | Set AI provider grup (owner/admin) | Admin |

### 📄 Dokumen & PDF

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/img2pdf` | Gabungkan gambar menjadi PDF | User |
| `/pdf2img` | Ekstrak halaman PDF spesifik ke gambar (contoh: `/pdf2img 3`) | User |
| `/mergepdf` | Gabungkan beberapa PDF (Multi-step session) | User |
| `/compresspdf` | Optimalkan (Optimize) ukuran PDF | User |
| `/pdftext` | Ekstrak teks dari PDF (Poppler) | User |
| `/pdfwatermark` | Tambah teks watermark ke PDF (max 30 karakter) | User |
| `/scan` | Simulasi scan dokumen | User |
| `/unzip` | Ekstrak ZIP/RAR dengan aman (Proteksi ZIP Bomb) | User |
| `/qr <teks/url>` | Buat QR Code dari teks/link | User |
| `/readqr` | Baca isi QR Code dari gambar | User |
| `/linkscan <url>` | Scan keamanan URL/link (SSRF-safe) | User |

### 👥 Grup & Moderasi

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/setup` | Cek status fitur grup | Admin |
| `/statusfitur` | Detail status feature flags | Admin |
| `/fiturstatus` | Tampilkan prefix, plan sewa, sisa kuota, dan status fitur | User / Admin |
| `/feature <nama> <on/off>` | Toggle fitur grup | Admin |
| `/bot [on/off]` | Aktifkan/nonaktifkan bot di grup | Admin |
| `/setprefix <prefix>` | Ubah prefix command | Admin |
| `/setcooldown <fitur> <detik>` | Atur rate limit fitur | Admin |
| `/warn @user <alasan>` | Beri warning ke member | Admin |
| `/warnings @user` | Cek warning member | Admin |
| `/unwarn` / `/clearwarn` | Kurangi / bersihkan warning | Admin |
| `/addbadword <kata>` | Tambah kata toxic ke filter | Admin |
| `/delbadword <kata>` | Hapus kata dari filter | Admin |
| `/listbadword` | Tampilkan daftar kata diblokir | Admin |
| `/blacklist @user` | Cekal user dari interaksi bot | Admin |
| `/unblacklist @user` | Hapus dari daftar cekal | Admin |
| `/listblacklist` | Tampilkan daftar hitam | Admin |
| `/kick @user` | Keluarkan member | Admin |
| `/mute @user [durasi]` | Mute member sementara | Admin |
| `/unmute @user` | Buka mute member | Admin |
| `/grouplog` | Lihat log aktivitas grup | Admin |
| `/warningrule set <N> <action>` | Atur aksi otomatis saat N warning | Admin |
| `/repair group` | Atur ulang (reset) setelan grup ke default bawaan bot | Admin |

### 🏫 Komunitas & Sekolah

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/schoolmode [on/off]` | Aktifkan mode sekolah | Admin |
| `/tugasadd <deskripsi> [deadline]` | Tambah tugas/PR | Admin |
| `/tugaslist` | Daftar tugas aktif | User |
| `/tugasdone <id>` | Tandai tugas selesai | Admin |
| `/absen [buka/list/tutup]` | Kelola absensi kehadiran | Admin |
| `/jadwal [add/lihat/hapus]` | Kelola jadwal pelajaran/kegiatan | Admin |
| `/ulang [add/list]` | Daftar ulang tahun anggota | User |
| `/stats` | Statistik aktivitas grup | Admin |
| `/topaktif` | Peringkat member paling aktif | User |
| `/profil [@user]` | Kartu profil & reputasi member | User |
| `/reputasi [@user]` | Skor reputasi & trust level | User |
| `/note [add/list/get/delete]` | Catatan grup / FAQ | Admin |
| `/wiki [add/get/list]` | Wiki konten grup | Admin |
| `/misi` | Daftar misi harian aktif | User |
| `/claimdaily` | Klaim reward misi harian | User |

### 💼 Bisnis & Jual-Beli

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/jual <harga> <deskripsi>` | Pasang iklan jual produk/jasa | User |
| `/beli <id>` | Ekspresikan minat beli produk | User |
| `/listproduk` | Daftar produk aktif di grup | User |
| `/hapusproduk <id>` | Hapus iklan produk sendiri | User |
| `/order add @user <deskripsi>\|<harga>` | Catat pesanan baru | Admin |
| `/order status` | Lihat status pesanan | User |
| `/customer add @user` | Daftarkan customer di CRM | Admin |
| `/escrow create @seller @buyer <jumlah>` | Buat rekening bersama (simulasi) | User |
| `/escrow paid <id>` | Konfirmasi pembayaran escrow | User |
| `/escrow release <id>` | Lepaskan dana escrow | Admin |
| `/kontrak [jualbeli/jasa/sewa]` | Draf template kontrak | User |

### 💰 Keuangan Grup

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/kas saldo` | Cek saldo kas grup | User |
| `/kas masuk <jumlah> [@user]` | Catat pemasukan kas | Admin |
| `/kas keluar <jumlah> <keterangan>` | Catat pengeluaran kas | Admin |
| `/kas laporan` | Laporan kas periode terakhir | User |
| `/kas export` | Export laporan kas ke file | Admin |
| `/split <nominal> @user1 @user2` | Buat split bill rata | User |
| `/splitstatus` | Status pembayaran split bill | User |
| `/splitdone @user` | Tandai bagian lunas | Admin |
| `/tagihan add @user <ket>\|<nominal>` | Buat tagihan iuran ke member | Admin |
| `/tagihan list` | Daftar tagihan aktif | User |
| `/tagihan done <id>` | Tandai tagihan lunas | Admin |
| `/tagihan remind` | Kirim pengingat tagihan belum lunas | Admin |
| `/arisan [join/list/undi]` | Kelola arisan kelompok | User |
| `/catat <nominal> [kategori]` | Catat pengeluaran pribadi | User |
| `/pengeluaran [hariini/bulanini]` | Ringkasan pengeluaran pribadi | User |
| `/budget [add/status]` | Atur & pantau budget bulanan | User |

### 🤖 Otomasi & Workflow

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/var set <nama> <nilai>` | Set variabel kustom grup | Admin |
| `/var get <nama>` | Ambil nilai variabel | User |
| `/var list` | Daftar variabel tersimpan | User |
| `/var delete <nama>` | Hapus variabel | Admin |
| `/auto when <trigger> <action>` | Buat aturan otomasi | Admin |
| `/auto list` | Daftar otomasi aktif | Admin |
| `/auto delete <id>` | Hapus otomasi | Admin |
| `/workflow create <nama>` | Buat workflow multi-langkah | Admin |
| `/workflow list` | Daftar workflow terdaftar | Admin |
| `/workflow delete <nama>` | Hapus workflow | Admin |
| `/rule tambah <aturan>` | Tambah smart rule | Admin |
| `/rule list` | Daftar smart rules | User |
| `/rule delete <id>` | Hapus smart rule | Admin |

### 🔒 Privasi & Data

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/privacymode [strict/balanced/off]` | Atur mode privasi grup | Admin |
| `/retention <scope> <durasi>` | Kebijakan retensi data | Admin |
| `/cleandb [logs/temp/usage] [durasi]` | Bersihkan data lama dari DB | Owner |
| `/mydata` | Lihat data personal tersimpan | User |
| `/deletemydata [konfirmasi]` | Hapus data personal (GDPR) | User |
| `/consent [ai/autosummary/analytics] [on/off]` | Atur consent fitur | User |
| `/generaterules [sekolah/jualbeli/komunitas]` | Generate peraturan dari template | Admin |
| `/rules [edit/version/rollback]` | Kelola versi peraturan grup | Admin |
| `/ruleslog` | Log persetujuan anggota | Admin |
| `/setuju` | Setujui peraturan grup | User |

### 📢 Pengumuman

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/announce <pesan>` | Buat pengumuman resmi bergaya format | Admin |
| `/announcements` | Daftar 10 pengumuman terakhir | User |
| `/announcement <id>` | Detail satu pengumuman | User |

### 🔗 Webhook

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/webhook set <url>` | Daftarkan URL webhook (SSRF-protected) | Owner/Admin |
| `/webhook test` | Kirim test event ke webhook | Owner/Admin |
| `/webhook off` | Nonaktifkan webhook | Owner/Admin |
| `/webhook list` | Lihat webhook terdaftar | Owner/Admin |

### 🎮 Games & Economy

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/tod` / `/truth` / `/dare` | Truth or Dare | User |
| `/tebakkata` | Tebak kata berhadiah XP | User |
| `/suit @user` | Batu Gunting Kertas PvP | User |
| `/ttt @user` | Tic-Tac-Toe multiplayer | User |
| `/slot` | Slot machine virtual | User |
| `/math` | Game matematika cepat | User |
| `/family100` | Kuis survey Family 100 | User |
| `/couple` / `/jodoh` | Cek kecocokan antar member | User |
| `/ww [create/join/start/stop/poison/heal/infect]` | Werewolf game (Witch, Black Wolf, Jester/Fool, night actions, and RPG economy rewards) | User |
| `/balance` / `/bal` | Cek saldo & level | User |
| `/claim` / `/daily` | Klaim bonus harian | User |
| `/transfer @user <jumlah>` | Transfer saldo virtual | User |
| `/rank` | Level Card & XP | User |
| `/top` / `/leaderboard` | Top 10 kekayaan | User |
| `/shop` / `/buy <item>` | Toko item virtual | User |
| `/inventory` / `/inv` | Isi tas item | User |
| `/pet [adopt/feed/status/battle]` | Adopsi & rawat hewan peliharaan | User |
| `/dungeon` | Petualangan RPG turn-based | User |
| `/misi` | Misi harian | User |

### 💎 Premium & Sewa

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/sewa [info/status]` | Info & status sewa bot | User |
| `/premium [info/cek]` | Cek status premium | User |
| `/quota` | Cek sisa kuota harian | User |
| `/coupon <kode>` | Redeem kode kupon | User |
| `/referral [kode/stats]` | Kelola kode referral | User |
| `/reseller [daftar/dashboard/saldo]` | Dashboard reseller | Reseller |

### 🛡️ Owner Tools

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/maintenance [on/off]` | Mode pemeliharaan global | Owner |
| `/premium add/remove @user` | Kelola status premium user | Owner |
| `/cekpremium @user` | Cek status, sisa durasi, dan detail premium user | Owner |
| `/listpremium` | Tampilkan daftar seluruh user premium aktif | Owner |
| `/fixpremiumids` | Normalisasi data database premium ke JID format canonical | Owner |
| `/dbinfo` | Tampilkan path database SQLite dan ukuran file disk | Owner |
| `/checkdeps` | Cek status instalasi seluruh system dependencies (ffmpeg, poppler, tesseract, ocr, stt, dll) | Owner |
| `/broadcast <pesan>` | Siarkan pesan ke seluruh grup | Owner |
| `/stats` | Statistik server, queue, error | Owner |
| `/errorlog` | Log error terbaru | Owner |
| `/plugin [list/on/off]` | Manajemen plugin global | Owner |
| `/setquota <grup> <limit>` | Set kuota command harian grup | Owner |
| `/setplan <grup> <plan>` | Ubah plan langganan grup | Owner |
| `/addcoupon <kode> <durasi>` | Buat kode kupon premium | Owner |
| `/addreseller @user` | Tambah akun reseller | Owner |
| `/queue` / `/canceljob` | Monitor & batalkan antrian | Owner |
| `/backup` / `/listbackup` | Backup & restore data | Owner |
| `/cleandb [logs/temp/usage]` | Bersihkan data lama dari DB | Owner |
| `/apikey` / `/revokeapikey` | Kelola API key | Owner |
| `/alias set <alias> <command>` | Buat alias command di grup | Admin |

---

### 🧠 AI Lanjutan & Multimodal *(Dynamic AI Module)*

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/draw <prompt>` | Generasi gambar AI (Stable Diffusion / Flux) | Premium |
| `/setpersona <gaya>` | Ubah persona AI bot (formal/santai/anime/lucu/tsundere) | Admin |
| `/resetpersona` | Reset persona AI ke default | Admin |
| `/solve <soal>` | Solver matematika step-by-step berbasis AI | User |
| `/cekcv` | Evaluasi CV / resume dengan AI | Premium |
| `/buatcv` | Generate template CV berbasis prompt | Premium |
| `/pitchdeck` | Buat outline pitch deck bisnis | Premium |
| `/debat <topik>` | AI argumen dua sisi topik | User |
| `/roast @user` | AI roasting lucu (mode fun) | User |
| `/pujian @user` | AI pujian kreatif | User |
| `/ceritapendek <tema>` | Generate cerita pendek | User |
| `/puisi <tema>` | Generate puisi | User |
| `/lirik <judul>` | Generate lirik lagu | User |
| `/skenario <genre>` | Generate skenario film/drama | Premium |
| `/chatmulti <topik>` | Multi-turn AI conversation dalam grup | Premium |
| `/fakta <topik>` | AI facts generator | User |
| `/brainstorm <topik>` | AI brainstorm ideas | User |
| `/analisa <teks>` | Analisa sentimen & tone teks | User |
| `/bagusintulis` | Perbaiki tulisan yang kurang rapi | User |
| `/parafrase` | Parafrase teks dengan gaya berbeda | User |
| `/countword` | Hitung kata & karakter dalam teks | User |
| `/emailpro` | Buat email profesional dari poin-poin | Premium |
| `/proposalai` | Generate proposal usaha dari prompt | Premium |
| `/setaimodel <model>` | Set model AI yang digunakan bot | Owner |
| `/aiusage` | Statistik penggunaan AI di grup | Admin |
| `/limitai <limit>` | Set limit request AI per hari per user | Admin |

### 🎨 Stiker Kreatif *(Dynamic AI Module)*

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/sfilter <efek>` | Filter stiker (vintage/grayscale/neon/blur/oil/sketch) | User |
| `/sanim <arah>` | Animasi stiker (shake/bounce/spin/flip) | User |
| `/sframe <bingkai>` | Tambah bingkai dekoratif ke stiker | User |
| `/sbubble <teks>` | Stiker speech bubble kustom | User |
| `/scomic <teks>` | Stiker gaya komik dengan teks | User |
| `/sglitch` | Efek glitch pixel pada stiker | User |
| `/scolor <warna>` | Recolor stiker dengan palette kustom | User |
| `/scollage` | Gabungkan beberapa stiker menjadi satu | User |
| `/smirror` | Stiker efek cermin | User |
| `/shollow` | Efek hollow/outline pada stiker | User |
| `/sstamp <teks>` | Tambah cap/stamp teks ke stiker | User |
| `/sminecraft` | Konversi gambar ke pixel-art gaya Minecraft | User |
| `/slego` | Konversi gambar ke pixel-art LEGO | User |
| `/swatercolor` | Efek cat air pada gambar/stiker | Premium |
| `/sai <prompt>` | Generate stiker berbasis prompt AI | Premium |

### 🛡️ Keamanan Lanjutan *(Dynamic Security Module)*

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/join-captcha [on/off]` | CAPTCHA matematika untuk member baru | Admin |
| `/linkdecode <url>` | Decode URL shortener & cek keamanan | User |
| `/lockdown` | Kunci total grup (hanya admin bisa chat) | Admin |
| `/unlockdown` | Buka lockdown grup | Admin |
| `/shadowban @user` | Ban tersembunyi tanpa notifikasi | Admin |
| `/unshadowban @user` | Hapus shadow ban | Admin |
| `/slowmode <detik>` | Atur jeda minimum antar pesan user | Admin |
| `/antiscam [on/off]` | Deteksi otomatis pola pesan scam | Admin |
| `/antiflood <limit> <detik>` | Batas maksimum pesan per interval | Admin |
| `/trustscore @user` | Tampilkan skor kepercayaan member | Admin |
| `/cloneguard [on/off]` | Deteksi & blokir akun kloning | Admin |
| `/tempban @user <menit>` | Ban sementara dengan auto-unban | Admin |
| `/antihoax [on/off]` | Filter konten hoax & disinformasi | Admin |
| `/raidprotect [on/off]` | Proteksi anti-raid otomatis | Admin |
| `/verifikasi @user` | Verifikasi manual identitas member | Admin |
| `/muteall` | Mute semua member kecuali admin | Admin |
| `/unmuteall` | Unmute semua member | Admin |
| `/antivirus [on/off]` | Scan link & file berbahaya otomatis | Admin |
| `/resensi @user` | Riwayat pelanggaran & perilaku member | Admin |
| `/logexport` | Export log grup ke file teks | Admin |

### 🎮 RPG & Games Lanjutan *(Dynamic Games Module)*

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/mancing` | Simulator mancing laut dalam (simpan ke DB) | User |
| `/jual-ikan` | Jual hasil tangkapan ikan ke pasar | User |
| `/raid <bos>` | Multiplayer boss raid (tim vs bos) | User |
| `/petbreed` | Kawinkan dua pet untuk menghasilkan keturunan | User |
| `/petevolve` | Evolusi pet ke tier lebih tinggi | User |
| `/gachacard` | Gacha kartu koleksi dengan rarity system | User |
| `/tradingcard` | Jual/beli kartu koleksi antar user | User |
| `/blackjack <taruhan>` | Blackjack versus dealer AI | User |
| `/roulette <taruhan> <pilihan>` | Roulette kasino virtual | User |
| `/poker` | Texas Hold'em Poker multiplayer | User |
| `/dadu <taruhan>` | Permainan dadu dengan taruhan | User |
| `/kotak-misteri` | Buka kotak misteri berhadiah acak | User |
| `/saham <beli/jual> <saham> <jumlah>` | Simulasi saham & investasi virtual | User |
| `/crypto <beli/jual> <koin>` | Simulasi trading crypto virtual | User |
| `/tambang` | Mining cryptocurrency virtual | User |
| `/ladang` | Berkebun virtual & panen produk | User |
| `/masak <resep>` | Mini-game memasak | User |
| `/guild [buat/gabung/keluar/info]` | Sistem guild/klan pemain | User |
| `/guild-war` | Perang antar guild | User |
| `/turnamen` | Daftar & ikut turnamen mingguan | User |
| `/achievement` | Lihat daftar pencapaian & badge | User |
| `/leaderboard-global` | Papan skor global seluruh server | User |
| `/craft <item>` | Crafting item dari bahan-bahan | User |
| `/map-dungeon` | Eksplorasi peta dungeon interaktif | User |
| `/bosslist` | Daftar bos aktif yang bisa di-raid | User |
| `/karyawan [rekrut/pecat/gaji]` | Kelola karyawan virtual bisnis | User |
| `/properti [beli/sewa/jual]` | Investasi properti virtual | User |

### 💼 Utility & Produktivitas *(Dynamic Utility Module)*

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/pdfmerge` | Gabungkan beberapa PDF menjadi satu | User |
| `/pdfsplit <halaman>` | Pisahkan halaman spesifik dari PDF | User |
| `/ocrtranslate [lang]` | OCR gambar lalu terjemahkan hasilnya | User |
| `/vntext` | Transkripsi voice note ke teks | User |
| `/zipfile` | Kompres file menjadi arsip ZIP | User |
| `/unzipfile` | Ekstrak arsip ZIP | User |
| `/konversi <nilai> <dari> <ke>` | Konversi satuan (panjang/berat/suhu/mata uang) | User |
| `/kalkulator <ekspresi>` | Kalkulator saintifik | User |
| `/kalkulatorgizi` | Hitung kebutuhan kalori & gizi harian | User |
| `/bmi <tinggi> <berat>` | Hitung Body Mass Index | User |
| `/todo [add/done/list/clear]` | Daftar tugas personal (to-do list) | User |
| `/reminder <waktu> <pesan>` | Atur pengingat personal | User |
| `/timer <menit>` | Countdown timer di grup | User |
| `/polling <pertanyaan> | <opsi1> | <opsi2>` | Buat polling interaktif | Admin |
| `/formlink <url>` | Bagikan link form Google/Typeform | Admin |
| `/encryptteks` | Enkripsi teks dengan password | User |
| `/decryptteks` | Dekripsi teks terenkripsi | User |
| `/passwordgen <panjang>` | Generator password kuat | User |
| `/uuid` | Generate UUID/GUID unik | User |
| `/ipinfo <ip>` | Informasi & geolokasi IP address | User |
| `/dns <domain>` | Cek DNS record domain | User |
| `/whois <domain>` | WHOIS lookup domain | User |
| `/base64 <encode/decode>` | Encode/decode Base64 | User |
| `/hash <teks>` | Generate hash MD5/SHA256 teks | User |
| `/shortlink <url>` | Persingkat URL panjang | User |
| `/calender` | Tampilkan kalender bulan ini | User |
| `/daysleft <tanggal>` | Hitung sisa hari menuju tanggal | User |
| `/zodiak <tanggal-lahir>` | Info zodiak & ramalan | User |
| `/wm-pos <posisi>` | Watermark video dengan posisi kustom (5 opsi: tl/tr/bl/br/center) | User |

### 📊 Analitik Grup *(Dynamic Utility Module)*

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/wordcloud` | Visualisasi awan kata dari obrolan grup | Admin |
| `/heatmap` | Peta panas aktivitas chat per jam | Admin |
| `/trendtopik` | Topik yang paling banyak dibahas | Admin |
| `/aktivitas` | Grafik aktivitas chat harian/mingguan | Admin |
| `/sentimengrup` | Analisa sentimen positif/negatif grup | Admin |
| `/topstiker` | Stiker paling sering digunakan | Admin |
| `/topreaksi` | Emoji/reaksi paling populer | Admin |
| `/toplink` | Link paling sering dibagikan | Admin |
| `/waktuaktif` | Jam tersibuk grup dalam seminggu | Admin |
| `/retensi` | Statistik retensi member per bulan | Admin |
| `/pertumbuhangrup` | Grafik pertumbuhan anggota | Admin |
| `/exportstats` | Export statistik grup ke file CSV | Admin |

### 🎵 Audio Suite Lanjutan *(Dynamic Integration Module)*

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/shazam` | Identifikasi lagu dari file audio/VN | User |
| `/lyric <judul> <artis>` | Cari lirik lagu | User |
| `/pitch <semitone>` | Ubah pitch audio tanpa mengubah tempo | User |
| `/tempo <bpm>` | Ubah tempo audio | User |
| `/equalizer <preset>` | Preset EQ (bass boost/treble/flat) | User |
| `/noisereduce` | Kurangi noise dari audio | Premium |
| `/vocal-isolate` | Pisahkan vokal dari instrumen (AI Stem) | Premium |
| `/audioconv <format>` | Konversi format audio (mp3/ogg/wav/flac) | User |
| `/audiomerge` | Gabungkan beberapa file audio | User |
| `/audiomix` | Mix dua audio secara overlay | User |
| `/audioloop <kali>` | Loop audio sebanyak N kali | User |
| `/radikal` | Rekam audio & efek heavy distortion | User |

### 📚 Edukasi & Layanan Publik *(Dynamic Integration Module)*

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/sholat <kota>` | Jadwal waktu sholat harian per kota | User |
| `/hijriyah` | Konversi tanggal Masehi ↔ Hijriyah | User |
| `/doa <nama>` | Doa harian dari database doa Islam | User |
| `/quran <surah>:<ayat>` | Tampilkan ayat Al-Quran + terjemahan | User |
| `/hadis <topik>` | Cari hadis berdasarkan topik | User |
| `/kbbi <kata>` | Cari definisi kata di KBBI | User |
| `/sinonim <kata>` | Cari sinonim & antonim | User |
| `/ejaan <kata>` | Cek ejaan bahasa Indonesia | User |
| `/proverb` | Peribahasa acak + artinya | User |
| `/ensiklopedia <topik>` | Ringkasan Wikipedia | User |
| `/berita [kategori]` | Berita terkini Indonesia | User |
| `/bmkg [kota]` | Info cuaca & peringatan BMKG | User |
| `/gempa` | Info gempa terbaru dari BMKG | User |
| `/kurs <mata-uang>` | Kurs mata uang real-time | User |
| `/harga-bbm` | Harga BBM terbaru | User |
| `/cekpajak <nopol>` | Cek pajak kendaraan bermotor | User |
| `/cekresi <nomor>` | Lacak paket pengiriman (JNE/J&T/SiCepat) | User |
| `/cekbpjs <nomor>` | Cek status keaktifan BPJS | User |
| `/pln <id-pel>` | Cek tagihan & token PLN | User |
| `/covid` | Statistik COVID-19 terkini | User |
| `/kalkpph` | Kalkulator PPh 21 (pajak penghasilan) | User |

### 🔗 Integrasi API Eksternal *(Dynamic Integration Module)*

| Command | Deskripsi | Peran |
|:--------|:----------|:------|
| `/github <user>` | Profil & repositori GitHub user | User |
| `/github-repo <user/repo>` | Detail repo GitHub + commit terbaru | User |
| `/npm <package>` | Info package NPM | User |
| `/pypi <package>` | Info package PyPI (Python) | User |
| `/stackoverflow <query>` | Cari jawaban di Stack Overflow | User |
| `/cuaca <kota>` | Cuaca real-time dari OpenWeatherMap | User |
| `/gempa-dunia` | Data gempa global dari USGS | User |
| `/covid-dunia <negara>` | Statistik COVID negara tertentu | User |
| `/kalkgizi <makanan>` | Cek nilai gizi makanan dari database | User |
| `/vaksin` | Jadwal & lokasi vaksinasi terdekat | User |
| `/shopee <query>` | Cari & monitor harga di Shopee | User |
| `/tokopedia <query>` | Cari produk di Tokopedia | User |
| `/lazada <query>` | Cari produk di Lazada | User |
| `/hargaemas` | Harga emas Antam real-time | User |
| `/bursaefek` | Indeks saham BEI terkini | User |
| `/jktproperty <area>` | Cek harga properti Jakarta | User |
| `/translate-api <lang>` | Terjemahkan via Google Translate API | User |
| `/detect-lang` | Deteksi bahasa teks otomatis | User |
| `/timezone <kota>` | Waktu terkini di kota manapun | User |
| `/country <nama>` | Info lengkap negara (peta, mata uang, bahasa) | User |
| `/movie <judul>` | Info film dari IMDb/OMDB | User |
| `/anime <judul>` | Info anime dari MyAnimeList | User |
| `/manga <judul>` | Info manga dari MangaDex | User |
| `/spotify-song <judul>` | Cari lagu di Spotify | User |
| `/youtube <query>` | Cari video di YouTube | User |

---

## ⚙️ Feature Flags Grup

Gunakan `/feature <nama> <on/off>` untuk mengaktifkan/menonaktifkan:

| Flag | Deskripsi |
|:-----|:----------|
| `welcome` | Pesan sambutan saat member baru masuk |
| `goodbye` | Pesan perpisahan saat member keluar |
| `antilink` | Blokir tautan luar (kecuali whitelist) |
| `leveling` | XP & naik level dari chat grup |
| `economy` | Sistem uang virtual grup |
| `cleancmd` | Hapus pesan command otomatis setelah dibalas |
| `antispam` | Anti-spam dan anti-flood otomatis |
| `badword` | Filter kata toxic otomatis |
| `schoolmode` | Mode sekolah (jadwal, tugas, absen) |
| `business` | Fitur jual-beli di grup |
| `finance` | Fitur kas dan keuangan grup |

---

## 🧪 Pengujian Sistem (Testing)

```bash
npm run test
```

Test suite (Vitest) mencakup:
- Role-Based Permissions & isOwner
- Rate limiter & antrian
- Level-up, claim ekonomi, XP
- Regex validasi URL downloader
- Dynamic feature flags di SQLite
- Plugin state toggle & API key hashing
- Privacy Mode, Data Retention, Consent
- Webhook SSRF protection
- Automation Builder, Workflow, Smart Rules
- Bisnis, Keuangan, Reseller
- Coupon, Quota, Subscription
- Dynamic Unified Routers (AI, Security, Games, Utility, Integration)
- Watermark video dengan 5 pilihan posisi overlay

**Total: 227 tests passing (31 test files)**

---

## 🗂️ Arsitektur Database (Prisma)

Model utama yang digunakan:
- `GroupConfig` — Konfigurasi prefix & feature flags per grup
- `UserProfile` — Profil, premium, bahasa, gelar
- `UserEconomy` — Saldo, bank, XP, level
- `GroupSubscription` — Plan sewa & kuota command
- `CustomVariable` — Key-value store fleksibel untuk otomasi, workflow, kas, variabel
- `DataRetentionPolicy` — Kebijakan retensi data per scope
- `Webhook` — URL webhook terdaftar per grup
- `AuditLog` — Log aksi admin & owner
- `PrdStateRecord` — Pengumuman, form, dan state fitur produktivitas
- `WarningRule` — Aturan threshold warning otomatis
- Dan 30+ model lainnya...

---

## PRD Stabilization Layer

Lapisan command coverage aman dari `prd.md`:
- Command belum punya handler khusus otomatis terdaftar dengan fallback aman
- State fitur disimpan di database, bukan source code
- Error user-facing memakai Error ID terenkripsi
- Metadata log di-masking untuk data sensitif

```bash
npm run typecheck   # Validasi TypeScript
npm run test        # Jalankan test suite
npm run build       # Build production
npm run db:push     # Sinkronkan schema database
npm run db:studio   # Buka Prisma Studio
```

Dashboard web: login rate limit, session TTL, cookie `HttpOnly`, CSRF token, host binding via `DASHBOARD_HOST`, health endpoint, API internal opsional dengan `DASHBOARD_API_ENABLED=true`.

